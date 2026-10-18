// Motion primitives that reproduce Framer's animation behaviour with the Web Animations API.
// Springs are integrated numerically and expressed as a CSS linear() easing, so a spring with Framer's
// stiffness / damping / mass plays with the same curve and settle time as on the Framer site.

export type Spring = { type: "spring"; stiffness?: number; damping?: number; mass?: number; delay?: number; duration?: number; bounce?: number };
export type Tween = { type?: "tween"; duration?: number; delay?: number; ease?: number[] | string };
export type Transition = Spring | Tween;
export type Pose = { opacity?: number; x?: number; y?: number; scale?: number; rotate?: number; rotateX?: number; rotateY?: number; skewX?: number; skewY?: number; filter?: string; transition?: Transition };

const springCache = new Map<string, { easing: string; duration: number }>();

/** Integrates a damped spring from 0 to 1 and returns a linear() easing plus its settle time in ms. */
export function springEasing(stiffness = 100, damping = 10, mass = 1) {
  const key = `${stiffness}|${damping}|${mass}`;
  const hit = springCache.get(key); if (hit) return hit;
  const dt = 1 / 240; let x = 0, v = 0, t = 0; const pts: number[] = [];
  let settled = 0;
  while (t < 10) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt; x += v * dt; t += dt;
    pts.push(x);
    if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) { if (++settled > 12) break; } else settled = 0;
  }
  const duration = Math.round(t * 1000);
  const n = Math.min(60, pts.length); const out: string[] = [];
  for (let i = 0; i <= n; i++) { const idx = Math.min(pts.length - 1, Math.round((i / n) * (pts.length - 1))); out.push(pts[idx].toFixed(4)); }
  out[0] = "0"; out[out.length - 1] = "1";
  const res = { easing: `linear(${out.join(", ")})`, duration };
  springCache.set(key, res);
  return res;
}

const bezier = (e: number[] | string | undefined) =>
  Array.isArray(e) ? `cubic-bezier(${e.join(",")})` : e === "linear" ? "linear" : e === "easeIn" ? "cubic-bezier(.42,0,1,1)" : e === "easeInOut" ? "cubic-bezier(.42,0,.58,1)" : "cubic-bezier(0,0,.58,1)";

/** Framer's default transition when an effect doesn't set one. */
export const DEFAULT: Transition = { type: "spring", stiffness: 400, damping: 30, mass: 1 };

/**
 * Framer's duration-based spring ({ duration, bounce }): the stiffness and damping that settle in `duration`,
 * found the way Framer Motion's findSpring does (Newton's method on the spring envelope, 0.001 tolerance).
 */
export function findSpring(duration: number, bounce = 0.25, mass = 1) {
  const safeMin = 0.001;
  const ratio = Math.min(1, Math.max(0.05, 1 - bounce));
  const d = Math.min(10, Math.max(0.01, duration));
  let envelope: (w: number) => number, derivative: (w: number) => number;
  if (ratio < 1) {
    const angular = (w: number) => w * Math.sqrt(1 - ratio * ratio);
    envelope = (w) => safeMin - ((w * ratio) / angular(w)) * Math.exp(-w * ratio * d);
    derivative = (w) => {
      const delta = w * ratio * d, e = ratio * ratio * w * w * d, f = Math.exp(-delta), g = angular(w * w);
      const factor = -envelope(w) + safeMin > 0 ? -1 : 1;
      return (factor * (-e * f)) / g;
    };
  } else {
    envelope = (w) => -safeMin + Math.exp(-w * d) * (w * d + 1);
    derivative = (w) => Math.exp(-w * d) * (-w * d * d);
  }
  let w = 5 / d;
  for (let i = 0; i < 12; i++) w = w - envelope(w) / derivative(w);
  if (!Number.isFinite(w)) return { stiffness: 100, damping: 10 };
  const stiffness = w * w * mass;
  return { stiffness, damping: ratio * 2 * Math.sqrt(mass * stiffness) };
}

export function timing(tr: Transition | undefined) {
  const t = tr ?? DEFAULT;
  if (t.type === "spring") {
    const k = t.stiffness === undefined && t.duration !== undefined ? findSpring(t.duration, t.bounce ?? 0.25, t.mass ?? 1) : { stiffness: t.stiffness ?? 400, damping: t.damping ?? 30 };
    const s = springEasing(k.stiffness, k.damping, t.mass ?? 1);
    return { duration: s.duration, easing: s.easing, delay: (t.delay ?? 0) * 1000 };
  }
  return { duration: (t.duration ?? 0.3) * 1000, easing: bezier(t.ease), delay: (t.delay ?? 0) * 1000 };
}

export const transformOf = (p: Pose) =>
  `translateX(${p.x ?? 0}px) translateY(${p.y ?? 0}px) scale(${p.scale ?? 1}) rotate(${p.rotate ?? 0}deg) rotateX(${p.rotateX ?? 0}deg) rotateY(${p.rotateY ?? 0}deg) skewX(${p.skewX ?? 0}deg) skewY(${p.skewY ?? 0}deg)`;

/** Plays from the element's current inline state to `to`, then leaves the final state inline (as Framer does). */
export function play(el: HTMLElement, to: Pose, tr: Transition | undefined, extraDelay = 0) {
  const from = getComputedStyle(el);
  const t = timing(tr);
  const target: Keyframe = { opacity: String(to.opacity ?? 1), transform: transformOf(to) };
  if (from.filter && from.filter !== "none") target.filter = to.filter ?? "blur(0px)";
  const anim = el.animate([{ opacity: from.opacity, transform: from.transform === "none" ? "none" : from.transform, filter: from.filter }, target],
    { duration: t.duration, easing: t.easing, delay: t.delay + extraDelay, fill: "both" });
  anim.finished.then(() => {
    el.style.opacity = String(to.opacity ?? 1);
    el.style.transform = to === undefined ? "none" : transformOf(to);
    if (target.filter) el.style.filter = String(target.filter);
    try { anim.cancel(); } catch { /* already gone */ }
  }).catch(() => {});
  return anim;
}

export const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
