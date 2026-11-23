import { useEffect, useState } from "react";
import { fetchMetrics } from "../../lib/metrics.js";
import { METRICS } from "../../content/metrics.js";

const STAT_KEYS = ["visits", "chats", "runs", "term", "resume"];
const SERIES_KEYS = ["visits", "chats", "runs", "term", "resume"];

// Live traffic dashboard — big numbers, then a sparkline per metric.
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
  const days = data?.days ?? [];
  const dead = data && SERIES_KEYS.every((k) => !totals[k]);

  if (!data || dead) {
    return (
      <div className="metrics">
        <div className="metrics__dim">
          {!loaded ? METRICS.loading : dead ? METRICS.empty : METRICS.unconfigured}
        </div>
      </div>
    );
  }

  return (
    <div className="metrics">
      <div className="metrics__title">
        {METRICS.title}
        <span className="metrics__window">{METRICS.window}</span>
      </div>
      <div className="metrics__stats">
        {STAT_KEYS.map((k) => (
          <div className="metrics__stat" key={k}>
            <div className="metrics__num">
              {(totals[k] ?? 0).toLocaleString("en-US")}
            </div>
            <div className="metrics__label">{METRICS.stats[k]}</div>
          </div>
        ))}
      </div>
      <div className="metrics__rows">
        {SERIES_KEYS.map((k) => {
          const max = Math.max(...days.map((d) => d[k] ?? 0));
          return (
            <div className="metrics__series" key={k}>
              <span className="metrics__name">{METRICS.series[k]}</span>
              <div className="metrics__grid">
                {days.map((d, i) => {
                  const v = d[k] ?? 0;
                  const lvl = max ? v / max : 0;
                  return (
                    <span
                      key={d.d}
                      className={`metrics__cell${
                        i === days.length - 1 ? " is-today" : ""
                      }`}
                      style={
                        v
                          ? {
                              background: "var(--accent)",
                              opacity: 0.25 + lvl * 0.75,
                            }
                          : undefined
                      }
                      title={`${d.d} — ${v}`}
                    />
                  );
                })}
              </div>
              <span className="metrics__count">{days.at(-1)?.[k] ?? 0}</span>
            </div>
          );
        })}
        <div className="metrics__axis">
          <span className="metrics__name" aria-hidden="true" />
          <div className="metrics__axis-track">
            <span>{METRICS.axisStart}</span>
            <span>{METRICS.axisNote}</span>
            <span>{METRICS.axisEnd}</span>
          </div>
          <span className="metrics__count" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
