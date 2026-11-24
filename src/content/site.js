// All copy for the site lives here. The site is an IDE: explorer tree on
// the left, one file open in the editor, agent chat on the right.
//
// The files shown in the IDE are real files under ./site/ — the explorer
// mirrors that folder and the editor renders their contents.

import { email, mailto } from "./contact.js";

const raw = import.meta.glob(["./site/**/*", "!./site/**/*.pdf"], {
  query: "?raw",
  import: "default",
  eager: true,
});

// PDFs aren't text — imported as asset URLs; the editor iframes them in
// a viewer tab instead of rendering bytes (see Editor.jsx).
const pdfRaw = import.meta.glob("./site/**/*.pdf", {
  query: "?url",
  import: "default",
  eager: true,
});
const pdfs = {};
for (const [path, url] of Object.entries(pdfRaw)) {
  pdfs[path.split("/").pop()] = url;
}

// File contents — arrays of lines, keyed by filename.
const contents = {};
for (const [path, text] of Object.entries(raw)) {
  contents[path.split("/").pop()] = text.replace(/\n$/, "").split("\n");
}

// Explorer tree built from the real folder layout, folders last.
const root = { type: "folder", name: "a1bin.dev", children: [] };
for (const path of [...Object.keys(raw), ...Object.keys(pdfRaw)].sort()) {
  const parts = path.replace("./site/", "").split("/");
  let children = root.children;
  for (const part of parts.slice(0, -1)) {
    let folder = children.find((c) => c.type === "folder" && c.name === part);
    if (!folder) {
      folder = { type: "folder", name: part, children: [] };
      children.push(folder);
    }
    children = folder.children;
  }
  children.push({ type: "file", name: parts.at(-1) });
}
const sortTree = (node) => {
  node.children?.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "file" ? -1 : 1
  );
  node.children?.forEach(sortTree);
};
sortTree(root);

// Obsidian-style edges, derived automatically: a file links to every
// other file whose name appears in its text. Word-boundary match so
// "read" or "agents" in prose doesn't count, and no self-links.
const links = {};
const names = [
  ...Object.keys(contents),
  ...Object.keys(pdfRaw).map((p) => p.split("/").pop()),
];
for (const [name, lines] of Object.entries(contents)) {
  const text = lines.join("\n");
  links[name] = names.filter(
    (other) =>
      other !== name &&
      new RegExp(
        `\\b${other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`
      ).test(text)
  );
}

// URL per file — basename → site-relative path with the .txt suffix
// dropped, so deep links read /snowboard/game, /README.md, /Resume.pdf.
const urls = {};
for (const path of [...Object.keys(raw), ...Object.keys(pdfRaw)]) {
  const rel = path.replace("./site/", "");
  urls[rel.split("/").pop()] = rel.replace(/\.txt$/, "");
}

// `help` output — seeds the terminal scrollback and answers the live command.
const termHelp = "ls · cat <file> · open <file> · clear";

export const SITE = {
  domain: "a1bin.dev",

  // Editor tabs. README.md is the landing view; the graph tab sits to
  // its left, Resume.pdf to its right.
  graphTab: "GRAPH",
  // Pseudo-views — activity-bar icons open these as tabs that render
  // components (Metrics.jsx, AB.jsx), not files.
  metricsTab: "METRICS",
  abTab: "A/B",
  openTabs: ["GRAPH", "README.md", "Resume.pdf", "game.txt"],
  activeTab: "README.md",
  graphCenter: "README.md",

  // snowboard/game.txt is a real file in ./site/ but swaps the editor
  // body for the ASCII game (Snowboard.jsx) instead of rendering text.
  gameFile: "game.txt",

  // snowboard/leaderboard.txt is a real file in ./site/ but swaps the
  // editor body for the live top-runs board (Leaderboard.jsx) — same
  // trick as the game.
  boardFile: "leaderboard.txt",

  // projects/pokestrike.txt is a real file in ./site/ but opens to the
  // side — a split editor group iframing the deployed game on GitHub
  // Pages. `aspect` (w/h) is the app's fixed logical ratio: the split
  // column sizes itself to it so nothing letterboxes inside.
  // `open` pins how it launches — "split" or "tab"; unset means auto:
  // split on desktop, a normal editor tab on mobile.
  play: {
    "pokestrike.txt": {
      url: "https://albisourous.github.io/pokestrike/",
      aspect: 540 / 960,
    },
  },

  // Status-bar "a11y" link → the standalone statement page. A real
  // html file in public/ so it works without the SPA — Vercel serves
  // it before the rewrite. ACCESSIBILITY.md in ./site/ mirrors the
  // text for explorer/graph readers.
  a11y: {
    label: "a11y",
    title: "accessibility statement",
    href: "/accessibility.html",
  },

  // "a links to b" — the graph renders each pair as an arrow a → b.
  links,

  // Explorer tree — mirrors ./site/. Folders render expanded; files are
  // openable tabs.
  files: [root],

  // Folders that start collapsed in the explorer.
  closedFolders: ["fitness"],

  contents,

  // Basename → deep-link path (see `urls` above). Editor file-links
  // href these; App.jsx boot resolves the same paths back to files.
  urls,

  // Binary files by filename → asset URL. Explorer lists them; opening
  // one renders a PDF viewer tab, not text.
  pdfs,

  chatTitle: "chat",
  emptyEditor: "no files open",

  // Zelda easter egg — the title bar's red "close" dot drops the whole
  // IDE like a curtain and reveals this behind it. "this" is the sword:
  // a link to Resume.pdf. `alt` is the mailto second line.
  curtain: {
    before: "it's dangerous to go alone. take",
    link: "this",
    alt: "or email me instead",
    // The pull handle — the sword icon in icons.jsx, drag it up (or
    // scroll/swipe up) to raise the IDE again.
    hint: "scroll or drag up",
  },

  // Activity bar — far-left icon rail. View buttons are defined in
  // ActivityBar.jsx; these are the outbound links pinned to the bottom
  // of the rail. `icon` names an SVG in ActivityBar.jsx.
  socials: [
    { name: "github", url: "https://github.com/Albisourous", icon: "github" },
    {
      name: "linkedin",
      url: "https://www.linkedin.com/in/albin-shrestha",
      icon: "linkedin",
    },
    { name: "x", url: "https://x.com/albinshr", icon: "x" },
    {
      name: "instagram",
      url: "https://www.instagram.com/adventureralbi/",
      icon: "instagram",
    },
    { name: "email", url: mailto, icon: "mail" },
  ],

  // Terminal — fake shell pinned to the bottom of the workbench, open
  // by default on desktop. The log seeds the scrollback; the prompt
  // takes real commands
  // (see Terminal.jsx for the command list).
  termTitle: "terminal",
  term: ["a1bin.dev $ help", termHelp],
  termPrompt: "a1bin.dev $",
  termHelp,

  // Scripted chat — the panel's opening conversation.
  chat: [
    { role: "user", text: "what are you working on right now?" },
    {
      role: "agent",
      text: "working on improving this chat with ai albin, try it :)",
    },
  ],

  // Contact — chat replies that mention this address get linkified into
  // `mailto` so one click opens a ready-to-send draft (./contact.js).
  email,
  mailto,

  // When /api/chat fails — out of tokens, no key, or a request error.
  fallbackReply: `i'm out of tokens :(. email albin at ${email} for the answer.`,

  theme: {
    label: "theme",
    dark: "dark",
    light: "light",
  },
};
