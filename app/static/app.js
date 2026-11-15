/* SPHEREx Blink — front end. No build step, no dependencies. */
"use strict";

const $ = (id) => document.getElementById(id);
/* plain-language explanations for the simple view */
const STORIES = {
  "Barnard's Star": { title: "Barnard's Star", cap: "Watch the star in the circle",
    lines: ["These are SPHEREx pictures of the same patch of sky, taken months apart. The bright star in the orange circle is Barnard's Star, 6 light-years away.",
            "Watch it creep <b>upward</b> from picture to picture, while every other star stays still."],
    note: "It moves about 10″ a year, faster than any other star in the sky." },
  "WISE J085510.83-071442.5": { title: "WISE 0855, the coldest brown dwarf", cap: "Look just left of the circle",
    lines: ["A brown dwarf is too small to shine like a star. This one is about −25 °C, colder than a freezer.",
            "We're showing SPHEREx's longest-wavelength camera (4.4–5.0 µm), the only one where it glows. Look <b>just left of the circle</b>: a faint dot walks to the right over the pictures."],
    note: "In ordinary pictures a background star sits on top of it and hides it." },
  "eps Ind B": { title: "Epsilon Indi B", cap: "Watch the spot in the circle",
    lines: ["Two brown dwarfs circling each other, 12 light-years away.",
            "Watch the bright spot in the circle drift <b>down and to the left</b> across the pictures."],
    note: "They move about 4.7″ a year." },
  "RW Aur": { title: "RW Aurigae", cap: "Is it brighter or fainter?",
    lines: ["A very young star, still wrapped in the dusty disc it formed from. It doesn't move.",
            "Its brightness changes when dust passes in front of it. Turn on <b>Show only what moved</b>: whatever stays visible changed between pictures."],
    note: "Click the star to measure its brightness in every picture." },
  "R Dra": { title: "R Draconis", cap: "Click the star in the middle",
    lines: ["A dying giant star that swells and shrinks every 8 months or so.",
            "It doesn't move. <b>Click it</b> to see how its brightness changed between SPHEREx's visits."],
    note: "SPHEREx passes over this spot again and again, so there are many pictures." },
};
let simple = true;
function explain(html) { $("explainBody").innerHTML = html; }
function storyFor(q) { return STORIES[q] || null; }
function explainView() {
  if (!S.view) return;
  const st = storyFor(S.target);
  if (S.mode === "diff") {
    explain(`<p class="big">Only what moved</p><p>Each picture has had the others subtracted, so stars that stayed put cancel out.</p><p>What's left changed: <b>white</b> is where something is now, <b>amber</b> is where it used to be. A white and amber pair side by side means it moved.</p><p class="note">Click on anything that's left to measure it.</p>`);
    return;
  }
  if (st) explain(`<p class="big">${st.title}</p>${st.lines.map((l) => `<p>${l}</p>`).join("")}<p class="note">${st.note}</p>`);
  else explain(`<p class="big">${$("capTarget").textContent}</p><p>SPHEREx pictures of this patch of sky, taken months apart. Anything that jumps between pictures is moving.</p><p class="note">Click any star to measure how fast it moves.</p>`);
}
function setSimple(on) {
  simple = on;
  document.body.classList.toggle("simple", on);
  const mt = $("modeToggle").querySelector("b");
  if (mt) mt.textContent = on ? "Full view" : "Simple view";
  try { localStorage.setItem("sb_simple", on ? "1" : "0"); } catch (e) { /* */ }
  if (!on) showTab(document.querySelector('.tab[aria-selected="true"]')?.dataset.tab || "object");
  if (on) explainView();
  setTimeout(draw, 0);
}

const PRESETS = [
  { q: "Barnard's Star", fov: 3, short: "The fastest star", note: "Fastest-moving star in the sky, about 10″ a year" },
  { q: "WISE J085510.83-071442.5", label: "WISE 0855", fov: 3, ch: "D6", short: "The coldest brown dwarf", note: "Coldest known brown dwarf; only visible at 4.4–5 µm, so we open that detector" },
  { q: "eps Ind B", label: "Epsilon Indi B", fov: 4, short: "Twin brown dwarfs", note: "A pair of brown dwarfs moving together" },
  { q: "RW Aur", label: "RW Aurigae", fov: 4, short: "A flickering young star", note: "Young star that dims and brightens" },
  { q: "R Dra", label: "R Draconis", fov: 4, short: "A breathing giant", note: "Pulsating giant; near the ecliptic pole, so many visits" },
];
const CHANNEL_COLOURS = { ALL: "linear-gradient(90deg,#5b8cff,#4fd1c5 22%,#9be15d 42%,#f6c445 62%,#ff9a45 80%,#ff5a6e)", RGB: "linear-gradient(90deg,#5b8cff,#9be15d,#ff5a6e)",
  D1: "#5b8cff", D2: "#4fd1c5", D3: "#9be15d", D4: "#f6c445", D5: "#ff9a45", D6: "#ff5a6e" };
const CHANNEL_SUB = { ALL: "0.75–5.0 µm", RGB: "false colour", D1: "0.75–1.1 µm", D2: "1.1–1.6 µm", D3: "1.6–2.4 µm", D4: "2.4–3.8 µm · CH₄", D5: "3.8–4.4 µm · CO₂", D6: "4.4–5.0 µm · cold" };
const CHANNELS = [
  ["ALL", "All", "All six detectors combined (0.75–5.0 µm), weighted by signal-to-noise."],
  ["RGB", "Colour", "False colour: blue 0.75–1.6 µm, green 1.6–3.8 µm, red 3.8–5.0 µm. Cold brown dwarfs look red."],
  ["D1", "0.75–1.1 µm", "Detector 1: near-visible light."],
  ["D2", "1.1–1.6 µm", "Detector 2."],
  ["D3", "1.6–2.4 µm", "Detector 3."],
  ["D4", "2.4–3.8 µm", "Detector 4: includes the 3.3 µm methane band seen in cold brown dwarfs."],
  ["D5", "3.8–4.4 µm", "Detector 5: includes the 4.3 µm CO₂ ice band."],
  ["D6", "4.4–5.0 µm", "Detector 6: where the coldest objects are brightest."],
];
const DET_COLOURS = { D1: "#5b8cff", D2: "#4fd1c5", D3: "#9be15d", D4: "#f6c445", D5: "#ff9a45", D6: "#ff5a6e" };
const COL = { amber: "#ffb547", teal: "#46d39a", coral: "#ff7a59", mauve: "#7d8da1", cream: "#eef3f8", muted: "#7d8da1", line: "#1d2a3a", ice: "#7fd3ff" };

/* tiny event bus so the missions (missions.js) can follow what the user does */
const bus = {};
const tr = (str, ...v) => (window.I18N ? window.I18N.t(str, ...v) : v.reduce((o, x, i) => o.split(`{${i}}`).join(x), str));
function on(ev, fn) { (bus[ev] = bus[ev] || []).push(fn); }
function emit(ev, data) { (bus[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.warn(e); } }); }

const S = {
  view: null, frames: {}, epoch: 0, playing: false, timer: null,
  channel: "ALL", mode: "blink", cmap: "gray", stretch: "asinh", contrast: 99.3,
  gaia: null, finds: [], phot: null, target: null, resolveInfo: null,
  showGaia: true, showMovers: true, showFlags: false, showGrid: true,
  limits: null,
};

