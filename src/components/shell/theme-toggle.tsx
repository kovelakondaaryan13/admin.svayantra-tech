"use client";
import { useEffect, useState } from "react";

/** Light/dark theme toggle. Adds/removes `.light` on <html> + persists to localStorage.
 *  Dark is the default (:root tokens); light is the logo-matched theme. */
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.classList.contains("light")), []);

  function toggle() {
    const next = !light;
    document.documentElement.classList.toggle("light", next);
    try { localStorage.setItem("stos-theme", next ? "light" : "dark"); } catch {}
    setLight(next);
  }

  return (
    <button
      onClick={toggle}
      title={light ? "Switch to dark" : "Switch to light"}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="rounded-lg px-1.5 py-1 text-xs text-muted transition-colors hover:text-fg"
    >
      {light ? "🌙" : "☀️"}
    </button>
  );
}
