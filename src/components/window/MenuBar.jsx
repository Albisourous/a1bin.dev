import { useEffect, useRef, useState } from "react";

// Menu model: { label, items: [{ label, shortcut?, action, check?, disabled? } | "sep"] }
export default function MenuBar({ menus, checks, onAction }) {
  const [open, setOpen] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    if (open == null) return;
    const close = (e) => {
      if (!barRef.current?.contains(e.target)) setOpen(null);
    };
    const esc = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const activate = (i) => setOpen((cur) => (cur === i ? null : i));

  return (
    <div className="menubar" ref={barRef} role="menubar">
      {menus.map((menu, i) => (
        <div key={menu.label}>
          <button
            className={`menubar__item${open === i ? " menubar__item--open" : ""}`}
            onClick={() => activate(i)}
            onMouseEnter={() => open != null && setOpen(i)}
            aria-expanded={open === i}
            aria-haspopup="menu"
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="menu" role="menu">
              {menu.items.map((item, j) =>
                item === "sep" ? (
                  <div className="menu__sep" key={j} />
                ) : (
                  <button
                    className="menu__item"
                    key={item.label}
                    disabled={item.disabled}
                    role="menuitem"
                    onClick={() => {
                      setOpen(null);
                      onAction(item.action);
                    }}
                  >
                    <span>
                      {item.check && (
                        <span className="menu__check">
                          {checks[item.check] ? "✓" : ""}
                        </span>
                      )}
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <span className="menu__shortcut">{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
