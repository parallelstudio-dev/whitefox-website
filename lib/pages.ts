import fs from "node:fs";
import path from "node:path";

// Pages migrated from Framer (scripts/migrate/convert.py): markup, CSS and metadata per route.
const DIR = path.join(process.cwd(), "content", "pages");

export type Meta = {
  route: string;
  title: string;
  canonical: string;
  tags: Record<string, string>[];
  icons: { rel: string; href: string; media?: string | null }[];
  appear: Record<string, unknown>;
  breakpoints: { hash: string; mediaQuery: string }[];
};

const walk = (dir: string, base = ""): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const rel = base ? `${base}/${d.name}` : d.name;
    if (!d.isDirectory()) return [];
    return fs.existsSync(path.join(dir, d.name, "meta.json")) ? [rel] : walk(path.join(dir, d.name), rel);
  });

export const allRoutes = () => walk(DIR);
export const routeKey = (slug?: string[]) => (slug && slug.length ? slug.map(decodeURIComponent).join("/") : "index");
export const exists = (key: string) => fs.existsSync(path.join(DIR, key, "meta.json"));
export const readPage = (key: string) => ({
  meta: JSON.parse(fs.readFileSync(path.join(DIR, key, "meta.json"), "utf8")) as Meta,
  css: fs.readFileSync(path.join(DIR, key, "page.css"), "utf8"),
  html: fs.readFileSync(path.join(DIR, key, "body.html"), "utf8"),
});
