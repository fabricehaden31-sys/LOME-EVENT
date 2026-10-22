"use client";

import { useEffect, type ReactNode } from "react";

export const THEME_KEY = "lome-events:theme";
export const THEME_EVENT = "lome-theme-change";

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const theme = savedTheme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, []);

  return children;
}