/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signIn, signOut } from "next-auth/react";

const mockConfirm = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSuccess = jest.fn();
const mockError = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
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
  jest.mocked(signIn).mockResolvedValue(undefined);
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
    if (url === "/api/auth/providers/linked") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [{ provider: "google", displayName: "Google" }] }),
      } as Response);
    }
    if (url === "/api/auth/providers/link-intent") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ provider: "github", redirectTo: "/settings" }),
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

  it("shows a disconnect control for linked OAuth providers", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("Connected Accounts")).toBeInTheDocument();
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
  });

  it("disconnects a linked provider and flips it back to connectable", async () => {
    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/providers/google", {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
    });
    expect(
      await screen.findByRole("button", { name: /connect google/i })
    ).toBeInTheDocument();
  });

  it("labels OAuth sessions without showing placeholder device or IP", async () => {
    global.fetch = jest.fn((url: string | URL | Request) => {
      if (url === "/api/auth/sessions") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [{ ...currentSession, ip: "oauth", userAgent: "Auth.js OAuth" }],
          }),
        } as Response);
      }
      if (url === "/api/auth/providers/linked") {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({ aiPreferences: {} }) } as Response);
    }) as jest.Mock;

    render(<SettingsPage />);

    expect(await screen.findByText("OAuth sign-in")).toBeInTheDocument();
    expect(screen.queryByText("Auth.js OAuth")).not.toBeInTheDocument();
    expect(screen.queryByText(/^oauth ·/)).not.toBeInTheDocument();
  });

  it("starts provider linking for unlinked providers", async () => {
    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /connect github/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/providers/link-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ provider: "github" }),
      });
      expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/settings" });
    });
  });
});
