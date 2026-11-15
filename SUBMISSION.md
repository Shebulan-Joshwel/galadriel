# NASA Space Apps 2026: submission text for Galadriel

Copy each section into the matching field on the project submission page.
Challenge: **Planet X and SPHEREx**. Team: rhaegar (solo), Colombo.

---

## 1. Project Name
Galadriel: SPHEREx Motion Explorer

## 2. High-Level Project Summary
Galadriel is a free web tool that lets anyone search NASA's SPHEREx infrared sky survey for
things that move or change: nearby stars, cold brown dwarfs and, one day perhaps, an unknown
planet. Type a star's name or coordinates and Galadriel finds every SPHEREx picture of that
spot, cleans and aligns them, and plays them as a blink so moving objects jump out. Click
anything to get its speed measured from SPHEREx alone, a check against ESA's Gaia catalogue,
its 0.75–5 µm spectrum and its light curve. We tested it on all five challenge targets with
real data: every speed lands within one SPHEREx pixel of the catalogue value. Guided missions,
plain-language explanations and 10 languages, including Sinhala and Tamil, mean a school
student in Colombo can join the same search as a professional astronomer.

## 3. Link to Project Demo
<YouTube link to the 30-second video, with English subtitles, set to Public or Unlisted>

## 4. Link to Final Project
https://galadriel-voae.onrender.com
Code: https://github.com/Shebulan-Joshwel/galadriel

## 5. Detailed Project Description
**What it does.** Planet X, if it exists, would be cold and faint: invisible in visible light
but glowing in the infrared, and creeping across the sky over months. SPHEREx photographs the
whole sky every six months in 102 infrared colours, so motion like that is in its data. The
hard part is seeing it. Galadriel turns SPHEREx's archive into a "blink comparator", the same
technique that found Pluto in 1930, but in a browser, for any spot on the sky.

**How it works.**
1. Find: a TAP query to NASA/IPAC IRSA lists every SPHEREx image covering the target. Star
   names are resolved with CDS Sesame and moved for proper motion to today's position
   (Barnard's Star is 4.4′ from its year-2000 position).
2. Clean: for each image, a small cutout is downloaded; the zodiacal-light model is
   subtracted, bad pixels are masked using the FLAGS bits, saturated star centres are filled,
   and every cutout is resampled onto one common grid.
3. Group: images are grouped into visits (a new visit after a 15-day gap), stacked with a
   median per visit and per detector, scaled to signal-to-noise and combined.
4. Compare: Blink, Difference (each visit minus the others, so still stars vanish), Change map
   (one picture of everything that changed) and Deep stack. Gaia DR3 stars are moved to each
   visit's date, so a mover with no Gaia match stands out and is listed as a candidate.
5. Measure: click an object and Galadriel follows it across visits and fits a straight line
   (its proper motion), finds the camera where it is brightest, and builds its spectrum (each
   SPHEREx picture samples a different wavelength) and its light curve. For stars too bright
   for the detector, it measures the glow around the core.

**Proof it works.** Run on real SPHEREx data for all five challenge targets, with no catalogue
input: Barnard's Star 9.8″/yr (catalogue 10.4), WISE 0855 11.1″/yr (8.2, visible only in the
4.4–5 µm camera), Epsilon Indi B 4.4″/yr (4.7). RW Aurigae and R Draconis are correctly
reported as not moving, and R Draconis's 12 visits show its brightness rising and falling.
Every error is under one SPHEREx pixel (6.2″). The table is inside the app ("Does it work?").

**Who it is for.** Students, teachers, amateur astronomers and citizen scientists, as well as
professionals. The expert console is the default; four one-minute guided missions, a numbered
page map, a plain-language briefing under the image and an ⓘ on every panel teach newcomers
as they go. The interface speaks English, Chinese, Hindi, Spanish, French, Arabic, Bengali,
Portuguese, Sinhala and Tamil. Any finding can be shared as a link or embedded in another page.

