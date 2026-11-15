"""SPHEREx data access + view building.

Pipeline for one view (RA, Dec, field of view):
  1. TAP query IRSA for every SPHEREx spectral image covering the position.
  2. Group exposures into epochs (survey visits) and pick a balanced subset per epoch.
  3. Download small cutouts in parallel (disk-cached, retried).
  4. Subtract the zodiacal-light model, mask bad pixels, resample onto one common
     sky grid centred on the target.
  5. Stack per epoch and per detector, convert to S/N, and build a broadband image.
"""
from __future__ import annotations

import base64
import concurrent.futures as cf
import datetime as dt
import hashlib
import io
import json
import logging
import random
import threading
import time
import warnings
from collections import OrderedDict

import numpy as np
import requests

from . import config, imaging

log = logging.getLogger("spherex")
warnings.filterwarnings("ignore")


def _quiet_astropy():
    # NB: never create logging.getLogger("astropy") before astropy is imported:
    # astropy installs its own logger class and crashes if a plain one exists.
    from astropy import log as alog
    alog.setLevel("ERROR")

MJD0 = dt.datetime(1858, 11, 17)


def mjd_to_iso(mjd):
    return (MJD0 + dt.timedelta(days=float(mjd))).strftime("%Y-%m-%d")


def b64f32(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype="<f4").tobytes()).decode("ascii")


# ====================================================================== query
_query_cache: dict = {}


def query_images(ra, dec):
    """All SPHEREx spectral images covering (ra, dec). Returns list of dicts."""
    key = (round(ra, 5), round(dec, 5))
    if key in _query_cache:
        return _query_cache[key]
    disk = config.VIEW_DIR / f"rows_{key[0]:.5f}_{key[1]:.5f}.json"
    if disk.exists():                      # remembered from an earlier query: no archive needed
        rows = json.loads(disk.read_text())
        _query_cache[key] = rows
        return rows
    _quiet_astropy()
    from astroquery.ipac.irsa import Irsa

    q = config.TAP_QUERY.format(ra=ra, dec=dec)
    t, last = None, None
    for attempt in range(2):               # IRSA sometimes drops the connection when busy
        # run with a hard time limit: a dead connection must not hang the app
        ex = cf.ThreadPoolExecutor(max_workers=1)
        fut = ex.submit(lambda: Irsa.query_tap(q).to_table())
        try:
            t = fut.result(timeout=45)
            break
        except Exception as e:  # noqa: BLE001  (includes TimeoutError)
            last = e if str(e) else TimeoutError("no answer within 45 s")
        finally:
            ex.shutdown(wait=False)
    if t is None:
        rows = local_rows(ra, dec)
        if rows:
            log.warning("IRSA unavailable (%s): using %d images already on disk", last, len(rows))
            _query_cache[key] = rows
            return rows
        raise RuntimeError(f"NASA's archive (IRSA) is not responding right now, and no images of this spot are saved yet: {last}")
    rows, seen = [], set()
    for r in t:
        band = str(r["energy_bandpassname"])
        det = band.split("-")[-1] if "-" in band else band
        mjd = float(r["time_bounds_lower"])
        k = (round(mjd, 5), det)
        uri = str(r["uri"])
        if k in seen or uri in seen:      # same exposure in two releases
            continue
        seen.add(k)
        seen.add(uri)
        rows.append({"uri": uri.lstrip("/"), "mjd": mjd, "det": det})
    _query_cache[key] = rows
    try:
        disk.write_text(json.dumps(rows))
    except Exception:  # noqa: BLE001
        pass
    return rows


# ====================================================================== offline index
def _local_index():
    """Header summary of every cutout already on disk: date, camera and sky footprint.
    Lets a view be rebuilt with no archive at all. Cached in cache/views/local_index.json."""
    from astropy.io import fits
    from astropy.wcs import WCS

    _quiet_astropy()
    idx_path = config.VIEW_DIR / "local_index.json"
    try:
        idx = json.loads(idx_path.read_text())
    except Exception:  # noqa: BLE001
        idx = {}
    changed = False
    for f in config.CUTOUT_DIR.glob("*.fits"):
        if f.name in idx:
            continue
        try:
            h = fits.getheader(f, "IMAGE")
            w = WCS(h)
            ny, nx = int(h["NAXIS2"]), int(h["NAXIS1"])
            corners = w.pixel_to_world_values([0, nx - 1, nx - 1, 0], [0, 0, ny - 1, ny - 1])
            idx[f.name] = {"mjd": float(h.get("MJD-OBS") or h.get("MJD-AVG")), "det": f"D{h.get('DETECTOR', '?')}",
                           "ra": [float(x) for x in corners[0]], "dec": [float(x) for x in corners[1]]}
        except Exception:  # noqa: BLE001
            idx[f.name] = None
        changed = True
    if changed:
        try:
            idx_path.write_text(json.dumps(idx))
        except Exception:  # noqa: BLE001
            pass
    return idx


