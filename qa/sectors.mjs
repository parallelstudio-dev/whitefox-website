// Reads the sector panel (image, title, text, buttons) for each sector on the live home page, by hovering each row.
import { chromium } from "playwright";
import fs from "node:fs";
const D = "/tmp/claude-0/-home-user/98759fbc-c32a-5fb8-ae01-39512d40bd8e/scratchpad/";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("https://whitefoxrecruitment.com.au/", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
const names = ["Accounting & Finance","Administration & Business Support","Tourism","Hospitality","Construction","Agriculture","Mining","IT & Technology","Legal"];
const visLeaf = (n) => p.evaluateHandle((n) => {
  const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.opacity === "0" || cs.display === "none" || cs.visibility === "hidden") return false; } return true; };
  return [...document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,span,div")].find((e) => e.children.length === 0 && e.textContent.trim() === n && vis(e) && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().left < 500);
}, n);
// Scroll with the wheel, like a visitor: Framer only arms the component once it has scrolled into view.
const y = await p.evaluate(() => { const e = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Accounting & Finance" && e.offsetParent); return Math.round(e.getBoundingClientRect().top + scrollY); });
for (let s = 0; s < Math.ceil((y - 350) / 120); s++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); }
await p.waitForTimeout(1500);
const out = [];
for (const n of names) {
  const h = (await visLeaf(n)).asElement(); await h.hover(); await p.waitForTimeout(1100);
  const info = await p.evaluate(() => {
    const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (+cs.opacity < 0.5 || cs.display === "none" || cs.visibility === "hidden") return false; } return true; };
    const imgs = [...document.querySelectorAll("img")].filter((i) => { const r = i.getBoundingClientRect(); return r.left > 500 && r.width > 300 && r.top > -200 && r.top < 900 && vis(i); });
    const img = imgs[0]; const r = img.getBoundingClientRect();
    const near = (sel, dy) => [...document.querySelectorAll(sel)].filter((t) => { const q = t.getBoundingClientRect(); return Math.abs(q.left - r.left) < 6 && q.top >= r.bottom - 4 && q.top < r.bottom + dy && vis(t) && t.textContent.trim(); });
    const heads = near("h1,h2,h3,h4,h5,h6,p", 140).map((t) => t.textContent.trim());
    const btns = [...document.querySelectorAll("a")].filter((a) => { const q = a.getBoundingClientRect(); return q.left >= r.left - 4 && q.left < r.left + 300 && q.top > r.bottom && q.top < r.bottom + 220 && vis(a); }).map((a) => [a.textContent.trim(), a.getAttribute("href")]);
    return { n: imgs.length, src: img.getAttribute("src"), srcset: img.getAttribute("srcset"), sizes: img.getAttribute("sizes"), heads, btns };
  });
  await p.screenshot({ path: `${D}sector-${n.replace(/\W+/g, "_")}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  out.push({ name: n, ...info });
  console.log(n, "|", info.n, "|", (info.src || "").split("/").pop().slice(0, 30), "|", info.heads.slice(0, 2).map((x) => x.slice(0, 50)).join(" // "), "|", JSON.stringify(info.btns));
}
fs.writeFileSync("qa/sectors-live.json", JSON.stringify(out, null, 1));
await b.close();
