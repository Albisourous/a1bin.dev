import { useEffect, useState } from "react";
import {
  cleanName,
  loadBest,
  loadScores,
  resetBoard,
  riderName,
  saveName,
} from "./scores.js";

// Live leaderboard — reads the top runs Snowboard.jsx writes through
// scores.js. Rendered in place of the leaderboard file's text.
const read = () => ({
  scores: loadScores(),
  best: loadBest(),
  name: riderName(),
});

export default function Leaderboard() {
  const [s, setS] = useState(read);
  const [draft, setDraft] = useState(s.name);
  const [bad, setBad] = useState(false);

  // stay live — re-read when a run ends, or another tab writes
  useEffect(() => {
    const refresh = () => setS(read());
    window.addEventListener("snowboard:scores", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("snowboard:scores", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const save = (v) => {
    setDraft(v);
    const n = cleanName(v);
    if (!n) {
      setBad(v.trim() !== "");
      return;
    }
    setBad(false);
    saveName(n);
  };

  return (
    <div className="board">
      <div className="board__title">leaderboard — your best rides</div>
      <label className="board__name">
        rider
        <input
          className="board__input"
          value={draft}
          onChange={(e) => save(e.target.value)}
          placeholder="name your runs"
          maxLength={16}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      {bad && <div className="board__dim">letters, digits, . _ - ' — keep it clean</div>}
      {s.scores.length === 0 ? (
        <div className="board__dim">no runs yet — open snowboard/game</div>
      ) : (
        s.scores.map((r, i) => (
          <div key={i} className="board__row">
            <span className="board__rank">{i + 1}.</span>
            <span className="board__dist">{r.d}m</span>
            <span className="board__who">{r.name ?? "rider"}</span>
            <span className="board__dim">{r.why}</span>
          </div>
        ))
      )}
      <div className="board__foot">
        best {s.best}m · scores stay in this browser — global board on the todo
        <button className="board__reset" onClick={resetBoard}>
          reset board
        </button>
      </div>
    </div>
  );
}
