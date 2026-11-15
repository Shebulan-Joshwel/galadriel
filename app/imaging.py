"""Pure-numpy image processing: epoch grouping, resampling, robust stacking, photometry.
No astropy here so it can be unit-tested anywhere."""
from __future__ import annotations

import numpy as np
from scipy.ndimage import map_coordinates


# ---------------------------------------------------------------- epochs
def group_epochs(mjds, gap_days=15.0, span_days=45.0):
    """Return a list of index arrays, one per epoch.

    1. Split the (sorted) time series wherever consecutive observations are more than
       `gap_days` apart -> SPHEREx's ~6-monthly survey visits.
    2. Any group longer than `span_days` (continuous coverage near the ecliptic poles)
       is cut into equal chunks, giving finer time resolution where the data allow it.
    """
    mjds = np.asarray(mjds, dtype=float)
    if mjds.size == 0:
        return []
    order = np.argsort(mjds)
    t = mjds[order]
    breaks = np.where(np.diff(t) > gap_days)[0] + 1
    groups = np.split(order, breaks)
    out = []
    for g in groups:
        tg = mjds[g]
        span = tg.max() - tg.min()
        if span <= span_days:
            out.append(g)
            continue
        n = int(np.ceil(span / span_days))
        edges = np.linspace(tg.min(), tg.max() + 1e-6, n + 1)
        for k in range(n):
            sel = g[(tg >= edges[k]) & (tg < edges[k + 1])]
            if sel.size:
                out.append(sel)
    return out


def merge_small(groups, mjds, min_size=4, max_gap=60.0):
    """Fold epochs with fewer than `min_size` exposures into the nearest epoch in time
    (if within `max_gap` days), so every frame of the blink is reasonably clean."""
    mjds = np.asarray(mjds, dtype=float)
    groups = [np.asarray(g) for g in groups]
    changed = True
    while changed and len(groups) > 1:
        changed = False
        for i, g in enumerate(groups):
            if len(g) >= min_size:
                continue
            t = mjds[g].mean()
            cand = [(abs(mjds[h].mean() - t), j) for j, h in enumerate(groups) if j != i]
            dist, j = min(cand)
            if dist <= max_gap:
                groups[j] = np.sort(np.concatenate([groups[j], g]))
                groups.pop(i)
                changed = True
                break
    return sorted(groups, key=lambda g: mjds[g].min())


def pick_evenly(groups, max_groups):
    """Keep at most `max_groups` epochs, evenly spaced, always keeping first and last."""
    if len(groups) <= max_groups:
        return groups
    idx = np.unique(np.round(np.linspace(0, len(groups) - 1, max_groups)).astype(int))
    return [groups[i] for i in idx]


def select_images(rows, per_epoch):
    """Round-robin across detectors so every epoch samples the full 0.75-5 um range.
    `rows` is a list of dicts with keys 'det' and 'mjd'."""
    by_det = {}
    for r in sorted(rows, key=lambda r: r["mjd"]):
        by_det.setdefault(r["det"], []).append(r)
    # spread picks evenly in time within each detector
    queues = {}
    for d, lst in by_det.items():
        k = min(len(lst), per_epoch)
        idx = np.unique(np.round(np.linspace(0, len(lst) - 1, k)).astype(int))
        queues[d] = [lst[i] for i in idx]
    chosen = []
    while len(chosen) < per_epoch and any(queues.values()):
        for d in sorted(queues):
            if queues[d] and len(chosen) < per_epoch:
                chosen.append(queues[d].pop(0))
    return chosen


# ---------------------------------------------------------------- resampling
def resample(data, x_in, y_in):
    """Bilinear resampling of `data` at input-pixel coordinates (x_in, y_in) (0-based),
    NaN-aware: NaNs never bleed into neighbours."""
    data = np.asarray(data, dtype=np.float32)
    good = np.isfinite(data)
    filled = np.where(good, data, 0.0).astype(np.float32)
    coords = np.array([y_in.ravel(), x_in.ravel()])
    val = map_coordinates(filled, coords, order=1, mode="constant", cval=0.0)
    wt = map_coordinates(good.astype(np.float32), coords, order=1, mode="constant", cval=0.0)
    out = np.full(val.shape, np.nan, dtype=np.float32)
    ok = wt > 0.6
    out[ok] = val[ok] / wt[ok]
    return out.reshape(x_in.shape)


def resample_mask(mask, x_in, y_in):
    """Nearest-neighbour resampling of a boolean mask (outside -> False)."""
    coords = np.array([y_in.ravel(), x_in.ravel()])
    v = map_coordinates(mask.astype(np.float32), coords, order=0, mode="constant", cval=0.0)
    return (v > 0.5).reshape(x_in.shape)


def fill_holes(img, bright_sigma=30.0):
    """Fill enclosed NaN holes (e.g. masked saturated star cores). A hole whose rim is
    bright becomes a solid max-brightness disk; a faint one gets its rim median."""
    from scipy.ndimage import binary_dilation, binary_fill_holes, label
    nan = ~np.isfinite(img)
    if not nan.any():
        return img
    enclosed = binary_fill_holes(~nan) & nan
    if not enclosed.any():
        return img
    out = img.copy()
    s = robust_sigma(img)
    med = np.nanmedian(img)
    vmax = np.nanmax(img)
    lab, n = label(enclosed)
    for k in range(1, n + 1):
        hole = lab == k
        rim = binary_dilation(hole, iterations=1) & ~hole & np.isfinite(img)
        if not rim.any():
            continue
        r = np.median(img[rim])
        out[hole] = vmax if np.isfinite(s) and r - med > bright_sigma * s else r
    return out