def local_rows(ra, dec):
    """Cutouts on disk whose footprint contains (ra, dec), as query rows."""
    rows, seen = [], set()
    for name, e in _local_index().items():
        if not e:
            continue
        dra = [((a - ra + 180) % 360 - 180) * np.cos(np.radians(dec)) for a in e["ra"]]
        ddec = [b - dec for b in e["dec"]]
        margin = 6 / 3600.0
        if min(dra) > -margin or max(dra) < margin or min(ddec) > -margin or max(ddec) < margin:
            continue
        k = (round(e["mjd"], 5), e["det"])
        if k in seen:
            continue
        seen.add(k)
        rows.append({"uri": None, "path": str(config.CUTOUT_DIR / name), "mjd": e["mjd"], "det": e["det"]})
    rows.sort(key=lambda r: r["mjd"])
    return rows


# ====================================================================== download
_session = requests.Session()
_session.mount("https://", requests.adapters.HTTPAdapter(pool_connections=8, pool_maxsize=8))

def cutout_url(uri, ra, dec, size_deg):
    return f"{config.IRSA_BASE}{uri}?center={ra:.7f},{dec:.7f}d&size={size_deg:.5f}"


_dl = {"fails": 0, "deadline": float("inf")}
DOWNLOAD_BUDGET_S = 150        # stop starting new downloads after this long
MAX_CONSECUTIVE_FAILS = 8      # archive clearly down: stop trying for this view


def fetch(url):
    """Download to the disk cache with retries; return the local path."""
    h = hashlib.sha1(url.encode()).hexdigest()
    path = config.CUTOUT_DIR / f"{h}.fits"
    if path.exists() and path.stat().st_size > 0:
        return path
    if _dl["fails"] >= MAX_CONSECUTIVE_FAILS or time.time() > _dl["deadline"]:
        raise RuntimeError("skipped: archive not responding (using the images already downloaded)")
    last = None
    for attempt in range(config.DOWNLOAD_RETRIES):
        try:
            r = _session.get(url, timeout=(10, 60))
            if r.status_code in (429, 502, 503, 504):
                # archive busy: short wait (honouring Retry-After) and try again
                wait = min(10, float(r.headers.get("Retry-After", 0) or 0) or 2 * 2 ** attempt)
                last = RuntimeError(f"{r.status_code} archive busy")
                time.sleep(wait + random.uniform(0, 1))
                continue
            r.raise_for_status()
            tmp = path.with_suffix(f".{threading.get_ident()}.part")
            tmp.write_bytes(r.content)
            tmp.replace(path)
            _dl["fails"] = 0
            return path
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(min(8, 2 * 2 ** attempt) + random.uniform(0, 1))
    _dl["fails"] += 1
    raise RuntimeError(f"download failed: {url}: {last}")


def read_cutout(path):
    """Read one cutout MEF -> dict with arrays, WCS and per-pixel wavelength map."""
    from astropy.io import fits
    from astropy.wcs import WCS
    import astropy.units as u

    with fits.open(path, memmap=False) as hl:
        hdr = hl["IMAGE"].header
        img = hl["IMAGE"].data.astype(np.float32)
        flags = hl["FLAGS"].data.astype(np.int64) if "FLAGS" in hl else None
        var = hl["VARIANCE"].data.astype(np.float32) if "VARIANCE" in hl else None
        zodi = hl["ZODI"].data.astype(np.float32) if "ZODI" in hl else None
        wcs = WCS(hdr)
        wl_map = None
        try:
            swcs = WCS(hdr, fobj=hl, key="W")
            swcs.sip = None
            yy, xx = np.indices(img.shape)
            wl, _bw = swcs.pixel_to_world(xx, yy)
            try:
                wl = wl.to(u.um)
            except Exception:  # noqa: BLE001
                pass
            wl_map = np.asarray(getattr(wl, "value", wl), dtype=np.float32)
        except Exception as e:  # noqa: BLE001
            log.debug("no spectral WCS: %s", e)
        version = hl[0].header.get("VERSION", "")
        hdr_text = hdr.tostring()
    sci = img - zodi if zodi is not None else img
    try:
        from astropy.wcs.utils import proj_plane_pixel_area
        pix_sr = proj_plane_pixel_area(wcs.celestial) * (np.pi / 180) ** 2
    except Exception:  # noqa: BLE001
        pix_sr = (config.NATIVE_PIX_ARCSEC / 206265.0) ** 2
    return {
        "sci": sci, "var": var, "flags": flags, "wcs": wcs, "wl": wl_map,
        "det": f"D{hdr.get('DETECTOR', '?')}", "pix_sr": float(pix_sr),
        "unit": hdr.get("BUNIT", "MJy/sr"), "version": str(version), "hdr": hdr_text,
    }


