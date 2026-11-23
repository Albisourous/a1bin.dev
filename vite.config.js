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
    const urls = ["/", "/GRAPH", "/accessibility.html"].concat(
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
  plugins: [react(), sitemap(), gameShare(), apiDev()],
});
