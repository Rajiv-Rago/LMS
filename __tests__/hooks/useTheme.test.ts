/**
 * @jest-environment jsdom
 */

import {
  getStoredTheme,
  setStoredTheme,
  resolveEffectiveTheme,
  type ThemeMode,
} from "@/lib/hooks/useTheme";

const CYCLE_ORDER: ThemeMode[] = ["light", "dark", "system"];

function nextMode(current: ThemeMode): ThemeMode {
  const i = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length];
}

let matchMediaDark: boolean;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? matchMediaDark : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

beforeEach(() => {
  localStorage.clear();
  matchMediaDark = false;
});

describe("getStoredTheme", () => {
  it("returns 'system' when localStorage has no theme key", () => {
    expect(getStoredTheme()).toBe("system");
  });

  it("returns 'dark' when localStorage has theme = dark", () => {
    localStorage.setItem("theme", "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("returns 'light' when localStorage has theme = light", () => {
    localStorage.setItem("theme", "light");
    expect(getStoredTheme()).toBe("light");
  });

  it("returns 'system' for any invalid localStorage value", () => {
    localStorage.setItem("theme", "purple");
    expect(getStoredTheme()).toBe("system");
  });
});

describe("setStoredTheme", () => {
  it("sets localStorage theme to 'dark' for dark mode", () => {
    setStoredTheme("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("sets localStorage theme to 'light' for light mode", () => {
    setStoredTheme("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("removes the theme key from localStorage for system mode", () => {
    localStorage.setItem("theme", "dark");
    setStoredTheme("system");
    expect(localStorage.getItem("theme")).toBeNull();
  });
});

describe("resolveEffectiveTheme", () => {
  it("returns true (isDark) for dark mode", () => {
    expect(resolveEffectiveTheme("dark")).toBe(true);
  });

  it("returns false for light mode", () => {
    expect(resolveEffectiveTheme("light")).toBe(false);
  });

  it("returns true for system mode when OS prefers dark", () => {
    matchMediaDark = true;
    expect(resolveEffectiveTheme("system")).toBe(true);
  });

  it("returns false for system mode when OS prefers light", () => {
    matchMediaDark = false;
    expect(resolveEffectiveTheme("system")).toBe(false);
  });
});

describe("cycling logic", () => {
  it("cycles light -> dark -> system -> light", () => {
    expect(nextMode("light")).toBe("dark");
    expect(nextMode("dark")).toBe("system");
    expect(nextMode("system")).toBe("light");
  });
});
