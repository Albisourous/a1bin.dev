import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Routes mirror src/content/site/ — every file gets a deep link
// (.txt dropped, see SITE.urls). Emit a sitemap covering them so
// crawlers find every page, including files added later.
const walk = (dir, base = "") =>
  readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .flatMap((f) =>
      statSync(join(dir, f)).isDirectory()
        ? walk(join(dir, f), `${base}${f}/`)
        : [`${base}${f}`]
    );

const sitemap = () => ({
  name: "sitemap",
  generateBundle() {
    const urls = ["/", "/GRAPH", "/METRICS", "/A/B", "/accessibility.html"].concat(
      walk("src/content/site").map((p) => `/${p.replace(/\.txt$/, "")}`)
    );
    this.emitFile({
      type: "asset",
      fileName: "sitemap.xml",
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>https://a1bin.dev${u}</loc></url>`)
        .join("\n")}\n</urlset>\n`,
    });
  },
});

// /snowboard/game ships its own html shell — a copy of the built
// index.html with game og tags swapped in. Vercel serves the static
// file before the SPA rewrite, so share crawlers see the snowboard
// icon while humans still boot the same bundle on the same route.
const gameShare = () => ({
  name: "game-share",
  writeBundle() {
    mkdirSync("dist/snowboard/game", { recursive: true });
    writeFileSync(
      "dist/snowboard/game/index.html",
      readFileSync("dist/index.html", "utf8")
        .replaceAll("Albin Shrestha — a1bin.dev", "snowboard — a1bin.dev")
        .replaceAll(
          "Albin Shrestha — software engineer in Seattle. Amazon Customer Service, LLM widgets, agent tooling. Personal site rendered as an IDE.",
          "tiny-wings on canvas — hold space to drop, ride the ridge until night falls."
        )
        .replaceAll('href="https://a1bin.dev/"', 'href="https://a1bin.dev/snowboard/game"')
        .replaceAll(
          'content="https://a1bin.dev/"',
          'content="https://a1bin.dev/snowboard/game"'
        )
        .replaceAll("https://a1bin.dev/og.png", "https://a1bin.dev/snowboard-guy.png")
        .replaceAll('content="2400"', 'content="512"')
        .replaceAll('content="1260"', 'content="512"')
        .replaceAll('content="summary_large_image"', 'content="summary"')
    );
  },
});

// Agent/SEO access layer — llms.txt files and the crawler prerender,
// all generated from src/content/site so they can't drift from the UI.
const siteDocs = () =>
  walk("src/content/site")
    .filter((rel) => /\.(md|txt)$/.test(rel))
    .map((rel) => ({
      rel, // fitness/FITNESS.md — path shown in the explorer
      url: `/${rel.replace(/\.txt$/, "")}`, // deep link (.txt dropped)
      text: readFileSync(join("src/content/site", rel), "utf8").replace(
        /\n$/,
        ""
      ),
    }));

// Resume.pdf is the only explorer file with no text source — its
// extract is kept in api/resume.txt (see api/chat.js knowledge).
const resumeText = () =>
  readFileSync("api/resume.txt", "utf8").replace(/\n$/, "");

// One-line blurbs for llms.txt entries; files without one still list.
const blurbs = {
  "README.md": "front door — who Albin is, stack, links",
  "AGENTS.md": "house rules for agents visiting the site",
  "ACCESSIBILITY.md": "wcag 2.2 status + plain-html fallback",
  "projects/pokestrike.txt": "pokémon roguelike — plays in the side panel",
  "snowboard/game.txt": "ascii tiny-wings game that runs in the editor",
  "snowboard/leaderboard.txt": "shared top runs from the game",
  "fitness/FITNESS.md": "why he trains + the three practices",
  "fitness/WEIGHTLIFTING.md": "lift prs at ~155 lbs bodyweight",
  "fitness/CALISTHENICS.md": "seattle bodyweight club he co-organizes",
  "fitness/JIUJITSU.md": "bjj blue belt, judo green belt",
};

const llmsTxt = () => {
  const secs = new Map();
  for (const d of siteDocs()) {
    const dir = d.rel.includes("/") ? d.rel.split("/")[0] : "site";
    if (!secs.has(dir)) secs.set(dir, []);
    secs.get(dir).push(d);
  }
  const list = (docs) =>
    docs
      .map(
        (d) =>
          `- [${d.rel}](https://a1bin.dev${d.url}): ${blurbs[d.rel] ?? "site file"}`
      )
      .join("\n");
  const order = ["site", "projects", "snowboard", "fitness"];
  const titled = (dir) =>
    dir === "site" ? "Site" : dir[0].toUpperCase() + dir.slice(1);
  const body = order
    .concat([...secs.keys()].filter((k) => !order.includes(k)))
    .filter((dir) => secs.has(dir))
    .map(
      (dir) =>
        `## ${titled(dir)}\n\n${list(secs.get(dir))}${
          dir === "site"
            ? "\n- [Resume.pdf](https://a1bin.dev/Resume.pdf): work history — Amazon SDE; text mirror is in llms-full.txt"
            : ""
        }`
    )
    .join("\n\n");
  return `# Albin Shrestha — a1bin.dev

> Albin Shrestha is a software engineer in Seattle, WA who builds customer-facing products and agent tooling — currently an SDE on Amazon's Customer Service experience. a1bin.dev is his personal site styled as an interactive IDE: the explorer holds real files, the chat is a live LLM, and the editor runs an ASCII snowboard game.

Every file rendered in the IDE is listed below and deep-linkable. The complete text of all of them — including the résumé — is mirrored in one request at /llms-full.txt.

${body}

## Elsewhere

- [GitHub](https://github.com/Albisourous): code
- [LinkedIn](https://www.linkedin.com/in/albin-shrestha): work
- [X](https://x.com/albinshr): posts
- [Instagram](https://www.instagram.com/adventureralbi/): outside work
- [Email](mailto:albinshrestha01@gmail.com): direct line

## Meta

- [llms-full.txt](https://a1bin.dev/llms-full.txt): the whole site as one plain-text document
- [accessibility.html](https://a1bin.dev/accessibility.html): plain-html page, no IDE required
`;
};

const llmsFull = () =>
  `# Albin Shrestha — a1bin.dev — full site mirror

> Complete text of every file on a1bin.dev in one document. The site is an interactive IDE — these are the real files its explorer renders. Each section links back to its deep link.

${siteDocs()
  .map((d) => `## ${d.rel}\n\nDeep link: https://a1bin.dev${d.url}\n\n${d.text}`)
  .join("\n\n---\n\n")}

---

## Resume.pdf

Deep link: https://a1bin.dev/Resume.pdf
Text extracted from the PDF (api/resume.txt):

${resumeText()}
`;

const escHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Crawler mirror injected at index.html's @prerender marker, inside the
// display:none .crawl wrapper — semantic text of every site file. React
// clears #root on mount; fetchers that don't run JS get the whole site.
const prerender = () => {
  const docs = siteDocs();
  return `<main aria-label="a1bin.dev site content">
      <nav aria-label="file index">
        <ul>
${docs.map((d) => `          <li><a href="${d.url}">${escHtml(d.rel)}</a></li>`).join("\n")}
          <li><a href="/Resume.pdf">Resume.pdf</a></li>
          <li><a href="/accessibility.html">accessibility.html</a></li>
        </ul>
      </nav>
${docs
  .map(
    (d) => `      <article>
        <h2>${escHtml(d.rel)}</h2>
        <pre>${escHtml(d.text)}</pre>
      </article>`
  )
  .join("\n")}
      <article>
        <h2>Resume.pdf</h2>
        <pre>${escHtml(resumeText())}</pre>
      </article>
    </main>`;
};

const agents = () => ({
  name: "agents",
  generateBundle() {
    for (const [fileName, source] of [
      ["llms.txt", llmsTxt()],
      ["llms-full.txt", llmsFull()],
    ])
      this.emitFile({ type: "asset", fileName, source });
  },
  // Dev parity — the files live only in memory until build emits them.
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split("?")[0];
      if (path !== "/llms.txt" && path !== "/llms-full.txt") return next();
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(path === "/llms.txt" ? llmsTxt() : llmsFull());
    });
  },
  transformIndexHtml: (html) =>
    html.replace("<!-- @prerender -->", () => prerender()),
});

// /api/* under `npm run dev` — vercel dev parity without the extra
// process. loadEnv("") pulls every var from .env.local (KV_*,
// GROQ_API_KEY) into process.env; vite only exposes VITE_* on its own.
// ssrLoadModule reloads function edits like any other module.
const apiDev = () => ({
  name: "api-dev",
  configureServer(server) {
    Object.assign(
      process.env,
      loadEnv(server.config.mode, server.config.root, "")
    );
    server.middlewares.use("/api", (req, res) => {
      const name = req.url?.split(/[/?]/).find(Boolean);
      res.status = (code) => ((res.statusCode = code), res);
      res.json = (body) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(body));
      };
      const run = async () => {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        req.body = chunks.length
          ? JSON.parse(Buffer.concat(chunks).toString())
          : {};
        const { default: handler } = await server.ssrLoadModule(
          `/api/${name}.js`
        );
        await handler(req, res);
      };
      run().catch((e) =>
        res.status(404).json({ error: `api dev: ${e.message}` })
      );
    });
  },
});

export default defineConfig({
  plugins: [react(), sitemap(), gameShare(), agents(), apiDev()],
});
