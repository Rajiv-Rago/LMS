import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestModule,
  createTestAssignment,
  createTestEnrollment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  GET as getCourse,
  PATCH as patchCourse,
  DELETE as deleteCourse,
} from "@/app/api/courses/[id]/route";
import {
  GET as getModules,
  POST as postModule,
} from "@/app/api/courses/[id]/modules/route";
import {
  GET as getAssignments,
} from "@/app/api/courses/[id]/assignments/route";
import {
  GET as getAssignment,
  PATCH as patchAssignment,
} from "@/app/api/courses/[id]/assignments/[assignmentId]/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Cross-route authorization consistency", () => {
  async function setupCourseWithData() {
    const { user: instructor, token: instructorToken } = await createTestUser({
      role: "user",
    });
    const { user: enrolledStudent, token: studentToken } = await createTestUser({
      role: "user",
    });
    const { user: outsider, token: outsiderToken } = await createTestUser({
      role: "user",
    });
    const { user: admin, token: adminToken } = await createTestUser({
      role: "admin",
    });

    const { course } = await createTestCourse(instructor._id, {
      isPublished: true,
    });
    const { module } = await createTestModule(course._id, {
      isPublished: true,
    });
    const { assignment } = await createTestAssignment(course._id, {
      isPublished: true,
    });

    await createTestEnrollment(course._id, enrolledStudent._id);

    return {
      instructor,
      instructorToken,
      enrolledStudent,
      studentToken,
      outsider,
      outsiderToken,
      admin,
      adminToken,
      course,
      module,
      assignment,
    };
  }

  describe("ObjectId validation", () => {
    it("GET /api/courses/not-valid-id returns 400", async () => {
      const { instructorToken } = await setupCourseWithData();

      const request = buildRequest("GET", "/api/courses/not-valid-id", {
        token: instructorToken,
      });
      const response = await getCourse(request, {
        params: Promise.resolve({ id: "not-valid-id" }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid");
    });

    it("GET /api/courses/not-valid-id/modules returns 400", async () => {
      const { instructorToken } = await setupCourseWithData();

      const request = buildRequest("GET", "/api/courses/not-valid-id/modules", {
        token: instructorToken,
      });
      const response = await getModules(request, {
        params: Promise.resolve({ id: "not-valid-id" }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid");
    });

    it("GET /api/courses/:id/assignments/not-valid-id returns 400", async () => {
      const { instructorToken, course } = await setupCourseWithData();

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/not-valid-id`,
        { token: instructorToken }
      );
      const response = await getAssignment(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: "not-valid-id",
        }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid");
    });
  });

  describe("Instructor access", () => {
    it("GET /api/courses/:id returns course (200)", async () => {
      const { instructorToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}`, {
        token: instructorToken,
      });
      const response = await getCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("GET /api/courses/:id/modules returns modules (200)", async () => {
      const { instructorToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}/modules`, {
        token: instructorToken,
      });
      const response = await getModules(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("POST /api/courses/:id/modules creates module (201)", async () => {
      const { instructorToken, course } = await setupCourseWithData();

      const request = buildRequest("POST", `/api/courses/${course._id}/modules`, {
        token: instructorToken,
        body: { title: "New Module" },
      });
      const response = await postModule(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(201);
    });

    it("PATCH /api/courses/:id updates course (200)", async () => {
      const { instructorToken, course } = await setupCourseWithData();

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token: instructorToken,
        body: { title: "Updated" },
      });
      const response = await patchCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });
  });

  describe("Enrolled student access", () => {
    it("GET /api/courses/:id returns course (200)", async () => {
      const { studentToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}`, {
        token: studentToken,
      });
      const response = await getCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("GET /api/courses/:id/modules returns modules (200)", async () => {
      const { studentToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}/modules`, {
        token: studentToken,
      });
      const response = await getModules(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("POST /api/courses/:id/modules returns 403", async () => {
      const { studentToken, course } = await setupCourseWithData();

      const request = buildRequest("POST", `/api/courses/${course._id}/modules`, {
        token: studentToken,
        body: { title: "Not Allowed" },
      });
      const response = await postModule(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it("GET /api/courses/:id/assignments returns assignments (200)", async () => {
      const { studentToken, course } = await setupCourseWithData();

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments`,
        { token: studentToken }
      );
      const response = await getAssignments(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("PATCH /api/courses/:id/assignments/:assignmentId returns 403", async () => {
      const { studentToken, course, assignment } = await setupCourseWithData();

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token: studentToken, body: { title: "Not Allowed" } }
      );
      const response = await patchAssignment(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });

  describe("Outsider (non-enrolled) access", () => {
    it("GET /api/courses/:id on unpublished course returns 404", async () => {
      const { outsiderToken, instructor } = await setupCourseWithData();
      const { course: unpublished } = await createTestCourse(instructor._id, {
        isPublished: false,
      });

      const request = buildRequest("GET", `/api/courses/${unpublished._id}`, {
        token: outsiderToken,
      });
      const response = await getCourse(request, {
        params: Promise.resolve({ id: unpublished._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });

    it("GET /api/courses/:id/assignments returns 200 for outsider on published course", async () => {
      const { outsiderToken, course } = await setupCourseWithData();

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments`,
        { token: outsiderToken }
      );
      const response = await getAssignments(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("POST /api/courses/:id/modules returns 403 for outsider", async () => {
      const { outsiderToken, course } = await setupCourseWithData();

      const request = buildRequest("POST", `/api/courses/${course._id}/modules`, {
        token: outsiderToken,
        body: { title: "Not Allowed" },
      });
      const response = await postModule(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });

  describe("Admin access", () => {
    it("GET /api/courses/:id returns course (200)", async () => {
      const { adminToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}`, {
        token: adminToken,
      });
      const response = await getCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("PATCH /api/courses/:id updates course (200)", async () => {
      const { adminToken, course } = await setupCourseWithData();

      const request = buildRequest("PATCH", `/api/courses/${course._id}`, {
        token: adminToken,
        body: { title: "Admin Updated" },
      });
      const response = await patchCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("DELETE /api/courses/:id deletes course (200)", async () => {
      const { adminToken, course } = await setupCourseWithData();

      const request = buildRequest("DELETE", `/api/courses/${course._id}`, {
        token: adminToken,
      });
      const response = await deleteCourse(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("GET /api/courses/:id/modules returns modules (200)", async () => {
      const { adminToken, course } = await setupCourseWithData();

      const request = buildRequest("GET", `/api/courses/${course._id}/modules`, {
        token: adminToken,
      });
      const response = await getModules(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });
  });
});
