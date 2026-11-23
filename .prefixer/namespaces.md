# namespaces
repo: a1bin-dev

| prefix | scope | contains |
|--------|-------|----------|
| api: | api/** | serverless functions: chat.js (Groq), snowboard leaderboard, resume.txt |
| docs: | docs/** | DESIGN.md design doc |
| public: | public/** | binary assets: mononoki fonts, favicon |
| src: | src/** | app source; prefer the narrower rows below |
| components: | src/components/** | React components, all IDE chrome |
|   ide: | src/components/ide/** | IDE chrome: Editor, Explorer, Chat, Graph, Terminal, Leaderboard, Snowboard |
| content: | src/content/** | site copy + chat strings (site.js), site/** files, Resume.pdf |
| lib: | src/lib/** | shared helpers: ab.js variant assignment, metrics.js |
| styles: | src/styles/** | SCSS; tokens/ emits CSS vars, mixins/, base/ — never hardcode visuals |
| cfg: | AGENTS.md, LICENSE, README.md, index.html, package.json, vercel.json, vite.config.js | config, manifests, docs at repo root |
| boot: | src/main.jsx, index.html | entry points, boot wiring |