/* ------------------------------------------------------------------ utilities */
function decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
function fmtRA(ra) {
  let h = ((ra % 360) + 360) % 360 / 15;
  const hh = Math.floor(h), m = (h - hh) * 60, mm = Math.floor(m), ss = (m - mm) * 60;
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}m${ss.toFixed(2).padStart(5, "0")}s`;
}
function fmtDec(dec) {
  const sg = dec < 0 ? "−" : "+", a = Math.abs(dec);
  const d = Math.floor(a), m = (a - d) * 60, mm = Math.floor(m), ss = (m - mm) * 60;
  return `${sg}${String(d).padStart(2, "0")}°${String(mm).padStart(2, "0")}′${ss.toFixed(1).padStart(4, "0")}″`;
}
const D2R = Math.PI / 180;

/* gnomonic (TAN) projection matching the server's grid WCS; pixels 0-based, y up */
function world2pix(ra, dec) {
  const w = S.view.wcs, ra0 = w.crval[0] * D2R, de0 = w.crval[1] * D2R;
  const a = ra * D2R, d = dec * D2R;
  const cosc = Math.sin(de0) * Math.sin(d) + Math.cos(de0) * Math.cos(d) * Math.cos(a - ra0);
  const xi = Math.cos(d) * Math.sin(a - ra0) / cosc / D2R;
  const eta = (Math.cos(de0) * Math.sin(d) - Math.sin(de0) * Math.cos(d) * Math.cos(a - ra0)) / cosc / D2R;
  return [w.crpix[0] - 1 + xi / w.cdelt[0], w.crpix[1] - 1 + eta / w.cdelt[1]];
}
function pix2world(x, y) {
  const w = S.view.wcs, ra0 = w.crval[0] * D2R, de0 = w.crval[1] * D2R;
  const xi = (x - (w.crpix[0] - 1)) * w.cdelt[0] * D2R, eta = (y - (w.crpix[1] - 1)) * w.cdelt[1] * D2R;
  const rho = Math.hypot(xi, eta);
  if (rho === 0) return [w.crval[0], w.crval[1]];
  const c = Math.atan(rho);
  const dec = Math.asin(Math.cos(c) * Math.sin(de0) + eta * Math.sin(c) * Math.cos(de0) / rho);
  const ra = ra0 + Math.atan2(xi * Math.sin(c), rho * Math.cos(de0) * Math.cos(c) - eta * Math.sin(de0) * Math.sin(c));
  return [((ra / D2R) % 360 + 360) % 360, dec / D2R];
}

function percentile(arr, p) {
  const v = [];
  const step = Math.max(1, Math.floor(arr.length / 40000));
  for (let i = 0; i < arr.length; i += step) if (Number.isFinite(arr[i])) v.push(arr[i]);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.round((p / 100) * (v.length - 1))))];
}

/* ------------------------------------------------------------------ frames */
function chan(ei, name) {
  const key = ei + ":" + name;
  if (S.frames[key] !== undefined) return S.frames[key];
  const b = S.view.epochs[ei].channels[name];
  return (S.frames[key] = b ? decode(b) : null);
}
function nEpochs() { return S.view ? S.view.epochs.length : 0; }
function npix() { return S.view.width * S.view.height; }

function meanOf(list) {
  const n = npix(), out = new Float32Array(n), cnt = new Uint16Array(n);
  for (const a of list) if (a) for (let i = 0; i < n; i++) if (Number.isFinite(a[i])) { out[i] += a[i]; cnt[i]++; }
  for (let i = 0; i < n; i++) out[i] = cnt[i] ? out[i] / cnt[i] : NaN;
  return out;
}
function rgbParts(ei) {
  const pair = (a, b) => {
    const A = chan(ei, a), B = chan(ei, b);
    if (!A && !B) return null;
    const n = npix(), o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = A ? A[i] : NaN, y = B ? B[i] : NaN;
      const fx = Number.isFinite(x), fy = Number.isFinite(y);
      o[i] = fx && fy ? (x + y) / Math.SQRT2 : fx ? x : fy ? y : NaN;
    }
    return o;
  };
  return [pair("D5", "D6"), pair("D3", "D4"), pair("D1", "D2")];
}
/* frame data for epoch ei in the current channel: array of 1 (mono) or 3 (RGB) planes */
/* colour composites only make sense for blink and deep-stack views */
function effChannel() { return S.channel === "RGB" && (S.mode === "diff" || S.mode === "change") ? "ALL" : S.channel; }
function planes(ei) {
  const ch = effChannel(), key = "p:" + ei + ":" + ch;
  if (S.frames[key]) return S.frames[key];
  const p = ch === "RGB" ? rgbParts(ei) : [chan(ei, ch)];
  return (S.frames[key] = p);
}
const memo = {};
function derived(kind) {
  const key = kind + ":" + effChannel();
  if (memo[key]) return memo[key];
  const ne = nEpochs(), np = effChannel() === "RGB" ? 3 : 1, res = [];
  if (kind === "coadd") {
    for (let k = 0; k < np; k++) res.push(meanOf([...Array(ne).keys()].map((e) => planes(e)[k])));
    return (memo[key] = res);
  }
  if (kind === "diff") {
    const out = [];
    for (let e = 0; e < ne; e++) {
      const pl = [];
      for (let k = 0; k < np; k++) {
        const others = meanOf([...Array(ne).keys()].filter((j) => j !== e).map((j) => planes(j)[k]));
        const cur = planes(e)[k], d = new Float32Array(npix());
        for (let i = 0; i < d.length; i++) d[i] = cur ? cur[i] - others[i] : NaN;
        pl.push(d);
      }
      out.push(pl);
    }
    return (memo[key] = out);
  }
  if (kind === "change") {   // per-pixel std across epochs, in units of the typical std
    for (let k = 0; k < np; k++) {
      const n = npix(), s1 = new Float32Array(n), s2 = new Float32Array(n), c = new Uint16Array(n);
      for (let e = 0; e < ne; e++) {
        const a = planes(e)[k];
        if (!a) continue;
        for (let i = 0; i < n; i++) if (Number.isFinite(a[i])) { s1[i] += a[i]; s2[i] += a[i] * a[i]; c[i]++; }
      }
      const sd = new Float32Array(n);
      for (let i = 0; i < n; i++) sd[i] = c[i] >= 2 ? Math.sqrt(Math.max(0, s2[i] / c[i] - (s1[i] / c[i]) ** 2) * c[i] / (c[i] - 1)) : NaN;
      const med = percentile(sd, 50) || 1;
      for (let i = 0; i < n; i++) sd[i] /= med;
      res.push(sd);
      (res.meds = res.meds || []).push(med);
    }
    return (memo[key] = res);
  }
}
function clearMemo() { for (const k in memo) delete memo[k]; S.limits = null; }

function currentPlanes() {
  if (S.mode === "blink") return planes(S.epoch);
  if (S.mode === "diff") return derived("diff")[S.epoch];
  return derived(S.mode);
}

/* one display scale shared by every epoch, so blinking compares like with like */
function computeLimits() {
  const np = effChannel() === "RGB" ? 3 : 1, lims = [];
  for (let k = 0; k < np; k++) {
    let pool;
    if (S.mode === "blink" || S.mode === "diff") {
      const src = S.mode === "blink" ? [...Array(nEpochs()).keys()].map((e) => planes(e)[k]) : derived("diff").map((p) => p[k]);
      const parts = src.filter(Boolean);
      const len = parts.reduce((s, a) => s + a.length, 0);
      pool = new Float32Array(len);
      let o = 0;
      for (const a of parts) { pool.set(a, o); o += a.length; }
    } else pool = derived(S.mode)[k];
    if (S.mode === "diff") {
      const abs = pool.map(Math.abs);
      const m = percentile(abs, S.contrast) || 1;
      lims.push([-m, m]);
    } else if (S.mode === "change") {
      lims.push([1, Math.max(3, percentile(pool, S.contrast))]);
    } else {
      lims.push([percentile(pool, 35), percentile(pool, S.contrast)]);
    }
  }
  S.limits = lims;
}

function stretchFn(t) {
  t = Math.min(1, Math.max(0, t));
  if (S.stretch === "linear") return t;
  if (S.stretch === "sqrt") return Math.sqrt(t);
  const b = 0.08;
  return Math.asinh(t / b) / Math.asinh(1 / b);
}
const HEAT = [[0, 0, 0], [70, 10, 20], [170, 40, 20], [233, 120, 40], [245, 200, 90], [255, 255, 235]];
function heat(t) {
  const x = t * (HEAT.length - 1), i = Math.min(HEAT.length - 2, Math.floor(x)), f = x - i;
  return HEAT[i].map((v, j) => v + (HEAT[i + 1][j] - v) * f);
}
function colourMono(t) {
  if (S.cmap === "plate") { const v = 232 - t * 222; return [v - 6, v, v - 2]; }
  if (S.cmap === "heat") return heat(t);
  return [3 + t * 236, 6 + t * 237, 11 + t * 240];        // deep space to white
}
function colourDiv(t) {    // t in [-1, 1]; dark = brighter now, light = was here before
  const a = Math.min(1, Math.abs(t));
  if (S.cmap === "plate") {
    return t > 0 ? [232 - a * 222, 232 - a * 210, 230 - a * 200] : [232 - a * 20, 232 - a * 110, 230 - a * 150];
  }
  return t > 0 ? [3 + a * 236, 6 + a * 237, 11 + a * 240] : [3 + a * 252, 6 + a * 175, 11 + a * 60];
}

/* ------------------------------------------------------------------ drawing */
const cv = $("plate"), ctx = cv.getContext("2d");
const off = document.createElement("canvas"), offx = off.getContext("2d");

function draw() {
  if (!S.view) return;
  if (!S.limits) computeLimits();
  const W = S.view.width, H = S.view.height;
  off.width = W; off.height = H;
  const img = offx.createImageData(W, H), px = img.data;
  const pl = currentPlanes(), lim = S.limits;
  const flag = S.showFlags && S.mode === "blink" ? chan(S.epoch, "FLAG") : null;
  for (let y = 0; y < H; y++) {
    const row = (H - 1 - y) * W;          // FITS y is up
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = (row + x) * 4;
      let c;
      if (pl.length === 3) {
        c = [0, 1, 2].map((k) => {
          const v = pl[k] ? pl[k][i] : NaN;
          return Number.isFinite(v) ? stretchFn((v - lim[k][0]) / (lim[k][1] - lim[k][0])) * 255 : 0;
        });
        if (S.cmap === "plate") c = c.map((v) => 235 - v * 0.92);
      } else {
        const v = pl[0] ? pl[0][i] : NaN;
        if (!Number.isFinite(v)) c = S.cmap === "plate" ? [196, 204, 201] : [14, 22, 32];
        else if (S.mode === "diff") c = colourDiv(v / lim[0][1]);
        else c = colourMono(stretchFn((v - lim[0][0]) / (lim[0][1] - lim[0][0])));
      }
      if (flag && flag[i] > 0) c = [c[0] * 0.5 + 214 * 0.5, c[1] * 0.5 + 69 * 0.5, c[2] * 0.5 + 122 * 0.5];
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  offx.putImageData(img, 0, 0);
  const size = cv.width;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(off, 0, 0, size, size);
  drawOverlay();
  updateLabels();
}

function toScreen(x, y) {
  const k = cv.width / S.view.width;
  return [(x + 0.5) * k, (S.view.height - 1 - y + 0.5) * k];
}

function drawOverlay() {
  const k = cv.width / S.view.width, plate = S.cmap === "plate";
  const ink = plate ? "rgba(10,15,22,.85)" : "rgba(127,211,255,.85)";
  ctx.lineWidth = Math.max(1.5, cv.width / 480);
  if (S.showGrid) {
    const [cx, cy] = toScreen(...world2pix(S.view.ra, S.view.dec));
    const g = 10 * k / 2 + 8, L = 18;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - g - L, cy); ctx.lineTo(cx - g, cy); ctx.moveTo(cx + g, cy); ctx.lineTo(cx + g + L, cy);
    ctx.moveTo(cx, cy - g - L); ctx.lineTo(cx, cy - g); ctx.moveTo(cx, cy + g); ctx.lineTo(cx, cy + g + L);
    ctx.stroke();
    // scale bar: 1 arcmin (or 10" for small fields)
    const arcsec = S.view.fov_arcmin > 2 ? 60 : 10;
    const len = arcsec / S.view.pix_arcsec * k, x0 = 16, y0 = cv.height - 18;
    ctx.fillStyle = ink; ctx.fillRect(x0, y0, len, 3);
    ctx.font = `600 ${Math.round(cv.width / 48)}px "Public Sans", sans-serif`;
    ctx.fillText(arcsec === 60 ? "1′" : "10″", x0, y0 - 6);
    // compass: drawn only in the plate style (the console shows it in the corner readout)
    if (plate) {
      const ox = cv.width - 26, oy = 50;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 28); ctx.moveTo(ox, oy); ctx.lineTo(ox - 28, oy); ctx.stroke();
      ctx.fillText("N", ox - 5, oy - 33); ctx.fillText("E", ox - 44, oy + 5);
    }
  }
  if (S.showGaia && S.gaia && !simple) {
    const ei = S.mode === "blink" || S.mode === "diff" ? S.epoch : null;
    for (const s of S.gaia.sources) {
      const fast = s.pm_tot > 150;
      if (!fast && (s.g === null || s.g > 17.5)) continue;
      const pts = s.pos.map((p) => toScreen(...world2pix(p[0], p[1])));
      ctx.strokeStyle = fast ? (plate ? "#2e7d6c" : COL.teal) : (plate ? "rgba(46,125,108,.5)" : "rgba(111,183,165,.55)");
      if (fast && pts.length > 1) {
        ctx.setLineDash([4, 4]); ctx.beginPath();
        pts.forEach((p, j) => (j ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke(); ctx.setLineDash([]);
      }
      const show = ei === null ? [pts[pts.length - 1]] : [pts[ei]];
      const r = Math.max(5, (19 - (s.g ?? 16)) * 1.6) + (fast ? 4 : 0);
      for (const [x, y] of show) {
        if (x < -20 || y < -20 || x > cv.width + 20 || y > cv.height + 20) continue;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
        if (fast) {
          ctx.fillStyle = plate ? "#2e7d6c" : COL.teal;
          ctx.font = `600 ${Math.round(cv.width / 56)}px "Public Sans", sans-serif`;
          ctx.fillText(`${(s.pm_tot / 1000).toFixed(2)}″/yr`, x + r + 4, y - 4);
        }
      }
    }
  }
  if (S.showMovers && !simple) {
    for (const f of S.finds) {
      const [x, y] = toScreen(f.x, f.y), r = 14;
      ctx.strokeStyle = f.known ? COL.teal : COL.coral;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const a of [0, 0.5, 1, 1.5]) { ctx.moveTo(x + Math.cos(a * Math.PI) * r, y + Math.sin(a * Math.PI) * r); ctx.lineTo(x + Math.cos(a * Math.PI) * (r + 8), y + Math.sin(a * Math.PI) * (r + 8)); }
      ctx.stroke();
      ctx.fillStyle = f.known ? COL.teal : COL.coral;
      ctx.font = `700 ${Math.round(cv.width / 52)}px "Public Sans", sans-serif`;
      ctx.fillText(String(f.n), x + r + 6, y + r + 10);
    }
  }
  if (S.phot) {
    const [x, y] = toScreen(...world2pix(S.phot.ra, S.phot.dec));
    ctx.strokeStyle = COL.amber; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, 1.5 * 6.15 / S.view.pix_arcsec * k + 3, 0, 2 * Math.PI); ctx.stroke();
  }
}

function updateLabels() {
  const e = S.view.epochs[S.epoch];
  const label = {
    blink: `${e.date}  (${S.epoch + 1} of ${nEpochs()})`,
    diff: tr("{0}: what changed", e.date),
    change: "Change across all visits",
    coadd: `All ${nEpochs()} visits added together`,
  }[S.mode];
  const modeName = { blink: "BLINK", diff: "DIFFERENCE", change: "CHANGE MAP", coadd: "DEEP STACK" }[S.mode];
  const perVisit = S.mode === "blink" || S.mode === "diff";
  $("epochLabel").innerHTML = (perVisit ? `VISIT <b class="amb">${String(S.epoch + 1).padStart(2, "0")} / ${String(nEpochs()).padStart(2, "0")}</b><br>DATE <b>${e.date}</b><br>` : `VISITS <b class="amb">ALL ${nEpochs()}</b><br>`) + `MODE <b>${modeName}</b>`;
  $("epochLabel").setAttribute("aria-label", label);
  $("roTarget").innerHTML = `RA <b>${fmtRA(S.view.ra)}</b><br>DEC <b>${fmtDec(S.view.dec)}</b><br>FIELD <b>${S.view.fov_arcmin}′</b>`;
  const ch = effChannel();
  $("roBand").innerHTML = `N ↑ &nbsp; E ←<br>${ch === "RGB" ? "COLOUR" : ch} <b>${CHANNEL_SUB[ch] || ""}</b>`;
  updateBriefing();
  emit("frame", { epoch: S.epoch, mode: S.mode });
  document.querySelectorAll(".timeline .tick").forEach((t, i) => t.classList.toggle("on", i === S.epoch && (S.mode === "blink" || S.mode === "diff")));
}

/* ------------------------------------------------------------------ briefing */
function updateBriefing() {
  if (!S.view || !$("briefSee")) return;
  const name = $("capTarget").textContent || "This patch of sky";
  const n = nEpochs(), e = S.view.epochs[S.epoch], v = S.view;
  const ch = effChannel();
  const cam = ch === "ALL" ? tr("all six cameras combined") : ch === "RGB" ? tr("false colour (blue = shorter infrared, red = longer)") : tr("camera {0} only ({1})", ch, CHANNEL_SUB[ch]);
  const span = tr("{0} to {1}", v.epochs[0].date, v.epochs[n - 1].date);
  let see, next;
  if (S.mode === "diff") {
    see = tr('Visit <b>{0}</b> ({1}) with the other visits subtracted, {2}. Stars that didn\'t move cancel out to black. <span class="w">White</span> is where something is in this visit; <span class="a">amber</span> is where it was in the others. A white and amber pair side by side means it moved.', S.epoch + 1, e.date, cam);
    next = tr("Click the white and amber pair, or any spot that's left, to measure how fast it moves.");
  } else if (S.mode === "change") {
    see = tr("One picture summarising all {0} visits ({1}), {2}. Bright spots changed between visits, by moving or by brightening and fading. Dark means steady.", n, span, cam);
    next = tr("Open the Changes tab and select a numbered mark to check it against the Gaia star catalogue.");
  } else if (S.mode === "coadd") {
    see = tr("All {0} visits added together, {1}. This is the deepest, faintest view, but anything that moves is smeared out.", n, cam);
    next = tr("Go back to Blink to see motion again.");
  } else {
    see = tr("<b>{0}</b>, photographed by SPHEREx on {1} visits from {2}, shown in {3}. You're on visit <b>{4}</b> ({5}). Far-away stars stay put from frame to frame; anything that jumps is moving across the sky.", name, n, span, cam, S.epoch + 1, e.date);
    next = S.playing ? tr("Watch the reticle in the middle, then press Difference to hide everything that stayed still.") : tr("Press Play, or step with ‹ and ›, and watch the reticle in the middle.");
  }
  if (/0855/.test(S.target || "") && ch !== "D6" && S.mode !== "change") next = tr("This brown dwarf is too cold to show here. Choose D6 (4.4–5.0 µm) in the strip at the top, then look just left of the reticle.");
  const o = S.lastObject;
  if (o) {
    const m = o.motion;
    const moving = m && m.total > Math.max(m.floor || 1, 3 * m.err);
    let first;
    if (!moving) first = tr("The object you selected isn't moving measurably.");
    else if (!o.gaia) first = tr("The object you selected moves {0}″ a year, and Gaia doesn't know it.", m.total.toFixed(1));
    else if (Math.abs(o.gaia.pm_tot / 1000 - m.total) < Math.max(1.5, 3 * m.err)) first = tr("The object you selected moves {0}″ a year, and Gaia agrees.", m.total.toFixed(1));
    else first = tr("The object you selected moves {0}″ a year, but Gaia gives a different speed.", m.total.toFixed(1));
    next = first + " " + tr("Its spectrum and light curve are just below the image; the i buttons explain how to read them.");
    if (S.mode === "change") next += " " + tr("Press Blink to watch it, or Difference to see where it moved.");
  }
  const story = STORIES[S.target];
  $("briefSee").innerHTML = see;
  $("briefWhy").textContent = tr("Nearby stars, cold brown dwarfs and perhaps unknown planets give themselves away by moving. SPHEREx photographs the whole sky every six months, so that motion shows up when you compare its pictures.") + (story ? " " + tr(story.note) : "");
  $("briefNext").textContent = next;
}

/* ------------------------------------------------------------------ timeline */
function buildTimeline() {
  const tl = $("timeline"); tl.innerHTML = "";
  const ep = S.view.epochs, t0 = ep[0].mjd, t1 = ep[ep.length - 1].mjd, span = Math.max(1, t1 - t0);
  const pos = (m) => 6 + 88 * (m - t0) / span;
  ep.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "tick"; b.style.left = pos(e.mjd) + "%";
    const d = new Date(e.date);
    b.innerHTML = `${d.toLocaleString("en", { month: "short" })}<br>${e.n_images} img`;
    b.title = `${e.range}: ${e.n_images} of ${e.n_available} images used (${Object.entries(e.detectors).map(([k, v]) => k + "×" + v).join(", ")})`;
    b.onclick = () => { stop(); if (S.mode !== "blink" && S.mode !== "diff") setMode("blink"); S.epoch = i; draw(); };
    tl.appendChild(b);
  });
  const y0 = new Date(ep[0].date).getUTCFullYear(), y1 = new Date(ep[ep.length - 1].date).getUTCFullYear();
  for (let y = y0; y <= y1; y++) {
    const m = Math.max(t0, Date.UTC(y, 0, 1) / 864e5 + 40587);
    const s = document.createElement("span"); s.className = "year";
    s.style.left = pos(m) + "%"; s.textContent = y;
    tl.appendChild(s);
  }
}

/* ------------------------------------------------------------------ playback */
function step(d) { if (!S.view) return; S.epoch = (S.epoch + d + nEpochs()) % nEpochs(); draw(); }
function play() {
  if (!S.view || S.playing) return;
  if (S.mode === "change" || S.mode === "coadd") setMode("blink");
  S.playing = true; $("playBtn").querySelector("span").textContent = "Pause"; $("playBtn").setAttribute("aria-label", "Pause"); $("playBtn").classList.add("running"); emit("play", true);
  const tick = () => { step(1); S.timer = setTimeout(tick, +$("speed").value); };
  S.timer = setTimeout(tick, +$("speed").value);
}
function stop() {
  const was = S.playing;
  S.playing = false; clearTimeout(S.timer); if (was) emit("play", false);
  $("playBtn").querySelector("span").textContent = "Play"; $("playBtn").setAttribute("aria-label", "Play"); $("playBtn").classList.remove("running");
}
function setMode(m) {
  S.mode = m; S.limits = null;
  document.querySelectorAll(".seg").forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  if (m === "change" || m === "coadd") stop();
  syncURL(); draw(); emit("mode", m);
  if ($("moveToggle")) $("moveToggle").checked = m === "diff";
  if (simple) explainView();
}

/* ------------------------------------------------------------------ change detection */
function findChanges() {
  S.finds = [];
  if (!S.view || nEpochs() < 2) return renderFinds();
  const saved = S.channel; S.channel = "ALL";
  const chd = derived("change"), ch = chd[0], co = derived("coadd")[0], med = chd.meds[0];
  S.channel = saved;
  // Score change relative to brightness: a static star that looks 10% brighter at one
  // wavelength mix is not news; something appearing where there was nothing is.
  const REL = 0.15;
  const score = (i) => ch[i] / (1 + REL * Math.abs(co[i]) / med);
  const W = S.view.width, H = S.view.height, sep = Math.max(2, Math.round(9 / S.view.pix_arcsec));
  const cand = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, v = score(i);
    if (!(v > 5)) continue;
    let peak = true;
    for (let dy = -sep; dy <= sep && peak; dy++) for (let dx = -sep; dx <= sep; dx++) {
      const j = (y + dy) * W + (x + dx);
      if (j !== i && j >= 0 && j < ch.length && score(j) > v) { peak = false; break; }
    }
    if (peak) cand.push({ x, y, v, s: co[i] });
  }
  cand.sort((a, b) => b.v - a.v);
  const out = [];
  for (const c of cand) {
    if (out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < sep * 2)) continue;
    const [ra, dec] = pix2world(c.x, c.y);
    let known = null;
    if (S.gaia) for (const s of S.gaia.sources) {
      const dmin = Math.min(...s.pos.map((p) => Math.hypot((p[0] - ra) * Math.cos(dec * D2R), p[1] - dec) * 3600));
      if (dmin < 10 && (!known || s.pm_tot > known.pm_tot)) known = s;
    }
    out.push({ ...c, ra, dec, known, n: out.length + 1 });
    if (out.length >= 8) break;
  }
  S.finds = out;
  renderFinds();
}
function renderFinds() {
  const box = $("findings"), ol = $("finds");
  ol.innerHTML = "";
  box.hidden = !S.view; $("changesEmpty").hidden = !!S.view;
  if (S.finds.length) badge("changes");
  if (!S.finds.length) { ol.innerHTML = "<li class='hint'>Nothing stands out above the noise in this field.</li>"; return; }
  for (const f of S.finds) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.className = f.known ? "known" : "";
    const what = f.known
      ? (f.known.pm_tot > 150 ? `Known fast mover, Gaia ${(f.known.pm_tot / 1000).toFixed(2)}″/yr` : `Gaia star (G ${f.known.g?.toFixed(1) ?? "?"}): likely variable or blended`)
      : tr(S.gaia ? "No Gaia match: check this one" : S.gaiaFailed ? "Gaia catalogue unavailable for this field" : "Checking the Gaia catalogue…");
    b.innerHTML = `${fmtRA(f.ra)} ${fmtDec(f.dec)}<small>${what}; ${tr("change {0}×", f.v.toFixed(1))}</small>`;
    b.onclick = () => { measure(f.ra, f.dec); emit("find", f); };
    li.appendChild(b); ol.appendChild(li);
  }
}

/* ------------------------------------------------------------------ charts */
const MOLECULES = [
  { name: "H₂O", lo: 1.33, hi: 1.50 }, { name: "H₂O", lo: 1.80, hi: 1.98 },
  { name: "CH₄", lo: 2.20, hi: 2.40 }, { name: "H₂O", lo: 2.65, hi: 3.05 },
  { name: "CH₄", lo: 3.20, hi: 3.45 }, { name: "CO₂", lo: 4.20, hi: 4.35 }, { name: "CO", lo: 4.55, hi: 4.80 },
];
function plot(canvas, pts, xKey, xLabel, colourBy, opts = {}) {
  /* draw at the canvas's real on-screen size so text stays sharp in the narrow column */
  const cssW = canvas.clientWidth || 340, cssH = canvas.clientHeight || 210, k = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * k); canvas.height = Math.round(cssH * k);
  const c = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  const m = { l: 44 * k, r: 10 * k, t: 26 * k, b: 34 * k };
  c.clearRect(0, 0, W, H);
  c.font = `${11 * k}px "IBM Plex Mono", monospace`; c.fillStyle = COL.muted; c.strokeStyle = COL.line; c.lineWidth = k;
  const P = pts.filter((p) => p[xKey] !== null && Number.isFinite(p.flux_mjy));
  if (P.length < 2) { c.fillText("Not enough clean measurements here.", m.l, H / 2); return; }
  const xs = P.map((p) => p[xKey]), ys = P.map((p) => p.flux_mjy);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ysorted = [...ys].sort((a, b) => a - b);
  let y0 = Math.min(0, ysorted[Math.floor(ys.length * 0.02)]), y1 = ysorted[Math.ceil(ys.length * 0.98) - 1];
  if (x1 === x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
  const pad = (y1 - y0) * 0.08; y1 += pad;
  const X = (v) => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = (v) => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
  if (opts.bands) {
    for (const b of opts.bands) {
      if (b.hi < x0 || b.lo > x1) continue;
      const xa = X(Math.max(b.lo, x0)), xb = X(Math.min(b.hi, x1));
      c.fillStyle = "rgba(127,211,255,.07)"; c.fillRect(xa, m.t, xb - xa, H - m.t - m.b);
      c.fillStyle = COL.ice; c.fillText(b.name, (xa + xb) / 2 - 8 * k, m.t - 5 * k);
    }
    c.fillStyle = COL.muted;
  }
  c.beginPath(); c.moveTo(m.l, m.t); c.lineTo(m.l, H - m.b); c.lineTo(W - m.r, H - m.b); c.stroke();
  for (let i = 0; i <= 4; i++) {
    const yv = y0 + (y1 - y0) * i / 4, xv = x0 + (x1 - x0) * i / 4;
    c.fillText(yv.toPrecision(3), 2 * k, Y(yv) + 4 * k);
    const xt = opts.xfmt ? opts.xfmt(xv) : xv.toFixed(2);
    c.fillText(xt, Math.min(X(xv) - 12 * k, W - c.measureText(xt).width - 2 * k), H - m.b + 14 * k);
  }
  c.fillText(xLabel, W / 2 - 30 * k, H - 4 * k);
  c.fillText("mJy", 2 * k, 11 * k);
  for (const p of P) {
    const col = colourBy(p);
    c.strokeStyle = col; c.fillStyle = col;
    const x = X(p[xKey]), y = Y(p.flux_mjy);
    if (p.err_mjy) { c.beginPath(); c.moveTo(x, Y(p.flux_mjy - p.err_mjy)); c.lineTo(x, Y(p.flux_mjy + p.err_mjy)); c.stroke(); }
    c.beginPath(); c.arc(x, y, 2.6 * k, 0, 2 * Math.PI);
    p.flagged ? c.stroke() : c.fill();
  }
}
function epochColour(i) {
  const n = Math.max(1, nEpochs() - 1), t = i / n;
  const a = [127, 211, 255], b = [255, 181, 71];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(",")})`;
}
function replot() {
  const ph = S.phot; if (!ph) return;
  plot($("specChart"), ph.points, "wl_um", "wavelength (µm)", (p) => epochColour(p.epoch), { bands: MOLECULES });
  plot($("lcChart"), ph.points, "mjd", "date", (p) => DET_COLOURS[p.det] || COL.muted,
    { xfmt: (m) => new Date((m - 40587) * 864e5).toISOString().slice(2, 7) });
}
window.addEventListener("resize", () => { if (S.phot && !$("charts").hidden) replot(); });
function showPhot(ph) {
  S.phot = ph;
  $("charts").hidden = false;
  const pts = ph.points;
  $("specCaption").textContent = tr("{0} images; colour = date (blue early, amber late); grey bands = molecules", pts.length);
  const nw = pts.filter((p) => p.method === "wing").length;
  $("lcCaption").textContent = "colour = detector; follow one colour" +
    (nw ? `; hollow = too bright, measured from its outer glow` : "");
  plot($("specChart"), pts, "wl_um", "wavelength (µm)", (p) => epochColour(p.epoch), { bands: MOLECULES });
  plot($("lcChart"), pts, "mjd", "date", (p) => DET_COLOURS[p.det] || COL.muted,
    { xfmt: (m) => new Date((m - 40587) * 864e5).toISOString().slice(2, 7) });
  draw();
}
async function measure(ra, dec) {
  if (!S.view) return;
  $("specCaption").textContent = "Measuring…";
  $("charts").hidden = false;
  try {
    const r = await fetch(`/api/photometry?view_id=${S.view.view_id}&ra=${ra}&dec=${dec}`);
    if (!r.ok) throw new Error((await r.json()).detail || r.statusText);
    const ph = await r.json();
    showPhot(ph);
    describeObject(ra, dec, ph);
    emit("measure", { ra, dec, ph });
  } catch (e) { $("specCaption").textContent = "Couldn't measure: " + e.message; }
}

