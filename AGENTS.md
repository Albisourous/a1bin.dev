# a1bin.dev — agent notes

Vite + React 19 + SCSS personal site, styled as a desktop IDE.
Design doc: `docs/DESIGN.md`.

- Dev: `npm run dev` · Build: `npm run build` · Preview: `npm run preview`
- Files shown in the IDE are real files in `src/content/site/` — the explorer
  mirrors that folder via `import.meta.glob` in `site.js`. Other copy (chat,
  labels, graph edges) lives in `src/content/site.js` — never hardcode strings.
- All visual constants are SCSS tokens (`src/styles/tokens/`) emitted as CSS
  vars — never hardcode colors/fonts/metrics in components.
- Plain JavaScript, no TypeScript. Keep components small; IDE chrome lives in
  `src/components/ide/`.
- Do NOT use "Devin" branding in the UI — the chat panel title is `chat`
  (`SITE.chatTitle`). The site may be *inspired by* the Devin IDE layout but
  never displays the name.
- The editor is editable: styled `<pre>` under a transparent `<textarea>`,
  drafts held in `App.jsx` state (in-session only).
- The editor is tabbed (`SITE.openTabs`/`activeTab`). `SITE.graphTab` is a
  pseudo-tab rendering `components/ide/Graph.jsx` — an Obsidian-style map
  built from `SITE.links`, centered on `SITE.graphCenter`.
