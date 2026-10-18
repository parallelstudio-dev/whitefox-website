"""Turns the captured open header menus (.cache/open-navs.json, from capture-menu.mjs) into content/menu.json.

Keyed by the closed nav variant ("Desktop Transparent", "Phone Fill", ...). Assets are made local with the same
naming as convert.py; Framer's leftover inline motion styles and hover state are removed."""
import json, os, re
from convert import ROOT, assets, collect, rewrite, download_all

navs = json.load(open(os.path.join(ROOT, ".cache", "open-navs.json")))
out = {}
for name, v in navs.items():
    html = v["html"]
    collect(html)
    html = rewrite(html)
    html = re.sub(r" ?transform: none; transform-origin: 50% 50% 0px;", "", html)
    html = re.sub(r" ?will-change: auto;", "", html)
    html = html.replace(' style=""', "")
    html = re.sub(r'(class="[^"]*?) hover"', r'\1"', html)
    html = re.sub(r'href="(?:\./|(?:\.\./)+)([^"]*)"', lambda m: f'href="/{m.group(1)}"', html)
    out[name] = {"open": v["openName"], "html": html, "symbols": v.get("symbols", [])}
download_all()
with open(os.path.join(ROOT, "content", "menu.json"), "w") as f:
    json.dump(out, f, indent=1)
print("menus:", ", ".join(f"{k} -> {v['open']}" for k, v in out.items()))
