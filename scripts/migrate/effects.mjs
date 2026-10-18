// Extracts the animation settings Framer keeps in its page bundles (they are not in the server HTML):
//  - scroll-in effects   (__framer__enter / __framer__animate / __framer__threshold / __framer__animateOnce)
//  - scroll-direction    (__framer__scrollDirection, the header hiding on scroll down)
//  - scroll variants     (__framer__targets: the nav switching to "Fill" when a section reaches the top)
//  - text effects        (effect: { tokenization, trigger, startDelay, transition, effect })
// keyed by the element's Framer class, so the runtime can find them in the migrated markup.
//
// The bundles are read as TEXT and parsed with a small literal parser; nothing from them is executed.
// Input: .cache/html/*.html (pages) and .cache/js/*.mjs (their modules, downloaded by this script).
// Output: content/effects.json. Run: node scripts/migrate/effects.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const HTML = path.join(ROOT, ".cache/html"), JS = path.join(ROOT, ".cache/js");
const RUNTIME = /\/(framer|react|motion|rolldown-runtime|script_main|index\.es)\.[^/]*\.mjs$/;

// ---------- download page modules ----------
const mods = new Set();
for (const f of fs.readdirSync(HTML)) for (const m of fs.readFileSync(path.join(HTML, f), "utf8").matchAll(/https:\/\/framerusercontent\.com\/sites\/[^"']+?\.mjs/g)) if (!RUNTIME.test(m[0])) mods.add(m[0]);
fs.mkdirSync(JS, { recursive: true });
await Promise.all([...mods].map(async (u) => {
  const dest = path.join(JS, u.split("/").pop());
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, Buffer.from(await (await fetch(u)).arrayBuffer()));
}));

// ---------- a tiny lexer: object spans, skipping strings / template literals / regexes we can't confuse ----------
function objectSpans(src) {
  const spans = new Map(); const stack = []; let i = 0;
  const skipString = (q) => { i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } };
  const skipTemplate = () => {
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") { i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") { i += 2; let d = 1; while (i < src.length && d) { if (src[i] === "`") { skipTemplate(); i++; continue; } if (src[i] === "'" || src[i] === '"') { skipString(src[i]); i++; continue; } if (src[i] === "{") d++; else if (src[i] === "}") d--; i++; } continue; }
      i++;
    }
  };
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "`") skipTemplate();
    else if (c === "'" || c === '"') skipString(c);
    else if (c === "{") stack.push(i);
    else if (c === "}") { const s = stack.pop(); if (s !== undefined) spans.set(s, i); }
  }
  return spans;
}

// ---------- literal parser (objects, arrays, numbers, strings, booleans; identifiers resolved by name) ----------
function parser(src, spans, defs) {
  const parse = (s, depth = 0) => {
    let i = 0;
    const ws = () => { while (/\s/.test(s[i])) i++; };
    const value = () => {
      ws();
      if (s[i] === "{") return obj();
      if (s[i] === "[") return arr();
      if (s[i] === "`") { const j = s.indexOf("`", i + 1); const v = s.slice(i + 1, j); i = j + 1; return v.includes("${") ? undefined : v; }
      if (s[i] === '"' || s[i] === "'") { const q = s[i]; let j = i + 1; while (s[j] !== q) { if (s[j] === "\\") j++; j++; } const v = JSON.parse('"' + s.slice(i + 1, j).replace(/\\'/g, "'") + '"'); i = j + 1; return v; }
      let m;
      if ((m = /^!0|^!1/.exec(s.slice(i)))) { i += 2; return m[0] === "!0"; }
      if ((m = /^void 0/.exec(s.slice(i)))) { i += 6; return undefined; }
      if ((m = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?/.exec(s.slice(i)))) { i += m[0].length; return Number(m[0]); }
      if ((m = /^(true|false|null)\b/.exec(s.slice(i)))) { i += m[0].length; return JSON.parse(m[0]); }
      if ((m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i)))) {
        i += m[0].length;
        // Anything more than a bare identifier (a call, member access, expression) is not a literal.
        ws(); if (s[i] && !",}]".includes(s[i])) { skipExpr(); return undefined; }
        return depth < 6 && defs.has(m[0]) ? parse(defs.get(m[0]), depth + 1) : undefined;
      }
      skipExpr(); return undefined;
    };
    const skipExpr = () => { let d = 0; while (i < s.length) { const c = s[i]; if ("([{".includes(c)) d++; else if (")]}".includes(c)) { if (!d) return; d--; } else if (c === "," && !d) return; else if (c === "`") { i = s.indexOf("`", i + 1); } i++; } };
    const key = () => { ws(); let m; if ((m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i)))) { i += m[0].length; return m[0]; } if (s[i] === '"' || s[i] === "`") { const q = s[i]; const j = s.indexOf(q, i + 1); const k = s.slice(i + 1, j); i = j + 1; return k; } if ((m = /^\d+/.exec(s.slice(i)))) { i += m[0].length; return m[0]; } return null; };
    const obj = () => {
      i++; const o = {};
      for (;;) {
        ws(); if (s[i] === "}") { i++; return o; }
        if (s.startsWith("...", i)) { i += 3; skipExpr(); }
        else { const k = key(); ws(); if (k === null || s[i] !== ":") { skipExpr(); } else { i++; const v = value(); if (v !== undefined) o[k] = v; } }
        ws(); if (s[i] === ",") i++; else if (s[i] === "}") { i++; return o; } else return o;
      }
    };
    const arr = () => { i++; const a = []; for (;;) { ws(); if (s[i] === "]") { i++; return a; } a.push(value()); ws(); if (s[i] === ",") i++; else { if (s[i] === "]") i++; return a; } } };
    return value();
  };
  return parse;
}

