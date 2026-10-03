import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest } from "../../helpers/api";
import { PATCH, POST } from "@/app/api/notifications/route";
import { GET as GET_MY_COURSES } from "@/app/api/courses/ai/my-courses/route";
import Notification from "@/lib/models/Notification";

beforeAll(connectTestDb, 30000);
afterEach(clearTestDb);
afterAll(disconnectTestDb, 30000);

it("marks only selected course notices belonging to the signed-in user", async () => {
  const { user, token } = await createTestUser();
  const { user: other } = await createTestUser();
  const notices = await Notification.create([
    { userId: user._id, type: "ai.generation.completed", title: "Course generated", message: "Ready" },
    { userId: other._id, type: "ai.generation.completed", title: "Course generated", message: "Ready" },
    { userId: user._id, type: "ai.generation.completed", title: "Content generation complete", message: "Ready" },
    { userId: user._id, type: "ai.generation.completed", title: "Course generated", message: "Ready" },
  ]);
  const response = await PATCH(buildRequest("PATCH", "/api/notifications", {
    token, body: { ids: notices.slice(0, 3).map((n) => n._id.toString()) },
  }));
  expect(response.status).toBe(200);
  for (let i = 0; i < notices.length; i++) {
    expect((await Notification.findById(notices[i]._id))?.read).toBe(i === 0);
  }
});

it("marks matching course creation notices on a direct course visit", async () => {
  const { user, token } = await createTestUser();
  const courseId = "507f1f77bcf86cd799439011";
  const notices = await Notification.create([
    { userId: user._id, type: "ai.generation.completed", title: "Course generated", message: "Ready", link: `/courses/${courseId}` },
    { userId: user._id, type: "ai.generation.completed", title: "Content generation complete", message: "Ready", link: `/courses/${courseId}` },
    { userId: user._id, type: "ai.generation.completed", title: "Course generated", message: "Ready", link: "/courses/507f1f77bcf86cd799439012" },
  ]);
  expect((await PATCH(buildRequest("PATCH", "/api/notifications", { token, body: { courseId } }))).status).toBe(200);
  for (let i = 0; i < notices.length; i++) {
    expect((await Notification.findById(notices[i]._id))?.read).toBe(i === 0);
  }
});

it("rejects anonymous, invalid and unscoped PATCH requests", async () => {
  const { token } = await createTestUser();
  expect((await PATCH(buildRequest("PATCH", "/api/notifications", { body: { ids: [] } }))).status).toBe(401);
  for (const body of [{}, { ids: [] }, { courseId: "bad" }]) {
    expect((await PATCH(buildRequest("PATCH", "/api/notifications", { token, body }))).status).toBe(400);
  }
});

it("keeps explicit mark-all-read behavior", async () => {
  const { user, token } = await createTestUser();
  const n = await Notification.create({ userId: user._id, type: "other", title: "Notice", message: "Hello" });
  expect((await POST(buildRequest("POST", "/api/notifications", { token }))).status).toBe(200);
  expect((await Notification.findById(n._id))?.read).toBe(true);
});

it("returns creator names for dashboard course cards", async () => {
  const { user, token } = await createTestUser({ name: "Course Creator" });
  await createTestCourse(user._id.toString(), { owner: user._id, isAIGenerated: true });
  const response = await GET_MY_COURSES(buildRequest("GET", "/api/courses/ai/my-courses", { token }));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.courses[0].owner.name).toBe("Course Creator");
  expect(data.courses[0].instructor.name).toBe("Course Creator");
});
