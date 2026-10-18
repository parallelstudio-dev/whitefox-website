// Interactive components of the Whitefox site, reimplemented without Framer's runtime.
// Values (speeds, distances, thresholds) were measured on the live Framer site.
import { play, reduced, springEasing } from "./motion";
import SECTORS from "@/content/sectors.json";
import MENUS from "@/content/menu.json";

// Counter targets (Framer keeps them in component props, not in the markup).
// Verified on the live site (18 Oct 2026): "/" and "/about-us" both count to 18, 95%, 815K+, 471+.
// Live sampling showed the count finishing within ~1s of entering view, so the duration is 1s
// (sampled at ~230ms intervals; the exact easing curve is not measured).
const COUNTERS: Record<string, number[]> = {
  "/": [18, 95, 815, 471],
  "/about-us": [18, 95, 815, 471],
};

const visible = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";

/** Header menu. Framer renders the open menu only on click, so its markup was captured from the live site
 *  (scripts/migrate/capture-menu.mjs → content/menu.json, one per closed nav variant). As on the live site:
 *  - a tap on the menu icon swaps the nav to its "… Open" variant; the panel grows in with the nav's
 *    transition (spring 400/40/1, from the component); the open nav locks page scroll;
 *  - any tap on the open nav closes it at once (Framer unmounts the panel, no exit animation). */
function menu(main: HTMLElement) {
  const menus = MENUS as Record<string, { open: string; html: string; symbols: string[] }>;
  const closed = new WeakMap<Element, Element>();
  let defs: HTMLElement | null = null;
  const onClick = (e: MouseEvent) => {
    const nav = (e.target as Element).closest("nav");
    if (!nav || !main.contains(nav)) return;
    const name = nav.getAttribute("data-framer-name") || "";
    const back = closed.get(nav);
    // A link inside the menu still navigates; close after the click has been handled.
    if (back) { if ((e.target as Element).closest("a")) setTimeout(() => nav.replaceWith(back)); else nav.replaceWith(back); return; }
    if (!menus[name] || !(e.target as Element).closest('[data-framer-name="Icon"]')) return;
    if (!defs) {
      defs = document.createElement("div");
      defs.setAttribute("aria-hidden", "true");
      defs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      defs.innerHTML = menus[name].symbols.join("");
      document.body.appendChild(defs);
    }
    const t = document.createElement("template");
    t.innerHTML = menus[name].html;
    const open = t.content.firstElementChild!;
    closed.set(open, nav);
    nav.replaceWith(open);
    const content = open.querySelector<HTMLElement>('[data-framer-name="Content"]');
    if (content && !reduced()) {
      const s = springEasing(400, 40, 1);
      content.animate([{ clipPath: "inset(0 0 100% 0 round 12px)" }, { clipPath: "inset(0 0 0% 0 round 12px)" }], { duration: s.duration, easing: s.easing });
    }
  };
  main.addEventListener("click", onClick);
  return () => { main.removeEventListener("click", onClick); defs?.remove(); };
}

/** Logo ticker: the strip scrolls left at 70px/s forever (items duplicated for a seamless loop). */
function tickers(main: HTMLElement) {
  const offs: (() => void)[] = [];
  main.querySelectorAll<HTMLUListElement>("ul").forEach((ul) => {
    if (!ul.querySelector(".ticker-item")) return;
    const items = [...ul.children] as HTMLElement[];
    items.forEach((li) => { const c = li.cloneNode(true) as HTMLElement; c.setAttribute("aria-hidden", "true"); ul.appendChild(c); });
    ul.style.opacity = "1";
    ul.style.willChange = "transform";
    let x = 0, prev = performance.now(), raf = 0, span = 0;
    const measure = () => { const gap = parseFloat(getComputedStyle(ul).columnGap || getComputedStyle(ul).gap) || 0; span = items.reduce((s, li) => s + li.offsetWidth + gap, 0); };
    measure();
    const tick = (t: number) => {
      const dt = Math.min(64, t - prev); prev = t;
      if (visible(ul)) { if (!span) measure(); x -= (70 * dt) / 1000; if (span && -x >= span) x += span; ul.style.transform = `translateX(${x}px)`; }
      raf = requestAnimationFrame(tick);
    };
    if (!reduced()) raf = requestAnimationFrame(tick);
    const ro = new ResizeObserver(measure); ro.observe(ul);
    offs.push(() => { cancelAnimationFrame(raf); ro.disconnect(); });
  });
  return () => offs.forEach((f) => f());
}