/* ------------------------------------------------------------------ meta & share */
function renderMeta() {
  const v = S.view, r = S.resolveInfo;
  const name = ((r && (r.name || r.query)) || S.target || `${fmtRA(v.ra)} ${fmtDec(v.dec)}`).replace(/^(NAME|V\*|\*)\s+/, "");
  $("capTarget").textContent = name;
  const rows = [["Visits", nEpochs()], ["Images", `${v.n_images_used}/${v.n_images_total}`],
    ["Span", `${v.epochs[0].date} → ${v.epochs[nEpochs() - 1].date}`], ["Field", `${v.fov_arcmin}′ · ${v.pix_arcsec.toFixed(1)}″/px`],
    ["Pipeline", v.versions.length ? v.versions.join(", ") : "SPHEREx"]];
  $("vitals").innerHTML = rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("");
  const kv = [["Name", name], ["Position today", `${v.ra.toFixed(4)} ${v.dec >= 0 ? "+" : ""}${v.dec.toFixed(4)}`]];
  if (r && r.pm) {
    const pm = Math.hypot(r.pm.pmra, r.pm.pmdec) / 1000;
    kv.push(["Catalogue motion", `${pm.toFixed(2)}″/yr`]);
    if (r.ra_j2000 !== undefined) {
      const moved = Math.hypot((v.ra - r.ra_j2000) * Math.cos(v.dec * D2R), v.dec - r.dec_j2000) * 3600;
      if (moved > 1) kv.push(["Moved since 2000", `${moved.toFixed(0)}″`]);
    }
  }
  kv.push(["SPHEREx visits", `${nEpochs()} (${v.n_images_used} images)`]);
  $("targetKv").innerHTML = kv.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("");
  if (v.versions.length) $("dataRel").textContent = v.versions[0];
}

