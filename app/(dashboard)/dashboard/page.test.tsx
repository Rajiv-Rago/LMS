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
      if (body.action === "questions") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            mcqs: [
              { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0 },
              { question: "Q2", options: ["a", "b", "c", "d"], correctIndex: 1 },
              { question: "Q3", options: ["a", "b", "c", "d"], correctIndex: 2 },
            ],
            essayPrompt: "Explain X",
            round: 1,
            done: false,
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          mcqScore: 66,
          essayDepthScore: 70,
          weakTopics: [],
          knowledgeProfile: "MCQ 66%",
          done: true,
          nextRound: null,
        }),
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
    fireEvent.click(await screen.findByRole("button", { name: "Continue to assessment" }));
    expect(await screen.findByText(/Quick knowledge check/)).toBeInTheDocument();

    // Start assessment, answer MCQs + essay, submit round -> triggers syllabus job
    fireEvent.click(screen.getByRole("button", { name: "Start assessment" }));
    expect(await screen.findByText(/Q1/)).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]);
    fireEvent.click(radios[5]);
    fireEvent.click(radios[10]);
    fireEvent.change(screen.getByPlaceholderText(/Explain in your own words/), {
      target: { value: "My explanation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit round" }));

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
  });
});
