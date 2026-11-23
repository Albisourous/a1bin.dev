import { useRef, useState } from "react";
import { SITE } from "../content/site.js";

const current = () => document.documentElement.dataset.theme || "dark";

// Status-bar theme switch. Persists to localStorage; default dark.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(current);
  const fadeTimer = useRef(null);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.dataset.theme = next;
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(
      () => root.classList.remove("theme-transitioning"),
      500,
    );
    try {
      localStorage.setItem("a1-theme", next);
    } catch (e) {}
    setTheme(next);
  }

  return (
    <button className="statusbar__item statusbar__item--btn" onClick={toggle}>
      {SITE.theme.label}: {theme}
    </button>
  );
}