# ====================================================================== grid
def target_grid(ra, dec, fov_arcmin):
    from astropy.wcs import WCS

    pix = max(config.NATIVE_PIX_ARCSEC / 2.0, fov_arcmin * 60.0 / config.MAX_GRID)
    n = int(np.ceil(fov_arcmin * 60.0 / pix))
    n += (n + 1) % 2                    # odd -> target sits on a pixel centre
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [(n + 1) / 2.0, (n + 1) / 2.0]
    w.wcs.cdelt = [-pix / 3600.0, pix / 3600.0]
    yy, xx = np.indices((n, n))
    gra, gdec = w.pixel_to_world_values(xx, yy)
    return {"wcs": w, "n": n, "pix": pix, "ra": gra, "dec": gdec}


# ====================================================================== views
_views: "OrderedDict[str, dict]" = OrderedDict()
_views_lock = threading.Lock()


def view_id_for(params):
    s = json.dumps(params, sort_keys=True)
    return hashlib.sha1(s.encode()).hexdigest()[:16]


def build_view(ra, dec, fov_arcmin=4.0, gap_days=config.GAP_DAYS, span_days=config.SPAN_DAYS,
               per_epoch=config.PER_EPOCH, max_epochs=config.MAX_EPOCHS, use_cache=True):
    t0 = time.time()
    fov_arcmin = float(min(max(fov_arcmin, 0.5), config.MAX_FOV_ARCMIN))
    params = dict(v=6, ra=round(ra, 6), dec=round(dec, 6), fov=round(fov_arcmin, 3), gap=gap_days,
                  span=span_days, per=per_epoch, maxe=max_epochs)
    vid = view_id_for(params)
    demo = config.DEMO_DIR / "views" / f"{vid}.json"
    if use_cache and demo.exists():        # bundled challenge target: no archive needed
        return json.loads(demo.read_text())
    cached = config.VIEW_DIR / f"{vid}.json"
    if use_cache and cached.exists():
        return json.loads(cached.read_text())

    _dl["fails"] = 0
    _dl["deadline"] = time.time() + DOWNLOAD_BUDGET_S
    rows = query_images(ra, dec)
    if not rows:
        raise LookupError("No SPHEREx images cover this position yet.")
    t_query = time.time() - t0

    all_mjd = [r["mjd"] for r in rows]
    groups = imaging.group_epochs(all_mjd, gap_days, span_days)
    groups = imaging.merge_small(groups, all_mjd)
    groups = imaging.pick_evenly(groups, max_epochs)
    plan = []
    for gi, g in enumerate(groups):
        for r in imaging.select_images([rows[i] for i in g], per_epoch):
            plan.append((gi, r))

    size_deg = fov_arcmin / 60.0 * 1.15 + 3 * config.NATIVE_PIX_ARCSEC / 3600.0
    urls = [cutout_url(r["uri"], ra, dec, size_deg) if r.get("uri") else None for _, r in plan]

    def work(i):
        try:
            local = plan[i][1].get("path")
            return i, read_cutout(local if local else fetch(urls[i]))
        except Exception as e:  # noqa: BLE001
            log.warning("skip cutout: %s", e)
            return i, None

    cutouts = [None] * len(plan)
    with cf.ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as ex:
        for i, c in ex.map(work, range(len(plan))):
            cutouts[i] = c
    t_dl = time.time() - t0 - t_query

    grid = target_grid(ra, dec, fov_arcmin)
    n = grid["n"]
    per = {}  # (epoch, det) -> list of resampled S/N-ready images
    flagcount = {}
    usedcount = {}
    kept = []
    for (gi, r), c in zip(plan, cutouts):
        if c is None:
            continue
        c["mjd"] = r["mjd"]
        c["epoch"] = gi
        det = c["det"] if c["det"] != "D?" else r["det"]
        c["det"] = det
        x_in, y_in = c["wcs"].world_to_pixel_values(grid["ra"], grid["dec"])
        bad = imaging.flag_mask(c["flags"], config.BAD_FLAG_BITS)
        sat = imaging.flag_mask(c["flags"], config.SATURATION_FLAG_BITS)
        art = imaging.flag_mask(c["flags"], config.ARTIFACT_FLAG_BITS)
        sci = c["sci"].copy()
        if bad is not None:
            sci[bad & ~sat] = np.nan
        if sat is not None and sat.any():
            # Very bright stars overload the detector. Show them as solid maximum-brightness
            # disks rather than holes, so they stay visible (and trackable) in the blink.
            ok = np.isfinite(sci) & ~sat
            if ok.any():
                sci[sat] = np.nanmax(sci[ok])
        rs = imaging.resample(sci, x_in, y_in)
        if np.isfinite(rs).sum() < 0.2 * rs.size:
            continue
        rs = imaging.background_subtract(imaging.fill_holes(rs))
        per.setdefault((gi, det), []).append(rs)
        if art is not None:
            a = imaging.resample_mask(art, x_in, y_in).astype(np.float32)
            flagcount[gi] = flagcount.get(gi, np.zeros((n, n), np.float32)) + a
            usedcount[gi] = usedcount.get(gi, 0) + 1
        kept.append(c)

    epochs = []
    for gi, g in enumerate(groups):
        chans = {}
        snr_maps = []
        dets = {}
        for det in config.DETECTORS:
            imgs = per.get((gi, det))
            if not imgs:
                continue
            st = imaging.robust_stack(imgs)
            snr = imaging.to_snr(st)
            chans[det] = snr
            snr_maps.append(snr)
            dets[det] = len(imgs)
        if not snr_maps:
            continue
        chans["ALL"] = imaging.combine_detectors(snr_maps)
        if gi in flagcount:
            chans["FLAG"] = flagcount[gi] / max(usedcount[gi], 1)
        mj = np.array([c["mjd"] for c in kept if c["epoch"] == gi])
        epochs.append({
            "index": len(epochs),
            "mjd": float(mj.mean()), "mjd_min": float(mj.min()), "mjd_max": float(mj.max()),
            "date": mjd_to_iso(mj.mean()),
            "range": f"{mjd_to_iso(mj.min())} → {mjd_to_iso(mj.max())}",
            "n_images": int(len(mj)), "n_available": int(len(g)), "detectors": dets,
            "channels": {k: b64f32(v) for k, v in chans.items() if v is not None},
        })
    if not epochs:
        raise LookupError("Images were found but none could be downloaded/processed. Try again.")
    # renumber so photometry points refer to displayed epochs (some groups may be empty)
    shown = {}
    for e in epochs:
        mj = e["mjd_min"]
        for c in kept:
            if c["mjd"] == mj:
                shown[c["epoch"]] = e["index"]
    kept = [c for c in kept if c["epoch"] in shown]
    for c in kept:
        c["epoch"] = shown[c["epoch"]]

    w = grid["wcs"]
    resp = {
        "view_id": vid,
        "params": params,
        "ra": ra, "dec": dec, "fov_arcmin": fov_arcmin,
        "width": n, "height": n, "pix_arcsec": grid["pix"],
        "wcs": {"crval": list(map(float, w.wcs.crval)), "crpix": list(map(float, w.wcs.crpix)),
                "cdelt": list(map(float, w.wcs.cdelt))},
        "epochs": epochs,
        "n_images_total": len(rows),
        "n_images_used": len(kept),
        "versions": sorted({c["version"] for c in kept if c["version"]}),
        "timing": {"query_s": round(t_query, 2), "download_s": round(t_dl, 2),
                   "total_s": round(time.time() - t0, 2)},
        "generated": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }
    resp["target_photometry"] = photometry_from_cutouts(kept, ra, dec)
    with _views_lock:
        _views[vid] = {"cutouts": kept, "params": params}
        while len(_views) > 6:
            _views.popitem(last=False)
    (config.VIEW_DIR / f"{vid}.params.json").write_text(json.dumps(params))
    cached.write_text(json.dumps(resp))
    return resp


