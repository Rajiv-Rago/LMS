/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

    it("renders skill level pills", async () => {
      mockFetchResponses(emptyGetResponses);
      render(React.createElement(DashboardPage));
      await waitFor(() => {
        expect(screen.getByText("Beginner")).toBeInTheDocument();
        expect(screen.getByText("Intermediate")).toBeInTheDocument();
        expect(screen.getByText("Advanced")).toBeInTheDocument();
      });
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
    it("calls POST /api/courses/generate on form submit", async () => {
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
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/courses/generate",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("Python basics"),
          })
        );
      });
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

      await waitFor(() => {
        expect(screen.getByText(/generating/i)).toBeInTheDocument();
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
