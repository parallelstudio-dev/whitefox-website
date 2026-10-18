// Framer's own animation settings for this site (content/effects.json, extracted from the page bundles by
// scripts/migrate/effects.mjs), replayed with the same rules as Framer's runtime:
//  - text effects: tokens start at startDelay + i × transition.delay ("word"), or line by line ("line");
//    "onInView" fires on the first visible pixel, "onMount" at load;
//  - scroll-in: in view when the visible height / min(element height, viewport height) reaches the threshold;
//    animateOnce=false plays back out when it leaves;
//  - scroll direction (header): after 4px in the configured direction, animate to the target; back otherwise;
//  - scroll variants (nav "Fill"): the variant applies from the moment the target section's top passes
//    1px above the top of the viewport (threshold × viewport earlier), and stays below it.
import EFFECTS from "@/content/effects.json";
import { play, reduced, springEasing, timing, type Pose, type Transition } from "./motion";

type TextEffect = { effect: Pose; startDelay?: number; tokenization?: string; transition?: Transition; trigger?: string; threshold?: number };
type Fx = {
  effect?: TextEffect;
  __framer__enter?: Pose;
  __framer__animate?: { transition?: Transition };
  __framer__threshold?: number;
  __framer__animateOnce?: boolean;
  __framer__scrollDirection?: { direction: "up" | "down"; target: Pose };
  variants?: { targets: { className: string | null; target: string }[]; threshold: number };
};

// Nav variant ids (from the nav component) → the variant they stand for.
const NAV_VARIANTS: Record<string, { name: string; cls: string }> = {
  APJCJ_NPz: { name: "Desktop Transparent", cls: "framer-v-r7ayt3" },
  jwcoYgIRS: { name: "Desktop Fill", cls: "framer-v-1e1p94" },
  Z9yguGZHO: { name: "Phone Transparent", cls: "framer-v-1tpiifq" },
  hqMPZa9qZ: { name: "Phone Fill", cls: "framer-v-wcbnin" },
};
const FILL_BG = "var(--token-10f50a16-d346-4a7c-b255-d3a09ddf0da9, rgb(10, 10, 10))";
const SCROLL_DELTA = 4; // Framer's minimum scroll in one direction before a scroll-direction effect reacts.
const STEPS = Array.from({ length: 100 }, (_, i) => i / 100);

const WORD = "span[style*='inline-block']";
const identity: Pose = { opacity: 1 };

/** Marks elements whose animation is handled here, so the generic fallbacks leave them alone. */
export const HANDLED = "data-fx";

export function initEffects(main: HTMLElement) {
  const offs: (() => void)[] = [];
  const fxs = EFFECTS as unknown as Record<string, Fx>;
  const still = reduced();

  for (const [cls, fx] of Object.entries(fxs)) {
    const els = [...main.querySelectorAll<HTMLElement>("." + cls)];
    if (!els.length) continue;

    if (fx.effect) els.forEach((el) => offs.push(textEffect(el, fx.effect!, still)));
    if (fx.__framer__enter) els.forEach((el) => offs.push(scrollIn(el, fx, still)));
    if (fx.__framer__scrollDirection) els.forEach((el) => offs.push(scrollDirection(el, fx.__framer__scrollDirection!, fx.__framer__animate?.transition, still)));
    if (fx.variants) els.forEach((el) => offs.push(scrollVariants(el, fx.variants!)));
  }
  return () => offs.forEach((f) => f());
}

function textEffect(el: HTMLElement, fx: TextEffect, still: boolean) {
  const tokens = [...el.querySelectorAll<HTMLElement>(WORD)];
  if (!tokens.length) return () => {};
  el.setAttribute(HANDLED, "");
  tokens.forEach((t) => t.setAttribute(HANDLED, ""));
  if (still) { tokens.forEach((t) => { t.style.opacity = "1"; t.style.filter = "none"; t.style.transform = "none"; }); return () => {}; }
  const start = (fx.startDelay ?? 0) * 1000, step = (fx.transition?.delay ?? 0) * 1000;
  const tr = { ...fx.transition, delay: 0 } as Transition;
  const run = () => {
    if (fx.tokenization === "line") {
      // Tokens grouped into lines by their offsetTop, as Framer does.
      const lines: HTMLElement[][] = []; let top: number | null = null;
      tokens.forEach((t) => { if (top === null || t.offsetTop !== top) lines.push([]); lines[lines.length - 1].push(t); top = t.offsetTop; });
      lines.forEach((line, i) => line.forEach((t) => play(t, identity, tr, start + i * step)));
    } else tokens.forEach((t, i) => play(t, identity, tr, start + i * step));
  };
  if (fx.trigger === "onMount") { run(); return () => {}; }
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); run(); } }, { threshold: fx.threshold ?? 0 });
  io.observe(el);
  return () => io.disconnect();
}