/* ------------------------------------------------------------------ tabs */
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
  document.querySelectorAll(".tabpanel").forEach((p) => (p.hidden = p.dataset.panel !== name));
  const t = document.querySelector(`.tab[data-tab="${name}"] .dot`);
  if (t) t.remove();
  emit("tab", name);

}
function badge(name) {
  const t = document.querySelector(`.tab[data-tab="${name}"]`);
  if (t && t.getAttribute("aria-selected") !== "true" && !t.querySelector(".dot")) t.insertAdjacentHTML("beforeend", '<span class="dot" aria-label="updated"></span>');
}

/* ------------------------------------------------------------------ object analysis */
const DET_RANGE = { D1: "0.75–1.1 µm", D2: "1.1–1.6 µm", D3: "1.6–2.4 µm", D4: "2.4–3.8 µm", D5: "3.8–4.4 µm", D6: "4.4–5.0 µm" };
function localPeak(arr, x0, y0, r) {
  const W = S.view.width, H = S.view.height;
  let best = -Infinity, bx = NaN, by = NaN;
  for (let y = Math.max(0, Math.round(y0 - r)); y <= Math.min(H - 1, Math.round(y0 + r)); y++)
    for (let x = Math.max(0, Math.round(x0 - r)); x <= Math.min(W - 1, Math.round(x0 + r)); x++) {
      if (Math.hypot(x - x0, y - y0) > r) continue;
      const v = arr[y * W + x];
      if (Number.isFinite(v) && v > best) { best = v; bx = x; by = y; }
    }
  return [best, bx, by];
}
function centroid(arr, x0, y0, r) {
  const W = S.view.width;
  const [pk, px, py] = localPeak(arr, x0, y0, r);
  if (!Number.isFinite(pk) || pk < 4) return null;
  let sw = 0, sx = 0, sy = 0;
  for (let y = py - 3; y <= py + 3; y++) for (let x = px - 3; x <= px + 3; x++) {
    const v = arr[y * W + x];
    if (!Number.isFinite(v) || v < 0.5 * pk || Math.hypot(x - px, y - py) > 3) continue;
    sw += v; sx += v * x; sy += v * y;
  }
  return sw ? { x: sx / sw, y: sy / sw, peak: pk } : null;
}
/* Which detector shows this object best? (signal-to-noise at the spot, all visits combined) */
function bestDetector(x0, y0) {
  const out = [];
  for (const d of ["ALL", "D1", "D2", "D3", "D4", "D5", "D6"]) {
    const list = [...Array(nEpochs()).keys()].map((e) => chan(e, d)).filter(Boolean);
    if (!list.length) continue;
    const m = meanOf(list);
    const [pk] = localPeak(m, x0, y0, 1.6);
    if (Number.isFinite(pk)) out.push({ d, snr: pk * Math.sqrt(list.length) });
  }
  out.sort((a, b) => b.snr - a.snr);
  return out;
}
/* Proper motion measured from SPHEREx alone: centroid per visit, straight-line fit. */
function measureMotion(x0, y0, ch) {
  const pts = [];
  const r = Math.max(3, 14 / S.view.pix_arcsec);
  for (let e = 0; e < nEpochs(); e++) {
    const a = chan(e, ch);
    if (!a) continue;
    const c = centroid(a, x0, y0, r);
    if (c) pts.push({ t: S.view.epochs[e].mjd / 365.25, x: c.x, y: c.y });
  }
  if (pts.length < 3) return null;
  const tm = pts.reduce((s, p) => s + p.t, 0) / pts.length;
  if (Math.max(...pts.map((p) => p.t)) - Math.min(...pts.map((p) => p.t)) < 0.3) return null;
  const fit = (k) => {
    let sxy = 0, sxx = 0; const mk = pts.reduce((s, p) => s + p[k], 0) / pts.length;
    for (const p of pts) { sxy += (p.t - tm) * (p[k] - mk); sxx += (p.t - tm) ** 2; }
    const b = sxy / sxx;
    const res = pts.reduce((s, p) => s + (p[k] - mk - b * (p.t - tm)) ** 2, 0);
    return [b, Math.sqrt(res / Math.max(1, pts.length - 2) / sxx)];
  };
  const [bx, ex] = fit("x"), [by, ey] = fit("y"), pix = S.view.pix_arcsec;
  const east = -bx * pix, north = by * pix;          // x grows to the west
  return { east, north, total: Math.hypot(east, north), err: Math.hypot(ex, ey) * pix, n: pts.length,
           pa: (Math.atan2(east, north) / D2R + 360) % 360 };
}
function compass(pa) { return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(pa / 45) % 8]; }
function describeObject(ra, dec, ph) {
  if (!S.view) return;
  const [x0, y0] = world2pix(ra, dec);
  const best = bestDetector(x0, y0);
  const bestDet = best.find((b) => b.d !== "ALL");
  const useCh = bestDet && best[0].d !== "ALL" ? bestDet.d : "ALL";
  const mo = measureMotion(x0, y0, useCh);
  /* Overloaded (saturated) stars: their centre is filled in, so positions are less
     precise. Demand a larger motion before calling it real. */
  const saturated = ph && ph.points.length && ph.points.filter((p) => p.method === "wing").length > 0.5 * ph.points.length;
  if (mo) { mo.saturated = saturated; mo.floor = saturated ? 5.0 : 1.0; }
  let gaia = null;
  if (S.gaia) for (const s of S.gaia.sources) {
    const dmin = Math.min(...s.pos.map((p) => Math.hypot((p[0] - ra) * Math.cos(dec * D2R), p[1] - dec) * 3600));
    if (dmin < 9 && (!gaia || dmin < gaia.d)) gaia = { ...s, d: dmin };
  }
  const L = [];
  L.push(`<p class="obj-big">${fmtRA(ra)} ${fmtDec(dec)}</p>`);
  if (mo) {
    const sig = mo.total > Math.max(mo.floor, 3 * mo.err);
    L.push(`<p class="obj-line"><b>Measured motion</b><span>${sig ? tr("{0}″/yr toward {1}", mo.total.toFixed(1), tr(compass(mo.pa))) : tr("none detected (under {0}″/yr)", Math.max(mo.floor, 3 * mo.err).toFixed(1))}<small>${tr("SPHEREx only, {0} visits, {1}", mo.n, useCh === "ALL" ? tr("all detectors") : useCh)}${mo.saturated ? tr("; star overloads the detector, so small motions can't be measured") : ""}</small></span></p>`);
    if (gaia) {
      const g = gaia.pm_tot / 1000, agree = Math.abs(g - (sig ? mo.total : 0)) < Math.max(1.5, 3 * mo.err);
      L.push(`<p class="obj-line"><b>Gaia DR3</b><span>${g.toFixed(2)}″/yr <span class="${agree ? "ok" : "bad"}">${agree ? tr("agrees ✓") : tr("differs ✗")}</span></span></p>`);
      const top = Math.max(g, mo.total, 1) * 1.25;
      L.push(`<div class="gauge" title="SPHEREx measurement (blue bar) against Gaia (green line)"><div class="gbar"><span class="a" style="width:${Math.min(100, (sig ? mo.total : 0) / top * 100)}%"></span><span class="g" style="left:${Math.min(99, g / top * 100)}%"></span></div><div class="glab"><span>0</span><span>SPHEREx ${sig ? mo.total.toFixed(1) : "0"}</span><span class="ok">Gaia ${g.toFixed(1)}</span><span>${top.toFixed(0)}″/yr</span></div></div>`);
    } else {
      L.push(`<p class="obj-line"><b>Gaia DR3</b><span>No match within 9″${sig ? `<small class="bad">Moving, and unknown to Gaia: worth reporting</small>` : ""}</span></p>`);
    }
  } else if (gaia) {
    L.push(`<p class="obj-line"><b>Gaia DR3</b><span>G ${gaia.g?.toFixed(1) ?? "?"}, ${(gaia.pm_tot / 1000).toFixed(2)}″/yr</span></p>`);
  }
  if (bestDet) {
    const all = best.find((b) => b.d === "ALL");
    L.push(`<p class="obj-line"><b>Best detector</b><span>${bestDet.d}, ${DET_RANGE[bestDet.d]}<small>signal-to-noise ${bestDet.snr.toFixed(0)}${all ? `; all combined ${all.snr.toFixed(0)}` : ""}</small></span></p>`);
    if (S.channel !== bestDet.d) L.push(`<div class="m-actions"><button class="btn" type="button" id="useBest">Show ${bestDet.d} (${DET_RANGE[bestDet.d]})</button></div>`);
  }
  if (ph) L.push(`<p class="hint">${tr("{0} brightness measurements: see the spectrum and light curve under the image.", ph.points.length)}</p>`);
  $("objectBody").innerHTML = L.join("");
  $("objectPanel").hidden = false; $("objectEmpty").hidden = true;
  const guideOpen = document.querySelector('.tab[data-tab="guide"]').getAttribute("aria-selected") === "true";
  if (guideOpen) badge("object"); else showTab("object");
  const ub = $("useBest");
  if (ub) ub.onclick = () => selectChannel(bestDet.d);
  S.lastObject = { ra, dec, motion: mo, gaia, best };
  updateBriefing();
  if (simple) {
    const parts = [];
    if (mo && mo.total > Math.max(mo.floor, 3 * mo.err)) {
      parts.push(`<p class="big">${tr("It moves {0}″ a year, toward the {1}.", mo.total.toFixed(1), tr(compass(mo.pa)))}</p>`);
      parts.push(`<p>${tr("SPHEREx measured that on its own, by following the object across {0} visits.", mo.n)}</p>`);
      if (gaia) {
        const g = gaia.pm_tot / 1000, agree = Math.abs(g - mo.total) < Math.max(1.5, 3 * mo.err);
        parts.push(`<p>${tr("The Gaia star catalogue says {0}″ a year:", g.toFixed(1))} ${agree ? tr("<b>they agree</b>.") : tr("they disagree, so take this one with care.")}</p>`);
      } else parts.push(`<p><b>Gaia doesn't know about it.</b> A moving object missing from the catalogue could be something new.</p>`);
    } else {
      parts.push(`<p class="big">This one isn't moving.</p>`);
      parts.push(`<p>${tr("Across {0} visits it stayed in the same place (to within about {1}″ a year).", mo ? mo.n : "", mo ? Math.max(mo.floor, 3 * mo.err).toFixed(0) : "1")}</p>`);
      if (mo && mo.saturated) parts.push(`<p class="note">It's so bright it overloads SPHEREx's camera, so only big motions can be measured.</p>`);
      if (gaia) parts.push(`<p>${tr("Gaia knows this star (brightness G {0}).", gaia.g?.toFixed(1) ?? "?")}</p>`);
    }
    if (bestDet && best[0].d !== "ALL") parts.push(`<p class="note">${tr("It shows up best in SPHEREx's {0} camera.", DET_RANGE[bestDet.d])}</p>`);
    parts.push(`<p class="note">Want the full details, spectrum and light curve? Press "Show all tools".</p>`);
    explain(parts.join(""));
  }
  emit("object", S.lastObject);
}
function selectChannel(id) {
  const b = [...document.querySelectorAll("#channels .chip")].find((c) => c.dataset.ch === id);
  if (b && !b.disabled) b.click();
}

