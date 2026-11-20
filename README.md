# a1bin.dev

Personal site for Albin Shrestha. The whole page is a Windows-classic
Notepad window displaying `a1bin.bin` — a corrupted binary whose printable
strings are the site content. Boot intertitle is a Lily Chou-Chou-style
ghost-text cut; the desktop wallpaper is pure-CSS Frutiger Aero.

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
| Colors                  | `src/styles/tokens/_colors.scss`       |
| Fonts, sizes            | `src/styles/tokens/_type.scss`         |
| Chrome metrics          | `src/styles/tokens/_chrome.scss`       |
| Mojibake texture        | `src/lib/charset.js` (weights)         |
| Document layout         | `src/lib/document.js`                  |
| Bevels / scrollbars     | `src/styles/mixins/`                   |

Deploy: any static host serves `dist/` (GitHub Pages, Cloudflare Pages,
Vercel, Netlify). Domain is registered on Spaceship — point its DNS at the
host when ready.
