import StringLine from "./StringLine.jsx";

// The file itself: noise lines with readable strings spliced in.
export default function Document({ lines }) {
  return (
    <div
      className="document"
      role="document"
      aria-label="a1.bin — corrupted binary, printable strings"
    >
      {lines.map((l, i) => {
        if (l.type === "noise")
          return (
            <div className="document__line" key={i} aria-hidden="true">
              {l.text}
            </div>
          );
        if (l.type === "marker")
          return (
            <div className="document__line" key={i}>
              <span className="document__marker">{l.text}</span>
              {i === lines.length - 1 && <span className="caret" aria-hidden="true" />}
            </div>
          );
        return (
          <div className="document__line" key={i}>
            {l.padBefore}
            <StringLine string={l.string} />
            {l.padAfter}
          </div>
        );
      })}
    </div>
  );
}
