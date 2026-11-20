import { useMemo, useState } from "react";
import { SITE } from "./content/site.js";
import { buildDocument } from "./lib/document.js";
import Window from "./components/window/Window.jsx";
import Document from "./components/document/Document.jsx";
import Intertitle from "./components/Intertitle.jsx";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [booted, setBooted] = useState(reduced);
  const lines = useMemo(() => buildDocument(), []);

  if (!booted) return <Intertitle onDone={() => setBooted(true)} />;

  return (
    <div className="desktop">
      <Window title={SITE.windowTitle}>
        <Document lines={lines} />
      </Window>
    </div>
  );
}
