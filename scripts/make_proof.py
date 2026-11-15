"""Turn the real-data self-check report into the "Does it work?" table shown in the app.

Run after `python -m scripts.selfcheck`:
    python -m scripts.make_proof            # reads cache/selfcheck/report.json
Writes app/static/proof.json (small, shipped with the app).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "cache" / "selfcheck" / "report.json"
OUT = ROOT / "app" / "static" / "proof.json"
PIXEL = 6.15          # native SPHEREx pixel, arcsec
FLOOR = 5.0           # saturated stars: motion below this is reported as "not moving"
PLAIN = {"Barnard's Star": "Nearby red dwarf, the fastest-moving star in our sky",
         "WISE 0855": "Coldest known brown dwarf, almost invisible except at 4–5 µm",
         "eps Ind B": "A pair of brown dwarfs close to the Sun",
         "RW Aur": "Young star that flickers but does not move",
         "R Dra": "Giant star that swells and fades over months but does not move"}
QUERY = {"Barnard's Star": "Barnard's Star", "WISE 0855": "WISE 0855", "eps Ind B": "Epsilon Indi B",
         "RW Aur": "RW Aurigae", "R Dra": "R Draconis"}


def mjd_years(dates):
    from datetime import date
    d = [date.fromisoformat(x) for x in dates]
    return (max(d) - min(d)).days / 365.25


def main(src: Path = SRC):
    rows = []
    for t in json.loads(src.read_text()):
        m, e = t["measured_pm_arcsec_yr"], t["expected_pm_arcsec_yr"]
        vm, ve = math.hypot(m["east"], m["north"]), math.hypot(e["east"], e["north"])
        err = math.hypot(m["east"] - e["east"], m["north"] - e["north"])
        dates = [x["date"] for x in t["epochs"]]
        years = mjd_years(dates)
        sat = str(t.get("saturated")) == "True"
        mover = ve >= 1.0
        if mover:
            dang = math.degrees(math.atan2(m["east"], m["north"]) - math.atan2(e["east"], e["north"]))
            dang = abs((dang + 180) % 360 - 180)
            verdict = "pass" if err * years < PIXEL else "check"
        else:
            dang = None
            verdict = "pass" if (vm < FLOOR if sat else vm < 1.5) else "check"
        rows.append({
            "target": QUERY.get(t["target"], t["target"]),
            "expect": PLAIN.get(t["target"], t["expect"]),
            "kind": "mover" if mover else "still",
            "measured": round(vm, 2), "known": round(ve, 2),
            "measured_en": [m["east"], m["north"]], "known_en": [e["east"], e["north"]],
            "error": round(err, 2), "direction_off_deg": None if dang is None else round(dang),
            "error_pixels": round(err * years / PIXEL, 2),
            "saturated": sat,
            "visits": t["view"]["n_epochs"], "images": t["view"]["images_used"],
            "first": min(dates), "last": max(dates), "years": round(years, 2),
            "gaia_stars": t["gaia"]["n"],
            "spectrum_points": t["photometry"]["n_points"],
            "wl_um": t["photometry"]["wl_range_um"],
            "verdict": verdict,
        })
    OUT.write_text(json.dumps({"pixel_arcsec": PIXEL, "floor": FLOOR, "rows": rows}, indent=1))
    print(f"wrote {OUT}")
    for r in rows:
        print(f"  {r['target']:16s} {r['verdict']:5s} measured {r['measured']:5.2f}\"/yr known {r['known']:5.2f}"
              f"  error {r['error']:.2f}\"/yr = {r['error_pixels']:.2f} px over {r['years']} yr")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else SRC)
