/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signOut } from "next-auth/react";

const mockConfirm = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSuccess = jest.fn();
const mockError = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

jest.mock("@/lib/hooks/useConfirm", () => ({
  useConfirm: () => mockConfirm,
}));

jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

jest.mock("@/components/ai/ModelSelector", () => ({
  ModelSelector: () => <div>Model selector</div>,
}));

import SettingsPage from "./page";

const currentSession = {
  id: "current",
  ip: "127.0.0.1",
  userAgent: "Current Browser",
  lastActiveAt: "2026-06-09T00:00:00.000Z",
  expiresAt: "2026-07-09T00:00:00.000Z",
  createdAt: "2026-06-09T00:00:00.000Z",
  isCurrent: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  jest.mocked(signOut).mockResolvedValue({ url: "/login" });
  global.fetch = jest.fn((url: string | URL | Request) => {
    if (url === "/api/users/preferences") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ aiPreferences: {} }),
      } as Response);
    }
    if (url === "/api/auth/sessions") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [currentSession] }),
      } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as jest.Mock;
});

describe("SettingsPage active sessions", () => {
  it("labels the current session", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Current Browser")).toBeInTheDocument();
    expect(screen.getByText("Current session")).toBeInTheDocument();
  });

  it("revokes all sessions and signs out the current browser", async () => {
    render(<SettingsPage />);

    await screen.findByText("Current Browser");
    fireEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/sessions", {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      expect(signOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});
