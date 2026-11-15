import numpy as np

from app import imaging
from app.catalogs import parse_coords, propagate


def test_group_epochs_survey_and_pole():
    # two survey visits 180 d apart, each ~10 d long
    t = np.r_[np.linspace(60800, 60810, 20), np.linspace(60990, 61000, 20)]
    g = imaging.group_epochs(t, 15, 45)
    assert len(g) == 2 and sum(map(len, g)) == 40
    # continuous coverage (ecliptic pole) for 180 days -> split into <=45 d chunks
    t = np.linspace(60800, 60980, 400)
    g = imaging.group_epochs(t, 15, 45)
    assert len(g) == 4
    assert all(np.ptp(t[x]) <= 45 for x in g)


def test_select_images_balances_detectors():
    rows = [{"det": f"D{d}", "mjd": 60800 + i} for d in range(1, 7) for i in range(10)]
    pick = imaging.select_images(rows, 12)
    dets = [r["det"] for r in pick]
    assert len(pick) == 12 and all(dets.count(f"D{d}") == 2 for d in range(1, 7))


def test_resample_shift_and_nan():
    img = np.zeros((40, 40), np.float32)
    img[20, 20] = 1
    img[5, 5] = np.nan
    yy, xx = np.indices((40, 40)).astype(float)
    out = imaging.resample(img, xx + 1, yy)          # sample one pixel to the right
    assert out[20, 19] == 1.0
    assert np.isnan(out[5, 4])
    assert np.isfinite(out[10, 10])


def test_snr_and_combine():
    rng = np.random.default_rng(1)
    a = rng.normal(0, 2, (50, 50)).astype(np.float32)
    s = imaging.to_snr(a)
    assert abs(np.std(s) - 1) < 0.1
    c = imaging.combine_detectors([s, s])
    assert abs(np.nanstd(c) - np.sqrt(2)) < 0.15


def test_aperture_photometry():
    img = np.zeros((30, 30), np.float32) + 5
    img[15, 15] += 100
    f, err, n, nbad = imaging.aperture_photometry(img, np.ones_like(img), 15, 15)
    assert abs(f - 100) < 1e-3 and n > 0 and nbad == 0


def test_parse_coords():
    ra, dec = parse_coords("08h55m10.831s -7d14m42.53s")
    assert abs(ra - 133.795129) < 1e-4 and abs(dec - -7.245147) < 1e-4
    ra, dec = parse_coords("08 55 10.831 -07 14 42.53")
    assert abs(dec - -7.245147) < 1e-4
    assert parse_coords("269.452 4.693") == (269.452, 4.693)
    assert parse_coords("-00 30 00") is None
    ra, dec = parse_coords("12 00 00 -00 30 00")
    assert abs(dec + 0.5) < 1e-9


def test_propagate_barnard():
    # Barnard's star: pmRA -801.6, pmDE 10362 mas/yr; 25 yr -> ~259" north
    ra, dec = propagate(269.452, 4.693, -801.6, 10362.0, 51544.5, 51544.5 + 25 * 365.25)
    assert abs((dec - 4.693) * 3600 - 259.05) < 0.1


def test_fill_holes_saturated_core():
    rng = np.random.default_rng(0)
    img = rng.normal(0, 1, (41, 41)).astype(np.float32)
    yy, xx = np.indices(img.shape)
    r = np.hypot(xx - 20, yy - 20)
    img += 500 * np.exp(-r ** 2 / 18)
    img[r < 3] = np.nan                      # masked core
    img[0:3, 0:3] = np.nan                   # edge gap: must stay NaN
    out = imaging.fill_holes(img)
    assert np.all(out[r < 3] == np.nanmax(img))
    assert np.isnan(out[0, 0])


def test_merge_small_epochs():
    t = np.r_[np.linspace(0, 5, 10), [40, 41], np.linspace(200, 205, 10)]
    g = imaging.merge_small(imaging.group_epochs(t, 15, 45), t)
    assert len(g) == 2 and len(g[0]) == 12


def test_wing_photometry_tracks_brightness():
    yy, xx = np.indices((41, 41))
    r = np.hypot(xx - 20, yy - 20)
    fl = []
    for amp in (100.0, 200.0):
        img = amp * np.exp(-r ** 2 / 8) + 3
        img[r < 1.5] = np.nan                 # overloaded core
        fl.append(imaging.wing_photometry(img, None, 20, 20)[0])
    assert abs(fl[1] / fl[0] - 2) < 0.01


def test_two_image_stack_rejects_hot_pixel():
    rng = np.random.default_rng(3)
    a = rng.normal(0, 1, (30, 30)).astype(np.float32)
    b = rng.normal(0, 1, (30, 30)).astype(np.float32)
    b[10, 10] = 500
    s = imaging.robust_stack([a, b])
    assert s[10, 10] < 5
