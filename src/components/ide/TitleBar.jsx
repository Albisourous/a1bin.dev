import { SITE } from "../../content/site.js";

// macOS-style title bar: traffic lights, domain.
export default function TitleBar() {
  return (
    <header className="titlebar">
      <div className="titlebar__lights" aria-hidden="true">
        <span className="titlebar__dot titlebar__dot--close" />
        <span className="titlebar__dot titlebar__dot--min" />
        <span className="titlebar__dot titlebar__dot--max" />
      </div>
      <span className="titlebar__title">{SITE.domain}</span>
    </header>
  );
}
