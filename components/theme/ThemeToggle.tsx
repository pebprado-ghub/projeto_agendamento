"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="themeToggle"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <span className="themeToggleIcon" aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
      <span className="themeToggleLabel">
        {isDark ? "Claro" : "Escuro"}
      </span>
    </button>
  );
}
