# a1bin.dev

Personal site for Albin Shrestha, rendered as a desktop IDE. Explorer on
the left (fake file tree — `src/ABOUT.md` is the site content), editor
in the middle, agent chat panel on the right. Dark first, light optional.

See `docs/DESIGN.md` for the full design doc.

## Stack

- Vite + React 19 (plain JS, no TS)
- SCSS — design tokens + mixins in `src/styles/`
- No runtime deps beyond React

## Commands

```sh
npm install
npm run dev      # local dev
npm run build    # production build → dist/
npm run preview  # serve the build
```

## Where to edit things

| What                    | Where                                  |
|-------------------------|----------------------------------------|
| Name, bio, links, copy  | `src/content/site.js`                  |
| Theme (dark/light)      | `src/styles/tokens/_colors.scss`       |
| Fonts, sizes            | `src/styles/tokens/_type.scss`         |
| File tree + file copy   | `SITE.files`/`SITE.contents` in site.js|
| Chat script + replies   | `SITE.chat`/`SITE.cannedReplies`       |

Theme: follows the OS; `[t] theme` in the footer toggles and persists to
localStorage. `?theme=dark|light` in the URL overrides.

Deploy: any static host serves `dist/` (GitHub Pages, Cloudflare Pages,
Vercel, Netlify). Domain is registered on Spaceship — point its DNS at the
host when ready.
