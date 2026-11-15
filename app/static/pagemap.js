/* Page map: numbered markers on every part of the page, with a plain-language list of
   what each part is for and what its output means. */
"use strict";
(() => {
  const SB = window.SB;
  const $ = (id) => document.getElementById(id);
  const tr = (s, ...v) => (window.I18N ? window.I18N.t(s, ...v) : s);

  /* The small i buttons next to panel and chart titles open a plain-language
     "how to read this" for that panel; the map lists them too. */
  const ITEMS = [
    { key: "search", title: "Search",
      what: "Type a star's name (for example Vega) or its sky coordinates (RA and Dec). Galadriel works out where the object is today, even if it moves.",
      out: "The image fills with SPHEREx pictures of that spot. The first look at a new spot can take a minute." },
    { key: "targets", title: "Targets",
      what: "Inside the search box: the five objects NASA named in the challenge. One click loads each.",
      out: "These open instantly because they are stored with the app." },
    { key: "wavelength", title: "Spectral strip: cameras and field",
      what: "SPHEREx sees 102 colours of infrared light, read by six cameras (D1 to D6). Each has its own colour line, from blue (shortest) to red (longest). ALL adds the cameras together; COLOUR paints short wavelengths blue and long ones red. FIELD on the right sets how much sky you see, in arcminutes (′).",
      out: "<em>Tip:</em> cold objects such as brown dwarfs only show up in D6, 4.4–5.0 µm. CH₄ and CO₂ mark ranges where methane and carbon dioxide leave their fingerprints." },
    { key: "workflow", title: "Workflow",
      what: "The five steps of a search, like a spacecraft checklist: Acquire a target, Observe the visits, Detect what changed, Analyse an object, Report it. Select a step to do it.",
      out: "Each light turns green when that step is done; the amber light is the next step." },
    { key: "image", title: "The image",
      what: "One small patch of sky. Each dot is a star or galaxy; brighter objects look bigger. The reticle marks your target's position today. The corners show live readouts: which visit and date you are seeing, the display mode, the target's coordinates, and which camera. N and E show north and east (east is on the left, as on any sky chart). The bar at the bottom left is 1 arcminute long.",
      out: "Move the mouse over it to read coordinates. Click any object to measure it." },
    { key: "briefing", title: "Briefing",
      what: "Under the image, in plain words: what you're seeing right now, why it matters, and what to try next. It updates every time you change something.",
      out: "If you're ever unsure, read the amber Try next column." },
    { key: "playback", title: "Play and step",
      what: "Play flips through the visits like a flip-book; its light glows while it runs. ‹ and › step one visit at a time. RATE sets how fast it flips.",
      out: "The visit number and date in the top-left corner of the image tell you which visit you're looking at." },
    { key: "modes", title: "Display modes",
      what: "Blink shows each visit in turn. Difference subtracts the visits from each other, so stars that stay put disappear. Change map is a single picture of everything that changed. Deep stack adds every visit together for the faintest view.",
      out: "In Difference, a white spot beside an amber spot means something moved: amber is where it was, white is where it is now." },
    { key: "timeline", title: "Timeline of visits",
      what: "One diamond for each time SPHEREx photographed this spot, spaced by real time. \"Aug, 12 img\" means the August visit used 12 pictures. Select a diamond to jump to it; the amber one is the visit on screen.",
      out: "SPHEREx returns about every six months, more often near the poles of its orbit." },
    { key: "tabs", title: "Side panels",
      what: "Guide: short missions that teach the tool. Object: results for whatever you clicked. Changes: a list of everything that changed. View: colours, contrast and overlays. Share: a link, embed code or a video of the animation.",
      out: "In Object you'll see the motion SPHEREx measured, whether the Gaia catalogue agrees (green ✓), and the camera where it shows best. An amber dot on a tab means it has something new." },
    { key: "charts", title: "Spectrum and light curve",
      what: "These appear just below the image after you click an object. The spectrum shows its brightness at each wavelength; grey bands mark molecules such as water, methane and carbon dioxide. The light curve shows its brightness over time; each colour is one camera.",
      out: "Hollow dots mean the star was too bright for the camera, so it was measured from its outer glow: fine for changes, not for exact brightness. Every panel and chart has a small <em>i</em> button that explains how to read it." },
    { key: "status", title: "Status bar",
      what: "Facts about the current view: target, number of visits and pictures, the time span covered, field of view and the SPHEREx pipeline version. The Sound switch on the right turns the console sounds on or off. The top bar shows the UTC clock and the archive link light (green when NASA's archive answered).",
      out: "Useful when you report a finding to an astronomer." },
  ];

  let current = null;

  function target(key) {
    const el = document.querySelector(`[data-map="${key}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.hidden || getComputedStyle(el).display === "none") return null;
    return { el, r };
  }

  function render() {
    const list = $("mapList");
    list.innerHTML = ITEMS.map((it, i) => {
      const hidden = !target(it.key);
      return `<li><button type="button" data-i="${i}"><span class="map-num">${i + 1}</span><span><b>${tr(it.title)}</b><span class="what">${tr(it.what)}</span><span class="out">${tr(it.out)}${hidden ? ` <small>${tr("(appears once a target is loaded or an object is clicked)")}</small>` : ""}</span></span></button></li>`;
    }).join("");
    list.querySelectorAll("button").forEach((b) => (b.onclick = () => select(+b.dataset.i)));
    pins();
  }

  function pins() {
    const box = $("mapPins");
    box.innerHTML = "";
    ITEMS.forEach((it, i) => {
      const t = target(it.key);
      if (!t) return;
      if (t.r.bottom < 70 || t.r.top > window.innerHeight - 10) return;   // off screen right now
      const p = document.createElement("button");
      p.className = "map-pin" + (current === i ? " on" : "");
      p.type = "button";
      p.textContent = i + 1;
      p.title = tr(it.title);
      p.style.left = Math.max(18, t.r.left + 4) + "px";
      p.style.top = Math.max(18, t.r.top + 4) + "px";
      p.setAttribute("aria-label", `${i + 1}: ${tr(it.title)}`);
      p.onclick = () => select(i);
      box.appendChild(p);
    });
    if (current !== null) {
      const t = target(ITEMS[current].key);
      if (t) {
        const ring = document.createElement("div");
        ring.className = "map-ring";
        Object.assign(ring.style, { left: t.r.left - 6 + "px", top: t.r.top - 6 + "px", width: t.r.width + 12 + "px", height: t.r.height + 12 + "px" });
        box.prepend(ring);
        $("mapShade").style.opacity = 0;
      } else $("mapShade").style.opacity = 1;
    } else $("mapShade").style.opacity = 1;
  }

  function select(i) {
    current = i;
    const t = target(ITEMS[i].key);
    const panel = document.querySelector(".map-panel");
    if (t) {
      t.el.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
      const r = t.el.getBoundingClientRect();
      // keep the explained part visible: move the panel to the other side if needed
      panel.style.left = r.right > window.innerWidth - 460 ? "0" : "auto";
      panel.style.right = r.right > window.innerWidth - 460 ? "auto" : "0";
    }
    document.querySelectorAll(".map-list button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
    const btn = document.querySelector(`.map-list button[data-i="${i}"]`);
    if (btn) btn.scrollIntoView({ block: "nearest" });
    requestAnimationFrame(pins);
  }

  function open() {
    if (SB && SB.setSimple) SB.setSimple(false);      // the map explains the full view
    document.querySelectorAll("details.menu").forEach((d) => (d.open = false));
    current = null;
    $("mapLayer").hidden = false;
    const panel = document.querySelector(".map-panel");
    panel.style.left = "auto"; panel.style.right = "0";
    window.scrollTo({ top: 0 });
    requestAnimationFrame(render);
    $("mapClose").focus();
  }
  function close() {
    $("mapLayer").hidden = true;
    $("openMap").focus();
  }

  $("openMap").onclick = open;
  $("mapClose").onclick = close;
  $("mapShade").onclick = close;
  document.addEventListener("keydown", (e) => {
    if ($("mapLayer").hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); e.stopPropagation();
      select(current === null ? 0 : (current + (e.key === "ArrowDown" ? 1 : ITEMS.length - 1)) % ITEMS.length);
    }
  }, true);
  window.addEventListener("resize", () => { if (!$("mapLayer").hidden) pins(); });
  window.addEventListener("scroll", () => { if (!$("mapLayer").hidden) pins(); }, { passive: true });
})();
