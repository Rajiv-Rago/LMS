/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signIn } from "next-auth/react";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
let searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => searchParams,
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

let LoginPage: React.ComponentType;

beforeAll(async () => {
  const mod = await import("./page");
  LoginPage = mod.default;
});

beforeEach(() => {
  searchParams = new URLSearchParams();
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "student@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginPage", () => {
  it("signs in with Auth.js credentials and routes to the dashboard by default", async () => {
    jest.mocked(signIn).mockResolvedValue({ ok: true, status: 200, error: null, url: null });

    render(React.createElement(LoginPage));
    fillAndSubmit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "student@example.com",
        password: "password123",
        redirect: false,
        redirectTo: "/dashboard",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("uses callbackUrl as the post-login destination", async () => {
    searchParams = new URLSearchParams({ callbackUrl: "/courses/abc" });
    jest.mocked(signIn).mockResolvedValue({ ok: true, status: 200, error: null, url: null });

    render(React.createElement(LoginPage));
    fillAndSubmit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirectTo: "/courses/abc" })
      );
      expect(mockPush).toHaveBeenCalledWith("/courses/abc");
    });
  });

  it("keeps supporting redirect as a legacy destination alias", async () => {
    searchParams = new URLSearchParams({ redirect: "/profile" });
    jest.mocked(signIn).mockResolvedValue({ ok: true, status: 200, error: null, url: null });

    render(React.createElement(LoginPage));
    fillAndSubmit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirectTo: "/profile" })
      );
      expect(mockPush).toHaveBeenCalledWith("/profile");
    });
  });

  it("shows a generic error for failed credentials", async () => {
    // Auth.js v5 reports credential failures with ok:true and error set.
    jest.mocked(signIn).mockResolvedValue({
      ok: true,
      status: 200,
      error: "CredentialsSignin",
      url: null,
    });

    render(React.createElement(LoginPage));
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("shows a generic OAuth conflict error", () => {
    searchParams = new URLSearchParams({ error: "AccessDenied" });

    render(React.createElement(LoginPage));

    expect(
      screen.getByText(/We couldn't sign you in with that provider/)
    ).toBeInTheDocument();
  });

  it("preserves the enrollment flow after Auth.js sign-in", async () => {
    searchParams = new URLSearchParams({ enroll: "course-123" });
    jest.mocked(signIn).mockResolvedValue({ ok: true, status: 200, error: null, url: null });
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Enrolled successfully" }),
    } as Response);

    render(React.createElement(LoginPage));
    fillAndSubmit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirectTo: "/courses/course-123" })
      );
      expect(global.fetch).toHaveBeenCalledWith("/api/courses/course-123/enroll", {
        method: "POST",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      expect(mockPush).toHaveBeenCalledWith("/courses/course-123");
    });
  });

  it("starts OAuth sign-in with the safe post-login destination", async () => {
    searchParams = new URLSearchParams({ callbackUrl: "/settings" });

    render(React.createElement(LoginPage));
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google", {
      redirectTo: "/settings",
    });
  });

  it("uses the enrollment course as the OAuth destination", async () => {
    searchParams = new URLSearchParams({ enroll: "course-123" });

    render(React.createElement(LoginPage));
    fireEvent.click(screen.getByRole("button", { name: /continue with github/i }));

    expect(signIn).toHaveBeenCalledWith("github", {
      redirectTo: "/courses/course-123",
    });
  });
});