def _load_demo_cutouts(vid):
    """Cutouts saved by scripts/bundle_demo.py (small arrays + header text)."""
    path = config.DEMO_DIR / "cutouts" / f"{vid}.npz"
    if not path.exists():
        return None
    from astropy.io.fits import Header
    from astropy.wcs import WCS

    z = np.load(path, allow_pickle=False)
    meta = json.loads(str(z["meta"]))
    out = []
    for i, m in enumerate(meta):
        wcs = WCS(Header.fromstring(m["hdr"]))
        wl = z[f"wl{i}"] if f"wl{i}" in z else None
        out.append({"sci": z[f"sci{i}"], "var": z[f"var{i}"], "flags": z[f"flags{i}"].astype(np.int64),
                    "wcs": wcs, "wl": wl, "det": m["det"], "pix_sr": m["pix_sr"], "unit": m["unit"],
                    "version": m["version"], "hdr": m["hdr"], "mjd": m["mjd"], "epoch": m["epoch"]})
    return out


def _cutouts_for(vid):
    with _views_lock:
        if vid in _views:
            return _views[vid]["cutouts"]
    demo = _load_demo_cutouts(vid)
    if demo is not None:
        with _views_lock:
            _views[vid] = {"cutouts": demo, "params": None}
        return demo
    p = config.VIEW_DIR / f"{vid}.params.json"
    if not p.exists():
        raise LookupError("Unknown view; reload the view first.")
    params = json.loads(p.read_text())
    # rebuild in memory from the downloaded files; the saved view is kept as it is
    build_view(params["ra"], params["dec"], params["fov"], params["gap"], params["span"],
               params["per"], params["maxe"], use_cache=False)
    with _views_lock:
        return _views[vid]["cutouts"]


