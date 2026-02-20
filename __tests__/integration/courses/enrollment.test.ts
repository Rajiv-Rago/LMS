import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  POST as ENROLL,
  DELETE as UNENROLL,
} from "@/app/api/courses/[id]/enroll/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Course Enrollment", () => {
  describe("POST /api/courses/[id]/enroll", () => {
    it("enrolls a student in a published course", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, {
        token: studentToken,
      });
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ message: string }>(response);

      expect(status).toBe(200);
      expect(data.message).toBe("Enrolled successfully");
    });

    it("returns 400 for double enrollment", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      // Enroll once
      const req1 = buildRequest("POST", `/api/courses/${course._id}/enroll`, {
        token: studentToken,
      });
      await ENROLL(req1, {
        params: Promise.resolve({ id: course._id.toString() }),
      });

      // Try to enroll again
      const req2 = buildRequest("POST", `/api/courses/${course._id}/enroll`, {
        token: studentToken,
      });
      const response = await ENROLL(req2, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Already enrolled in this course");
    });

    it("returns 400 when enrolling in unpublished course", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: false,
      });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, {
        token: studentToken,
      });
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("unpublished");
    });

    it("prevents an instructor from enrolling in their own course", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({
        role: "teacher",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, {
        token: teacherToken,
      });
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("own courses");
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it("returns 404 for non-existent course", async () => {
      const { token } = await createTestUser({ role: "student" });
      const fakeId = "000000000000000000000000";

      const request = buildRequest("POST", `/api/courses/${fakeId}/enroll`, {
        token,
      });
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: fakeId }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/courses/[id]/enroll (unenroll)", () => {
    it("unenrolls a student from a course", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      // First enroll
      const enrollReq = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      await ENROLL(enrollReq, {
        params: Promise.resolve({ id: course._id.toString() }),
      });

      // Then unenroll
      const unenrollReq = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await UNENROLL(unenrollReq, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ message: string }>(response);

      expect(status).toBe(200);
      expect(data.message).toBe("Unenrolled successfully");
    });

    it("returns 400 when not enrolled", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await UNENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Not enrolled in this course");
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/enroll`
      );
      const response = await UNENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });
  });
});
