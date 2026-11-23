import { SITE } from "../../content/site.js";
import { ICONS } from "./icons.jsx";

export default function ActivityBar({
  explorerActive,
  onOpenExplorer,
  graphActive,
  onOpenGraph,
  metricsActive,
  onOpenMetrics,
  abActive,
  onOpenAb,
}) {
  return (
    <div className="activitybar" role="toolbar" aria-label="activity bar">
      <button
        className={`activitybar__btn${explorerActive ? " is-active" : ""}`}
        onClick={onOpenExplorer}
        aria-label="explorer"
        title="explorer"
      >
        {ICONS.explorer}
      </button>
      <button
        className={`activitybar__btn${graphActive ? " is-active" : ""}`}
        onClick={onOpenGraph}
        aria-label={SITE.graphTab.toLowerCase()}
        title={SITE.graphTab.toLowerCase()}
      >
        {ICONS.graph}
      </button>
      <button
        className={`activitybar__btn${metricsActive ? " is-active" : ""}`}
        onClick={onOpenMetrics}
        aria-label={SITE.metricsTab}
        title={SITE.metricsTab}
      >
        {ICONS.metrics}
      </button>
      <button
        className={`activitybar__btn${abActive ? " is-active" : ""}`}
        onClick={onOpenAb}
        aria-label={SITE.abTab}
        title={SITE.abTab}
      >
        {ICONS.ab}
      </button>
      <div className="activitybar__spacer" />
      {SITE.socials.map((s) => (
        <a
          key={s.name}
          className="activitybar__btn"
          href={s.url}
          target="_blank"
          rel="noreferrer"
          aria-label={s.name}
          title={s.name}
        >
          {ICONS[s.icon]}
        </a>
      ))}
    </div>
  );
}
