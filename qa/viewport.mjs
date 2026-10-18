// Viewport screenshots of live vs local at the same scroll positions (what a visitor actually sees).
// node qa/viewport.mjs <width> <route> <y1,y2,...>
import { chromium } from "playwright";
import fs from "node:fs";
const [w, route, ys] = process.argv.slice(2); const W = +w, H = W < 810 ? 844 : 900;
const out = `qa/shots/vp-${W}`; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [name, base] of [["live", "https://whitefoxrecruitment.com.au"], ["local", process.env.LOCAL || "http://localhost:3300"]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 810, hasTouch: W < 810 }); const p = await ctx.newPage();
  await p.goto(base + route, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(3500);
  let i = 0;
  for (const y of ys.split(",").map(Number)) {
    const cur = await p.evaluate(() => scrollY);
    const steps = Math.max(1, Math.round(Math.abs(y - cur) / 120));
    for (let s = 0; s < steps; s++) { await p.mouse.wheel(0, (y - cur) / steps); await p.waitForTimeout(40); }
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${out}/${(route.replace(/\//g, "_") || "_")}-${String(i++).padStart(2, "0")}-${name}.png` });
  }
  await ctx.close();
}
await b.close();
