"""FastAPI app: JSON API + static single-page viewer."""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import catalogs, config, spherex

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="SPHEREx Blink", version="1.0")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
STATIC = Path(__file__).parent / "static"


def _err(e: Exception):
    if isinstance(e, LookupError):
        raise HTTPException(404, str(e))
    if isinstance(e, ValueError):
        raise HTTPException(400, str(e))
    logging.exception("server error")
    raise HTTPException(502, f"Upstream/archive error: {e}")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/resolve")
def resolve(q: str = Query(..., min_length=1)):
    try:
        return catalogs.resolve(q)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.get("/api/view")
def view(ra: float, dec: float, fov: float = 4.0,
         gap: float = config.GAP_DAYS, span: float = config.SPAN_DAYS,
         per: int = Query(config.PER_EPOCH, ge=2, le=40),
         maxe: int = Query(config.MAX_EPOCHS, ge=2, le=24)):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(400, "RA must be 0-360 and Dec -90..90 degrees")
    try:
        return spherex.build_view(ra, dec, fov, gap, span, per, maxe)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.get("/api/photometry")
def photometry(view_id: str, ra: float, dec: float):
    try:
        return spherex.photometry(view_id, ra, dec)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.get("/api/gaia")
def gaia(ra: float, dec: float, radius: float, mjds: str):
    try:
        m = [float(x) for x in mjds.split(",") if x]
        return catalogs.gaia(ra, dec, min(radius, 25.0), m)
    except Exception as e:  # noqa: BLE001
        _err(e)


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
