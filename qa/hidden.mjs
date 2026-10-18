import { chromium } from "playwright";
const [url = "http://localhost:3300/", w = "1440"] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: 900 } });
p.on("pageerror", (e) => console.log("ERR", String(e)));
await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
const H = await p.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 400) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(150); }
await p.waitForTimeout(2500);
const r = await p.evaluate(() => [...document.querySelectorAll("#main *")].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return +cs.opacity < 0.05 && b.width > 0 && b.height > 0 && e.offsetParent !== null; })
  .map((e) => ({ tag: e.tagName, name: e.getAttribute("data-framer-name"), style: (e.getAttribute("style") || "").slice(0, 90), text: (e.textContent || "").trim().slice(0, 40), top: Math.round(e.getBoundingClientRect().top + scrollY) })));
console.log(r.length); console.log(r.slice(0, 25).map((x) => JSON.stringify(x)).join("\n"));
await b.close();
