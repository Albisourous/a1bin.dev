import { useMemo, useRef, useState } from "react";
import { SITE } from "./content/site.js";
import { buildDocument } from "./lib/document.js";
import Window from "./components/window/Window.jsx";
import Document from "./components/document/Document.jsx";
import Intertitle from "./components/Intertitle.jsx";
import Dialog from "./components/Dialog.jsx";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MENUS = [
  {
    label: "File",
    items: [
      { label: "New", shortcut: "Ctrl+N", disabled: true },
      "sep",
      { label: "Save As…", action: "save" },
      "sep",
      { label: "Exit", action: "exit" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Copy", shortcut: "Ctrl+C", action: "copy" },
      { label: "Select All", shortcut: "Ctrl+A", action: "selectAll" },
      "sep",
      { label: "Time/Date", shortcut: "F5", action: "timeDate" },
    ],
  },
  {
    label: "Format",
    items: [
      { label: "Word Wrap", check: "wordWrap", action: "toggleWrap" },
      { label: "Font…", disabled: true },
    ],
  },
  {
    label: "View",
    items: [{ label: "Status Bar", check: "statusBar", action: "toggleStatus" }],
  },
  {
    label: "Help",
    items: [{ label: "About Notepad", action: "about" }],
  },
];

export default function App() {
  const [booted, setBooted] = useState(reduced);
  const [closed, setClosed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [showStatus, setShowStatus] = useState(true);
  const [about, setAbout] = useState(false);
  const [pos, setPos] = useState({ ln: 1, col: 1 });
  const docRef = useRef(null);

  const lines = useMemo(() => buildDocument(), []);

  function save() {
    const blob = new Blob([docRef.current.text()], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = SITE.file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const actions = {
    save,
    exit: () => setClosed(true),
    copy: () => navigator.clipboard?.writeText(window.location.href),
    selectAll: () => docRef.current.selectAll(),
    timeDate: () => docRef.current.insertAtCaret(new Date().toLocaleString()),
    toggleWrap: () => setWordWrap((w) => !w),
    toggleStatus: () => setShowStatus((s) => !s),
    about: () => setAbout(true),
  };

  if (!booted) return <Intertitle onDone={() => setBooted(true)} />;

  return (
    <div className="desktop">
      <button
        className="desktop__icon"
        onDoubleClick={() => setClosed(false)}
        onKeyDown={(e) => e.key === "Enter" && setClosed(false)}
        aria-label={`${SITE.file.name} — double-click to open`}
      >
        <svg width="32" height="32" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="1" width="11" height="14" fill="#fff" stroke="#000" />
          <path d="M4 4h7M4 6.5h7M4 9h7M4 11.5h5" stroke="#316AC5" />
        </svg>
        {SITE.file.name}
      </button>

      {!closed && (
        <Window
          title={SITE.windowTitle}
          menus={MENUS}
          checks={{ wordWrap, statusBar: showStatus }}
          onAction={(a) => actions[a]?.()}
          onMinimize={() => setClosed(true)}
          onMaximize={() => setMaximized((m) => !m)}
          onClose={() => setClosed(true)}
          maximized={maximized}
          pos={pos}
          showStatus={showStatus}
        >
          <Document
            ref={docRef}
            lines={lines}
            wordWrap={wordWrap}
            onCaret={(ln, col) => setPos({ ln, col })}
          />
        </Window>
      )}

      {about && (
        <Dialog
          title="About Notepad"
          body={SITE.about.join("\n")}
          onClose={() => setAbout(false)}
        />
      )}
    </div>
  );
}