function syncURL() {
  if (!S.view) return;
  const p = new URLSearchParams(location.search);
  p.set("ra", S.view.ra.toFixed(6)); p.set("dec", S.view.dec.toFixed(6)); p.set("fov", S.view.fov_arcmin);
  if (S.target) p.set("name", S.target); else p.delete("name");
  p.set("ch", S.channel); p.set("mode", S.mode);
  if (S.cmap !== "gray") p.set("cmap", S.cmap); else p.delete("cmap");
  history.replaceState(null, "", "?" + p.toString());
}
function flash(msg) { $("shareNote").textContent = msg; setTimeout(() => ($("shareNote").textContent = ""), 3500); }

/* ------------------------------------------------------------------ loading a view */
async function getJSON(url) {
  const r = await fetch(url);
  let body; try { body = await r.json(); } catch { body = {}; }
  if (!r.ok) throw new Error(body.detail || `${r.status} ${r.statusText}`);
  return body;
}
function seq(k) {
  document.querySelectorAll("#seq li").forEach((li) => {
    const i = +li.dataset.k;
    li.className = i < k ? "done" : i === k ? "now" : "";
  });
}
async function openTarget(q, fov, ch) {
  $("q").value = q;
  $("empty").hidden = true; $("loading").hidden = false; seq(0);
  if (ch) S.channel = ch;
  else if (S.channel !== "ALL" && S.channel !== "RGB") S.channel = "ALL";
  $("resolveNote").textContent = "Looking up the name…";
  try {
    const res = await getJSON(`/api/resolve?q=${encodeURIComponent(q)}`);
    S.resolveInfo = res; S.target = q;
    $("resolveNote").textContent = res.note || "";
    emit("resolved", res);
    await openView(res.ra, res.dec, fov ?? +$("fov").value);
  } catch (e) {
    $("loading").hidden = true; if (!S.view) $("empty").hidden = false;
    $("resolveNote").textContent = `Couldn't find "${q}". Check the spelling, or enter coordinates like 269.45 4.74.`;
    emit("error", e);
  }
}
async function openView(ra, dec, fov) {
  stop();
  $("fov").value = fov; $("fovOut").textContent = fov + "′";
  $("empty").hidden = true; $("loading").hidden = false; seq(1);
  $("loadingText").textContent = "Searching the SPHEREx archive";
  const t0 = Date.now();
  const msgs = [[3, 2, "Downloading image cutouts"], [14, 3, "Aligning and stacking visits"]];
  const iv = setInterval(() => {
    const s = (Date.now() - t0) / 1000;
    for (const [t, k, m] of msgs) if (s > t) { seq(k); $("loadingText").textContent = m; }
    $("loadingSub").textContent = `T+${Math.round(s)}s. A new field takes a minute or two the first time; repeat visits and the challenge targets are instant.${s > 40 ? " Fields near the ecliptic poles have thousands of images." : ""}`;
  }, 500);
  const adv = ["gap", "span", "per", "maxe"].map((k) => `${k}=${$(k).value}`).join("&");
  try {
    const v = await getJSON(`/api/view?ra=${ra}&dec=${dec}&fov=${fov}&${adv}`);
    S.view = v; S.frames = {}; clearMemo(); S.epoch = 0; S.phot = null; S.gaia = null; S.gaiaFailed = false; S.finds = []; S.lastObject = null;
    const sz = Math.min(1440, Math.max(720, Math.round(cv.clientWidth * devicePixelRatio)));
    cv.width = cv.height = sz - (sz % v.width) || sz;
    buildChannels(); buildTimeline(); renderMeta(); draw(); syncURL();
    $("objectPanel").hidden = true;
    if (v.target_photometry && v.target_photometry.points.length) showPhot(v.target_photometry);
    findChanges();
    emit("view", v);
    document.querySelectorAll(".qt").forEach((b) => b.classList.toggle("on", b.dataset.q === S.target));
    $("moveToggle").checked = S.mode === "diff";
    explainView();
    const st = storyFor(S.target);
    if (simple && st) { $("plateCaption").textContent = st.cap; setTimeout(() => { if ($("plateCaption").textContent === st.cap) $("plateCaption").textContent = ""; }, 9000); }
    loadGaia(); loadAladin();
    if (nEpochs() > 1) play();
  } catch (e) {
    $("empty").hidden = false;
    $("empty").innerHTML = `<p class="empty-title">Acquisition failed</p><p>${e.message}</p>`;
    emit("error", e);
  } finally { clearInterval(iv); seq(4); $("loading").hidden = true; }
}
async function loadGaia() {
  const v = S.view;
  try {
    const g = await getJSON(`/api/gaia?ra=${v.ra}&dec=${v.dec}&radius=${v.fov_arcmin * 0.75}&mjds=${v.epochs.map((e) => e.mjd.toFixed(2)).join(",")}`);
    if (S.view !== v) return;
    S.gaia = g; findChanges(); draw(); emit("gaia", g);
  } catch (e) {
    console.warn("Gaia overlay unavailable", e);
    if (S.view === v) { S.gaiaFailed = true; findChanges(); }
  }
}

