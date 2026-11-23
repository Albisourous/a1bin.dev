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
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return;
  }
  fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "visit", id: visitorId() }),
    keepalive: true,
  }).catch(() => {});
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
