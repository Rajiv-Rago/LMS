"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light" | "system";

const STORAGE_KEY = "theme";
const DARK_CLASS = "dark";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

export function getStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {}
  return "system";
}

export function setStoredTheme(mode: ThemeMode): void {
  try {
    if (mode === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {}
}

export function resolveEffectiveTheme(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia(DARK_MEDIA).matches;
}

export function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle(DARK_CLASS, isDark);
}

const CYCLE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return getStoredTheme();
  });

  useEffect(() => {
    applyTheme(resolveEffectiveTheme(mode));
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;

    const mql = window.matchMedia(DARK_MEDIA);
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  const cycle = useCallback(() => {
    const next = CYCLE[mode];
    setStoredTheme(next);
    applyTheme(resolveEffectiveTheme(next));
    setMode(next);
  }, [mode]);

  return { mode, cycle };
}
