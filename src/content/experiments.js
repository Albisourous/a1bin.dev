// The public experiment registry — what this site tests on its
// visitors. One entry per test; `status` is internal plumbing, never
// shown: we don't claim a test is running, only report the draw.
//   live      → each browser draws a variant (src/lib/ab.js)
//   concluded → `winner` (a variant key) + `note` tell the result
//   idea      → on the whiteboard, no assignment, dashed wireframe
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
    status: "idea",
    question: "how should the snowboarder dive?",
    metric: "median run distance",
    variants: [
      { key: "a", label: "hold space", note: "press and hold to tuck" },
      { key: "b", label: "tap to flap", note: "each tap lifts the nose" },
    ],
  },
];

// UI copy for the A/B tab — every string the view renders lives here.
export const AB_COPY = {
  title: "a/b — experiment log",
  blurb:
    "some choices on this site get settled by a/b draw — the " +
    "candidates and the deciding metric, out in the open.",
  metricLabel: "metric",
  winnerLabel: "winner",
  footnote: "assignments live in localStorage — no cookies, no tracking pixels",
};
