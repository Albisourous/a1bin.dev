// Site metrics client — anonymous visit beacon + dashboard fetch.
//   trackVisit()   → one "visit" POST per browser session, silent
//   fetchMetrics() → GET /api/metrics payload, or null when the api
//                    isn't there (`npm run dev`, unconfigured env,
//                    offline). The tab renders its dim state on null.
// Visitor id: a uuid in localStorage, only used for the uniques
// HyperLogLog server-side. No cookies, no fingerprinting.
const API = "/api/metrics";
const VISITOR_KEY = "metrics.visitor";
const SESSION_KEY = "metrics.visited";

// Self-exclusion + bot gate — the owner's refreshes and crawlers don't
// count. ?ignore=true latches the flag in localStorage; ?ignore=false
// clears it. navigator.webdriver and the usual bot UAs never send.
const IGNORE_KEY = "ignore_analytics";
const BOT_UA =
  /bot|crawler|spider|headless|lighthouse|pingdom|uptime|slurp|duckduck/i;
try {
  const q = new URLSearchParams(location.search).get("ignore");
  if (q === "true") localStorage.setItem(IGNORE_KEY, "true");
  if (q === "false") localStorage.removeItem(IGNORE_KEY);
} catch {}

export const analyticsOff = () => {
  try {
    if (localStorage.getItem(IGNORE_KEY) === "true") return true;
  } catch {}
  return navigator.webdriver || BOT_UA.test(navigator.userAgent);
};

// non-blocking send — sendBeacon survives tab close; keepalive fetch
// is the fallback. Either way a failure is swallowed.
export const post = (body) => {
  const data = JSON.stringify(body);
  const blob = new Blob([data], { type: "application/json" });
  if (navigator.sendBeacon?.(API, blob)) return;
  fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: data,
    keepalive: true,
  }).catch(() => {});
};

const uuid = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const visitorId = () => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};

// fire-and-forget — a session counts once, failures are swallowed
export const trackVisit = () => {
  if (analyticsOff()) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return;
  }
  post({ event: "visit", id: visitorId() });
};

// one countable interaction — terminal command, resume open, finished
// snowboard run. No session guard: every press counts. Silent on
// failure.
const EVENTS = new Set(["term", "resume", "run"]);
// rapid accidental re-fires don't count — resume opens debounce at 4s
const GAP_MS = { resume: 4000 };
const lastAt = {};
export const trackEvent = (name) => {
  if (!EVENTS.has(name) || analyticsOff()) return;
  const now = Date.now();
  if (lastAt[name] && now - lastAt[name] < (GAP_MS[name] ?? 0)) return;
  lastAt[name] = now;
  post({ event: name });
};

export const fetchMetrics = async () => {
  try {
    const res = await fetch(API);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch {
    return null;
  }
};

// beacon on import — whoever loads this module first counts the session
trackVisit();
