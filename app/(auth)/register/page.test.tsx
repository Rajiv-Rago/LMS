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

import RegisterPage from "./page";

beforeEach(() => {
  jest.clearAllMocks();
  searchParams = new URLSearchParams();
  jest.mocked(signIn).mockResolvedValue({
    ok: true,
    status: 200,
    error: null,
    url: null,
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: "Registration successful" }),
  });
});

function submitRegistration() {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: "New User" },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "new@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: "password123" },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  it("signs the new user in through Auth.js before redirecting", async () => {
    render(<RegisterPage />);
    submitRegistration();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "new@example.com",
        password: "password123",
        redirect: false,
        redirectTo: "/dashboard",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("starts OAuth sign-in from registration", () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }));

    expect(signIn).toHaveBeenCalledWith("facebook", {
      redirectTo: "/dashboard",
    });
  });

  it("preserves enrollment destination for OAuth registration", () => {
    searchParams = new URLSearchParams({ enroll: "course-123" });

    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google", {
      redirectTo: "/courses/course-123",
    });
  });
});
