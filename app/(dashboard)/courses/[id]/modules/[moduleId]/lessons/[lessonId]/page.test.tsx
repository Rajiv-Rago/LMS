/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import LessonDetailPage from "./page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    use: (value: unknown) => value,
  };
});

jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

jest.mock("@/components/ui/MarkdownContent", () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

jest.mock("@/components/lesson/YouTubeVideoPicker", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/lesson/FeedbackSection", () => ({
  __esModule: true,
  default: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  let lessonFetches = 0;

  global.fetch = jest.fn((url: string | URL | Request, init?: RequestInit) => {
    const urlString = typeof url === "string" ? url : url.toString();

    if (urlString === "/api/courses/course-1/modules/module-1/lessons/lesson-1") {
      lessonFetches += 1;
      const lesson =
        lessonFetches === 1
          ? {
              _id: "lesson-1",
              title: "Limits",
              contentType: "text",
              content: "",
              isPublished: true,
              generationStatus: "skeleton",
              lessonOutline: "Explain limits",
            }
          : {
              _id: "lesson-1",
              title: "Limits",
              contentType: "text",
              content: "Generated body",
              isPublished: true,
              generationStatus: "completed",
              lessonOutline: "Explain limits",
            };

      return Promise.resolve({
        ok: true,
        json: async () => ({
          lesson,
          permissions: { canEdit: true, isSharedWith: false },
          isOwnedCourse: true,
        }),
      } as Response);
    }

    if (urlString === "/api/courses/course-1/modules") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          modules: [
            {
              _id: "module-1",
              title: "Module 1",
              lessons: [{ _id: "lesson-1", title: "Limits" }],
            },
          ],
        }),
      } as Response);
    }

    if (urlString === "/api/ai/credits") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ remaining: 10 }),
      } as Response);
    }

    if (
      urlString === "/api/courses/ai/course-1/lessons/lesson-1/generate" &&
      init?.method === "POST"
    ) {
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "X-RateLimit-Remaining": "9",
            },
          }
        )
      );
    }

    throw new Error(`Unexpected fetch ${urlString}`);
  }) as jest.Mock;
});

describe("LessonDetailPage", () => {
  it("refreshes the lesson when a successful generation stream closes without a done event", async () => {
    render(
      <LessonDetailPage
        params={{
          id: "course-1",
          moduleId: "module-1",
          lessonId: "lesson-1",
        } as unknown as Promise<{ id: string; moduleId: string; lessonId: string }>}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/courses/ai/course-1/lessons/lesson-1/generate",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("Generated body")).toBeInTheDocument();
  });
});
