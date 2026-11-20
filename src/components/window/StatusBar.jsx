export default function StatusBar({ ln, col }) {
  return (
    <div className="statusbar">
      <div className="statusbar__field statusbar__field--main" />
      <div className="statusbar__field statusbar__field--pos">
        Ln {ln}, Col {col}
      </div>
      <div className="statusbar__grip" aria-hidden="true" />
    </div>
  );
}
