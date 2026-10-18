# python3 qa/vpsheet.py <width> <route> out.jpg — live (left) vs local (right), one row per scroll position, with diff score
import sys, glob
from PIL import Image, ImageChops, ImageStat, ImageDraw
w, r, out = sys.argv[1:4]; n = r.replace("/", "_") or "_"
lives = sorted(glob.glob(f"qa/shots/vp-{w}/{n}-*-live.png")); rows = []
for lv in lives:
    lc = lv.replace("-live.png", "-local.png"); a = Image.open(lv).convert("RGB"); b = Image.open(lc).convert("RGB")
    d = round(sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3, 2)
    s = 560 / a.width; a = a.resize((560, int(a.height * s))); b = b.resize((560, int(b.height * s)))
    row = Image.new("RGB", (1130, a.height + 18), "white"); row.paste(a, (0, 18)); row.paste(b, (570, 18))
    ImageDraw.Draw(row).text((4, 2), f"{lv.split('/')[-1]}  diff {d}", fill="black"); rows.append(row); print(lv.split('/')[-1], d)
S = Image.new("RGB", (1130, sum(x.height for x in rows)), "white"); y = 0
for x in rows: S.paste(x, (0, y)); y += x.height
S.save(out, quality=72)
