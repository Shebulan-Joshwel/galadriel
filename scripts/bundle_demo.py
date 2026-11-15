"""Bundle the challenge targets into app/demo/ so the app works without NASA's archive.

Run (after the targets have been viewed once, so their images are cached):
    python -m scripts.bundle_demo
Creates app/demo/views/*.json, app/demo/cutouts/*.npz, app/demo/resolve.json, app/demo/gaia.json
"""
import json

import numpy as np

from app import catalogs, config, spherex

TARGETS = [("Barnard's Star", 3), ("WISE J085510.83-071442.5", 3), ("eps Ind B", 4),
           ("RW Aur", 4), ("R Dra", 4)]
ALIASES = {"Barnard's Star": ["barnard's star", "barnards star", "barnard"],
           "WISE J085510.83-071442.5": ["wise j085510.83-071442.5", "wise 0855", "wise 0855-0714"],
           "eps Ind B": ["eps ind b", "epsilon indi b"],
           "RW Aur": ["rw aur", "rw aurigae"], "R Dra": ["r dra", "r draconis"]}


def to_py(x):
    if isinstance(x, (np.floating,)):
        return float(x)
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, bytes):
        return x.decode()
    return x


def _save_maps(d, resolve_map, gaia_map):
    (d / "resolve.json").write_text(json.dumps(resolve_map, indent=1))
    (d / "gaia.json").write_text(json.dumps(gaia_map))


def _existing_view_near(d, ra, dec, fov):
    """A view already bundled for this target (positions can differ by a few mas)."""
    for f in (d / "views").glob("*.json"):
        try:
            v = json.loads(f.read_text())
        except Exception:  # noqa: BLE001
            continue
        if abs(v["fov_arcmin"] - fov) < 1e-6 and abs(v["dec"] - dec) * 3600 < 30 and \
                abs((v["ra"] - ra) * np.cos(np.radians(dec))) * 3600 < 30 and \
                (d / "cutouts" / f"{v['view_id']}.npz").exists():
            return v
    return None


def main():
    import sys
    import time
    d = config.DEMO_DIR
    (d / "views").mkdir(parents=True, exist_ok=True)
    (d / "cutouts").mkdir(parents=True, exist_ok=True)
    try:
        resolve_map = json.loads((d / "resolve.json").read_text())
    except Exception:  # noqa: BLE001
        resolve_map = {}
    try:
        gaia_map = json.loads((d / "gaia.json").read_text())
    except Exception:  # noqa: BLE001
        gaia_map = {}
    only = [a.lower() for a in sys.argv[1:]]
    for name, fov in TARGETS:
        if only and not any(o in name.lower() for o in only):
            continue
        t0 = time.time()
        try:
            r = catalogs.resolve(name, epoch_mjd=catalogs.now_mjd())
            v = _existing_view_near(d, r["ra"], r["dec"], fov)
            if v is not None:
                # already bundled: just make sure the name maps to exactly that position
                r = dict(r, ra=v["ra"], dec=v["dec"])
                print(f"kept    {name:28s} (already bundled)")
            else:
                v = spherex.build_view(r["ra"], r["dec"], fov)
                vid = v["view_id"]
                cut = spherex._cutouts_for(vid)
                arrays, meta = {}, []
                for i, c in enumerate(cut):
                    arrays[f"sci{i}"] = c["sci"].astype(np.float32)
                    arrays[f"var{i}"] = (c["var"] if c["var"] is not None else np.full_like(c["sci"], np.nan)).astype(np.float32)
                    arrays[f"flags{i}"] = (c["flags"] if c["flags"] is not None else np.zeros(c["sci"].shape)).astype(np.int32)
                    if c["wl"] is not None:
                        arrays[f"wl{i}"] = c["wl"].astype(np.float32)
                    meta.append({"hdr": c["hdr"], "mjd": float(c["mjd"]), "epoch": int(c["epoch"]), "det": c["det"],
                                 "pix_sr": float(c["pix_sr"]), "unit": str(c["unit"]), "version": str(c["version"])})
                arrays["meta"] = np.array(json.dumps(meta))
                np.savez_compressed(d / "cutouts" / f"{vid}.npz", **arrays)
                (d / "views" / f"{vid}.json").write_text(json.dumps(v))
                print(f"bundled {name:28s} {len(cut):4d} images  {len(v['epochs']):2d} visits  {time.time() - t0:5.0f}s")
            for a in ALIASES[name] + [name.lower()]:
                resolve_map[a] = r
            radius = v["fov_arcmin"] * 0.75
            try:
                catalogs.gaia(v["ra"], v["dec"], radius, [e["mjd"] for e in v["epochs"]])
                r_deg = (min(radius, 25.0) + 2.0) / 60.0
                key = (round(v["ra"], 4), round(v["dec"], 4), round(r_deg, 4))
                rows = catalogs._gaia_cache.get(key, [])
                gaia_map[f"{key[0]},{key[1]},{key[2]}"] = [[to_py(x) for x in row] for row in rows]
            except Exception as e:  # noqa: BLE001
                print(f"        (Gaia overlay not bundled for {name}: {e})")
            _save_maps(d, resolve_map, gaia_map)       # progress is saved after every target
        except Exception as e:  # noqa: BLE001
            print(f"SKIPPED {name:28s} {type(e).__name__}: {e}")
    total = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
    print(f"total {total / 1e6:.1f} MB in {d}")


if __name__ == "__main__":
    main()
