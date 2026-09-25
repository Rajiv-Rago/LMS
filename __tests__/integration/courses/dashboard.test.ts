/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockAddJobs = jest.fn();
jest.mock("@/lib/hooks/useJobPoller", () => ({
  useJobPoller: () => ({ addJobs: mockAddJobs, activeCount: 0 }),
}));

const mockConfirm = jest.fn();
jest.mock("@/lib/hooks/useConfirm", () => ({
  useConfirm: () => mockConfirm,
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
};
jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => mockToast,
}));

function mockFetchResponses(responses: Record<string, unknown>) {
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    for (const [pattern, data] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
        });
      }
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  }) as jest.Mock;
}

function mockFetchWithPost(
  getResponses: Record<string, unknown>,
  postResponse: { status: number; data: unknown }
) {
  global.fetch = jest.fn(
    (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (init?.method === "POST" && urlStr.includes("/api/courses/diagnostic")) {
        const body = JSON.parse((init?.body as string) ?? "{}");
        if (body.action === "questions") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                mcqs: [
                  { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0 },
                  { question: "Q2", options: ["a", "b", "c", "d"], correctIndex: 1 },
                  { question: "Q3", options: ["a", "b", "c", "d"], correctIndex: 2 },
                ],
                essayPrompt: "Explain X",
                round: 1,
                done: false,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              mcqScore: 66,
              essayDepthScore: 70,
              weakTopics: [],
              knowledgeProfile: "MCQ 66%",
              done: true,
              nextRound: null,
            }),
        });
      }

      if (init?.method === "POST") {
        return Promise.resolve({
          ok: postResponse.status >= 200 && postResponse.status < 300,
          status: postResponse.status,
          json: () => Promise.resolve(postResponse.data),
        });
      }

      for (const [pattern, data] of Object.entries(getResponses)) {
        if (urlStr.includes(pattern)) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(data),
          });
        }
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }
  ) as jest.Mock;
}

const emptyGetResponses = {
  "/api/courses/ai/my-courses": { courses: [] },
  "/api/courses?enrolled=true": { courses: [], pagination: {} },
};

const populatedGetResponses = {
  "/api/courses/ai/my-courses": {
    courses: [
      {
        _id: "gen-1",
        title: "Python Mastery",
        description: "Learn Python from scratch",
        modules: [{ lessons: [{}, {}] }],
      },
    ],
  },
  "/api/courses?enrolled=true": {
    courses: [
      {
        _id: "enr-1",
        title: "Web Dev 101",
        description: "Intro to web development",
        instructor: { name: "Jane" },
        modules: [{ lessons: [{}] }],
      },
    ],
    pagination: {},
  },
};

// Dynamic import to avoid issues with mock hoisting
let DashboardPage: React.ComponentType;

beforeAll(async () => {
  const mod = await import("@/app/(dashboard)/dashboard/page");
  DashboardPage = mod.default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DashboardPage", () => {
  describe("rendering", () => {
    it("renders generation input with placeholder text", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });
    });

    it("does not render skill level pills (removed)", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });
      expect(screen.queryByText("Beginner")).not.toBeInTheDocument();
      expect(screen.queryByText("Intermediate")).not.toBeInTheDocument();
      expect(screen.queryByText("Advanced")).not.toBeInTheDocument();
    });

    it("renders My Courses section and generated course cards", async () => {
      mockFetchResponses(populatedGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(screen.getByText("My Courses")).toBeInTheDocument();
      });
      expect(screen.getByText("Python Mastery")).toBeInTheDocument();
    });

    it("shows welcome message when no courses exist", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(screen.getByText(/start learning/i)).toBeInTheDocument();
      });
    });

    it("shows topic suggestion chips when no courses exist", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(screen.getByText("Python for Beginners")).toBeInTheDocument();
      });
    });

    it("does not render teacher-specific elements", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/total students/i)).not.toBeInTheDocument();
    });
  });

  describe("generation wiring", () => {
    it("opens the config modal on Generate without calling the API yet", async () => {
      mockFetchWithPost(emptyGetResponses, {
        status: 202,
        data: { jobId: "test-123" },
      });
      render(React.createElement(DashboardPage));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("What do you want to learn?"),
        { target: { value: "Python basics" } }
      );
      fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));

      await waitFor(() => {
        expect(screen.getByText("Configure your course")).toBeInTheDocument();
      });
      expect(global.fetch).not.toHaveBeenCalledWith(
        "/api/courses/generate",
        expect.anything()
      );
    });

    it("calls POST /api/courses/generate after config + skipped assessment", async () => {
      mockFetchWithPost(emptyGetResponses, {
        status: 202,
        data: { jobId: "test-123" },
      });
      render(React.createElement(DashboardPage));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("What do you want to learn?"),
        { target: { value: "Python basics" } }
      );
      fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));

      fireEvent.click(await screen.findByRole("button", { name: "Continue to assessment" }));
      fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/courses/generate",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("Python basics"),
          })
        );
      });

      const call = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) => url === "/api/courses/generate" && init?.method === "POST"
      );
      const payload = JSON.parse(call[1].body as string);
      expect(payload.complexity).toBe("standard");
      expect(payload.passingScore).toBe(70);
    });

    it("shows generating card after successful submission", async () => {
      mockFetchWithPost(emptyGetResponses, {
        status: 202,
        data: { jobId: "test-123" },
      });
      render(React.createElement(DashboardPage));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("What do you want to learn?")
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText("What do you want to learn?"),
        { target: { value: "Python basics" } }
      );
      fireEvent.click(screen.getByRole("button", { name: /^Generate$/ }));

      fireEvent.click(await screen.findByRole("button", { name: "Continue to assessment" }));
      fireEvent.click(await screen.findByRole("button", { name: "Skip" }));

      await waitFor(() => {
        expect(screen.getAllByText(/generating/i).length).toBeGreaterThan(0);
      });
    });

    it("shows limit message when limit reached", async () => {
      const limitResponses = {
        "/api/courses/ai/my-courses": {
          courses: Array.from({ length: 5 }, (_, i) => ({
            _id: `gen-${i}`,
            title: `Course ${i}`,
            description: "desc",
            modules: [],
          })),
        },
        "/api/courses?enrolled=true": { courses: [], pagination: {} },
      };
      mockFetchResponses(limitResponses);
      render(React.createElement(DashboardPage));

      await waitFor(() => {
        expect(screen.getByText(/limit/i)).toBeInTheDocument();
      });
    });
  });
});