# ---------------------------------------------------------------- statistics
def robust_sigma(a):
    a = np.asarray(a)
    a = a[np.isfinite(a)]
    if a.size < 5:
        return np.nan
    med = np.median(a)
    return 1.4826 * np.median(np.abs(a - med))


def background_subtract(img):
    a = img[np.isfinite(img)]
    if a.size == 0:
        return img
    return img - np.median(a)


def robust_stack(images):
    """Combine images of the same epoch & detector (different wavelengths/exposures).
    n>=3: per-pixel median (kills cosmic rays/artefacts); else mean."""
    if not images:
        return None
    cube = np.stack(images)
    with np.errstate(all="ignore"):
        if len(images) >= 3:
            return np.nanmedian(cube, axis=0).astype(np.float32)
        out = np.nanmean(cube, axis=0)
        if len(images) == 2:
            # a hot pixel / cosmic ray in one of the two images: keep the fainter value
            a, b = cube
            sig = np.nanmax([robust_sigma(a), robust_sigma(b)])
            jump = np.abs(a - b) > 6 * sig * np.sqrt(2)
            out = np.where(jump & np.isfinite(a) & np.isfinite(b), np.fmin(a, b), out)
        return out.astype(np.float32)


def to_snr(img):
    """Scale an image to units of its own background noise (signal-to-noise map),
    which lets us add very different wavelengths together fairly."""
    s = robust_sigma(img)
    if not np.isfinite(s) or s <= 0:
        return np.full_like(img, np.nan)
    return (img / s).astype(np.float32)


def combine_detectors(snr_maps):
    """Optimal-ish broadband detection image: sum of S/N maps / sqrt(N)."""
    maps = [m for m in snr_maps if m is not None]
    if not maps:
        return None
    cube = np.stack(maps)
    n = np.sum(np.isfinite(cube), axis=0)
    with np.errstate(all="ignore"):
        s = np.nansum(cube, axis=0) / np.sqrt(np.maximum(n, 1))
    s[n == 0] = np.nan
    return s.astype(np.float32)


# ---------------------------------------------------------------- photometry
def aperture_photometry(img, var, x, y, r_ap=1.5, r_in=4.0, r_out=7.0, badmask=None):
    """Simple aperture photometry at (x, y) (0-based pixel coords).
    Returns (sum, err, n_pix, n_bad) in image units * pixels, or None if off-image."""
    ny, nx = img.shape
    if not (0 <= x < nx and 0 <= y < ny):
        return None
    yy, xx = np.indices(img.shape)
    rr = np.hypot(xx - x, yy - y)
    ap = rr <= r_ap
    ann = (rr >= r_in) & (rr <= r_out) & np.isfinite(img)
    if badmask is not None:
        ann &= ~badmask
    if ap.sum() == 0 or ann.sum() < 5:
        return None
    bkg = np.median(img[ann])
    vals = img[ap]
    good = np.isfinite(vals)
    if good.sum() < max(1, 0.6 * ap.sum()):
        return None
    flux = np.sum(vals[good] - bkg) * ap.sum() / good.sum()
    if var is not None:
        v = var[ap]
        v = v[np.isfinite(v)]
        err = float(np.sqrt(np.sum(v))) if v.size else np.nan
    else:
        err = np.nan
    n_bad = int(badmask[ap].sum()) if badmask is not None else 0
    return float(flux), err, int(ap.sum()), n_bad


def wing_photometry(img, var, x, y, r_in=1.6, r_out=3.2, b_in=6.0, b_out=9.0, badmask=None):
    """Brightness from the PSF wings (an annulus outside an overloaded core).
    Wing flux is proportional to total flux, so it traces brightness changes of stars
    too bright to measure directly. Returns (flux, err, n_pix) or None."""
    ny, nx = img.shape
    if not (0 <= x < nx and 0 <= y < ny):
        return None
    yy, xx = np.indices(img.shape)
    rr = np.hypot(xx - x, yy - y)
    good = np.isfinite(img) if badmask is None else (np.isfinite(img) & ~badmask)
    ring = (rr >= r_in) & (rr <= r_out) & good
    bkg = (rr >= b_in) & (rr <= b_out) & good
    full = ((rr >= r_in) & (rr <= r_out)).sum()
    if ring.sum() < 0.5 * full or bkg.sum() < 8:
        return None
    b = np.median(img[bkg])
    flux = float(np.mean(img[ring] - b) * full)
    err = float(np.sqrt(np.nansum(var[ring])) * full / ring.sum()) if var is not None else np.nan
    return flux, err, int(ring.sum())


def saturated_centre(sat, img, x, y, r=3.0):
    """Centre of an overloaded star core near (x, y): mean position of saturated/NaN
    pixels within r, which is far more stable than the catalogue position."""
    yy, xx = np.indices(sat.shape)
    near = np.hypot(xx - x, yy - y) <= r
    core = near & (sat | ~np.isfinite(img))
    if core.sum() < 2:
        return x, y
    return float(xx[core].mean()), float(yy[core].mean())


def flag_mask(flags, bits):
    if flags is None:
        return None
    m = 0
    for b in bits:
        m |= (1 << b)
    return (flags.astype(np.int64) & m) != 0
