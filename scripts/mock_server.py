"""Offline mock of the API with synthetic SPHEREx-like data, for UI development and for
demoing the interface without network access.  Run:  python scripts/mock_server.py
then open http://localhost:8001 . Real data: run the FastAPI app instead (see README)."""
import base64
import json
import math
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np

STATIC = Path(__file__).resolve().parents[1] / "app" / "static"
RNG = np.random.default_rng(7)
N, PIX = 79, 3.075
EPOCH_MJD = [60820.0, 61002.0, 61185.0, 61368.0]
DETS = ["D1", "D2", "D3", "D4", "D5", "D6"]
STARS = [(RNG.uniform(3, N - 4), RNG.uniform(3, N - 4), RNG.uniform(5, 60), RNG.uniform(0, 1)) for _ in range(70)]


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, "<f4").tobytes()).decode()


def psf(img, x, y, amp, s=1.0):
    yy, xx = np.indices(img.shape)
    sig = s * 1.1 * 6.15 / PIX / 2.355
    img += amp * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sig ** 2))


def frame(ei, det):
    d = DETS.index(det)
    img = RNG.normal(0, 1, (N, N)).astype(np.float32)
    for x, y, a, col in STARS:
        psf(img, x, y, a * (1 - 0.5 * col * d / 5))
    c = (N - 1) / 2
    psf(img, c, c + ei * 0.85 * 2, 120 * (0.4 + d / 6))           # fast mover going north
    psf(img, c - 20, c + 14, 40 * (1 + 0.6 * math.sin(ei * 1.7)))  # variable star
    psf(img, c + 18, c - 16 + ei * 1.3, 12 + 6 * d)                 # unknown red mover
    return img


def view(ra, dec, fov):
    epochs = []
    for ei, m in enumerate(EPOCH_MJD):
        ch = {d: frame(ei, d) for d in DETS}
        ch["ALL"] = sum(ch.values()) / np.sqrt(6)
        flag = np.zeros((N, N), np.float32)
        flag[60:66, 10:30] = 0.5 if ei == 2 else 0
        ch["FLAG"] = flag
        import datetime as dt
        date = (dt.datetime(1858, 11, 17) + dt.timedelta(days=m)).strftime("%Y-%m-%d")
        epochs.append({"index": ei, "mjd": m, "mjd_min": m - 5, "mjd_max": m + 5, "date": date,
                       "range": date, "n_images": 12, "n_available": 80,
                       "detectors": {d: 2 for d in DETS},
                       "channels": {k: b64(v) for k, v in ch.items()}})
    pix = PIX / 3600
    return {"view_id": "mock", "params": {}, "ra": ra, "dec": dec, "fov_arcmin": fov, "width": N,
            "height": N, "pix_arcsec": PIX,
            "wcs": {"crval": [ra, dec], "crpix": [(N + 1) / 2] * 2, "cdelt": [-pix, pix]},
            "epochs": epochs, "n_images_total": 320, "n_images_used": 48,
            "versions": ["MOCK DATA"], "timing": {"total_s": 0.1},
            "target_photometry": phot(ra, dec)}


def phot(ra, dec):
    pts = []
    for ei, m in enumerate(EPOCH_MJD):
        for k in range(12):
            wl = 0.75 + (k + ei * 0.3) / 12 * 4.25
            f = 3 * np.exp(-((wl - 1.3) / 0.8) ** 2) + 1.2 * np.exp(-((wl - 4.6) / 0.4) ** 2) + 0.2
            pts.append({"mjd": m + k * 0.7, "date": "", "det": f"D{min(6, int((wl - 0.75) / 0.71) + 1)}",
                        "wl_um": round(wl, 3), "flux_mjy": float(f * (1 + RNG.normal(0, 0.05))),
                        "err_mjy": 0.08, "flagged": k == 3, "epoch": ei})
    return {"ra": ra, "dec": dec, "aperture_arcsec": 9.2, "points": pts}


def gaia(ra, dec, mjds):
    out = []
    pix = PIX / 3600
    c = (N - 1) / 2
    for x, y, a, _ in STARS[:40]:
        r = ra - (x - c) * pix / math.cos(math.radians(dec)); d = dec + (y - c) * pix
        out.append({"id": "x", "g": 18 - a / 8, "plx": 1, "pmra": 1, "pmdec": 1, "pm_tot": 2,
                    "pos": [[r, d] for _ in mjds]})
    out.append({"id": "fast", "g": 9.5, "plx": 547, "pmra": -800, "pmdec": 10362, "pm_tot": 10393,
                "pos": [[ra, dec + i * 0.85 * 2 * pix] for i, _ in enumerate(mjds)]})
    return {"sources": out}


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(STATIC), **k)

    def send_json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/api/resolve":
            return self.send_json({"query": q["q"], "name": q["q"], "ra": 269.4486, "dec": 4.7395,
                                   "note": "Moved 264\" since J2000 (proper motion 10.39\"/yr); centred on today's position."})
        if u.path == "/api/view":
            return self.send_json(view(float(q["ra"]), float(q["dec"]), float(q.get("fov", 4))))
        if u.path == "/api/photometry":
            return self.send_json(phot(float(q["ra"]), float(q["dec"])))
        if u.path == "/api/gaia":
            return self.send_json(gaia(float(q["ra"]), float(q["dec"]), q["mjds"].split(",")))
        if u.path == "/":
            self.path = "/index.html"
        elif u.path.startswith("/static/"):
            self.path = u.path[len("/static"):]
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    print(f"Mock SPHEREx Blink on http://localhost:{port}")
    ThreadingHTTPServer(("", port), H).serve_forever()
