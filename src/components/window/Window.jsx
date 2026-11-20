import TitleBar from "./TitleBar.jsx";
import MenuBar from "./MenuBar.jsx";
import StatusBar from "./StatusBar.jsx";

export default function Window({
  title,
  menus,
  checks,
  onAction,
  onMinimize,
  onMaximize,
  onClose,
  maximized,
  pos,
  showStatus,
  children,
}) {
  return (
    <div className={`window${maximized ? " window--max" : ""}`}>
      <TitleBar
        title={title}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />
      <MenuBar menus={menus} checks={checks} onAction={onAction} />
      {children}
      {showStatus && <StatusBar ln={pos.ln} col={pos.col} />}
    </div>
  );
}
