import { useEffect, useState } from "react";
import { AB_COPY, EXPERIMENTS } from "../../content/experiments.js";
import { variantFor } from "../../lib/ab.js";
import { fetchMetrics } from "../../lib/metrics.js";

// Public experiment log — what's live, what concluded, and which
// variant this browser drew (deterministic via variantFor). Live
// experiments also show real assignment counts from /api/metrics.
export default function AB() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    fetchMetrics().then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);
  const counts = data?.experiments ?? {};
  return (
    <div className="ab">
      <div className="ab__title">{AB_COPY.title}</div>
      <p className="ab__blurb">{AB_COPY.blurb}</p>
      {EXPERIMENTS.map((e, i) => (
        <Experiment key={e.id} e={e} n={i + 1} counts={counts[e.id]} />
      ))}
      <div className="ab__foot">{AB_COPY.footnote}</div>
    </div>
  );
}

function Experiment({ e, n, counts }) {
  const you = variantFor(e); // live only — null for concluded/idea
  const won = e.winner;
  // real draws, when the api has them — the split widens toward the
  // arm more visitors landed in
  const tally = e.variants.map((v) => Number(counts?.[v.key] ?? 0));
  const total = tally.reduce((a, b) => a + b, 0);
  return (
    <section className={`ab__exp ab__exp--${e.status}`}>
      <div className="ab__head">
        <span className="ab__num">{String(n).padStart(2, "0")}</span>
        <span className="ab__name">{e.name}</span>
        <span className={`ab__status ab__status--${e.status}`}>
          {AB_COPY.marks[e.status]} {AB_COPY.statuses[e.status]}
        </span>
      </div>
      <div className="ab__q">{e.question}</div>
      <div className="ab__split">
        {e.variants.map((v, vi) => {
          const isYou = you?.key === v.key;
          const isWin = won === v.key;
          const cls = [
            "ab__arm",
            isYou ? "is-you" : "",
            isWin ? "is-win" : "",
            won && !isWin ? "is-loss" : "",
          ].join(" ");
          return (
            <div
              key={v.key}
              className={cls}
              style={{ flexGrow: Math.max(tally[vi], 1) }}
            >
              <div className="ab__arm-top">
                <span className="ab__key">{v.key}</span>
                <span className="ab__label">{v.label}</span>
                {total > 0 && <span className="ab__n">{tally[vi]}</span>}
                {(isYou || isWin) && (
                  <span className="ab__tag">
                    {isWin ? AB_COPY.winnerLabel : AB_COPY.youLabel}
                  </span>
                )}
              </div>
              <div className="ab__note">{v.note}</div>
            </div>
          );
        })}
      </div>
      <div className="ab__meta">
        <span>
          {AB_COPY.metricLabel}: {e.metric}
        </span>
        {total > 0 && <span>n = {total}</span>}
        {you && (
          <span className="ab__you">
            {AB_COPY.youLabel}: {you.key} — {you.label}
          </span>
        )}
        {won && <span>→ {e.note}</span>}
      </div>
    </section>
  );
}