function buildChannels() {
  const box = $("channels"); box.innerHTML = "";
  const hintFor = CHANNELS.find((c) => c[0] === S.channel);
  if (hintFor) $("channelHint").textContent = hintFor[2];
  const have = new Set(Object.keys(S.view.epochs[0].channels));
  S.view.epochs.forEach((e) => Object.keys(e.channels).forEach((k) => have.add(k)));
  for (const [id, label, hint] of CHANNELS) {
    const b = document.createElement("button");
    b.className = "chip band" + (id === S.channel ? " on" : ""); b.type = "button"; b.dataset.ch = id;
    b.innerHTML = `<b><i class="led"></i>${id === "RGB" ? "COLOUR" : id}</b>${CHANNEL_SUB[id]}`;
    b.style.setProperty("--c", CHANNEL_COLOURS[id]);
    b.title = hint;
    b.setAttribute("role", "radio"); b.setAttribute("aria-checked", id === S.channel);
    b.disabled = id !== "RGB" && !have.has(id);
    b.onclick = () => {
      S.channel = id; S.limits = null;
      box.querySelectorAll(".chip").forEach((c) => { c.classList.remove("on"); c.setAttribute("aria-checked", false); });
      b.classList.add("on"); b.setAttribute("aria-checked", true);
      b.classList.remove("powerup"); void b.offsetWidth; b.classList.add("powerup");
      $("channelHint").textContent = hint; syncURL(); draw(); emit("channel", id);
    };
    box.appendChild(b);
  }
}

