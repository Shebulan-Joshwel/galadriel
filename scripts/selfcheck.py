"""End-to-end self-check on REAL data for the five challenge targets.

Run:  python -m scripts.selfcheck
Writes cache/selfcheck/report.txt (human readable), report.json, and <target>.npz
(per-epoch images) so the results can be reviewed without re-running anything.
"""
import base64
import json
import time
import traceback
from pathlib import Path

import numpy as np

from app import catalogs, config, spherex

OUT = config.CACHE_DIR / "selfcheck"
OUT.mkdir(parents=True, exist_ok=True)

# name, fov (arcmin), what we expect to see
TARGETS = [
    ("Barnard's Star", 3, "bright, moving ~10.4\"/yr north"),
    ("WISE 0855", 3, "faint at short wavelengths, bright at 4-5 um, moving ~8.1\"/yr west", "D6"),
    ("eps Ind B", 4, "faint pair, moving ~4.7\"/yr"),
    ("RW Aur", 4, "bright, variable, not moving"),
    ("R Dra", 4, "bright Mira variable, not moving, many epochs"),
]


def dec_img(b64, n):
    return np.frombuffer(base64.b64decode(b64), "<f4").reshape(n, n)


def centroid(img, x0, y0, r):
    """Peak-finding centroid: start at the brightest pixel within r of (x0, y0), then
    take the flux-weighted mean of pixels above half that peak (works for filled
    saturated cores too)."""
    yy, xx = np.indices(img.shape)
    m = (np.hypot(xx - x0, yy - y0) <= r) & np.isfinite(img)
    if not m.any():
        return np.nan, np.nan, np.nan
    sub = np.where(m, img, -np.inf)
    py, px = np.unravel_index(np.argmax(sub), img.shape)
    peak = float(img[py, px])
    near = (np.hypot(xx - px, yy - py) <= 3) & np.isfinite(img) & (img >= 0.5 * peak)
    w = np.where(near, img, 0)
    return float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum()), peak


