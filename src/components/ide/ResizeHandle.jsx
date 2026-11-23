import { useRef, useState } from "react";

// Drag handle between workbench panels. Reports incremental px deltas
// along `axis` via onDrag; the parent clamps and stores the size.
export default function ResizeHandle({ name, axis = "x", onDrag, label }) {
  const last = useRef(null);
  const [drag, setDrag] = useState(false);

  const stop = () => {
    last.current = null;
    setDrag(false);
    document.body.classList.remove("is-resizing", "is-resizing-x", "is-resizing-y");
  };

  return (
    <div
      className={`divider divider--${name}${axis === "y" ? " divider--y" : ""}${
        drag ? " is-drag" : ""
      }`}
      role="separator"
      aria-orientation={axis === "y" ? "horizontal" : "vertical"}
      aria-label={label}
      onPointerDown={(e) => {
        last.current = axis === "y" ? e.clientY : e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        document.body.classList.add("is-resizing", `is-resizing-${axis}`);
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const pos = axis === "y" ? e.clientY : e.clientX;
        onDrag(pos - last.current);
        last.current = pos;
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}
