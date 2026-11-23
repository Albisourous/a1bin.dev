import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, statSync } from "node:fs";
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
    const urls = ["/", "/GRAPH"].concat(
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

export default defineConfig({
  plugins: [react(), sitemap()],
});
