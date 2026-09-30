/**
 * @jest-environment jsdom
 */

import React from "react";
import { TextDecoder } from "node:util";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LessonDetailPage from "./page";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock("next/navigation", () => ({
  usePathname: () => "/courses/course-1/modules/module-1/lessons/lesson-1",
  useRouter: () => mockRouter,
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
  default: ({ onSelect }: { onSelect: (video: unknown) => void }) => <button onClick={() => onSelect({ videoId: "video", title: "Video lesson", channelName: "Channel", channelId: "channel", thumbnailUrl: "https://example.com/image", duration: "PT5M" })}>Select video</button>,
}));

beforeEach(() => {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
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
      return Promise.resolve({
        ok: true, status: 200, headers: { get: () => "9" },
        body: { getReader: () => ({ read: async () => ({ done: true }) }) },
      } as unknown as Response);
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

describe("lesson actions and resource refresh", () => {
  const params = { id: "course-1", moduleId: "module-1", lessonId: "lesson-1" } as unknown as Promise<{ id: string; moduleId: string; lessonId: string }>;
  let currentLesson: Record<string, unknown>;
  let permissions: { canEdit: boolean; isSharedWith: boolean };
  let resourceFailure: boolean;
  const jsonResponse = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data, headers: { get: () => null } });
  beforeEach(() => {
    global.TextDecoder = TextDecoder as typeof global.TextDecoder;
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    currentLesson = { _id: "lesson-1", title: "Limits", contentType: "text", content: "Original body", isPublished: true, generationStatus: "completed", sources: [{ title: "Citation", url: "https://example.com/citation" }], learningResources: [{ title: "Practice", url: "https://example.com/practice", description: "Practice limits.", type: "exercise", requiresSignup: false }] };
    permissions = { canEdit: true, isSharedWith: false };
    resourceFailure = false;
    global.fetch = jest.fn(async (url, init) => {
      if (url === "/api/ai/credits") return jsonResponse({ remaining: 10 });
      if (url === "/api/courses/course-1/modules") return jsonResponse({ modules: [] });
      if (String(url).endsWith("/generate")) {
        currentLesson = { ...currentLesson, content: "Updated body" };
        let delivered = false;
        return { ...jsonResponse({}), headers: { get: () => "9" }, body: { getReader: () => ({ read: async () => {
          if (delivered) return { done: true };
          delivered = true;
          return { done: false, value: new Uint8Array(Buffer.from('event: done\ndata: {}\n\n')) };
        } }) } };
      }
      if (String(url).endsWith("/revert")) {
        currentLesson = { ...currentLesson, content: "Original body" };
        return jsonResponse({});
      }
      if (String(url).endsWith("/resources")) return jsonResponse(resourceFailure ? { error: "Search unavailable" } : { learningResources: [] }, resourceFailure ? 503 : 200);
      if (init?.method === "PATCH") currentLesson = { ...currentLesson, ...JSON.parse(String(init.body)) };
      return jsonResponse({ lesson: currentLesson, permissions, isOwnedCourse: true });
    }) as jest.Mock;
  });
  it("offers feedback to shared users while reserving replacement for editors", async () => {
    permissions = { canEdit: false, isSharedWith: true };
    render(<LessonDetailPage params={params} />);
    fireEvent.click(await screen.findByRole("button", { name: "Lesson actions" }));
    expect(screen.getByRole("menuitem", { name: "Improve this lesson" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Replace with YouTube video" })).not.toBeInTheDocument();
  });
  it("places Edit and Delete in the right-aligned menu without publishing controls", async () => {
    render(<LessonDetailPage params={params} />);
    const trigger = await screen.findByRole("button", { name: "Lesson actions" });
    expect(trigger.closest(".relative")?.parentElement?.className).toContain("justify-between");
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
  it("hides the menu for viewers", async () => {
    permissions = { canEdit: false, isSharedWith: false };
    render(<LessonDetailPage params={params} />);
    await screen.findByText("Original body");
    expect(screen.queryByRole("button", { name: "Lesson actions" })).not.toBeInTheDocument();
  });
  it("validates feedback, submits a chip, and keeps Undo", async () => {
    render(<LessonDetailPage params={params} />);
    fireEvent.click(await screen.findByRole("button", { name: "Lesson actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Improve this lesson" }));
    const textbox = screen.getByRole("textbox", { name: "Lesson feedback" });
    fireEvent.change(textbox, { target: { value: "Short" } });
    fireEvent.click(screen.getByRole("button", { name: /Improve with AI/ }));
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Too advanced" }));
    fireEvent.click(screen.getByRole("button", { name: /Improve with AI/ }));
    expect(await screen.findByText("Updated body")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/generate"), expect.objectContaining({ body: JSON.stringify({ feedback: "Too advanced" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Original body")).toBeInTheDocument();
  });
  it("opens the video picker in a dialog and replaces the lesson", async () => {
    render(<LessonDetailPage params={params} />);
    fireEvent.click(await screen.findByRole("button", { name: "Lesson actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace with YouTube video" }));
    expect(screen.getByRole("dialog", { name: "Replace with YouTube video" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select video" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/lessons/lesson-1"), expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"contentType":"video"') }));
  });
  it("dismisses dialogs and restores focus to the title menu", async () => {
    render(<LessonDetailPage params={params} />);
    const trigger = await screen.findByRole("button", { name: "Lesson actions" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Improve this lesson" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("preserves existing recommendations on refresh failure and offers retry", async () => {
    resourceFailure = true;
    render(<LessonDetailPage params={params} />);
    const refresh = await screen.findByRole("button", { name: /Refresh resources/ });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    expect(await screen.findByRole("alert")).toHaveTextContent("Search unavailable");
    expect(screen.getByRole("link", { name: "Practice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh resources/ })).toBeEnabled();
  });
});