/** Counters: count up from 0 when they come into view (~1s, ease-out), keeping their prefix/suffix. */
function counters(main: HTMLElement) {
  const targets = COUNTERS[location.pathname.replace(/\/$/, "") || "/"];
  if (!targets) return () => {};
  // Each counter renders two <p>: a hidden sizer and the visible gradient number (position:absolute).
  // Desktop / tablet / phone variants each render a copy; only the active variant's copies are laid out,
  // so a counter's target is its position among the counters visible right now.
  const all = [...main.querySelectorAll<HTMLParagraphElement>("p")].filter((p) => /position:\s*absolute/.test(p.getAttribute("style") || "") && /^0/.test(p.textContent || ""));
  const shownNow = () => all.filter((p) => p.offsetParent !== null);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const p = e.target as HTMLParagraphElement; const sizer = p.previousElementSibling as HTMLElement | null;
    const target = targets[shownNow().indexOf(p)] ?? 0;
    const suffix = (p.textContent || "").replace(/^0/, "");
    const t0 = performance.now(), D = reduced() ? 0 : 1000;
    const step = (t: number) => {
      const k = D ? Math.min(1, (t - t0) / D) : 1; const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      p.textContent = `${v}${suffix}`; if (sizer) sizer.textContent = `${v}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.4 });
  all.forEach((p) => io.observe(p));
  return () => io.disconnect();
}

/** Blocks Framer renders with will-change + opacity:0 (a scroll-in effect) play in as they enter the viewport. */
function blocks(main: HTMLElement) {
  const els = [...main.querySelectorAll<HTMLElement>("[style*='will-change']")].filter((e) => !e.hasAttribute("data-fx") && /opacity:\s*0(;|$)/.test(e.getAttribute("style") || ""));
  if (reduced()) { els.forEach((e) => { e.style.opacity = "1"; e.style.transform = "none"; }); return () => {}; }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    play(e.target as HTMLElement, { opacity: 1 }, { type: "spring", stiffness: 125, damping: 35, mass: 2 });
  }), { rootMargin: "0px 0px -8% 0px" });
  els.forEach((e) => io.observe(e));
  return () => io.disconnect();
}

/**
 * Shutter footer (desktop): the WHITEFOX letters wait off to the left ("Default" variant) and slide into place
 * ("Default 2") once the footer is about a third into view. Measured on the live site: the first letter settles
 * after ~1.1s, the last after ~1.7s. Implemented as a variant class swap with a FLIP slide per letter.
 */
function shutter(main: HTMLElement) {
  const roots = [...main.querySelectorAll<HTMLElement>(".framer-v-1lqr6d7")];
  if (!roots.length) return () => {};
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const root = e.target as HTMLElement;
    const letters = [...root.children].map((c) => c.firstElementChild as HTMLElement).filter(Boolean);
    const before = letters.map((l) => l.getBoundingClientRect().left);
    root.classList.replace("framer-v-1lqr6d7", "framer-v-167lrlx");
    root.setAttribute("data-framer-name", "Default 2");
    // In "Default 2" each letter is centred on both axes (live: transform translate(-50%, -50%)).
    letters.forEach((l) => { if (/translateY\(-50%\)/.test(l.getAttribute("style") || "")) l.style.transform = "translate(-50%, -50%)"; });
    if (reduced()) return;
    const s = springEasing(120, 20, 1);
    letters.forEach((l, i) => {
      const dx = before[i] - l.getBoundingClientRect().left;
      if (!dx) return;
      l.animate([{ translate: `${dx}px 0` }, { translate: "0 0" }], { duration: s.duration, easing: s.easing, delay: 450 + i * 70, fill: "backwards" });
    });
  }), { rootMargin: "0px 0px -30% 0px" });
  roots.forEach((r) => io.observe(r));
  return () => io.disconnect();
}

/**
 * Sector list (home): hovering a row makes it the active row (lighter band, white border, white title, arrow turned
 * 45°) and shows that sector's image, title and text in the panel beside the list. Content from the live component
 * (content/sectors.json); clicking a row does nothing extra, as on the live site.
 */
function sectors(main: HTMLElement) {
  const ACTIVE = { cls: "framer-v-1ia68xd", name: "Desktop Active", border: "var(--token-10c96ffd-6509-42e3-8261-20b495ab6f7e, rgb(242, 242, 242))", bg: "rgba(250, 250, 250, 0.08)" };
  const IDLE = { cls: "framer-v-2h70ak", name: "Desktop", border: "rgba(250, 250, 250, 0.2)", bg: "rgba(0, 0, 0, 0)" };
  const rows = [...main.querySelectorAll<HTMLElement>(`.framer-6SAIZ.${ACTIVE.cls}, .framer-6SAIZ.${IDLE.cls}`)];
  if (!rows.length) return () => {};
  const byTitle = new Map(SECTORS.map((s) => [s.title, s]));
  const titleOf = (row: HTMLElement) => row.querySelector("p")?.textContent?.trim() ?? "";
  const setRow = (row: HTMLElement, on: boolean) => {
    const v = on ? ACTIVE : IDLE, o = on ? IDLE : ACTIVE;
    row.classList.replace(o.cls, v.cls); row.setAttribute("data-framer-name", v.name);
    row.style.transition = "background-color .3s ease, border-color .3s ease";
    row.style.setProperty("--border-color", v.border); row.style.backgroundColor = v.bg;
    const txt = row.querySelector<HTMLElement>("[data-framer-component-type='RichTextContainer']"); const p = row.querySelector<HTMLElement>("p");
    if (on) { txt?.style.setProperty("--extracted-r6o4lv", ACTIVE.border); p?.style.setProperty("--framer-text-color", "var(--extracted-r6o4lv, var(--token-10c96ffd-6509-42e3-8261-20b495ab6f7e, rgb(242, 242, 242)))"); }
    else { txt?.style.removeProperty("--extracted-r6o4lv"); p?.style.removeProperty("--framer-text-color"); }
    const icon = row.querySelector<HTMLElement>("[data-framer-name='Icon']");
    if (icon) { icon.style.transition = "transform .3s ease"; icon.style.transform = on ? "rotate(45deg)" : "none"; }
  };
  // Each breakpoint variant has its own list and panel; the panel is found from its title (an <h5>) in the same variant.
  const scopeOf = (row: HTMLElement) => row.closest(".ssr-variant") ?? main;
  const show = (row: HTMLElement) => {
    const scope = scopeOf(row); const s = byTitle.get(titleOf(row)); if (!s) return;
    scope.querySelectorAll<HTMLElement>(`.framer-6SAIZ.${ACTIVE.cls}`).forEach((r) => r !== row && setRow(r, false));
    setRow(row, true);
    const h = [...scope.querySelectorAll<HTMLElement>("h5")].find((e) => byTitle.has(e.textContent?.trim() ?? "")); if (!h) return;
    let box: HTMLElement | null = h; while (box && !box.querySelector("img")) box = box.parentElement;
    const img = box?.querySelector<HTMLImageElement>("img"); const body = h.closest("[data-framer-component-type]")?.parentElement?.querySelector<HTMLElement>("p:not(:empty)");
    if (img && img.getAttribute("src") !== s.src) {
      img.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
      img.srcset = s.srcset; img.src = s.src; img.style.objectPosition = s.position; img.width = s.width; img.height = s.height;
    }
    h.textContent = s.title;
    const bodyP = [...(box?.querySelectorAll<HTMLElement>("p") ?? [])].find((p) => p.textContent && p.textContent.length > 40);
    if (bodyP) bodyP.textContent = s.body; else if (body) body.textContent = s.body;
  };
  const offs = rows.map((row) => { const on = () => show(row); row.addEventListener("pointerenter", on); row.addEventListener("focus", on); return () => { row.removeEventListener("pointerenter", on); row.removeEventListener("focus", on); }; });
  return () => offs.forEach((f) => f());
}

/**
 * Testimonial slider (home): one card at a time, autoplay every 5s, sliding left (live settings: intervalControl 5,
 * direction left, itemAmount 1, gap 20, drag). The round ← → controls (CarouselControlsDesktop / Phone) are in the
 * markup but disabled until scripts run; they are enabled here and drive the track.
 * The slide easing is an estimate (not measured on the live site).
 */
function testimonials(main: HTMLElement) {
  const tracks = [...main.querySelectorAll<HTMLUListElement>("ul")].filter((ul) => ul.querySelector("[class*='-container'][data-framer-name='1']") && /gap:20px/.test(ul.getAttribute("style") || ""));
  if (!tracks.length) return () => {};
  const offs: (() => void)[] = [];
  const s = springEasing(200, 40, 1);
  tracks.forEach((ul) => {
    const n = ul.children.length; let i = 0, timer = 0;
    const scope = ul.closest(".ssr-variant") ?? main;
    const go = (k: number) => {
      i = (k + n) % n;
      const w = (ul.parentElement as HTMLElement).clientWidth;
      ul.style.transition = reduced() ? "none" : `transform ${s.duration}ms ${s.easing}`;
      ul.style.transform = `translateX(${-i * (w + 20)}px)`;
    };
    // Autoplay only while the slider is on screen (live setting playOffscreen: false).
    let onScreen = false;
    const restart = () => { clearInterval(timer); if (!reduced() && onScreen) timer = window.setInterval(() => { if (ul.offsetParent) go(i + 1); }, 5000); };
    // Start as soon as any part is visible; only (re)start the timer when visibility actually changes.
    const vio = new IntersectionObserver(([e]) => { if (e.isIntersecting === onScreen) return; onScreen = e.isIntersecting; restart(); }, { threshold: 0 });
    // Watch the clipping container, not the track: once the track slides, it is clipped out of its own box.
    vio.observe(ul.parentElement as HTMLElement); offs.push(() => vio.disconnect());
    // Controls: the visible pair for this breakpoint.
    const btns = [...scope.querySelectorAll<HTMLButtonElement>("[data-framer-name^='CarouselControls'] button")];
    btns.forEach((b) => {
      b.disabled = false; b.style.opacity = "1"; b.style.cursor = "pointer";
      const img = b.querySelector("img"); if (img) img.style.opacity = "1";
      const prev = b.getAttribute("aria-label") === "Previous";
      const click = () => { go(i + (prev ? -1 : 1)); restart(); };
      // Hover: rgb(242,242,242) → rgb(184,184,184) (measured on the live site); no scale on press.
      const enter = () => { b.style.backgroundColor = "rgb(184, 184, 184)"; }; const leave = () => { b.style.backgroundColor = ""; };
      b.addEventListener("click", click); b.addEventListener("pointerenter", enter); b.addEventListener("pointerleave", leave);
      offs.push(() => { b.removeEventListener("click", click); b.removeEventListener("pointerenter", enter); b.removeEventListener("pointerleave", leave); });
    });
    // Drag / swipe.
    let x0 = 0, dragging = false;
    const pd = (e: PointerEvent) => { dragging = true; x0 = e.clientX; };
    const pu = (e: PointerEvent) => { if (!dragging) return; dragging = false; const dx = e.clientX - x0; if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); restart(); } };
    ul.addEventListener("pointerdown", pd); window.addEventListener("pointerup", pu);
    const onResize = () => go(i); window.addEventListener("resize", onResize);
    restart();
    offs.push(() => { clearInterval(timer); ul.removeEventListener("pointerdown", pd); window.removeEventListener("pointerup", pu); window.removeEventListener("resize", onResize); });
  });
  return () => offs.forEach((f) => f());
}

export function initInteractions(main: HTMLElement) {
  const off = [menu(main), tickers(main), counters(main), blocks(main), shutter(main), sectors(main), testimonials(main)];
  return () => off.forEach((f) => f());
}
