/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
let jobStatus = "pending";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/lib/hooks/useConfirm", () => ({
  useConfirm: () => jest.fn(),
}));

jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jobStatus = "pending";

  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString === "/api/courses/ai/my-courses") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ courses: [] }),
      } as Response);
    }

    if (urlString === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ user: { role: "admin", subscriptionTier: "admin" } }),
      } as Response);
    }

    if (urlString === "/api/courses/generate") {
      jobStatus = "completed";
      return Promise.resolve({
        ok: true,
        status: 202,
        json: async () => ({ jobId: "job-1" }),
      } as Response);
    }

    if (urlString === "/api/jobs/job-1") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          job: { status: jobStatus, result: { courseId: "course-1" } },
        }),
      } as Response);
    }

    throw new Error(`Unexpected fetch ${urlString}`);
  }) as jest.Mock;
});

describe("DashboardPage", () => {
  it("refreshes route data before opening a generated course", async () => {
    render(<DashboardPage />);

    const input = await screen.findByPlaceholderText("What do you want to learn?");
    fireEvent.change(input, { target: { value: "Linear Algebra" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/courses/course-1/overview");
    });
  });
});
