import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("https://whitefoxrecruitment.com.au/about-us", { waitUntil: "networkidle" }); await p.waitForTimeout(3000);
// mark candidates: elements whose SSR inline style starts hidden, below the fold
const info = await p.evaluate(() => {
  const els = [...document.querySelectorAll('#main [style*="opacity"]')].filter(e => { const r = e.getBoundingClientRect(); return r.top > window.innerHeight + 200; });
  return els.slice(0, 400).map((e, i) => { e.dataset.probe = i; return { i, tag: e.tagName, style: e.getAttribute("style").slice(0, 160), top: Math.round(e.getBoundingClientRect().top + scrollY), text: (e.textContent||"").trim().slice(0, 30) }; });
});
const pick = info.filter(x => /opacity:\s*0\.001/.test(x.style)).slice(0, 3).concat(info.filter(x => /opacity:\s*0\.001/.test(x.style) && x.tag !== "SPAN").slice(0, 3));
console.log(JSON.stringify(pick, null, 0));
for (const t of pick) {
  await p.evaluate((y) => scrollTo(0, y - 600), t.top);
  const samples = await p.evaluate(async (i) => { const e = document.querySelector(`[data-probe="${i}"]`); const out = []; const t0 = performance.now();
    while (performance.now() - t0 < 2200) { const cs = getComputedStyle(e); out.push([Math.round(performance.now() - t0), +(+cs.opacity).toFixed(3), cs.transform, cs.filter]); await new Promise(r => requestAnimationFrame(r)); } return out; }, t.i);
  const s = samples.filter((_, k) => k % 6 === 0).map(x => `${x[0]}:${x[1]}:${x[2].replace(/matrix\(1, 0, 0, 1, /, "m(").slice(0, 20)}${x[3] !== "none" ? ":" + x[3] : ""}`);
  console.log(t.i, t.tag, t.text, "\n  ", s.join("  "));
}
await b.close();
