export default function Dialog({ title, body, onClose }) {
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog__title">
          <span>{title}</span>
          <button className="titlebar__btn titlebar__btn--close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="dialog__body">{body}</div>
        <button className="dialog__ok" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}
