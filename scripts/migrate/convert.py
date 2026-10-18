#!/usr/bin/env python3
"""Framer → Next.js migration for whitefoxrecruitment.com.au.

Reads the server-rendered HTML of every URL in sitemap.txt (fetched into .cache/html/) and writes, per page:
  content/pages/<route>/body.html   the page markup (Framer's rendered DOM, without Framer's runtime)
  content/pages/<route>/page.css    the page's CSS (fonts, breakpoints, components), with local asset URLs
  content/pages/<route>/meta.json   title, description, social tags, canonical, appear-animation data
All media (images in every size, videos, fonts) is downloaded once into public/assets/ and every URL is rewritten.
Nothing from Framer's JavaScript is kept; behaviour is reimplemented in components/runtime/.
Usage: python3 scripts/migrate/convert.py [--refetch]
"""
import hashlib, html as htmllib, json, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, ".cache", "html")
SITE = "https://whitefoxrecruitment.com.au"
ASSET_RE = re.compile(r"https://(?:framerusercontent\.com|fonts\.gstatic\.com)/[^\s\"'()<>,]+")
os.makedirs(CACHE, exist_ok=True)

def route_of(url):
    p = urllib.parse.unquote(url[len(SITE):]).strip("/")
    return p or "index"

def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (migration; Parallel Studio)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)

# ---------- assets ----------
assets = {}  # remote url -> local path
def local_name(u):
    parsed = urllib.parse.urlparse(u)
    base = os.path.basename(parsed.path) or "file"
    stem, ext = os.path.splitext(base)
    if parsed.query:
        stem += "-" + hashlib.sha1(parsed.query.encode()).hexdigest()[:8]
    if not ext and "fonts.gstatic.com" in u:
        ext = ".woff2"
    sub = "fonts" if ("fonts.gstatic.com" in u or ext in (".woff", ".woff2", ".ttf", ".otf")) else ("media" if ext in (".mp4", ".webm", ".mov") else "img")
    return f"/assets/{sub}/{stem}{ext}"

def norm(raw):
    return htmllib.unescape(raw.rstrip("\\;"))

def collect(text):
    for m in ASSET_RE.finditer(text):
        u = norm(m.group(0))
        if "/sites/" in u and (u.endswith(".mjs") or u.endswith(".json")):
            continue  # Framer runtime bundles and search index are not migrated
        assets.setdefault(u, local_name(u))

def rewrite(text):
    def sub(m):
        raw = m.group(0).rstrip("\\;"); tail = m.group(0)[len(raw):]
        return assets.get(norm(raw), raw) + tail
    return ASSET_RE.sub(sub, text)

def download_all():
    todo = [(u, os.path.join(ROOT, "public", p.lstrip("/"))) for u, p in assets.items() if not os.path.exists(os.path.join(ROOT, "public", p.lstrip("/")))]
    def go(a):
        try: fetch(*a)
        except Exception as e: print("  ! asset failed", a[0], e)
    with ThreadPoolExecutor(12) as ex:
        list(ex.map(go, todo))
    print(f"assets: {len(assets)} referenced, {len(todo)} downloaded")

# ---------- pages ----------
KEEP_META = ("description", "og:", "twitter:", "robots")
def convert(url):
    route = route_of(url)
    src = os.path.join(CACHE, route.replace("/", "__") + ".html")
    if "--refetch" in sys.argv or not os.path.exists(src):
        fetch(url, src)
    html = open(src, encoding="utf-8").read()
    soup = BeautifulSoup(html, "lxml")
    head, body = soup.head, soup.body

    meta = {"route": "/" if route == "index" else "/" + route, "title": head.title.string if head.title else "", "tags": [], "icons": []}
    for m in head.find_all("meta"):
        key = m.get("name") or m.get("property") or ""
        if key.startswith(KEEP_META) or key in KEEP_META:
            meta["tags"].append({k: v for k, v in m.attrs.items()})
    canon = head.find("link", rel="canonical")
    meta["canonical"] = canon["href"] if canon else SITE + meta["route"]
    for l in head.find_all("link", rel=lambda r: r and ("icon" in r or "apple-touch-icon" in r)):
        meta["icons"].append({"rel": " ".join(l["rel"]), "href": l["href"], "media": l.get("media")})
    for sid in ("__framer__appearAnimationsContent", "__framer__breakpoints"):
        s = soup.find("script", id=sid)
        meta["appear" if "Content" in sid else "breakpoints"] = json.loads(s.string) if s and s.string else ({} if "Content" in sid else [])

    css = "\n".join(st.decode_contents() for st in head.find_all("style"))

    main = body.find(id="main")
    for s in main.find_all(["script", "noscript"]):
        s.decompose()
    templates = body.find(id="svg-templates")
    markup = main.decode_contents()
    if templates:
        markup = str(templates) + markup
    # Internal links: Framer writes "./about-us"; make them root-relative.
    markup = re.sub(r'href="\./([^"]*)"', lambda m: f'href="/{m.group(1)}"'.replace('href="/"', 'href="/"'), markup)
    markup = markup.replace('href="./"', 'href="/"')
    markup = markup.replace(SITE + "/", "/").replace('href="' + SITE + '"', 'href="/"')

    collect(css); collect(markup); collect(json.dumps(meta))
    return route, meta, css, markup

def main():
    urls = [u.strip() for u in open(os.path.join(os.path.dirname(__file__), "sitemap.txt")) if u.strip()]
    pages = [convert(u) for u in urls]
    download_all()
    for route, meta, css, markup in pages:
        d = os.path.join(ROOT, "content", "pages", route)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "body.html"), "w", encoding="utf-8").write(rewrite(markup))
        open(os.path.join(d, "page.css"), "w", encoding="utf-8").write(rewrite(css))
        json.dump(json.loads(rewrite(json.dumps(meta))), open(os.path.join(d, "meta.json"), "w"), indent=1, ensure_ascii=False)
    print(f"pages: {len(pages)}")

if __name__ == "__main__":
    main()
