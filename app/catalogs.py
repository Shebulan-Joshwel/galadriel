"""Name resolution (with proper-motion propagation) and Gaia DR3 overlays."""
from __future__ import annotations

import datetime as dt
import json
import re
import xml.etree.ElementTree as ET

import numpy as np
import requests

SESAME = [
    "https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/SNV?{q}",
    "https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-ox/SNV?{q}",
]
# Built-in fallback for the challenge targets, so the demo never depends on a name
# resolver being up: (aliases, ra, dec, epoch_mjd of that position, pmra, pmdec mas/yr)
KNOWN = [
    (("barnard", "barnard's star", "gj 699", "v2500 oph"), 269.452076, 4.693364, 51544.5, -801.551, 10362.394),
    # the WISE designation encodes its position at the 2010 WISE epoch
    (("wise 0855", "wise j085510.83-071442.5", "wise 0855-0714"), 133.795129, -7.245147, 55330.0, -8123.0, 673.0),
    (("eps ind b", "epsilon indi b", "eps indi b"), 331.0438, -56.7827, 51544.5, 3966.0, -2537.0),
    (("rw aur", "rw aurigae"), 76.956417, 30.401417, 51544.5, 0.0, 0.0),
    (("r dra", "r draconis"), 248.167375, 66.755000, 51544.5, 0.0, 0.0),
]
J2000_MJD = 51544.5
J2016_MJD = 57388.5


def now_mjd():
    return (dt.datetime.utcnow() - dt.datetime(1858, 11, 17)).total_seconds() / 86400.0


def propagate(ra, dec, pmra_masyr, pmdec_masyr, from_mjd, to_mjd):
    """Linear proper-motion propagation. pmra includes the cos(dec) factor (Gaia/SIMBAD
    convention). Good to << 1 arcsec over decades for anything SPHEREx can see."""
    dt_yr = (np.asarray(to_mjd) - from_mjd) / 365.25
    dec_t = dec + pmdec_masyr * dt_yr / 3.6e6
    ra_t = ra + pmra_masyr * dt_yr / 3.6e6 / np.cos(np.radians(dec))
    return ra_t % 360.0, dec_t


def parse_coords(text):
    """Accept '133.795 -7.245', '08 55 10.83 -07 14 42.5', '08h55m10.831s -7d14m42.53s',
    '08:55:10.8 -07:14:42'. Returns (ra_deg, dec_deg) or None."""
    s = text.strip().replace(",", " ")
    nums = re.findall(r"[-+]?\d+(?:\.\d+)?", s)
    if not nums:
        return None
    if re.fullmatch(r"\s*[-+]?\d+(\.\d+)?\s+[-+]?\d+(\.\d+)?\s*", s):
        ra, dec = float(nums[0]), float(nums[1])
        if 0 <= ra < 360 and -90 <= dec <= 90:
            return ra, dec
        return None
    if len(nums) == 6 or re.search(r"[hms:]", s):
        if len(nums) < 6:
            return None
        h, m, sec = map(float, nums[:3])
        dsign = -1 if nums[3].startswith("-") or re.search(r"\s-\s*0+\s", " " + s) else 1
        dd, dm, ds = abs(float(nums[3])), float(nums[4]), float(nums[5])
        ra = 15 * (h + m / 60 + sec / 3600)
        dec = dsign * (dd + dm / 60 + ds / 3600)
        if 0 <= ra < 360 and -90 <= dec <= 90:
            return ra, dec
    return None


def _demo(name):
    try:
        from . import config
        f = config.DEMO_DIR / name
        return json.loads(f.read_text()) if f.exists() else None
    except Exception:  # noqa: BLE001
        return None


