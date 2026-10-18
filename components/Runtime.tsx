"use client";
import { useEffect } from "react";
import { play, reduced, type Pose, type Transition } from "./runtime/motion";
import { initInteractions } from "./runtime/interactions";

type Appear = Record<string, Record<string, { initial: Pose; animate: Pose }>>;
type Breakpoint = { hash: string; mediaQuery: string };

const HIDDEN = /opacity:\s*0\.001/;

/**
 * Brings the migrated Framer markup to life, without Framer's runtime:
 *  1. appear effects (data-framer-appear-id) play on load with the exact keyframes and springs Framer exported;
 *  2. scroll-in effects (elements rendered with Framer's hidden initial state) play once as they enter the viewport,
 *     words of animated headings one after another;
 *  3. interactive components (menu, ticker, counters, sliders, video, accordions, forms) are wired in interactions.ts.
 */
export default function Runtime({ appear, breakpoints }: { appear: Record<string, unknown>; breakpoints: Breakpoint[] }) {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const cleanups: (() => void)[] = [];

    if (reduced()) {
      main.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
        if (HIDDEN.test(el.getAttribute("style") || "")) { el.style.opacity = "1"; el.style.transform = "none"; el.style.filter = "none"; }
      });
    } else {
      // 1. Appear effects, per active breakpoint.
      const bp = breakpoints.find((b) => window.matchMedia(b.mediaQuery).matches)?.hash;
      const appearMap = appear as Appear;
      const appearing = new Set<HTMLElement>();
      main.querySelectorAll<HTMLElement>("[data-framer-appear-id]").forEach((el) => {
        const def = appearMap[el.dataset.framerAppearId!];
        if (!def) return;
        const v = (bp && def[bp]) || def.default;
        if (!v) return;
        appearing.add(el);
        play(el, v.animate, v.animate.transition as Transition);
      });

      // 2. Scroll-in effects.
      const pending = [...main.querySelectorAll<HTMLElement>("[style]")].filter((el) => !appearing.has(el) && HIDDEN.test(el.getAttribute("style") || ""));
      const io = new IntersectionObserver((entries) => {
        const now = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        // Words of one heading animate in sequence; blocks animate together.
        const groups = new Map<Element, HTMLElement[]>();
        now.forEach((el) => {
          io.unobserve(el);
          const word = el.tagName === "SPAN" && el.style.display === "inline-block";
          const key = word ? el.closest("p, h1, h2, h3, h4, h5, h6, [data-framer-component-type]") ?? el : el;
          groups.set(key, [...(groups.get(key) ?? []), el]);
        });
        groups.forEach((els, key) => {
          const words = key !== els[0] || els.length > 1;
          const all = words ? [...key.querySelectorAll<HTMLElement>("span[style*='inline-block']")] : els;
          els.forEach((el) => {
            const i = Math.max(0, all.indexOf(el));
            play(el, { opacity: 1 }, words ? { type: "spring", stiffness: 160, damping: 24, mass: 1 } : { type: "spring", stiffness: 125, damping: 35, mass: 2 }, words ? i * 55 : 0);
          });
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
      pending.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    cleanups.push(initInteractions(main));
    return () => cleanups.forEach((c) => c());
  }, [appear, breakpoints]);
  return null;
}
