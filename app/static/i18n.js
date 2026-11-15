/* Language switch. English is written in the page and the scripts; other languages
   live in /static/lang/<code>.json as { "English text": "translation" }.

   - Whole paragraphs that contain <b>, <em> or similar are looked up by their HTML,
     so a translation can move the bold words to where its grammar needs them.
   - Plain text nodes and the title / aria-label / placeholder attributes are looked up
     by their text.
   - Text built from numbers (the briefing, mission results) uses I18N.t(template, values),
     where the template has {0}, {1}... in it.
   - A MutationObserver translates anything the app adds later (missions, page map, panels).
   Anything missing from a language file simply stays in English. */
"use strict";
(() => {
  const LANGS = [
    ["en", "English", "ltr"], ["zh", "中文", "ltr"], ["hi", "हिन्दी", "ltr"], ["es", "Español", "ltr"],
    ["fr", "Français", "ltr"], ["ar", "العربية", "rtl"], ["bn", "বাংলা", "ltr"], ["pt", "Português", "ltr"],
    ["si", "සිංහල", "ltr"], ["ta", "தமிழ்", "ltr"],
  ];
  const INLINE = new Set(["B", "STRONG", "EM", "I", "SPAN", "SUB", "SUP", "BR", "SMALL", "A"]);
  const SKIP = "script,style,canvas,svg,input,textarea,select,code,[data-no-i18n]";
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const srcText = new WeakMap();   // text node -> original English
  const srcHTML = new WeakMap();   // element -> original English HTML
  const srcAttr = new WeakMap();   // element -> {attr: English}
  const trHTML = new WeakMap();    // element -> HTML we last put there

  let lang = "en", dict = {}, busy = false;
  try { lang = localStorage.getItem("sb_lang") || (navigator.language || "en").slice(0, 2); } catch (e) { /* */ }
  if (!LANGS.some((l) => l[0] === lang)) lang = "en";

  function t(s, ...v) {
    let out = (lang !== "en" && dict[norm(s)]) || s;
    v.forEach((x, i) => { out = out.split(`{${i}}`).join(x); });
    return out;
  }

  /* An element is a "unit" when it holds text mixed with inline tags only (a paragraph
     with some bold words) - then it's translated as a whole. */
  function isUnit(el) {
    let text = false, inline = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) text = true; }
      else if (n.nodeType === 1) {
        if (!INLINE.has(n.tagName) || n.id || n.querySelector("button,input,[id]")) return false;
        if (n.textContent.trim()) inline = true;
      }
    }
    return text && inline;
  }

  function applyTo(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 3) return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.closest && root.closest(SKIP)) return;
    const walk = (el) => {
      if (el.matches(SKIP)) return;
      attrs(el);
      if (isUnit(el)) {
        let orig = srcHTML.get(el);
        const cur = el.innerHTML;
        // the app may have rewritten it in English since we last looked
        if (orig === undefined || (cur !== orig && cur !== trHTML.get(el))) { orig = cur; srcHTML.set(el, orig); }
        const tr = lang === "en" ? null : dict[norm(orig)];
        const want = tr || orig;
        if (cur !== want) el.innerHTML = want;
        trHTML.set(el, el.innerHTML);
        return;
      }
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3) textNode(n);
        else if (n.nodeType === 1) walk(n);
      }
    };
    walk(root);
  }

  function textNode(n) {
    const v = n.nodeValue;
    if (!v.trim()) return;
    let orig = srcText.get(n);
    if (orig === undefined || (v !== orig && v !== n._tr)) { orig = v; srcText.set(n, orig); }
    const key = norm(orig);
    const tr = lang === "en" ? null : dict[key];
    const ws = orig.match(/^(\s*)[\s\S]*?(\s*)$/);
    const want = tr ? ws[1] + tr + ws[2] : orig;
    if (v !== want) { n.nodeValue = want; n._tr = want; }
  }

  function attrs(el) {
    for (const a of ["title", "aria-label", "placeholder", "data-tip"]) {
      if (!el.hasAttribute(a)) continue;
      const store = srcAttr.get(el) || {};
      const cur = el.getAttribute(a);
      if (store[a] === undefined || (cur !== store[a] && cur !== store["_" + a])) store[a] = cur;
      srcAttr.set(el, store);
      const tr = lang === "en" ? null : dict[norm(store[a])];
      const want = tr || store[a];
      if (cur !== want) { el.setAttribute(a, want); store["_" + a] = want; }
    }
  }

  function applyAll() {
    busy = true;
    try { applyTo(document.body); document.title = t("Galadriel · SPHEREx motion explorer"); }
    finally { busy = false; obs.takeRecords(); }
  }

  const pending = new Set();
  let raf = 0;
  const obs = new MutationObserver((recs) => {
    if (busy) return;
    for (const r of recs) {
      if (r.type === "characterData") pending.add(r.target);
      else if (r.type === "attributes") pending.add(r.target);
      else r.addedNodes.forEach((n) => pending.add(n.nodeType === 3 ? n : n));
      if (r.type === "childList" && r.target.nodeType === 1) pending.add(r.target);
    }
    if (!raf) raf = requestAnimationFrame(flush);
  });
  function flush() {
    raf = 0;
    if (lang === "en") { pending.clear(); return; }
    busy = true;
    try { pending.forEach((n) => { if (n.isConnected) applyTo(n); }); }
    finally { pending.clear(); busy = false; obs.takeRecords(); }
  }

  async function load(code) {
    if (code === "en") return {};
    const r = await fetch(`/static/lang/${code}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(code);
    const raw = await r.json(), d = {};
    for (const k in raw) d[norm(k)] = raw[k];
    return d;
  }

  async function setLang(code, quiet) {
    try { dict = await load(code); lang = code; }
    catch (e) { dict = {}; lang = "en"; }
    try { localStorage.setItem("sb_lang", lang); } catch (e) { /* */ }
    const L = LANGS.find((l) => l[0] === lang);
    document.documentElement.lang = lang;
    document.body.classList.toggle("rtl-text", L[2] === "rtl");
    document.body.dataset.lang = lang;
    applyAll();
    const sel = document.getElementById("langSel");
    if (sel) sel.value = lang;
    if (!quiet && window.SB && window.SB.emit) window.SB.emit("lang", lang);
  }

  window.I18N = { t, setLang, get lang() { return lang; }, LANGS, apply: applyTo,
    /* for building language files: every English string currently on the page */
    collect() {
      const out = new Set();
      const walk = (el) => {
        if (el.matches(SKIP)) return;
        for (const a of ["title", "aria-label", "placeholder", "data-tip"]) if (el.hasAttribute(a)) out.add(norm(el.getAttribute(a)));
        if (isUnit(el)) { out.add(norm(el.innerHTML)); return; }
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.nodeValue.trim()) out.add(norm(n.nodeValue));
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(document.body);
      return [...out].filter((s) => /[A-Za-z]{2}/.test(s));
    } };

  function init() {
    const sel = document.getElementById("langSel");
    if (sel) {
      sel.innerHTML = LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join("");
      sel.value = lang;
      sel.onchange = () => setLang(sel.value);
    }
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
    if (lang !== "en") setLang(lang, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
