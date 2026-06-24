/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewAICoursePage from "./page";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockDefaultModelValue = { tier: "balanced" };

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/components/ai/ModelSelector", () => ({
  ModelSelector: () => null,
}));

jest.mock("@/lib/hooks/useUserAIDefaults", () => ({
  useUserAIDefaults: () => ({
    loading: false,
    value: mockDefaultModelValue,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();

  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ user: { role: "admin" } }),
      } as Response);
    }

    if (urlString === "/api/courses/ai/syllabus") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ jobId: "job-1" }),
      } as Response);
    }

    if (urlString === "/api/jobs/job-1") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          job: { status: "completed", result: { courseId: "course-1" } },
        }),
      } as Response);
    }

    throw new Error(`Unexpected fetch ${urlString}`);
  }) as jest.Mock;
});

describe("NewAICoursePage", () => {
  it("refreshes route data before redirecting to the generated course", async () => {
    render(<NewAICoursePage />);

    fireEvent.change(await screen.findByLabelText("What do you want to learn?"), {
      target: { value: "Calculus" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Course Length"), {
      target: { value: "4 weeks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Course" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/courses/ai/syllabus",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/courses/course-1/overview");
    }, { timeout: 4000 });
  });
});
