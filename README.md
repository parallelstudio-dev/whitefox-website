# Whitefox Recruitment — website

The Whitefox Recruitment site (whitefoxrecruitment.com.au), migrated from Framer to a Next.js build hosted on Vercel,
by Parallel Studio, with Whitefox's approval.

- `content/pages/<route>/` — each page's markup, CSS and metadata, produced by `scripts/migrate/convert.py` from the
  live Framer site. All media, fonts and images are local in `public/assets/`.
- `components/Runtime.tsx` + `components/runtime/` — the site's behaviour, reimplemented without Framer's runtime:
  appear and scroll-in animations (Framer's own spring values), header, logo ticker, counters, footer shutter, and the
  interactive components.
- `qa/` — side-by-side checks against the live site (`viewport.mjs` + `vpsheet.py`, `compare.mjs` + `pair.py`).

```
npm install
npm run dev        # http://localhost:3000
npm run build
npm run migrate    # re-run the Framer conversion (Python 3 + beautifulsoup4 + lxml)
```

Not yet wired: the Framer forms (Contact, Submit Vacancy, newsletter) — submission target to be decided (likely Tally).
Submit Resume keeps its existing Tally embed. Preview deployments are `noindex`; production indexing follows the
original robots settings.
