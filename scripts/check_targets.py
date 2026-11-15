"""Run the five challenge test targets against the real archive, print a report, and warm
the cache (so the live demo is instant).  Usage:  python -m scripts.check_targets"""
import time

from app import catalogs, spherex

TARGETS = [("Barnard's Star", 3), ("WISE J085510.83-071442.5", 3), ("eps Ind B", 4),
           ("RW Aur", 4), ("R Dra", 4)]

for name, fov in TARGETS:
    t = time.time()
    try:
        r = catalogs.resolve(name)
        v = spherex.build_view(r["ra"], r["dec"], fov)
        eps = ", ".join(f"{e['date']}({e['n_images']})" for e in v["epochs"])
        print(f"OK  {name:28s} {time.time() - t:5.1f}s  {v['n_images_used']}/{v['n_images_total']} imgs  "
              f"{len(v['epochs'])} epochs: {eps}")
        print(f"    {r.get('note', '')}")
        print(f"    target photometry points: {len(v['target_photometry']['points'])}")
    except Exception as e:  # noqa: BLE001
        print(f"ERR {name:28s} {type(e).__name__}: {e}")
