/* Cockpit layer: mission clock, archive link lamp, workflow rail, and switch sounds. */
"use strict";
(() => {
  const SB = window.SB;
  if (!SB) return;
  const { S, on, $ } = SB;

  /* ---------------------------------------------------------- mission clock */
  const tick = () => { $("utcClock").textContent = new Date().toISOString().slice(11, 19); };
  tick(); setInterval(tick, 1000);

  /* ---------------------------------------------------------- archive link lamp */
  function link(state) {
    const lamp = $("linkLamp");
    lamp.className = "lamp" + (state === "ok" ? " ok" : state === "bad" ? " bad" : "");
    $("linkState").textContent = state === "ok" ? "NOMINAL" : state === "bad" ? "NO RESPONSE" : "STANDBY";
  }
  link("standby");
  on("view", () => link("ok"));
  on("error", () => link("bad"));

  /* ---------------------------------------------------------- sounds (Web Audio, no files) */
  let ctx = null, enabled = true;
  try { enabled = localStorage.getItem("sb_sound") !== "0"; } catch (e) { /* */ }
  const sw = $("soundToggle");
  const setSound = (v) => { enabled = v; sw.setAttribute("aria-checked", v); try { localStorage.setItem("sb_sound", v ? "1" : "0"); } catch (e) { /* */ } };
  setSound(enabled);
  sw.onclick = () => { setSound(!enabled); if (enabled) click(); };
  function ac() {
    if (!enabled) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function click() {
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    // short mechanical tick: filtered noise burst + low thunk
    const buf = a.createBuffer(1, a.sampleRate * 0.03, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const n = a.createBufferSource(); n.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 1.2;
    const g = a.createGain(); g.gain.value = 0.10;
    n.connect(f).connect(g).connect(a.destination); n.start(t);
    const o = a.createOscillator(), og = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(og).connect(a.destination); o.start(t); o.stop(t + 0.07);
  }
  function tone(freqs, dur = 0.09, gap = 0.07, vol = 0.05, type = "sine") {
    const a = ac(); if (!a) return;
    freqs.forEach((fr, i) => {
      const t = a.currentTime + i * (dur + gap);
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    });
  }
  function powerUp() {
    const a = ac(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.32);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.42);
  }
  const SWITCHES = ".sw, .btn, .seg, .band, .tab, .step, .qt, .preset, .menu-item, .tick, .flip, .finds button, .m-list button, .map-list button, .map-pin, summary";
  document.addEventListener("pointerdown", (e) => { if (e.target.closest(SWITCHES)) click(); }, true);
  document.addEventListener("keydown", (e) => {
    if ([" ", "ArrowLeft", "ArrowRight", "b", "d", "c", "a"].includes(e.key) && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) click();
  });
  on("view", () => powerUp());
  on("object", (o) => { if (o && o.motion && o.motion.total > Math.max(o.motion.floor || 1, 3 * o.motion.err)) tone([880, 1320]); else tone([660]); });
  on("error", () => tone([330, 220], 0.14, 0.05, 0.05, "square"));

  /* ---------------------------------------------------------- "how to read this" buttons */
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".info");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const box = document.getElementById("info-" + b.dataset.info);
    if (!box) return;
    const open = box.hidden;
    box.hidden = !open;
    b.setAttribute("aria-expanded", open);
  }, true);

  /* ---------------------------------------------------------- workflow rail */
  const flags = { acquire: false, observe: false, detect: false, analyse: false, report: false };
  const order = ["acquire", "observe", "detect", "analyse", "report"];
  const seen = new Set();
  function renderRail() {
    const now = order.find((k) => !flags[k]);
    document.querySelectorAll(".step").forEach((b) => {
      const k = b.dataset.step;
      b.classList.toggle("done", flags[k]);
      b.classList.toggle("now", k === now);
    });
  }
  on("view", () => {
    flags.acquire = true; seen.clear();
    $("wfAcquire").textContent = $("capTarget").textContent || "Target acquired";
    renderRail();
  });
  on("frame", (d) => {
    if (d.mode === "blink") seen.add(d.epoch);
    if (!flags.observe && SB.nEpochs() && seen.size >= Math.min(SB.nEpochs(), 3)) { flags.observe = true; renderRail(); }
  });
  on("mode", (m) => { if ((m === "diff" || m === "change") && !flags.detect) { flags.detect = true; renderRail(); } });
  on("object", () => { if (!flags.analyse) { flags.analyse = true; renderRail(); } });
  on("share", () => { if (!flags.report) { flags.report = true; renderRail(); } });

  const ACTIONS = {
    acquire: () => { const t = $("targetsMenu"); $("q").focus(); $("q").select(); if (t) t.open = true; },
    observe: () => { SB.setMode("blink"); SB.play(); },
    detect: () => SB.setMode("diff"),
    analyse: () => {
      SB.showTab("object");
      $("plateCaption").textContent = "Click an object on the image to analyse it";
      setTimeout(() => { if ($("plateCaption").textContent.startsWith("Click an object")) $("plateCaption").textContent = ""; }, 6000);
    },
    report: () => SB.showTab("share"),
  };
  document.querySelectorAll(".step").forEach((b) => (b.onclick = () => ACTIONS[b.dataset.step]()));
  $("railGuide").onclick = () => $("openGuide").click();
  $("railMap").onclick = () => $("openMap").click();
  renderRail();
})();
