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
  useSearchParams: () => new URLSearchParams(),
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

  global.fetch = jest.fn((url: string | URL | Request, init?: RequestInit) => {
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

    if (urlString === "/api/courses/diagnostic") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      const profile = {
        goals: ["Use matrices in graphics"], startingLevel: "beginner", selfReportedLevel: "unsure",
        observedStrengths: [], observedGaps: ["Matrices"], assumptions: ["Rough estimate"], assessmentSkipped: false,
      };
      const data = body.action === "start"
        ? { phase: "goals", token: "goals-token", round: 1, goalOptions: ["Use matrices in graphics", "Give me a broad introduction / help me choose"] }
        : body.action === "goals"
          ? { phase: "knowledge", token: "knowledge-token", round: 2, maxRounds: 3, questions: [
            { question: "Q1", options: ["a", "b", "c", "d"] },
            { question: "Q2", options: ["a", "b", "c", "d"] },
            { question: "Q3", options: ["a", "b", "c", "d"] },
          ] }
          : { phase: "summary", round: 2, profile };
      return Promise.resolve({ ok: true, json: async () => data } as Response);
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
  it("opens the config modal on Generate instead of generating immediately", async () => {
    render(<DashboardPage />);

    const input = await screen.findByPlaceholderText("What do you want to learn?");
    fireEvent.change(input, { target: { value: "Linear Algebra" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByText("Configure your course")).toBeInTheDocument();
    expect(screen.queryByText(/Generating your course/)).not.toBeInTheDocument();
  });

  it("runs config -> assessment -> generate pipeline", async () => {
    render(<DashboardPage />);

    const input = await screen.findByPlaceholderText("What do you want to learn?");
    fireEvent.change(input, { target: { value: "Linear Algebra" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    // Modal defaults to Standard complexity; continue to assessment
    fireEvent.click(await screen.findByRole("button", { name: "Continue to course planning" }));
    expect(await screen.findByText(/Plan your course:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Plan my course" }));
    fireEvent.click(await screen.findByLabelText("Use matrices in graphics"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to knowledge check" }));
    expect(await screen.findByText(/Q1/)).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]);
    fireEvent.click(radios[6]);
    fireEvent.click(radios[12]);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Review your course plan")).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url === "/api/courses/generate")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Generate course" }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/courses/course-1/overview");
    });

    // Payload carries new fields (complexity, passingScore)
    const generateCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/courses/generate"
    );
    expect(generateCall).toBeDefined();
    const payload = JSON.parse(generateCall[1].body as string);
    expect(payload.complexity).toBe("standard");
    expect(payload.passingScore).toBe(70);
    expect(payload.topic).toBe("Linear Algebra");
    expect(payload.learnerProfile.goals).toEqual(["Use matrices in graphics"]);
    expect(payload.learnerProfile.startingLevel).toBe("beginner");
  });
});
