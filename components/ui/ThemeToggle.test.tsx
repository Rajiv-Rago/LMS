/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, act } from "@testing-library/react";
import ThemeToggle from "./ThemeToggle";
let mockDark = false;
let mockChange: ((event: { matches: boolean }) => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  mockDark = false;
  mockChange = undefined;
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: mockDark,
    addEventListener: (_: string, handler: typeof mockChange) => { mockChange = handler; },
    removeEventListener: jest.fn(),
  }));
});
it("switches repeatedly between light and dark without selecting system", () => {
  render(<ThemeToggle />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(localStorage.getItem("theme")).toBe("dark");
  expect(document.documentElement).toHaveClass("dark");
  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(localStorage.getItem("theme")).toBe("light");
  expect(document.documentElement).not.toHaveClass("dark");
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  expect(localStorage.getItem("theme")).toBe("dark");
});
it("starts from the effective system theme and switches to its opposite", () => {
  mockDark = true;
  render(<ThemeToggle />);
  expect(localStorage.getItem("theme")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
  expect(localStorage.getItem("theme")).toBe("light");
});
it("follows system changes until the user chooses a theme", () => {
  render(<ThemeToggle />);
  act(() => { mockDark = true; mockChange?.({ matches: true }); });
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  expect(document.documentElement).toHaveClass("dark");
  expect(localStorage.getItem("theme")).toBeNull();
});