/* ------------------------------------------------------------------ Aladin context */
let aladin = null, aladinLoading = null, aladinBox = null;
function loadAladin() {
  const v = S.view;
  const go = () => {
    try {
      if (!aladin) aladin = A.aladin("#aladin", { survey: "P/2MASS/color", fov: v.fov_arcmin / 60 * 3, target: `${v.ra} ${v.dec}`, showReticle: true, showLayersControl: false, showGotoControl: false, showFullscreenControl: false });
      else { aladin.gotoRaDec(v.ra, v.dec); aladin.setFoV(v.fov_arcmin / 60 * 3); }
      if (aladinBox) aladinBox.removeAll();
      else { aladinBox = A.graphicOverlay({ color: "#e9a93b", lineWidth: 2 }); aladin.addOverlay(aladinBox); }
      const o = aladinBox;
      const h = v.fov_arcmin / 120;
      const c = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([dx, dy]) => [v.ra + dx / Math.cos(v.dec * D2R), v.dec + dy]);
      o.add(A.polygon(c));
    } catch (e) { console.warn("Aladin", e); }
  };
  if (window.A && window.A.init) return window.A.init.then(go);
  if (aladinLoading) return aladinLoading.then(go);
  aladinLoading = new Promise((res) => {
    const s = document.createElement("script");
    s.src = "https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js";
    s.charset = "utf-8"; s.onload = () => A.init.then(res); s.onerror = () => ($("aladin").textContent = "Sky context unavailable.");
    document.head.appendChild(s);
  });
  aladinLoading.then(go);
}

/* ------------------------------------------------------------------ recording */
async function record() {
  if (!S.view || !window.MediaRecorder) return flash("Your browser can't record video.");
  const stream = cv.captureStream(30);
  const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: type });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
    a.download = `spherex-blink-${(S.target || S.view.ra.toFixed(3) + "_" + S.view.dec.toFixed(3)).replace(/\W+/g, "-")}.webm`;
    a.click(); flash("Animation saved."); emit("share", "video");
  };
  flash("Recording two loops…");
  const was = S.mode; if (was !== "blink" && was !== "diff") setMode("blink");
  stop(); S.epoch = 0; draw(); rec.start();
  const dur = +$("speed").value;
  for (let i = 0; i < nEpochs() * 2; i++) { await new Promise((r) => setTimeout(r, dur)); step(1); }
  rec.stop();
}

