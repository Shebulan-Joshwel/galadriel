"""Central configuration. Everything that changes with new SPHEREx data releases lives here,
so updating the tool for a new release is a one-line (or one env var) change."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = Path(os.environ.get("SPHEREX_CACHE_DIR", ROOT.parent / "cache"))
CUTOUT_DIR = CACHE_DIR / "cutouts"
VIEW_DIR = CACHE_DIR / "views"
for d in (CUTOUT_DIR, VIEW_DIR):
    d.mkdir(parents=True, exist_ok=True)

IRSA_BASE = "https://irsa.ipac.caltech.edu/"

# Pre-built data for the challenge targets, shipped with the app so the demo works even
# when NASA's archive is busy or unreachable. Built by `python -m scripts.bundle_demo`.
DEMO_DIR = ROOT / "demo"

# The TAP metadata tables IRSA uses for SPHEREx spectral images. New Quick Releases
# (weekly) and Data Releases land in these same tables, so the tool picks them up
# automatically. Duplicate exposures (e.g. same exposure in QR and DR) are de-duplicated.
TAP_QUERY = """
SELECT a.uri, p.time_bounds_lower, p.time_bounds_upper, p.energy_bandpassname
FROM spherex.artifact a
JOIN spherex.plane p ON a.planeid = p.planeid
WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
ORDER BY p.time_bounds_lower
"""

# SPHEREx's six detector arrays (approximate wavelength coverage, micrometres).
DETECTORS = {
    "D1": (0.75, 1.09),
    "D2": (1.10, 1.62),
    "D3": (1.63, 2.41),
    "D4": (2.42, 3.82),
    "D5": (3.83, 4.41),
    "D6": (4.42, 5.00),
}

# FLAGS bits treated as "bad pixel" when stacking. Deliberately NOT masking
# SOURCE (21) or OUTLIER (19): a real moving object can be marked as an outlier,
# and masking it would erase exactly what users are looking for.
# TRANSIENT (0) and SUR_ERROR (2) are NOT masked either: the onboard processing sets them
# on large areas around bright stars (measured: ~70% of pixels near R Dra), and masking
# them deletes the stars' wings. Single-image glitches are removed by the stacking instead.
BAD_FLAG_BITS = [int(b) for b in os.environ.get(
    "SPHEREX_BAD_BITS", "6,9,10,11,27").split(",")]
# BLOOM (26) is not masked either: it covers the whole wing ring of very bright stars
# (all 28 ring pixels around R Dra), which is exactly where their brightness is measured.
# OVERFLOW / NONLINEAR: saturated cores of bright stars (filled, not masked)
SATURATION_FLAG_BITS = [1, 15]
# Bits shown in the "artifact" overlay (contamination flags users may want to see).
ARTIFACT_FLAG_BITS = [17, 20, 22, 23, 24, 25, 26, 27, 28]
FLAG_NAMES = {
    0: "TRANSIENT", 1: "OVERFLOW", 2: "SUR_ERROR", 6: "NONFUNC", 7: "DICHROIC",
    9: "MISSING_DATA", 10: "HOT", 11: "COLD", 12: "FULLSAMPLE", 14: "PHANMISS",
    15: "NONLINEAR", 17: "PERSIST", 19: "OUTLIER", 20: "CROSSTALK", 21: "SOURCE",
    22: "GHOST", 23: "GHOST_FPA", 24: "GHOST_EXT", 25: "STREAK", 26: "BLOOM",
    27: "SNOWBALL", 28: "HALO",
}

NATIVE_PIX_ARCSEC = 6.15     # SPHEREx native pixel scale
MAX_GRID = 220               # max output image size (pixels per side)
MAX_WORKERS = int(os.environ.get("SPHEREX_WORKERS", "6"))   # be gentle: IRSA returns 503 when busy
DOWNLOAD_TIMEOUT = 120
DOWNLOAD_RETRIES = 6

# Epoch grouping defaults: split the time series where there's a gap > GAP_DAYS,
# then split long continuous stretches (deep fields near the ecliptic poles) into
# chunks of at most SPAN_DAYS.
GAP_DAYS = 15.0
SPAN_DAYS = 45.0
PER_EPOCH = 12               # images downloaded per epoch (spread across detectors)
MAX_EPOCHS = 12
MAX_FOV_ARCMIN = 30.0
