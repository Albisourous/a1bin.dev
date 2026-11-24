import { SITE } from "../../content/site.js";

// macOS-style title bar: traffic lights, domain. Only the red dot is
// real — it "closes the window" (drops the IDE like a curtain).
export default function TitleBar({ onClose }) {
  return (
    <header className="titlebar">
      <div className="titlebar__lights">
        <button
          className="titlebar__dot titlebar__dot--close"
          onClick={onClose}
          aria-label="close window"
        />
        <span className="titlebar__dot titlebar__dot--min" aria-hidden="true" />
        <span className="titlebar__dot titlebar__dot--max" aria-hidden="true" />
      </div>
      <span className="titlebar__title">{SITE.domain}</span>
    </header>
  );
}
