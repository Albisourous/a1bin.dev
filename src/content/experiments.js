// The public experiment registry — what this site tests on its
// visitors. One entry per test; `status` drives what AB.jsx shows:
//   live      → each browser draws a variant (src/lib/ab.js)
//   concluded → `winner` (a variant key) + `note` tell the result
//   idea      → on the whiteboard, no assignment
//
// Shape: { id, name, status, question, metric, variants[], winner?, note? }
// `id` is the assignment hash input — keep it stable once an experiment
// goes live, or everyone silently re-draws.
export const EXPERIMENTS = [
  {
    id: "boot-tab",
    name: "landing view",
    status: "live",
    question: "what should greet you on load?",
    metric: "files opened per visit",
    variants: [
      { key: "a", label: "readme first", note: "README.md takes the focus" },
      { key: "b", label: "graph first", note: "the map is the front door" },
    ],
  },
  {
    id: "chat-default",
    name: "chat on boot",
    status: "live",
    question: "does an open chat panel invite conversation?",
    metric: "messages sent per session",
    variants: [
      { key: "a", label: "chat open", note: "panel visible on landing" },
      { key: "b", label: "chat closed", note: "rail icon only — pull to open" },
    ],
  },
  {
    id: "dive-input",
    name: "dive mechanic",
    status: "concluded",
    question: "how should the snowboarder dive?",
    metric: "median run distance",
    variants: [
      { key: "a", label: "hold space", note: "press and hold to tuck" },
      { key: "b", label: "tap to flap", note: "each tap lifts the nose" },
    ],
    winner: "a",
    note: "hold won — tap runs died young and angry",
  },
  {
    id: "board-rank",
    name: "leaderboard math",
    status: "concluded",
    question: "best run or total runs on the board?",
    metric: "repeat plays after posting",
    variants: [
      { key: "a", label: "best run", note: "one row per rider" },
      { key: "b", label: "total runs", note: "grinding climbs the board" },
    ],
    winner: "a",
    note: "best won — totals rewarded stamina, not skill",
  },
  {
    id: "term-boot",
    name: "terminal on boot",
    status: "idea",
    question: "open the shell at the bottom on landing?",
    metric: "commands typed",
    variants: [
      { key: "a", label: "term open", note: "prompt blinks up at you" },
      { key: "b", label: "term closed", note: "editor keeps the floor" },
    ],
  },
];

// UI copy for the A/B tab — every string the view renders lives here.
export const AB_COPY = {
  title: "a/b — experiment log",
  blurb:
    "this site a/b tests itself on you. live tests deal you a variant " +
    "in your browser — nothing is sent anywhere. yet.",
  metricLabel: "metric",
  youLabel: "you got",
  winnerLabel: "winner",
  footnote: "assignments live in localStorage — no cookies, no tracking pixels",
  // Status marks — brightness and fill only, never hue:
  //   ● live (bright)   ○ concluded (dim)   · idea (faint)
  statuses: { live: "live", concluded: "concluded", idea: "idea" },
  marks: { live: "●", concluded: "○", idea: "·" },
};
