// All copy for the METRICS tab — the site's own traffic dashboard.
// Same voice as the rest of the site: lowercase, terse, a little playful.
export const METRICS = {
  title: "metrics",
  window: "last 30 days",
  loading: "…",
  unconfigured: "metrics not configured — `npx vercel dev` serves the api",
  empty: "no data yet — come back after a few visits",
  stats: {
    visits: "page loads",
    chats: "chat messages",
    runs: "games played",
    term: "terminal commands",
    resume: "resume opens",
    visitors: "unique visitors",
    players: "players",
  },
  series: {
    visits: "loads",
    chats: "chats",
    runs: "games",
    term: "term",
    resume: "resume",
  },
};
