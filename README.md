---
title: Galadriel
emoji: 🌌
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
---

# Galadriel: SPHEREx motion explorer

A public web tool for the 2026 NASA Space Apps Challenge, **"Planet X and SPHEREx"**.
Type a name or RA/Dec. The tool then plays NASA SPHEREx infrared images of that patch of
sky, one survey visit after another, so anything that moves or changes stands out.

## What it does
- **Blink** through every SPHEREx survey visit, all on one shared brightness scale.
- **Difference** mode: each visit minus the average of the others. Still stars disappear and
  moving objects show up as light/dark pairs.
- **Change map**: one image of how much each pixel varied over time. It marks movers and
  variable stars automatically and lists them, flagging any that have **no Gaia match**
  as candidates worth checking.
- **Deep stack**: all visits added together for the faintest view.
- **102 bands, used well**: images are stacked per detector (D1–D6) and converted to
  signal-to-noise, then combined into a broadband image. The "Colour" view is a false-colour
  composite in which cold brown dwarfs look red.
- **Spectra on the fly**: click any source. Each SPHEREx image samples it at a different
  wavelength (linear variable filters), so together they give a **spectrum** (0.75–5 µm) and a
  **light curve**.
- **Proper-motion-aware name lookup**: Barnard's Star is about 4.4′ from its J2000 position, so
  names are resolved through CDS Sesame and moved to today's position.
- **Gaia DR3 overlay**, moved to each visit's date, with tracks for fast-moving stars.
- Contamination **flag overlay** (ghosts, streaks, persistence, and others).
- **Shareable URLs** (`?name=R%20Dra&fov=4&mode=diff&ch=RGB`), an **embed** mode
  (`&embed=1`), and **Save animation** (WebM).
- **Stays current automatically**: it queries IRSA's live SPHEREx tables, so new Quick
  Releases and Data Releases show up without code changes. All release-specific settings
  are in `app/config.py`.

## Run it
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# open http://localhost:8000
```
Check the five challenge targets against the real archive (this also warms the cache):
```bash
python -m scripts.check_targets
```
To work on the UI without internet access, run `python scripts/mock_server.py`, which uses
synthetic data, and open http://localhost:8001.

Run the tests with `pytest -q`.

## Deploy (free public URL)
Hugging Face Spaces: create a Space, choose the **Docker** SDK, and push this folder.
The front matter at the top of this README configures it. Render and Railway can use the
same `Dockerfile`.

## How it works
1. A TAP query to IRSA (`spherex.plane` joined with `spherex.artifact`) finds every spectral
   image whose footprint contains the target.
2. Exposures are grouped into epochs: the series is split at gaps longer than 15 days, and
   continuous coverage near the ecliptic poles is cut into chunks of 45 days or less. Up to
   12 images per epoch are picked, balanced across the six detectors.
3. IRSA cutouts (`?center=ra,decd&size=deg`) are downloaded in parallel and cached on disk.
   The ZODI model is subtracted, bad pixels are masked using the FLAGS bits, and every image
   is resampled onto one TAN grid centred on the target.
4. Stacking: a per-pixel median for each epoch and detector, then signal-to-noise scaling,
   then a broadband sum of S/N maps divided by √N.
5. Photometry: aperture photometry in each native image, with the wavelength read from the
   spectral WCS (`key="W"`, a lookup table in WCS-WAVE).

Data credits: NASA/JPL-Caltech SPHEREx via NASA/IPAC IRSA; ESA Gaia DR3 via CDS VizieR;
CDS Sesame; Aladin Lite (CDS). Data-access patterns follow the IRSA SPHEREx tutorial
notebooks (BSD-3).
