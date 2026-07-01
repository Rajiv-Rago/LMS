import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  POST as ENROLL,
  DELETE as UNENROLL,
} from "@/app/api/courses/[id]/enroll/route";
import Enrollment from "@/lib/models/Enrollment";

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
    it("enrolls a student and creates an Enrollment document", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ message: string }>(
        response
      );

      expect(status).toBe(200);
      expect(data.message).toBe("Enrolled successfully");

      const enrolled = await Enrollment.isEnrolled(course._id, student._id);
      expect(enrolled).toBe(true);
    });

    it("returns 400 for duplicate enrollment (compound index)", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      await createTestEnrollment(course._id, student._id);

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(
        response
      );

      expect(status).toBe(400);
      expect(data.error).toBe("Already enrolled in this course");
    });

    it("returns 400 when enrolling in unpublished course", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: false,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(
        response
      );

      expect(status).toBe(400);
      expect(data.error).toContain("restricted");
    });

    it("prevents an instructor from enrolling in their own course", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/enroll`,
        { token: teacherToken }
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ error: string }>(
        response
      );

      expect(status).toBe(400);
      expect(data.error).toContain("own courses");
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
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
      const { token } = await createTestUser({ role: "user" });
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

    it("returns 400 for invalid ObjectId", async () => {
      const { token } = await createTestUser({ role: "user" });

      const request = buildRequest(
        "POST",
        `/api/courses/not-a-valid-id/enroll`,
        { token }
      );
      const response = await ENROLL(request, {
        params: Promise.resolve({ id: "not-a-valid-id" }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });

    it("only creates one enrollment for concurrent attempts", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      const makeRequest = () => {
        const req = buildRequest(
          "POST",
          `/api/courses/${course._id}/enroll`,
          { token: studentToken }
        );
        return ENROLL(req, {
          params: Promise.resolve({ id: course._id.toString() }),
        });
      };

      const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);
      const { status: s1 } = await parseResponse(res1);
      const { status: s2 } = await parseResponse(res2);

      const statuses = [s1, s2].sort();
      expect(statuses).toEqual([200, 400]);

      const count = await Enrollment.countDocuments({
        course: course._id,
        student: student._id,
      });
      expect(count).toBe(1);
    });
  });

  describe("DELETE /api/courses/[id]/enroll (unenroll)", () => {
    it("unenrolls a student by removing the Enrollment document", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "user",
      });
      const { course } = await createTestCourse(teacher._id, {
        isPublished: true,
      });

      await createTestEnrollment(course._id, student._id);

      const request = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/enroll`,
        { token: studentToken }
      );
      const response = await UNENROLL(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ message: string }>(
        response
      );

      expect(status).toBe(200);
      expect(data.message).toBe("Unenrolled successfully");

      const enrolled = await Enrollment.isEnrolled(course._id, student._id);
      expect(enrolled).toBe(false);
    });

    it("returns 400 when not enrolled", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({
        role: "user",
      });
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
      const { status, data } = await parseResponse<{ error: string }>(
        response
      );

      expect(status).toBe(400);
      expect(data.error).toBe("Not enrolled in this course");
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
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