def resolve(text, epoch_mjd=None):
    """Coordinates or object name -> position at `epoch_mjd` (default: now).
    High-proper-motion objects (Barnard's Star moves ~10"/yr) would otherwise be several
    arcminutes away from their catalogue J2000 position by the time SPHEREx imaged them."""
    bundled = (_demo("resolve.json") or {}).get(text.strip().lower())
    if bundled and epoch_mjd is None:
        return bundled                         # same centre the bundled view was built on
    epoch_mjd = epoch_mjd or now_mjd()
    c = parse_coords(text)
    if c:
        return {"query": text, "name": None, "ra": c[0], "dec": c[1], "pm": None,
                "note": "Coordinates used as given (no proper-motion correction)."}
    res = None
    for url in SESAME:
        try:
            r = requests.get(url.format(q=requests.utils.quote(text)), timeout=12)
            r.raise_for_status()
            res = ET.fromstring(r.text).find(".//Resolver")
            if res is not None and res.find("jradeg") is not None:
                break
            res = None
        except Exception:  # noqa: BLE001
            res = None
    if res is None:
        key = text.strip().lower()
        for aliases, ra, dec, ep, pmra, pmde in KNOWN:
            if key in aliases:
                ra_t, dec_t = propagate(ra, dec, pmra, pmde, ep, epoch_mjd)
                return {"query": text, "name": text, "ra": float(ra_t), "dec": float(dec_t),
                        "pm": {"pmra": pmra, "pmdec": pmde},
                        "note": "Name service unreachable; used built-in position, corrected for proper motion."}
        raise LookupError(f"Could not resolve '{text}'.")
    ra = float(res.findtext("jradeg"))
    dec = float(res.findtext("jdedeg"))
    name = res.findtext("oname") or text
    # Sesame nests proper motion inside <pm>...</pm>: search all descendants
    pmra = res.findtext(".//pmRA")
    pmde = res.findtext(".//pmDE")
    if pmra is None or pmde is None:          # fall back to built-in values for known targets
        key = text.strip().lower()
        for aliases, kra, kdec, ep, kpmra, kpmde in KNOWN:
            if key in aliases and abs(kpmra) + abs(kpmde) > 0:
                ra, dec = [float(v) for v in propagate(kra, kdec, kpmra, kpmde, ep, J2000_MJD)]
                pmra, pmde = kpmra, kpmde
    out = {"query": text, "name": name, "ra_j2000": ra, "dec_j2000": dec, "ra": ra, "dec": dec,
           "pm": None, "note": ""}
    if pmra is not None and pmde is not None:
        pmra, pmde = float(pmra), float(pmde)
        ra_t, dec_t = propagate(ra, dec, pmra, pmde, J2000_MJD, epoch_mjd)
        out.update(ra=float(ra_t), dec=float(dec_t), pm={"pmra": pmra, "pmdec": pmde})
        shift = np.hypot(pmra, pmde) * (epoch_mjd - J2000_MJD) / 365.25 / 1000
        out["note"] = (f"Moved {shift:.0f}\" since J2000 (proper motion "
                       f"{np.hypot(pmra, pmde)/1000:.2f}\"/yr); centred on today's position.")
    return out


GAIA_TAP = "https://gea.esac.esa.int/tap-server/tap/sync"
_gaia_cache: dict = {}


def _gaia_rows_esa(ra, dec, r_deg):
    q = ("SELECT TOP 3000 source_id, ra, dec, pmra, pmdec, parallax, phot_g_mean_mag "
         "FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS', ra, dec), "
         f"CIRCLE('ICRS', {ra}, {dec}, {r_deg}))")
    r = requests.get(GAIA_TAP, params={"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "json",
                                       "QUERY": q}, timeout=30)
    r.raise_for_status()
    j = r.json()
    names = [m["name"] for m in j["metadata"]]
    for row in j["data"]:
        d = dict(zip(names, row))
        yield (d["source_id"], d["ra"], d["dec"], d["pmra"], d["pmdec"], d["parallax"],
               d["phot_g_mean_mag"])


def _gaia_rows_vizier(ra, dec, r_deg):
    from astroquery.vizier import Vizier
    from astropy.coordinates import SkyCoord
    import astropy.units as u

    v = Vizier(columns=["Source", "RA_ICRS", "DE_ICRS", "pmRA", "pmDE", "Plx", "Gmag"],
               row_limit=3000, timeout=30)
    t = v.query_region(SkyCoord(ra, dec, unit="deg"), radius=r_deg * u.deg,
                       catalog="I/355/gaiadr3")
    if not t:
        return
    for row in t[0]:
        vals = []
        for k in ("Source", "RA_ICRS", "DE_ICRS", "pmRA", "pmDE", "Plx", "Gmag"):
            x = row[k]
            vals.append(None if np.ma.is_masked(x) else x)
        yield tuple(vals)


def _num(x):
    try:
        x = float(x)
        return x if np.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def gaia(ra, dec, radius_arcmin, mjds):
    """Gaia DR3 sources around (ra, dec), with positions propagated to each epoch.
    The search radius is padded so fast movers that have *entered* the field since 2016
    are still included. Tries ESA's Gaia archive, then CDS VizieR."""
    r_deg = (radius_arcmin + 2.0) / 60.0
    key = (round(ra, 4), round(dec, 4), round(r_deg, 4))
    rows = _gaia_cache.get(key)
    if rows is None:
        rows = (_demo("gaia.json") or {}).get(f"{key[0]},{key[1]},{key[2]}")
    if rows is None:
        last = None
        for fn in (_gaia_rows_esa, _gaia_rows_vizier):
            try:
                rows = list(fn(ra, dec, r_deg))
                break
            except Exception as e:  # noqa: BLE001
                last = e
        if rows is None:
            raise RuntimeError(f"Gaia catalogue unavailable: {last}")
        _gaia_cache[key] = rows
    mjds = np.asarray(mjds, dtype=float)
    out = []
    for sid, sra, sdec, pmra, pmde, plx, g in rows:
        sra, sdec = _num(sra), _num(sdec)
        if sra is None or sdec is None:
            continue
        pmra, pmde = _num(pmra) or 0.0, _num(pmde) or 0.0
        ras, decs = propagate(sra, sdec, pmra, pmde, J2016_MJD, mjds)
        out.append({"id": str(sid), "g": _num(g), "plx": _num(plx), "pmra": pmra, "pmdec": pmde,
                    "pm_tot": float(np.hypot(pmra, pmde)),
                    "pos": [[round(float(a), 7), round(float(b), 7)] for a, b in
                            zip(np.atleast_1d(ras), np.atleast_1d(decs))]})
    out.sort(key=lambda s: -(s["pm_tot"]))
    return {"sources": out}
