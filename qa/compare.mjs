// Side-by-side: live Framer site vs this build, full-page screenshots at one width.
// node qa/compare.mjs <width> <route...>   (LIVE_JS=0 disables JavaScript on the live site)
import { chromium } from "playwright";
import fs from "node:fs";
const [w, ...routes] = process.argv.slice(2);
const W = Number(w), H = W < 810 ? 844 : 900;
const LIVE = "https://whitefoxrecruitment.com.au", LOCAL = process.env.LOCAL || "http://localhost:3300";
fs.mkdirSync(`qa/shots/${W}`, { recursive: true });
const b = await chromium.launch();
for (const [name, base, js] of [["live", LIVE, process.env.LIVE_JS !== "0"], ["local", LOCAL, process.env.LOCAL_JS !== "0"]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, javaScriptEnabled: js, isMobile: W < 810, hasTouch: W < 810 });
  const p = await ctx.newPage();
  for (const r of routes) {
    await p.goto(base + r, { waitUntil: "networkidle", timeout: 90000 }); await p.waitForTimeout(1500);
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1200);
    await p.screenshot({ path: `qa/shots/${W}/${(r.replace(/\//g, "_") || "_")}-${name}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
