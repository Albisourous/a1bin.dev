# a1bin.dev — agent notes

Vite + React 19 + SCSS personal site. Design doc: `docs/DESIGN.md`.

- Dev: `npm run dev` · Build: `npm run build` · Preview: `npm run preview`
- All user-facing copy lives in `src/content/site.js` — never hardcode strings.
- All visual constants are SCSS tokens (`src/styles/tokens/`) emitted as CSS
  vars — never hardcode colors/fonts/metrics in components.
- The mojibake document is deterministic: `mulberry32(seed)` in
  `src/lib/document.js` → same "file" every visit. Change `SITE.seed` in
  site.js to reshuffle.
- Plain JavaScript, no TypeScript. Keep components small; chrome
  (`components/window/`), content (`components/document/`), pure logic
  (`lib/`) stay separate.
