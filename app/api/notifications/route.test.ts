import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { authenticate, requireCsrf } from "@/lib/auth";
import Notification from "@/lib/models/Notification";
jest.mock("@/lib/db", () => ({ dbConnect: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authenticate: jest.fn(), requireCsrf: jest.fn() }));
jest.mock("@/lib/models/Notification", () => ({ __esModule: true, default: { updateMany: jest.fn() } }));
const id = "507f1f77bcf86cd799439011";
function request(body: unknown) {
  return new NextRequest("http://localhost/api/notifications", { method: "PATCH", body: JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(authenticate).mockResolvedValue({ userId: "current-user", role: "user" } as Awaited<ReturnType<typeof authenticate>>);
  jest.mocked(requireCsrf).mockReturnValue(null);
});
it("scopes selected IDs to the current user and course creation notices", async () => {
  expect((await PATCH(request({ ids: [id] }))).status).toBe(200);
  expect(Notification.updateMany).toHaveBeenCalledWith({ userId: "current-user", read: false, type: "ai.generation.completed", title: "Course generated", _id: { $in: [id] } }, { $set: { read: true } });
});
it("matches the course link exactly rather than a prefix", async () => {
  expect((await PATCH(request({ courseId: id }))).status).toBe(200);
  expect(Notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ userId: "current-user", link: { $in: [`/courses/${id}`, `/courses/${id}/overview`] } }), { $set: { read: true } });
});
it("rejects invalid selections without a database mutation", async () => {
  for (const body of [{}, { ids: [] }, { courseId: "bad" }, { ids: [id], courseId: id }]) {
    expect((await PATCH(request(body))).status).toBe(400);
  }
  expect(Notification.updateMany).not.toHaveBeenCalled();
});
it("requires authentication before mutating notifications", async () => {
  jest.mocked(authenticate).mockResolvedValue(null);
  expect((await PATCH(request({ ids: [id] }))).status).toBe(401);
  expect(Notification.updateMany).not.toHaveBeenCalled();
});
