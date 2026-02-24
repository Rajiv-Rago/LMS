import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { GET, POST } from "@/app/api/courses/route";
import {
  GET as GET_SINGLE,
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

describe("Courses CRUD", () => {
  describe("POST /api/courses", () => {
    it("allows a teacher to create a standard course", async () => {
      const { token } = await createTestUser({ role: "teacher" });

      const request = buildRequest("POST", "/api/courses", {
        token,
        body: {
          title: "My Course",
          description: "A great course about testing",
        },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        course: { title: string; description: string; isPublished: boolean };
      }>(response);

      expect(status).toBe(201);
      expect(data.course.title).toBe("My Course");
      expect(data.course.description).toBe("A great course about testing");
      expect(data.course.isPublished).toBe(false);
    });

    it("prevents a student from creating a standard course", async () => {
      const { token } = await createTestUser({ role: "student" });

      const request = buildRequest("POST", "/api/courses", {
        token,
        body: {
          title: "Student Course",
          description: "Should not be allowed",
        },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(403);
      expect(data.error).toContain("Only teachers");
    });

    it("allows a student to create an ai-generated course", async () => {
      const { token } = await createTestUser({ role: "student" });

      const request = buildRequest("POST", "/api/courses", {
        token,
        body: {
          title: "AI Course",
          description: "Auto-generated",
          courseType: "ai-generated",
        },
      });
      const response = await POST(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(201);
    });

    it("returns 401 for unauthenticated users", async () => {
      const request = buildRequest("POST", "/api/courses", {
        body: {
          title: "Unauthorized Course",
          description: "Should fail",
        },
      });
      const response = await POST(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it("returns 400 for missing title", async () => {
      const { token } = await createTestUser({ role: "teacher" });

      const request = buildRequest("POST", "/api/courses", {
        token,
        body: { description: "No title" },
      });
      const response = await POST(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });
  });

  describe("GET /api/courses", () => {
    it("returns courses for authenticated users", async () => {
      const { user, token } = await createTestUser({ role: "teacher" });
      await createTestCourse(user._id, { title: "Course 1", isPublished: true });
      await createTestCourse(user._id, { title: "Course 2", isPublished: true });

      const request = buildRequest("GET", "/api/courses", { token });
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        data: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it("returns only published courses for unauthenticated users", async () => {
      const { user } = await createTestUser({ role: "teacher" });
      await createTestCourse(user._id, {
        title: "Published",
        isPublished: true,
      });
      await createTestCourse(user._id, {
        title: "Unpublished",
        isPublished: false,
      });

      const request = buildRequest("GET", "/api/courses");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        data: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.pagination.total).toBe(1);
      expect(data.data[0].title).toBe("Published");
    });
  });

  describe("GET /api/courses/[id]", () => {
    it("returns a course by ID", async () => {
      const { user, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(user._id, {
        title: "Single Course",
        isPublished: true,
      });

      const request = buildRequest("GET", `/api/courses/${course._id}`, {
        token,
      });
      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: { title: string };
        permissions: { canEdit: boolean; isInstructor: boolean };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Single Course");
      expect(data.permissions.canEdit).toBe(true);
      expect(data.permissions.isInstructor).toBe(true);
    });

    it("returns 404 for non-existent course", async () => {
      const { token } = await createTestUser({ role: "teacher" });
      const fakeId = "000000000000000000000000";

      const request = buildRequest("GET", `/api/courses/${fakeId}`, {
        token,
      });
      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ id: fakeId }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it("hides unpublished course from non-instructor/non-enrolled users", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: false,
      });

      const request = buildRequest("GET", `/api/courses/${course._id}`, {
        token: studentToken,
      });
      const response = await GET_SINGLE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/courses/[id]", () => {
    it("allows the instructor to update the course", async () => {
      const { user, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(user._id, {
        title: "Original Title",
      });

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token,
        body: { title: "Updated Title" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: { title: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Updated Title");
    });

    it("returns 403 when a non-instructor tries to update", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: otherToken } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token: otherToken,
        body: { title: "Hijacked" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(user._id);

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

  describe("DELETE /api/courses/[id]", () => {
    it("allows the instructor to delete the course", async () => {
      const { user, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(user._id);

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

    it("returns 403 when a non-instructor tries to delete", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: otherToken } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("DELETE", `/api/courses/${course._id}`, {
        token: otherToken,
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it("returns 404 for non-existent course", async () => {
      const { token } = await createTestUser({ role: "teacher" });
      const fakeId = "000000000000000000000000";

      const request = buildRequest("DELETE", `/api/courses/${fakeId}`, {
        token,
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: fakeId }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });
});
