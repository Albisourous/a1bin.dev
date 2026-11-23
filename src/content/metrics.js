// All copy for the METRICS tab — the site's own traffic dashboard.
// Same voice as the rest of the site: lowercase, terse, a little playful.
export const METRICS = {
  title: "metrics",
  window: "last two weeks",
  loading: "…",
  unconfigured: "metrics not configured — check .env.local for upstash vars",
  empty: "no data yet — come back after a few visits",
  stats: {
    visits: "page loads",
    chats: "chat messages",
    runs: "games played",
    term: "terminal commands",
    resume: "resume opens",
  },
  series: {
    visits: "page loads",
    chats: "chats",
    runs: "games",
    term: "term",
    resume: "resume",
  },
  deathsTitle: "run endings",
  axisStart: (n) => `${n} days ago`,
  axisNote: "one cell = one day · brighter = busier",
  axisEnd: "today",
};
