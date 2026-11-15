/* Beginner missions: short guided stories built on real SPHEREx data.
   Each step says what to do, highlights the control, and ticks itself off
   when the user does it (via events emitted by app.js). */
"use strict";
(() => {
  const SB = window.SB;
  if (!SB) return;
  const { S, on, $ } = SB;
  const tr = SB.tr;

  const isTarget = (re) => S.view && re.test(S.target || "");
  const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? "?" : x.toFixed(d));

  const MISSIONS = [
    {
      id: "runaway", title: "Catch a runaway star", blurb: "Barnard's Star, the fastest star in our sky",
      target: { q: "Barnard's Star", fov: 3, ch: "ALL" },
      steps: [
        { label: "Load the star", load: true,
          say: "Barnard's Star is only 6 light-years away, one of the Sun's closest neighbours. Load SPHEREx's pictures of it.",
          check: (ev) => ev === "view" && isTarget(/barnard/i) },
        { label: "Pause the movie", spot: "#playBtn",
          say: "The image is flipping between SPHEREx pictures taken on different dates. The date at the top left changes each time. Press Pause so we can look carefully.",
          check: (ev, d) => ev === "play" && d === false, skipIf: () => !S.playing },
        { label: "Step through every date", spot: "#nextBtn", visit: true,
          say: "Press › (or the → key) and watch the big bright star in the crosshair. Compare it with the small stars around it. Visit every date.",
          check: (ev, d, st) => st.visited.size >= SB.nEpochs() },
        { label: "Press Difference", spot: '[data-mode="diff"]',
          say: "Did you see it creep upward while everything else stayed still? Now press Difference: each picture is subtracted from the others, so stars that don't move disappear.",
          check: (ev) => ev === "mode" && S.mode === "diff" },
        { label: "Click the runaway", spot: "#plateWrap",
          say: "Only our runaway is left: white where it is now, amber where it used to be. Click right on it to measure how fast it moves.",
          check: (ev) => ev === "object" },
      ],
      win: () => {
        const m = S.lastObject && S.lastObject.motion;
        return tr("You caught a runaway star. SPHEREx measured it moving {0}″ a year toward the {1}; Gaia's value is 10.4″. At that speed it crosses the width of the full Moon in about 180 years, faster than any other star we can see.", m ? fmt(m.total) : "~10", tr(m ? ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(m.pa / 45) % 8] : "north"));
      },
    },
    {
      id: "invisible", title: "Find the invisible brown dwarf", blurb: "WISE 0855, colder than your freezer",
      target: { q: "WISE J085510.83-071442.5", fov: 3, ch: "ALL" },
      steps: [
        { label: "Load WISE 0855", load: true,
          say: "WISE 0855 is a brown dwarf: too small to shine like a star, too big to be a planet. It's the coldest one ever found, about −25 °C. Load its patch of sky.",
          check: (ev) => ev === "view" && isTarget(/0855/) },
        { label: "Spot the trick", next: "I see the dot",
          say: "See the dot sitting right on the crosshair? Trick question: that's an ordinary background star, not our target. Something this cold gives off almost no light at these wavelengths." },
        { label: "Switch to 4.4–5.0 µm", spot: '[data-ch="D6"]',
          say: "Cold objects glow at long infrared wavelengths. In the spectral strip at the top, choose D6, SPHEREx's longest-wavelength camera (4.4–5.0 µm).",
          check: (ev) => ev === "channel" && S.channel === "D6" },
        { label: "Watch it walk", spot: "#nextBtn", visit: true,
          say: "Now a faint dot appears just left of the crosshair. Pause, then step through the dates with ›: it walks to the right, toward the crosshair, about 8″ a year.",
          check: (ev, d, st) => st.visited.size >= SB.nEpochs() },
      ],
      win: () => "You found the coldest brown dwarf known, using light your eyes can't see. Viewers that add every wavelength together never show it: the background star drowns it out. Choosing the right one of SPHEREx's 102 colours is what made it visible.",
    },
    {
      id: "breathe", title: "Watch a star breathe", blurb: "R Draconis, a giant that swells and shrinks",
      target: { q: "R Dra", fov: 4, ch: "ALL" },
      steps: [
        { label: "Load R Draconis", load: true,
          say: "R Draconis is a dying giant star. It sits near a spot SPHEREx passes over again and again, so we have many visits. Load it.",
          check: (ev) => ev === "view" && isTarget(/dra/i) },
        { label: "Click the star", spot: "#plateWrap",
          say: "Click the bright star in the middle of the image to measure its brightness in every picture.",
          check: (ev) => ev === "measure" },
        { label: "Read the light curve", spot: "#lcChart", next: "I see it change",
          say: "Look at the Light curve just below the image. Time runs left to right. Each colour is one detector. Follow one colour: the star brightens and fades over months, because it swells and shrinks every 8 months or so." },
      ],
      win: () => "You watched a star breathe. R Draconis is so bright it overloads SPHEREx's detector, so the console measures its outer glow instead (the hollow dots). That glow still rises and falls with the star.",
    },
    {
      id: "discover", title: "Be a discoverer", blurb: "Check what changed and whether anyone knows about it",
      target: { q: "eps Ind B", fov: 4, ch: "ALL" },
      steps: [
        { label: "Load a field", load: true,
          say: "Epsilon Indi B is a pair of brown dwarfs, but let's pretend we don't know that. Load the field.",
          check: (ev) => ev === "view" && isTarget(/ind/i) },
        { label: "Open the Change map", spot: '[data-mode="change"]',
          say: "Press Change map. It's one picture showing how much every spot changed between visits. Bright means changed.",
          check: (ev) => ev === "mode" && S.mode === "change" },
        { label: "Check a change", spot: "#findings",
          say: "Each numbered mark is listed under What changed. Green ones are stars Gaia already knows about; orange ones have no match. Click the first item.",
          check: (ev) => ev === "object" },
        { label: "Read the verdict", spot: "#objectPanel", next: "Done",
          say: "The Selected object panel shows the speed SPHEREx measured, whether Gaia agrees, and the wavelength where it shows best. Something moving with no Gaia match is a real candidate: copy the link and send it to an astronomer." },
      ],
      win: () => "That's the real workflow astronomers and citizen scientists use: spot a change, measure it, check the catalogues, report it. Most known brown dwarfs were found by volunteers doing exactly this.",
    },
  ];

  let cur = null;            // { m, i, visited }
  let done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem("sb_missions") || "[]")); } catch (e) { /* */ }
  const save = () => { try { localStorage.setItem("sb_missions", JSON.stringify([...done])); } catch (e) { /* */ } };

  function clearSpot() {
    document.querySelectorAll(".spotlight").forEach((e) => e.classList.remove("spotlight"));
    $("plateCaption").textContent = "";
  }
  function spot(sel) {
    clearSpot();
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add("spotlight");
    /* the guide lives in a tab: point at the other tab instead of switching away from it */
    const panel = el.closest(".tabpanel");
    if (panel && panel.dataset.panel !== "guide") {
      const tab = document.querySelector(`.tab[data-tab="${panel.dataset.panel}"]`);
      if (tab) tab.classList.add("spotlight");
    }
    if (!panel) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function show() { SB.showTab("guide"); }

  function menu() {
    clearSpot(); cur = null; show();
    const items = MISSIONS.map((m, i) => `<li><button type="button" data-i="${i}" class="${done.has(m.id) ? "done" : ""}"><b>${i + 1}. ${tr(m.title)}</b><span>${tr(m.blurb)}</span></button></li>`).join("");
    $("missionBody").innerHTML = `
      <p class="m-title">New to this? Start here</p>
      <p class="m-intro">SPHEREx is a NASA space telescope that photographs the whole sky every six months in infrared light. This viewer flips between its pictures so you can spot anything that moved or changed. Each mission takes about a minute and uses real data.</p>
      <ol class="m-list">${items}</ol>
      <dl class="m-glossary">
        <dt>Visit</dt><dd>One pass of SPHEREx over this patch of sky. The dots under the image are visits.</dd>
        <dt>Blink</dt><dd>Flipping between visits. Things that move seem to jump.</dd>
        <dt>Difference</dt><dd>Subtracting visits. Still stars vanish; a mover leaves a white spot (where it is) and an amber spot (where it was).</dd>
        <dt>″/yr</dt><dd>Arcseconds per year, how fast something crosses the sky. The Moon is about 1,800″ wide.</dd>
        <dt>Gaia</dt><dd>An ESA star catalogue. If something moves and Gaia doesn't know it, it might be new.</dd>
      </dl>`;
    $("missionBody").querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => start(+b.dataset.i)));
  }
  function start(i) {
    const m = MISSIONS[i];
    cur = { m, i: 0, idx: i, visited: new Set() };
    render();
  }
  function render() {
    show();
    const { m, i } = cur;
    if (i >= m.steps.length) return win();
    const st = m.steps[i];
    const steps = m.steps.map((s, k) => `<li class="${k < i ? "done" : k === i ? "now" : ""}">${tr(s.label)}</li>`).join("");
    const actions = [];
    if (st.load) actions.push(`<button class="btn amber" id="mLoad" type="button">${tr("Load {0}", m.target.q.replace(/^WISE J.*/, "WISE 0855"))}</button>`);
    if (st.next) actions.push(`<button class="btn teal" id="mNext" type="button">${tr(st.next)}</button>`);
    actions.push(`<button class="btn ghost" id="mMenu" type="button">All missions</button>`);
    $("missionBody").innerHTML = `<p class="m-title">${tr(m.title)}</p><ol class="m-steps">${steps}</ol><p class="m-say">${tr(st.say)}</p><div class="m-actions">${actions.join("")}</div>`;
    const L = $("mLoad"), N = $("mNext");
    if (L) L.onclick = () => SB.openTarget(m.target.q, m.target.fov, m.target.ch);
    if (L) L.className = "btn primary";
    if (N) N.className = "btn primary";
    if (N) N.onclick = advance;
    $("mMenu").onclick = menu;
    if (st.visit) cur.visited = new Set();
    spot(st.spot);
    $("plateCaption").textContent = tr(st.label);
    if (st.load && S.view && S.target === m.target.q && S.channel === (m.target.ch || "ALL")) {
      setTimeout(advance, 50);           // already showing the right field
    }
    if (st.skipIf) setTimeout(() => { if (cur && cur.m.steps[cur.i] === st && st.skipIf()) advance(); }, 900);
  }
  function advance() { if (!cur) return; cur.i++; render(); }
  function win() {
    clearSpot();
    const { m, idx } = cur;
    done.add(m.id); save();
    const nextM = MISSIONS[idx + 1];
    $("missionBody").innerHTML = `<p class="m-win">Mission complete</p><p class="m-say">${tr(m.win())}</p><div class="m-actions">${nextM ? `<button class="btn primary" id="mNextM" type="button">${tr("Next: {0}", tr(nextM.title))}</button>` : `<button class="btn primary" id="mExpert" type="button">Explore on your own</button>`}<button class="btn ghost" id="mMenu" type="button">All missions</button></div>`;
    if ($("mNextM")) $("mNextM").onclick = () => start(idx + 1);
    if ($("mExpert")) $("mExpert").onclick = () => { $("q").focus(); SB.showTab("object"); };
    $("mMenu").onclick = menu;
    cur = null;
  }
  function onEvent(ev, data) {
    if (!cur) return;
    const st = cur.m.steps[cur.i];
    if (!st) return;
    if (st.visit && ev === "frame" && !S.playing && (data.mode === "blink" || data.mode === "diff")) cur.visited.add(data.epoch);
    if (st.check && st.check(ev, data, cur)) advance();
    else if (st.visit && ev === "frame") {
      $("plateCaption").textContent = tr("{0}: {1} of {2}", tr(st.label), cur.visited.size, SB.nEpochs());
    }
  }
  ["view", "play", "frame", "mode", "channel", "measure", "object", "find", "click"].forEach((e) => on(e, (d) => onEvent(e, d)));
  on("guide", () => { if (!cur) menu(); });
  on("lang", () => { if (cur) render(); else menu(); });
  on("tab", (t) => { document.querySelectorAll(".tab.spotlight").forEach((e) => { if (e.dataset.tab === t) e.classList.remove("spotlight"); }); });
  menu();
})();
