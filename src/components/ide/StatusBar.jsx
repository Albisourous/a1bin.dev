import { SITE } from "../../content/site.js";
import ThemeToggle from "../ThemeToggle.jsx";

const stroke = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
};

const ICONS = {
  chat: (
    <svg {...stroke} aria-hidden="true">
      <path d="M13.5 2.5h-11a1 1 0 0 0-1 1v10l3-3h9a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z" />
    </svg>
  ),
  terminal: (
    <svg {...stroke} aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="10" rx="1" />
      <path d="M4.5 6.5l2 2-2 2M8 10.5h3.5" />
    </svg>
  ),
};

// IDE status bar: branch left, file stats + theme toggle right.
export default function StatusBar({
  chatActive,
  onToggleChat,
  termActive,
  onToggleTerm,
}) {
  return (
    <footer className="statusbar">
      <span className="statusbar__item">⎇ main</span>
      <span className="statusbar__spacer" />
      <button
        className={`statusbar__item statusbar__item--btn${
          chatActive ? "" : " is-off"
        }`}
        onClick={onToggleChat}
        aria-label={SITE.chatTitle}
        title={SITE.chatTitle}
      >
        {ICONS.chat}
      </button>
      <button
        className={`statusbar__item statusbar__item--btn${
          termActive ? "" : " is-off"
        }`}
        onClick={onToggleTerm}
        aria-label={SITE.termTitle}
        title={SITE.termTitle}
      >
        {ICONS.terminal}
      </button>
      <span className="statusbar__item">LF</span>
      <span className="statusbar__item">UTF-8</span>
      <ThemeToggle />
    </footer>
  );
}