function scrollIn(el: HTMLElement, fx: Fx, still: boolean) {
  el.setAttribute(HANDLED, "");
  const enter = fx.__framer__enter!, tr = fx.__framer__animate?.transition, threshold = fx.__framer__threshold ?? 0, once = fx.__framer__animateOnce ?? true;
  if (still) { el.style.opacity = "1"; el.style.transform = "none"; return () => {}; }
  let inView = false;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const b = e.boundingClientRect;
    const now = b.height === 0 ? e.isIntersecting : e.isIntersecting && e.intersectionRect.height / Math.min(b.height, window.innerHeight) >= threshold;
    if (now && !inView) { inView = true; play(el, identity, tr); if (once) io.disconnect(); }
    else if (!now && inView) { inView = false; play(el, enter, tr); }
  }), { threshold: STEPS });
  io.observe(el);
  return () => io.disconnect();
}

function scrollDirection(el: HTMLElement, cfg: { direction: "up" | "down"; target: Pose }, tr: Transition | undefined, still: boolean) {
  el.setAttribute(HANDLED, "");
  const base = el.style.transform || "translateX(-50%)";
  let last: number | undefined, dir: string | undefined, anchor = 0, current: Pose | undefined;
  const t = timing(tr);
  const go = (to: Pose | undefined) => {
    const p = to ?? identity;
    const a = el.animate(
      [{ transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity },
       { transform: `${base} translateY(${p.y ?? 0}px)`, opacity: String(p.opacity ?? 1) }],
      { duration: t.duration, easing: t.easing, fill: "forwards" });
    if (still) a.finish();
  };
  const on = () => {
    const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
    if (y > max || y < 0) return;
    const d = last !== undefined && y < last ? "up" : "down";
    last = y;
    if (d !== dir) { dir = d; anchor = y; return; }
    if (Math.abs(y - anchor) < SCROLL_DELTA) return;
    const next = d === cfg.direction ? cfg.target : undefined;
    if (next !== current) { current = next; go(next); }
  };
  on(); // Framer reads the position once on load, so the first scroll already counts from there.
  window.addEventListener("scroll", on, { passive: true });
  return () => window.removeEventListener("scroll", on);
}

function scrollVariants(container: HTMLElement, cfg: { targets: { className: string | null; target: string }[]; threshold: number }) {
  const nav = () => container.querySelector<HTMLElement>("nav");
  const first = nav();
  if (!first) return () => {};
  const family = (first.dataset.framerName || "").startsWith("Phone") ? "Phone" : "Desktop";
  const base = Object.values(NAV_VARIANTS).find((v) => v.name === first.dataset.framerName);
  const t = cfg.targets.find((x) => NAV_VARIANTS[x.target]?.name.startsWith(family));
  const section = t?.className ? document.querySelector<HTMLElement>("." + t.className) : null;
  if (!base || !t || !section) return () => {};
  const fill = NAV_VARIANTS[t.target];
  const baseBg = first.style.backgroundColor;
  let active = false;
  const offsetTop = (el: HTMLElement) => { let n = 0, e: HTMLElement | null = el; while (e) { n += e.offsetTop; e = e.offsetParent as HTMLElement | null; } return n; };
  const apply = (on: boolean) => {
    const n = nav();
    if (!n || n.dataset.framerName?.endsWith(" Open")) return; // the open menu keeps its own variant
    const v = on ? fill : base;
    n.classList.remove(base.cls, fill.cls); n.classList.add(v.cls);
    n.dataset.framerName = v.name;
    const s = springEasing(400, 40, 1); // the nav component's transition
    const from = getComputedStyle(n).backgroundColor;
    n.style.backgroundColor = on ? FILL_BG : baseBg;
    n.animate([{ backgroundColor: from }, { backgroundColor: getComputedStyle(n).backgroundColor }], { duration: s.duration, easing: s.easing });
  };
  const on = () => {
    const start = Math.max(offsetTop(section) - 1 - cfg.threshold * window.innerHeight, 0);
    const now = window.scrollY >= start;
    if (now !== active) { active = now; apply(now); }
  };
  on();
  window.addEventListener("scroll", on, { passive: true });
  window.addEventListener("resize", on);
  return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
}
