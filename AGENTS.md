# a1bin.dev — agent notes

Vite + React 19 + SCSS personal site, styled as a desktop IDE.
Design doc: `docs/DESIGN.md`.

- Dev: `npm run dev` · Build: `npm run build` · Preview: `npm run preview`
- Local dev with the api: `npm run dev` serves `api/` too — the
  `apiDev` plugin in `vite.config.js` dispatches `/api/*` to the
  functions via `ssrLoadModule` and loads `.env.local` (gitignored:
  Upstash vars + `GROQ_API_KEY`) into `process.env`. Without env vars
  the endpoints still run — the leaderboard falls back to its
  localStorage cache and chat falls back to `SITE.cannedReplies`.
- Chat agent: `api/chat.js` → Groq `openai/gpt-oss-20b`. Knowledge =
  `src/content/site/**` text + `api/resume.txt`, shipped via
  `vercel.json` `functions.includeFiles`. `api/resume.txt` is
  Resume.pdf extracted — regenerate when the PDF changes:
  `osascript -l JavaScript -e 'ObjC.import("Quartz"); const u=$.NSURL.fileURLWithPath("<abs>/src/content/site/Resume.pdf"); $.PDFDocument.alloc.initWithURL(u).string.js' > api/resume.txt`
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
- `.prefixer/namespaces.md` maps search namespaces — start searches scoped
  (`api:`, `ide:`, `content:`, `styles:`...) before widening to root.
- `graphify-out/` (gitignored) holds a knowledge graph of the repo — treat
  codebase questions as graph queries first; rebuild with `/graphify . --update`.
