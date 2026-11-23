import { useEffect, useState } from "react";
import { loadScores } from "./scores.js";

// Live leaderboard — score and rider, nothing else. Rendered in place
// of the leaderboard file's text.
export default function Leaderboard() {
  const [scores, setScores] = useState(loadScores);

  // stay live — re-read when a run ends, or another tab writes
  useEffect(() => {
    const refresh = () => setScores(loadScores());
    window.addEventListener("snowboard:scores", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("snowboard:scores", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="board">
      <div className="board__title">leaderboard</div>
      {scores.length === 0 ? (
        <div className="board__dim">no runs yet — open snowboard/game.txt</div>
      ) : (
        <>
          <div className="board__row board__row--head">
            <span className="board__dist">score</span>
            <span className="board__who">rider</span>
          </div>
          {scores.map((r, i) => (
            <div key={i} className="board__row">
              <span className="board__dist">{r.d}m</span>
              <span className="board__who">{r.name ?? "rider"}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
