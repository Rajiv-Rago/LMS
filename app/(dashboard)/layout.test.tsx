/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signOut } from "next-auth/react";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

jest.mock("@/components/ui/NotificationBell", () => ({
  NotificationBell: () => <div />,
}));

jest.mock("@/components/ui/ThemeToggle", () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock("@/components/ui/BottomNav", () => ({
  __esModule: true,
  default: () => <div />,
}));

let DashboardLayout: React.ComponentType<{ children: React.ReactNode }>;

beforeAll(async () => {
  const mod = await import("./layout");
  DashboardLayout = mod.default;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(signOut).mockResolvedValue({ url: "/login" });
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "user-1",
            name: "Student User",
            email: "student@example.com",
            role: "student",
          },
        }),
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ message: "Logged out successfully" }),
    } as Response);
  }) as jest.Mock;
});

describe("DashboardLayout", () => {
  it("clears the Auth.js session on logout", async () => {
    render(
      <DashboardLayout>
        <div>Dashboard content</div>
      </DashboardLayout>
    );

    await screen.findByText("Student User");
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({
        redirect: false,
        redirectTo: "/login",
      });
      expect(mockPush).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
