export default function TitleBar({ title, onMinimize, onMaximize, onClose }) {
  return (
    <div className="titlebar">
      <svg className="titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1" y="1" width="11" height="14" fill="#fff" stroke="#000" />
        <path d="M3 4h7M3 6.5h7M3 9h7M3 11.5h5" stroke="#316AC5" />
        <rect x="10" y="3" width="4" height="6" fill="#ffd735" stroke="#000" />
      </svg>
      <span className="titlebar__title">{title}</span>
      <div className="titlebar__btns">
        <button className="titlebar__btn" onClick={onMinimize} aria-label="Minimize">
          _
        </button>
        <button className="titlebar__btn" onClick={onMaximize} aria-label="Maximize">
          ▢
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
