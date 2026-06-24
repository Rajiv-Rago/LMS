/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import CoursePreview from "./CoursePreview";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock("@/components/course/ShareDialog", () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn((url: string | URL | Request) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString === "/api/courses/course-1") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          course: {
            _id: "course-1",
            title: "Generated Course",
            description: "Fresh generated description",
            instructor: { _id: "user-1", name: "Teacher" },
            enrolledCount: 0,
            accessLevel: "restricted",
            modules: [],
            aiPreferences: { defaultProvider: "openai" },
          },
          permissions: {
            canEdit: true,
            canEnroll: false,
            isEnrolled: false,
            isInstructor: true,
          },
        }),
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        modules: [
          {
            _id: "module-1",
            title: "Module 1",
            order: 0,
            lessons: [{ _id: "lesson-1", title: "Lesson 1", contentType: "text", order: 0 }],
          },
        ],
      }),
    } as Response);
  }) as jest.Mock;
});

describe("CoursePreview", () => {
  it("loads generated course data without using a stale browser cache", async () => {
    render(<CoursePreview courseId="course-1" />);

    await screen.findByText("Generated Course");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/courses/course-1", { cache: "no-store" });
      expect(global.fetch).toHaveBeenCalledWith("/api/courses/course-1/modules", { cache: "no-store" });
    });
  });
});