def photometry_from_cutouts(cutouts, ra, dec):
    """Aperture photometry at (ra, dec) in every image -> spectrum + light curve points.
    Because SPHEREx's linear variable filters give each pixel its own wavelength,
    every image samples the source at one wavelength: together they form a spectrum."""
    pts = []
    for c in cutouts:
        x, y = c["wcs"].world_to_pixel_values(ra, dec)
        x, y = float(x), float(y)
        bad = imaging.flag_mask(c["flags"], config.BAD_FLAG_BITS)
        sat = imaging.flag_mask(c["flags"], config.SATURATION_FLAG_BITS)
        method = "aperture"
        res = None
        core_sat = False
        if sat is not None:
            xi, yi = int(round(x)), int(round(y))
            y0, y1, x0, x1 = max(0, yi - 1), yi + 2, max(0, xi - 1), xi + 2
            core_sat = bool(sat[y0:y1, x0:x1].any())
        if not core_sat:
            res = imaging.aperture_photometry(c["sci"], c["var"], x, y, badmask=bad)
        if res is None:
            # overloaded (or masked) core: measure the star's outer glow instead
            if sat is not None:
                x, y = imaging.saturated_centre(sat, c["sci"], x, y)
            wing = imaging.wing_photometry(c["sci"], c["var"], x, y,
                                           badmask=None if bad is None else (bad | (sat if sat is not None else False)))
            if wing is None:
                continue
            flux, err, npix = wing
            nbad, method = 1, "wing"
        else:
            flux, err, npix, nbad = res
        wl = None
        if c["wl"] is not None:
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < c["wl"].shape[0] and 0 <= xi < c["wl"].shape[1]:
                wl = float(c["wl"][yi, xi])
        # Pixel values are surface brightness (MJy/sr), as in IRSA's SPHEREx tutorials,
        # even though some headers label BUNIT as "MJy". Checked against R Dra and
        # Barnard's Star: treating them as MJy per pixel gives absurd (1e9 Jy) fluxes.
        k = c["pix_sr"] * 1e9   # MJy/sr * sr -> MJy -> mJy
        pts.append({
            "mjd": round(c["mjd"], 5), "date": mjd_to_iso(c["mjd"]), "det": c["det"],
            "wl_um": None if wl is None or not np.isfinite(wl) else round(wl, 4),
            "flux_mjy": round(flux * k, 5),
            "err_mjy": None if not np.isfinite(err) else round(err * k, 5),
            "flagged": nbad > 0, "epoch": c["epoch"], "method": method,
        })
    pts.sort(key=lambda p: (p["wl_um"] or 0))
    return {"ra": ra, "dec": dec, "aperture_arcsec": round(1.5 * config.NATIVE_PIX_ARCSEC, 1),
            "points": pts}


def photometry(vid, ra, dec):
    return photometry_from_cutouts(_cutouts_for(vid), ra, dec)
