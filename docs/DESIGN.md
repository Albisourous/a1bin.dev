# a1bin.dev — Design Document

> Personal site for Albin Shrestha, rendered as a desktop IDE. Explorer
> on the left, a file open in the editor, chat on the right.

## 1. Concept

**"My personal site is the editor I work in."**

The page is a fake-but-functional IDE window: macOS title bar, file
explorer, tabbed editor with line numbers, a Devin-style chat panel, and
a status bar. On load the editor shows `README.md`, with the `GRAPH`
tab — an Obsidian-style node map of the site — open to its right.
The site content is literally files you can read; clicking a graph
node or a tree row opens it as a tab.

The chat panel is the site's voice: a scripted opener explains the
fiction, and anything the user types gets a canned reply that points
back to the file tree. Nothing leaves the browser.

## 2. Art Direction

- Reference: Devin Desktop / VS Code-family IDEs — quiet dark surface,
  raised panels, one accent color doing all the work.
- Palette: Solarized — chosen because Mononoki's own site is
  Solarized-inspired and the palette was engineered as a paired
  dark/light set. Accents (green #859900, yellow #b58900) stay
  constant; only the base tones flip between themes. 60/30/10:
  editor `bg` dominant, `bg-raise` panels, `ink` family text,
  accents sparing. `data-theme` / `prefers-color-scheme` /
  `?theme=` / localStorage. Dark is default.
- Type: UI chrome in system sans (`$font-ui`, 12px — should look
  OS-native); editor content in Mononoki (`$font-doc`, 14px,
  self-hosted SIL OFL — see `src/assets/fonts/`).

## 3. Layout

```
┌─ ●●● ──────────── ABOUT.md — a1bin.dev ────────────┐  titlebar
├──────────┬──────────────────────────┬──────────────┤
│ EXPLORER │ README.md  GRAPH         │ CHAT         │
│ ◈ GRAPH  ├─ node map / line nos ────┤ chat msgs    │
│ a1bin.dev│  + md lite render        │              │
│  src     │                          │              │
│   ABOUT  │                          │              │
│  work    │                          ├──────────────┤
│          │                          │ ask anything │
├──────────┴──────────────────────────┴──────────────┤
│ ⎇ main                        LF  UTF-8  theme:dark │ statusbar
└─────────────────────────────────────────────────────┘
```

`≤860px`: explorer hides; chat and terminal start closed (the editor
gets the screen) and toggle from the activity bar. Open, they stack as
bottom panels.

## 4. Content model — `content/site.js`

- `SITE.files` — explorer tree (folders expanded, files clickable).
- `SITE.contents` — `filename → lines[]`; the editor renders markdown
  lite (`#`, `##`, `>`, `**bold**`, `[links]`) — real `<a>` for SEO.
- `SITE.chat` — opening conversation; `SITE.cannedReplies` — rotation
  for user input.
- `SITE.openTabs` / `SITE.activeTab` — which tabs open on load and which
  is focused. `SITE.graphTab` names the graph's pseudo-tab.
- `SITE.links` + `SITE.graphCenter` — graph edges (undirected) and hub
  node. Nodes are the keys of `SITE.contents`; layout is deterministic —
  hub center, its links on an inner ring, the rest outer.
- `SITE.gameFile` — `snowboard/game` is a real file in the tree but its
  tab renders an ASCII game (hold SPACE to dive) instead of its text.

## 5. Components

```
src/
├─ content/site.js         ← ALL copy
├─ styles/                 ← tokens → CSS vars, two themes
├─ components/
│  ├─ ide/
│  │  ├─ TitleBar.jsx      ← traffic lights + breadcrumb
│  │  ├─ Explorer.jsx      ← file tree + graph row, opens tabs
│  │  ├─ Editor.jsx        ← tab bar, line numbers + markdown-lite
│  │  ├─ Graph.jsx         ← SVG node map, click node opens file
│  │  ├─ Snowboard.jsx     ← ASCII tiny-wings, swaps in for .game file
│  │  ├─ Chat.jsx          ← msgs + input + canned replies
│  │  └─ StatusBar.jsx     ← branch, file stats, theme toggle
│  └─ ThemeToggle.jsx      ← status-bar theme switch
├─ App.jsx                 ← .ide grid + open-file state
└─ main.jsx
```

Dead from the previous incarnations and deleted: window chrome, mojibake
generator, ASCII art, sandpile sim, intertitle. git history has them.

## 6. Next / open

- More files = more sections; the tree is the roadmap.
- Explorer collapse toggle for mobile.
- Chat could get a real FAQ map later (keyword → reply).
- Future: consider bringing ASCII art back via
  [ascii-magic-art](https://github.com/kailashsr38/ascii-magic-art) — 734
  animated pieces, embeddable as an `<ascii-art>` web component or added
  from an `npx` prompt. Possible homes: loading state, 404, status-bar
  flourish. Idea noted from an Instagram reel; not planned, just a
  candidate to evaluate later.