def check(name, fov, expect, band="ALL"):
    rep = {"target": name, "expect": expect, "problems": [], "warnings": []}
    t0 = time.time()
    r = catalogs.resolve(name)
    rep["resolve"] = {k: r.get(k) for k in ("ra", "dec", "pm", "note", "name")}
    if r.get("pm") is None and "rw" not in name.lower() and "dra" not in name.lower():
        rep["problems"].append("no proper motion from resolver: centre may be wrong")
    v = spherex.build_view(r["ra"], r["dec"], fov)
    n = v["width"]
    pix = v["pix_arcsec"]
    c = (n - 1) / 2
    rep["view"] = {"n_epochs": len(v["epochs"]), "grid": n, "pix_arcsec": round(pix, 2),
                   "images_used": v["n_images_used"], "images_total": v["n_images_total"],
                   "versions": v["versions"], "build_s": v["timing"]}
    eps = []
    imgs = {}
    for e in v["epochs"]:
        a = dec_img(e["channels"]["ALL"], n)
        imgs[f"ep{e['index']}_{e['date']}"] = a
        if band != "ALL":
            a = dec_img(e["channels"][band], n) if band in e["channels"] else np.full((n, n), np.nan)
        for d in ("D1", "D3", "D6"):
            if d in e["channels"]:
                imgs[f"ep{e['index']}_{d}"] = dec_img(e["channels"][d], n)
        cx, cy, peak = centroid(a, c, c, (15 if band == "ALL" else 20) / pix)
        nanfrac = float(np.isnan(a).mean())
        eps.append({"date": e["date"], "n_img": e["n_images"], "dets": e["detectors"],
                    "peak_snr": None if not np.isfinite(peak) else round(peak, 1),
                    "dx_arcsec": None if not np.isfinite(cx) else round((cx - c) * pix, 2),
                    "dy_arcsec": None if not np.isfinite(cy) else round((cy - c) * pix, 2),
                    "nan_frac": round(nanfrac, 3)})
        if e["n_images"] < 4:
            rep["warnings"].append(f"{e['date']}: only {e['n_images']} images")
        if nanfrac > 0.2:
            rep["warnings"].append(f"{e['date']}: {nanfrac:.0%} of the field has no data")
    rep["epochs"] = eps
    co = np.nanmean(np.stack([dec_img(e["channels"]["ALL"], n) for e in v["epochs"]]), axis=0)
    imgs["coadd"] = co
    cx, cy, peak = centroid(co, c, c, 15 / pix)
    rep["coadd_centre"] = {"dx_arcsec": round((cx - c) * pix, 2), "dy_arcsec": round((cy - c) * pix, 2),
                           "peak_snr": round(peak, 1),
                           "field_max_snr": round(float(np.nanmax(co)), 1)}
    if not np.isfinite(peak) or peak < 5:
        rep["problems"].append("no source detected within 15\" of the crosshair")
    elif np.hypot(cx - c, cy - c) * pix > 8:
        rep["warnings"].append("source centroid >8\" from crosshair")

    # measured motion: fit centroid vs time (east = -x because RA increases to the left)
    t = np.array([e["mjd"] for e in v["epochs"]])
    xs = np.array([e["dx_arcsec"] if e["dx_arcsec"] is not None else np.nan for e in eps])
    ys = np.array([e["dy_arcsec"] if e["dy_arcsec"] is not None else np.nan for e in eps])
    snr = np.array([e["peak_snr"] if e["peak_snr"] is not None else 0 for e in eps])
    ok = np.isfinite(xs) & np.isfinite(ys) & (snr >= 5)       # ignore visits where it's lost in noise
    sat_star = bool(v["target_photometry"]["points"]) and np.mean([p.get("method") == "wing" for p in v["target_photometry"]["points"]]) > 0.5
    rep["saturated"] = sat_star
    if ok.sum() >= 3 and np.ptp(t[ok]) > 100:
        yr = (t[ok] - t[ok].mean()) / 365.25
        pm_e = -np.polyfit(yr, xs[ok], 1)[0]
        pm_n = np.polyfit(yr, ys[ok], 1)[0]
        rep["measured_pm_arcsec_yr"] = {"east": round(pm_e, 2), "north": round(pm_n, 2)}
        if r.get("pm"):
            rep["expected_pm_arcsec_yr"] = {"east": round(r["pm"]["pmra"] / 1000, 2),
                                            "north": round(r["pm"]["pmdec"] / 1000, 2)}

    # Gaia
    try:
        g = catalogs.gaia(v["ra"], v["dec"], fov * 0.75, [e["mjd"] for e in v["epochs"]])
        s = g["sources"]
        rep["gaia"] = {"n": len(s), "fastest_pm_masyr": round(s[0]["pm_tot"], 1) if s else None}
        if not s:
            rep["warnings"].append("Gaia returned 0 sources")
    except Exception as e:  # noqa: BLE001
        rep["problems"].append(f"Gaia failed: {e}")

    # photometry / spectrum
    ph = v["target_photometry"]["points"]
    wl = np.array([p["wl_um"] for p in ph if p["wl_um"] is not None])
    fl = np.array([p["flux_mjy"] for p in ph])
    rep["photometry"] = {
        "n_points": len(ph), "n_with_wavelength": int(wl.size),
        "wl_range_um": [round(float(wl.min()), 3), round(float(wl.max()), 3)] if wl.size else None,
        "flux_median_mjy": round(float(np.median(fl)), 3) if fl.size else None,
        "flux_range_mjy": [round(float(fl.min()), 3), round(float(fl.max()), 3)] if fl.size else None,
        "flagged_frac": round(float(np.mean([p["flagged"] for p in ph])), 2) if ph else None,
        "sample": ph[:: max(1, len(ph) // 12)][:12],
    }
    rep["photometry"]["n_wing"] = sum(p.get("method") == "wing" for p in ph)
    if len(ph) < 0.5 * v["n_images_used"]:
        rep["problems"].append(f"only {len(ph)} photometry points from {v['n_images_used']} images")
    if wl.size and (wl.min() < 0.6 or wl.max() > 5.2):
        rep["problems"].append(f"wavelengths out of range {wl.min():.2f}-{wl.max():.2f} um")
    if wl.size == 0 and ph:
        rep["problems"].append("no wavelengths: spectral WCS not read")
    rep["seconds"] = round(time.time() - t0, 1)
    np.savez_compressed(OUT / (name.replace(" ", "_").replace("'", "") + ".npz"), **imgs)
    return rep


def main():
    reports = []
    for t in TARGETS:
        name = t[0]
        print(f"... {name}", flush=True)
        try:
            reports.append(check(*t))
        except Exception as e:  # noqa: BLE001
            reports.append({"target": name, "problems": [f"CRASH {type(e).__name__}: {e}"],
                            "traceback": traceback.format_exc()})
        (OUT / "report.json").write_text(json.dumps(reports, indent=1, default=str))
    lines = []
    for r in reports:
        lines.append(f"=== {r['target']}  ({'OK' if not r['problems'] else 'PROBLEMS'})")
        for p in r["problems"]:
            lines.append(f"  PROBLEM: {p}")
        for w in r.get("warnings", []):
            lines.append(f"  warning: {w}")
        if "measured_pm_arcsec_yr" in r:
            lines.append(f"  motion measured {r['measured_pm_arcsec_yr']} expected {r.get('expected_pm_arcsec_yr')}")
        if "photometry" in r:
            lines.append(f"  spectrum: {r['photometry']['n_points']} pts, {r['photometry']['wl_range_um']} um")
    (OUT / "report.txt").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\nFull report: {OUT / 'report.json'}")


if __name__ == "__main__":
    main()
