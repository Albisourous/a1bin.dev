# a1bin.dev

Personal site for Albin Shrestha, rendered as a desktop IDE. Explorer on
the left (mirrors the real files in `src/content/site/`), tabbed editor in
the middle, live LLM chat panel on the right, terminal along the bottom.
Dark first, light optional.

See `docs/DESIGN.md` for the full design doc.

## Stack

- Vite + React 19 (plain JS, no TS)
- SCSS — design tokens + mixins in `src/styles/`, emitted as CSS vars
- `@upstash/redis` — the only runtime dep besides React
- Vercel serverless functions in `api/`

## Commands

```sh
npm install
npm run dev      # local dev — also serves /api/* via the apiDev vite plugin
npm run build    # production build → dist/
npm run preview  # serve the build
```

`npm run dev` loads `.env.local` (gitignored) into `process.env` and
dispatches `/api/*` to the functions in `api/` — no `vercel dev` needed.
Without env vars the endpoints still run: the leaderboard falls back to
its localStorage cache, chat replies with `SITE.fallbackReply`.

| Env var                                        | Used by                          |
|------------------------------------------------|----------------------------------|
| `GROQ_API_KEY`                                 | `api/chat.js`                    |
| `UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/`_TOKEN` | `api/scores.js`, `api/metrics.js`, chat rate limit |

## API

| Endpoint       | Purpose                                                        |
|----------------|----------------------------------------------------------------|
| `api/chat.js`  | Chat panel agent → Groq `openai/gpt-oss-20b`. Knowledge = `src/content/site/**` + `api/resume.txt`, inlined into the system prompt. Per-IP daily cap when Redis is set. |
| `api/scores.js`| Snowboard leaderboard — Redis hash `snowboard:riders`, one best row per rider. |
| `api/metrics.js` | Counters (visits, runs, chats, uniques HLL), last-30-days rows, live A/B experiment tallies from `src/content/experiments.js`. Missing env → `{ok:false}`, never an error. |

## Where to edit things

| What                    | Where                                            |
|-------------------------|--------------------------------------------------|
| Site content files      | `src/content/site/` — the explorer mirrors it via `import.meta.glob` in `site.js` |
| Copy, labels, chat, tabs| `src/content/site.js` (`SITE.*`) — never hardcode strings in components |
| Theme (dark/light)      | `src/styles/tokens/_colors.scss`                 |
| Fonts, sizes            | `src/styles/tokens/_type.scss`                   |
| A/B experiments         | `src/content/experiments.js`                     |

## How it fits together

- Every file under `src/content/site/` becomes an explorer node, an
  editor tab, and a deep link (`.txt` dropped: `/snowboard/game`).
- `README.md` is the landing tab; `GRAPH` is a pseudo-tab rendering an
  Obsidian-style map — edges are derived automatically when one file's
  text mentions another file's name.
- `snowboard/game.txt` and `snowboard/leaderboard.txt` are real files
  whose editor bodies swap to the ASCII game (`Snowboard.jsx`) and the
  live top-runs board.
- `Resume.pdf` opens in a PDF-viewer tab. `api/resume.txt` is its
  extracted text for the chat agent — regenerate it when the PDF
  changes (osascript command in `AGENTS.md`).
- The editor is editable: transparent `<textarea>` over a styled
  `<pre>`, drafts in `App.jsx` state, in-session only.
- The terminal takes real commands — `help` lists them.
- Build plugins in `vite.config.js` emit `sitemap.xml` covering every
  site file and a `/snowboard/game` html shell with its own og tags.
- `/accessibility.html` is a static statement page in `public/` —
  Vercel serves it before the SPA rewrite; `ACCESSIBILITY.md` in
  `site/` mirrors the text for explorer/graph readers.

Theme: dark by default; the `theme` button in the status bar toggles and
persists to localStorage. `?theme=dark|light` in the URL overrides.

## Deploy

Vercel — `vercel.json` SPA-rewrites everything to `index.html`, ships
`src/content/site/**` and `api/resume.txt` into the chat function
bundle, and redirects `/game` → `/snowboard/game`. A static host can
serve `dist/` too, but `/api/*` won't exist there — leaderboard, chat,
and metrics degrade to their fallbacks. Domain is on Spaceship.
