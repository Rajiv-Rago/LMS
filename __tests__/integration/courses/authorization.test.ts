import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  PATCH,
  DELETE,
} from "@/app/api/courses/[id]/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Course Authorization (ownership-based)", () => {
  describe("Owner access (student role with course.owner)", () => {
    it("allows owner to PATCH their course", async () => {
      const { user: owner, token } = await createTestUser({ role: "student" });
      const { user: instructor } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(instructor._id, {
        owner: owner._id,
      });

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token,
        body: { title: "Owner Updated Title" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: { title: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Owner Updated Title");
    });

    it("allows owner to DELETE their course", async () => {
      const { user: owner, token } = await createTestUser({ role: "student" });
      const { user: instructor } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(instructor._id, {
        owner: owner._id,
      });

      const request = buildRequest("DELETE", `/api/courses/${course._id}`, {
        token,
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ message: string }>(response);

      expect(status).toBe(200);
      expect(data.message).toBe("Course deleted successfully");
    });
  });

  describe("Instructor access (teacher role with course.instructor)", () => {
    it("allows instructor to PATCH their course", async () => {
      const { user: instructor, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(instructor._id);

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token,
        body: { title: "Instructor Updated Title" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: { title: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Instructor Updated Title");
    });
  });

  describe("Admin access", () => {
    it("allows admin to PATCH any course", async () => {
      const { user: instructor } = await createTestUser({ role: "teacher" });
      const { token: adminToken } = await createTestUser({ role: "admin" });
      const { course } = await createTestCourse(instructor._id);

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token: adminToken,
        body: { title: "Admin Updated Title" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: { title: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Admin Updated Title");
    });
  });

  describe("Unauthorized access", () => {
    it("returns 403 for random authenticated user on PATCH", async () => {
      const { user: instructor } = await createTestUser({ role: "teacher" });
      const { token: randomToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(instructor._id);

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token: randomToken,
        body: { title: "Hijacked" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 401 for unauthenticated request on PATCH", async () => {
      const { user: instructor } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(instructor._id);

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        body: { title: "Nope" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });
  });
});
