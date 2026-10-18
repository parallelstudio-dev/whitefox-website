// Captures the open state of the header menu on the live site (Framer renders it only on click, so it is
// not in the server HTML). Output: .cache/open-navs.json, read by menu.py. Run: node scripts/migrate/capture-menu.mjs
import { chromium } from "playwright";
import fs from "fs";
const D = new URL("../../.cache/", import.meta.url).pathname;
const jobs = [["about-us", 1440], ["about-us", 390], ["", 390], ["insight/whitefox-recruitment-enters-third-year-of-exclusive-partnership-with-jewel-gold-coast", 1440], ["insight/whitefox-recruitment-enters-third-year-of-exclusive-partnership-with-jewel-gold-coast", 390], ["", 1440]];
const b = await chromium.launch(); const out = {};
for (const [page, W] of jobs) {
  const p = await b.newPage({ viewport: { width: W, height: W < 810 ? 844 : 900 } });
  await p.goto("https://whitefoxrecruitment.com.au/" + page, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  const nav = () => p.evaluate(() => { const n = [...document.querySelectorAll("nav")].find((e) => e.getBoundingClientRect().width > 0); return { name: n.dataset.framerName, cls: n.className, html: n.outerHTML }; });
  const c = await nav();
  const t = await p.evaluate(() => { const e = [...document.querySelectorAll('nav [data-framer-name="Icon"]')].find((e) => e.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(t.x, t.y); await p.mouse.move(W / 2, 830); await p.waitForTimeout(1800);
  const o = await nav();
  // SVG symbols the open menu references but the server HTML doesn't define (e.g. the close icon).
  o.symbols = await p.evaluate(() => [...new Set([...document.querySelectorAll("nav use")].map((u) => u.getAttribute("href")))].map((h) => { const el = document.querySelector(h); return el ? (el.closest("svg") ?? el).outerHTML : null; }).filter(Boolean));
 
  out[c.name] = { closedCls: c.cls, openName: o.name, openCls: o.cls, html: o.html, symbols: o.symbols };
  console.log(page || "home", W, c.name, "->", o.name, o.html.length);
  await p.close();
}
fs.writeFileSync(D + "open-navs.json", JSON.stringify(out, null, 1));
await b.close();
