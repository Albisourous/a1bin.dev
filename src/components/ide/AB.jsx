import { AB_COPY, EXPERIMENTS } from "../../content/experiments.js";
import { variantFor } from "../../lib/ab.js";

// Public experiment log — the questions on the table and, where this
// browser has been dealt in, which arm it drew (deterministic via
// variantFor). No status claims: we don't say a test is running.
export default function AB() {
  return (
    <div className="ab">
      <div className="ab__title">{AB_COPY.title}</div>
      <p className="ab__blurb">{AB_COPY.blurb}</p>
      {EXPERIMENTS.map((e, i) => (
        <Experiment key={e.id} e={e} n={i + 1} />
      ))}
      <div className="ab__foot">{AB_COPY.footnote}</div>
    </div>
  );
}

function Experiment({ e, n }) {
  const you = variantFor(e); // dealt-in experiments only
  const won = e.winner;
  return (
    <section className={`ab__exp ab__exp--${e.status}`}>
      <div className="ab__head">
        <span className="ab__num">{String(n).padStart(2, "0")}</span>
        <span className="ab__name">{e.name}</span>
      </div>
      <div className="ab__q">{e.question}</div>
      <div className="ab__split">
        {e.variants.map((v) => {
          const isYou = you?.key === v.key;
          const isWin = won === v.key;
          const cls = [
            "ab__arm",
            isYou ? "is-you" : "",
            isWin ? "is-win" : "",
            won && !isWin ? "is-loss" : "",
          ].join(" ");
          return (
            <div key={v.key} className={cls}>
              <div className="ab__arm-top">
                <span className="ab__key">{v.key}</span>
                <span className="ab__label">{v.label}</span>
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
