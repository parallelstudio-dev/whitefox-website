# Side-by-side sheet + difference score: python3 qa/pair.py <width> <route> out.jpg
import sys
from PIL import Image, ImageChops, ImageStat
w, r, out = sys.argv[1], sys.argv[2], sys.argv[3]
n = r.replace("/", "_") or "_"
a = Image.open(f"qa/shots/{w}/{n}-live.png").convert("RGB"); b = Image.open(f"qa/shots/{w}/{n}-local.png").convert("RGB")
h = max(a.height, b.height); W = 420
sa = a.resize((W, int(a.height * W / a.width))); sb = b.resize((W, int(b.height * W / b.width)))
S = Image.new("RGB", (W * 2 + 10, max(sa.height, sb.height)), "red"); S.paste(sa, (0, 0)); S.paste(sb, (W + 10, 0)); S.save(out, quality=70)
c = min(a.height, b.height); d = ImageChops.difference(a.crop((0, 0, a.width, c)), b.crop((0, 0, b.width, c)))
print(n, "live", a.size, "local", b.size, "mean diff", round(sum(ImageStat.Stat(d).mean) / 3, 2))