on("lang", () => { if (S.view) { updateBriefing(); if (S.lastObject) emit("relang"); } });
window.SB = { S, on, emit, tr, openTarget, setMode, selectChannel, play, stop, step, measure, nEpochs, showTab, setSimple: (v) => setSimple(v), $ };

/* ------------------------------------------------------------------ wiring */
function init() {
  const pre = $("presets");
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "preset"; b.setAttribute("role", "menuitem");
    b.innerHTML = `<b>${p.label || p.q}</b><span>${p.note}</span>`;
    b.onclick = () => { $("targetsMenu").open = false; openTarget(p.q, p.fov, p.ch); };
    pre.appendChild(b);
  }
  $("searchForm").onsubmit = (e) => { e.preventDefault(); openTarget($("q").value.trim()); };
  $("fov").oninput = () => ($("fovOut").textContent = $("fov").value + "′");
  $("fov").onchange = () => S.view && openView(S.view.ra, S.view.dec, +$("fov").value);
  $("playBtn").onclick = () => (S.playing ? stop() : play());
  $("prevBtn").onclick = () => { stop(); step(-1); };
  $("nextBtn").onclick = () => { stop(); step(1); };
  document.querySelectorAll(".seg").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $("cmap").onchange = (e) => { S.cmap = e.target.value; syncURL(); draw(); };
  $("stretch").onchange = (e) => { S.stretch = e.target.value; draw(); };
  $("contrast").oninput = (e) => { S.contrast = +e.target.value; $("contrastOut").textContent = S.contrast + "%"; S.limits = null; draw(); };
  $("contrastOut").textContent = S.contrast + "%";
  for (const k of ["showGaia", "showMovers", "showFlags", "showGrid"]) $(k).onchange = (e) => { S[k] = e.target.checked; draw(); };
  $("copyLink").onclick = async () => { await navigator.clipboard.writeText(location.href); flash("Link copied."); emit("share", "link"); };
  $("copyEmbed").onclick = async () => {
    const u = new URL(location.href); u.searchParams.set("embed", "1");
    await navigator.clipboard.writeText(`<iframe src="${u}" width="560" height="640" style="border:0" title="SPHEREx Blink"></iframe>`);
    flash("Embed code copied."); emit("share", "embed");
  };
  $("record").onclick = record;

  cv.addEventListener("mousemove", (e) => {
    if (!S.view) return;
    const r = cv.getBoundingClientRect(), k = S.view.width / r.width;
    const x = (e.clientX - r.left) * k - 0.5, y = S.view.height - 1 - ((e.clientY - r.top) * k - 0.5);
    const [ra, dec] = pix2world(x, y);
    const pl = currentPlanes(), i = Math.round(y) * S.view.width + Math.round(x);
    const v = pl[0] && pl.length === 1 ? pl[0][i] : NaN;
    $("readout").textContent = `${fmtRA(ra)} ${fmtDec(dec)}${Number.isFinite(v) ? `   ${S.mode === "change" ? "change" : "S/N"} ${v.toFixed(1)}` : ""}`;
  });
  cv.addEventListener("mouseleave", () => ($("readout").textContent = ""));
  cv.addEventListener("click", (e) => {
    if (!S.view) return;
    const r = cv.getBoundingClientRect(), k = S.view.width / r.width;
    const x = (e.clientX - r.left) * k - 0.5, y = S.view.height - 1 - ((e.clientY - r.top) * k - 0.5);
    const [ra, dec] = pix2world(x, y);
    emit("click", { ra, dec });
    measure(ra, dec);
  });
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (e.key === " ") { e.preventDefault(); S.playing ? stop() : play(); }
    else if (e.key === "ArrowRight") { stop(); step(1); }
    else if (e.key === "ArrowLeft") { stop(); step(-1); }
    else if (e.key === "b") setMode("blink");
    else if (e.key === "d") setMode("diff");
    else if (e.key === "c") setMode("change");
    else if (e.key === "a") setMode("coadd");
  });

  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "qt"; b.dataset.q = p.q;
    b.innerHTML = `<b>${p.label || p.q}</b><span>${p.short || ""}</span>`;
    b.onclick = () => openTarget(p.q, p.fov, p.ch);
    $("quickTargets").appendChild(b);
  }
  $("moveToggle").onchange = (e) => setMode(e.target.checked ? "diff" : "blink");
  $("modeToggle").onclick = () => { $("helpMenu").open = false; setSimple(!simple); };
  $("showTools").onclick = () => setSimple(false);
  $("tryMission").onclick = () => { setSimple(false); showTab("guide"); emit("guide"); };
  let simplePref = "0"; try { simplePref = localStorage.getItem("sb_simple") ?? "0"; } catch (e) { /* */ }
  setSimple(simplePref === "1");
  $("openGuide").onclick = () => { $("helpMenu").open = false; setSimple(false); showTab("guide"); emit("guide"); };
  document.addEventListener("click", (e) => {
    document.querySelectorAll("details.menu").forEach((d) => { if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll("details.menu").forEach((d) => (d.open = false)); });
  $("cmap").value = S.cmap;
  showTab("object");

  // deep links: ?name=...  or ?ra=..&dec=..  (+ fov, ch, mode, cmap, embed)
  const p = new URLSearchParams(location.search);
  if (p.get("embed") === "1") {
    document.body.classList.add("embed");
    const a = document.createElement("a"); a.className = "embed-link"; a.target = "_blank";
    const full = new URL(location.href); full.searchParams.delete("embed"); a.href = full; a.textContent = "Open in SPHEREx Blink";
    $("transport").appendChild(a);
  }
  if (p.get("ch")) S.channel = p.get("ch");
  if (p.get("mode")) S.mode = p.get("mode");
  if (p.get("cmap")) { S.cmap = p.get("cmap"); $("cmap").value = S.cmap; }
  document.querySelectorAll(".seg").forEach((b) => b.classList.toggle("on", b.dataset.mode === S.mode));
  const fov = p.get("fov") ? +p.get("fov") : undefined;
  if (p.get("ra") && p.get("dec")) {
    S.target = p.get("name"); if (S.target) $("q").value = S.target;
    openView(+p.get("ra"), +p.get("dec"), fov ?? 4);
  } else if (p.get("name") || p.get("q")) openTarget(p.get("name") || p.get("q"), fov);
  else if (p.get("embed") !== "1") openTarget(PRESETS[0].q, PRESETS[0].fov);
}
init();


/* ================================================================ proof table */
on("lang", () => proofTable());
async function proofTable() {
  const body = document.getElementById("proofRows");
  if (!body) return;
  let d;
  try { d = await (await fetch("/static/proof.json", { cache: "no-cache" })).json(); }
  catch { body.innerHTML = '<tr><td colspan="6" class="proof-empty">Test results could not be loaded.</td></tr>'; return; }
  const top = Math.max(...d.rows.map((r) => Math.max(r.measured, r.known)), 1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const what = (r) => r.expect.charAt(0).toUpperCase() + r.expect.slice(1).replace(/um\b/g, "µm");
  body.innerHTML = d.rows.map((r) => {
    const bar = (cls, v, label) => `<span>${tr(label)}</span><span class="bar ${cls}"><i style="width:${Math.max(1.5, v / top * 100)}%"></i></span><b>${v.toFixed(1)}</b>`;
    const err = r.kind === "mover"
      ? `<span class="err">${r.error_pixels.toFixed(2)}<small>${tr("direction off by {0}°", r.direction_off_deg)}</small></span>`
      : `<span class="err">${r.error_pixels.toFixed(2)}<small>${r.saturated ? tr("overloaded star; under 5″/yr = still") : tr("still star")}</small></span>`;
    const ok = r.verdict === "pass";
    const result = tr(r.kind === "mover" ? (ok ? "Motion found" : "Check") : (ok ? "Correctly still" : "Check"));
    return `<tr>
      <td><button class="proof-target" type="button" data-q="${esc(r.target)}">${esc(r.target)}<small>${tr("open in viewer")}</small></button></td>
      <td class="proof-what">${esc(tr(what(r)))}</td>
      <td><div class="speed">${bar("m", r.measured, "SPHEREx")}${bar("k", r.known, "catalogue")}</div></td>
      <td>${err}</td>
      <td class="used">${tr("{0} visits · {1} pictures", r.visits, r.images)}<br>${r.first} → ${r.last}<br>${tr("{0} spectrum points", r.spectrum_points)}</td>
      <td><span class="verdict ${ok ? "" : "check"}">${result}</span></td>
    </tr>`;
  }).join("");
  body.onclick = (e) => {
    const b = e.target.closest(".proof-target");
    if (!b) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof openTarget === "function") { const q = document.getElementById("q"); if (q) q.value = b.dataset.q; openTarget(b.dataset.q); }
  };
}
proofTable();