**Built to be reliable.** The five challenge targets are bundled with the app, so they open
in under a second and keep working when the archive is down (this happened to us repeatedly
during the hackathon). The tool queries IRSA's live tables, so new SPHEREx data releases appear
without code changes.

**Tools.** Python, FastAPI, NumPy, SciPy, Astropy, Astroquery; vanilla JavaScript and Canvas
(no frameworks), Web Audio; Docker on Render. Fully open source.

## 6. NASA Data
- **SPHEREx spectral images** (Quick Release / Data Release, Level 2) from the NASA/IPAC
  Infrared Science Archive (IRSA): the IMAGE, FLAGS, VARIANCE and ZODI extensions, the spectral
  WCS for each pixel's wavelength, and the image metadata tables `spherex.plane` and
  `spherex.artifact`, queried through IRSA's TAP service and cutout service.
- These are the core of the project: every picture, motion measurement, spectrum and light
  curve comes from SPHEREx data.
- 2MASS near-infrared images (via Aladin Lite) give wider sky context.

## 7. Space Agency Partner & Other Data
- **ESA Gaia DR3** (European Space Agency): positions and proper motions, used to check every
  motion we measure and to flag movers that Gaia does not know. Accessed via the ESA Gaia
  archive and CDS VizieR.
- CDS Sesame / SIMBAD (Strasbourg) for name resolution and catalogue proper motions.
- Aladin Lite (CDS) for the sky-context view.
- IRSA SPHEREx tutorial notebooks (BSD-3) as a reference for data-access patterns.
- Fonts: Michroma, IBM Plex Sans, IBM Plex Mono (SIL Open Font License).
- No NASA logos or mission insignia are used.

## 8. Use of Artificial Intelligence
Yes. I used Claude (Anthropic) as a coding and writing assistant throughout the hackathon:
it helped write and debug the Python backend and JavaScript frontend, draft the interface
text and its translations into nine languages, and draft this write-up. I directed the
project, chose the challenge approach and the design, tested every feature, ran the
real-data checks on my own machine, and reviewed the results. All scientific numbers come
from running the code on real SPHEREx data, not from AI. The Sinhala and Tamil text was
reviewed by me [keep this sentence only after you have proofread them]. No AI-generated images, video or audio are used; the video is a screen
recording of the real app.

---

# 30-second demo video (must not exceed 30 s; English subtitles required)

Record the live site full-screen (QuickTime → New Screen Recording), with sound off or quiet
switch clicks. Add the subtitles below as captions (YouTube: Subtitles → Upload or type).
Open the site a minute before recording so the free server is awake.

| Time | On screen | Subtitle |
|---|---|---|
| 0–3 s | Galadriel console, Barnard's Star loaded, blinking | "Planet X would be cold, faint, and moving." |
| 3–7 s | Press Difference: still stars vanish, white–amber pair | "Galadriel blinks NASA SPHEREx images so movers stand out." |
| 7–11 s | Click the star: Object panel shows 9.8″/yr, Gaia ✓ | "Barnard's Star: speed measured from SPHEREx alone. Gaia agrees." |
| 11–16 s | Targets → WISE 0855, switch to D6, faint dot walks | "The coldest brown dwarf only appears at 4.4–5 µm." |
| 16–20 s | Scroll to Spectrum and Light curve charts | "Click anything: spectrum and light curve, instantly." |
| 20–24 s | Scroll to "Does it work?" table | "Tested on all five challenge targets: every result within one pixel." |
| 24–28 s | Globe menu → සිංහල, then தமிழ் | "Guided missions, plain words, 10 languages." |
| 28–30 s | Back to console, wordmark | "Galadriel. Anyone can search for Planet X." |

Tips: zoom the browser to 110% so text is readable; keep each action to one click; trim in
QuickTime (Edit → Trim) to 29 seconds to be safe.