// ---------- extraction ----------
const KEYS = ["__framer__enter", "__framer__exit", "__framer__animate", "__framer__threshold", "__framer__animateOnce", "__framer__scrollDirection", "__framer__targets", "__framer__styleAppearEffectEnabled", "__framer__variantAppearEffectEnabled", "effect"];
const out = {}; const conflicts = [];
for (const f of fs.readdirSync(JS).filter((f) => f.endsWith(".mjs") && !RUNTIME.test("/" + f))) {
  const src = fs.readFileSync(path.join(JS, f), "utf8");
  if (!src.includes("__framer__") && !src.includes("tokenization:")) continue;
  const spans = objectSpans(src);
  const defs = new Map();
  for (const m of src.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]{0,3})=\{/g)) { const s = m.index + m[0].length - 1; if (spans.has(s)) defs.set(m[1], src.slice(s, spans.get(s) + 1)); }
  const parse = parser(src, spans, defs);
  for (const [s, e] of spans) {
    const body = src.slice(s, e + 1);
    if (!KEYS.some((k) => body.includes(k + ":"))) continue;
    const o = parse(body);
    if (!o || !KEYS.some((k) => k in o)) continue;
    // The nav's scroll variants sit on a component instance without a class: key them by the enclosing container.
    if (typeof o.className !== "string" && o.__framer__targets) o.className = [...src.slice(Math.max(0, s - 3000), s).matchAll(/className:`(framer-[\w-]+-container)`/g)].pop()?.[1];
    if (typeof o.className !== "string") continue;
    // __framer__targets refer to section refs (variables); resolve each ref to the element that declares ref:<name>.
    if (o.__framer__targets) {
      const raw = /__framer__targets:\[([^\]]*)\]/.exec(body)?.[1] ?? "";
      o.__framer__targets = [...raw.matchAll(/\{ref:([\w$]+),target:`([^`]+)`\}/g)].map(([, ref, target]) => {
        const el = new RegExp(`\\{[^{}]*?className:\`([^\`]+)\`[^{}]*?ref:${ref.replace("$", "\\$")}[,}]`).exec(src) ?? new RegExp(`\\{[^{}]*?ref:${ref.replace("$", "\\$")},[^{}]*?className:\`([^\`]+)\``).exec(src);
        return { className: el?.[1] ?? null, target };
      });
    }
    let pick = Object.fromEntries(Object.entries(o).filter(([k]) => KEYS.includes(k)));
    // Scroll variants have their own threshold / once flags; keep them apart from the element's style effect.
    if (pick.__framer__targets) pick = { variants: { targets: pick.__framer__targets, threshold: pick.__framer__threshold ?? 0, once: pick.__framer__animateOnce ?? false } };
    const cls = o.className.split(" ")[0];
    // One element can carry several effects (the header: scroll direction + scroll variants); merge them.
    const prev = out[cls] ?? {};
    // Desktop and phone scroll variants of the same nav (phone ones come from a breakpoint override).
    if (pick.variants && prev.variants) { pick.variants.targets = [...prev.variants.targets, ...pick.variants.targets.filter((t) => !prev.variants.targets.some((p) => p.target === t.target))]; delete prev.variants; }
    for (const k of Object.keys(pick)) if (k in prev && JSON.stringify(prev[k]) !== JSON.stringify(pick[k])) conflicts.push([cls, k, f, JSON.stringify(prev[k]), JSON.stringify(pick[k])]);
    out[cls] = { ...prev, ...pick, module: f };
  }
}
fs.writeFileSync(path.join(ROOT, "content/effects.json"), JSON.stringify(out, null, 1));
console.log(`effects: ${Object.keys(out).length} elements; conflicts: ${conflicts.length}`, conflicts.slice(0, 10));
