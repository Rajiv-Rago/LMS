/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => mockPathname }));
const courseId = "507f1f77bcf86cd799439011";
const noticeId = "507f1f77bcf86cd799439012";
beforeEach(() => {
  mockPathname = "/dashboard";
  let read = false;
  global.fetch = jest.fn(async (_url, init) => {
    if (init?.method === "PATCH") read = true;
    return { ok: true, json: async () => ({ data: [
      { id: noticeId, type: "ai.generation.completed", title: "Course generated", message: "Ready", read, createdAt: new Date().toISOString() },
      { id: "other", type: "ai.generation.completed", title: "Content generation complete", message: "Ready", read: false, createdAt: new Date().toISOString() },
    ], unreadCount: read ? 1 : 2 }) } as Response;
  });
});
it("marks visible course creations read on opening and leaves other notices unread", async () => {
  render(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
  await screen.findByRole("button", { name: "Notifications, 1 unread" });
  expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ids: [noticeId] }) }));
});
it("marks notices on a direct course route and when navigating to a different course", async () => {
  mockPathname = `/courses/${courseId}/overview`;
  const { rerender } = render(<NotificationBell />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ body: JSON.stringify({ courseId }) })));
  mockPathname = `/courses/${noticeId}/modules/123`;
  rerender(<NotificationBell />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ body: JSON.stringify({ courseId: noticeId }) })));
});
it("keeps notices unread if marking them fails", async () => {
  const original = global.fetch;
  global.fetch = jest.fn(async (url, init) => init?.method === "PATCH" ? { ok: false } as Response : original(url, init));
  render(<NotificationBell />);
  fireEvent.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "PATCH" })));
  expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();
});
