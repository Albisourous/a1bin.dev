const MENUS = ["File", "Edit", "Format", "View", "Help"];

// Pure chrome — Notepad window frame, no behavior.
export default function Window({ title, children }) {
  return (
    <div className="window">
      <div className="titlebar">
        <svg className="titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="1" width="11" height="14" fill="#fff" stroke="#000" />
          <path d="M3 4h7M3 6.5h7M3 9h7M3 11.5h5" stroke="#316AC5" />
          <rect x="10" y="3" width="4" height="6" fill="#ffd735" stroke="#000" />
        </svg>
        <span className="titlebar__title">{title}</span>
        <div className="titlebar__btns" aria-hidden="true">
          <span className="titlebar__btn">_</span>
          <span className="titlebar__btn">▢</span>
          <span className="titlebar__btn titlebar__btn--close">✕</span>
        </div>
      </div>
      <div className="menubar">
        {MENUS.map((m) => (
          <span className="menubar__item" key={m}>
            {m}
          </span>
        ))}
      </div>
      {children}
      <div className="statusbar">
        <div className="statusbar__field statusbar__field--main" />
        <div className="statusbar__field statusbar__field--pos">Ln 1, Col 1</div>
        <div className="statusbar__grip" aria-hidden="true" />
      </div>
    </div>
  );
}
