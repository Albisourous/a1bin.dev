import { useEffect, useState } from "react";
import { fetchMetrics } from "../../lib/metrics.js";
import { METRICS } from "../../content/metrics.js";

const SITE_KEYS = ["visits", "visitors", "chats", "term", "resume"];
const SNOW_KEYS = ["runs", "players"];

// Live traffic dashboard — a wall of all-time totals.
// Rendered in place of the METRICS pseudo-tab.
export default function Metrics() {
  const [state, setState] = useState({ loaded: false, data: null });

  useEffect(() => {
    let live = true;
    fetchMetrics().then((data) => {
      if (live) setState({ loaded: true, data });
    });
    return () => {
      live = false;
    };
  }, []);

  const { loaded, data } = state;
  const totals = data?.totals ?? {};
  // run-ending mix — sorted desc so the dominant killer leads
  const deaths = Object.entries(data?.deaths ?? {})
    .map(([k, v]) => [k, Number(v) || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const deathTotal = deaths.reduce((s, [, v]) => s + v, 0);
  const dead = data && [...SITE_KEYS, ...SNOW_KEYS].every((k) => !totals[k]);

  if (!data || dead) {
    return (
      <div className="metrics">
        <div className="metrics__dim">
          {!loaded ? METRICS.loading : dead ? METRICS.empty : METRICS.unconfigured}
        </div>
      </div>
    );
  }

  const stat = (k, label, n) => (
    <div className="metrics__stat" key={k}>
      <div className="metrics__num">{n.toLocaleString("en-US")}</div>
      <div className="metrics__label">{label}</div>
    </div>
  );

  return (
    <div className="metrics">
      <div className="metrics__title">
        {METRICS.title}
        <span className="metrics__window">{METRICS.window}</span>
      </div>
      <div className="metrics__stats">
        {SITE_KEYS.map((k) => stat(k, METRICS.stats[k], totals[k] ?? 0))}
      </div>
      <div className="metrics__title">{METRICS.snowboard.title}</div>
      <div className="metrics__stats">
        {SNOW_KEYS.map((k) => stat(k, METRICS.snowboard.stats[k], totals[k] ?? 0))}
        {deaths.map(([k, v]) =>
          stat(k, `${k} · ${Math.round((v / deathTotal) * 100)}%`, v),
        )}
      </div>
    </div>
  );
}
