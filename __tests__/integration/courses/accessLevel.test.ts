import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import Course from "@/lib/models/Course";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import {
  POST as ENROLL,
  DELETE as UNENROLL,
} from "@/app/api/courses/[id]/enroll/route";
import { GET as GET_COURSE } from "@/app/api/courses/[id]/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Course accessLevel", () => {
  describe("Schema", () => {
    it("defaults accessLevel to restricted", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id);
      expect(course.accessLevel).toBe("restricted");
    });

    it("accepts published, unlisted, and restricted values", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });

      const { course: c1 } = await createTestCourse(teacher._id, { accessLevel: "published" });
      expect(c1.accessLevel).toBe("published");

      const { course: c2 } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });
      expect(c2.accessLevel).toBe("unlisted");

      const { course: c3 } = await createTestCourse(teacher._id, { accessLevel: "restricted" });
      expect(c3.accessLevel).toBe("restricted");
    });

    it("has enrolledCount field defaulting to 0", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id);
      expect(course.enrolledCount).toBe(0);
    });

    it("isPublished virtual returns true for non-restricted courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });

      const { course: published } = await createTestCourse(teacher._id, { accessLevel: "published" });
      expect(published.isPublished).toBe(true);

      const { course: unlisted } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });
      expect(unlisted.isPublished).toBe(true);

      const { course: restricted } = await createTestCourse(teacher._id, { accessLevel: "restricted" });
      expect(restricted.isPublished).toBe(false);
    });
  });

  describe("Permissions with null user", () => {
    it("returns canView=true for published course with null user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });
      const perms = await getCoursePermissions(course, null);
      expect(perms.canView).toBe(true);
      expect(perms.isInstructor).toBe(false);
      expect(perms.isEnrolled).toBe(false);
      expect(perms.isOwner).toBe(false);
      expect(perms.isAdmin).toBe(false);
      expect(perms.canEdit).toBe(false);
    });

    it("returns canView=true for unlisted course with null user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });
      const perms = await getCoursePermissions(course, null);
      expect(perms.canView).toBe(true);
    });

    it("returns canView=false for restricted course with null user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "restricted" });
      const perms = await getCoursePermissions(course, null);
      expect(perms.canView).toBe(false);
    });
  });

  describe("Permissions with authenticated user", () => {
    it("allows any authenticated user to view published courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });
      const perms = await getCoursePermissions(course, {
        userId: student._id.toString(),
        email: student.email,
        role: student.role,
        subscriptionTier: "free",
      });
      expect(perms.canView).toBe(true);
    });

    it("allows any authenticated user to view unlisted courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });
      const perms = await getCoursePermissions(course, {
        userId: student._id.toString(),
        email: student.email,
        role: student.role,
        subscriptionTier: "free",
      });
      expect(perms.canView).toBe(true);
    });
  });

  describe("Enroll route with accessLevel", () => {
    it("allows enrollment in published courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, { token: studentToken });
      const response = await ENROLL(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status } = await parseResponse(response);
      expect(status).toBe(200);
    });

    it("allows enrollment in unlisted courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, { token: studentToken });
      const response = await ENROLL(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status } = await parseResponse(response);
      expect(status).toBe(200);
    });

    it("blocks enrollment in restricted courses", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "restricted" });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, { token: studentToken });
      const response = await ENROLL(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status } = await parseResponse(response);
      expect(status).toBe(400);
    });

    it("increments enrolledCount on enrollment", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { token: studentToken } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });

      const request = buildRequest("POST", `/api/courses/${course._id}/enroll`, { token: studentToken });
      await ENROLL(request, { params: Promise.resolve({ id: course._id.toString() }) });

      const updated = await Course.findById(course._id);
      expect(updated!.enrolledCount).toBe(1);
    });

    it("decrements enrolledCount on unenroll", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { user: student, token: studentToken } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });

      await createTestEnrollment(course._id, student._id);
      await Course.findByIdAndUpdate(course._id, { $set: { enrolledCount: 1 } });

      const request = buildRequest("DELETE", `/api/courses/${course._id}/enroll`, { token: studentToken });
      await UNENROLL(request, { params: Promise.resolve({ id: course._id.toString() }) });

      const updated = await Course.findById(course._id);
      expect(updated!.enrolledCount).toBe(0);
    });
  });

  describe("GET /api/courses/[id] with accessLevel", () => {
    it("returns published course for unauthenticated user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status, data } = await parseResponse<{ course: { title: string }; permissions: { canEnroll: boolean } }>(response);
      expect(status).toBe(200);
      expect(data.course.title).toBe("Test Course");
      expect(data.permissions.canEnroll).toBe(true);
    });

    it("returns unlisted course for unauthenticated user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "unlisted" });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status } = await parseResponse(response);
      expect(status).toBe(200);
    });

    it("returns 404 for restricted course to unauthenticated user", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "restricted" });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { status } = await parseResponse(response);
      expect(status).toBe(404);
    });

    it("uses accessLevel for canEnroll check", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, { params: Promise.resolve({ id: course._id.toString() }) });
      const { data } = await parseResponse<{ permissions: { canEnroll: boolean } }>(response);
      expect(data.permissions.canEnroll).toBe(true);
    });
  });

  describe("Fixture support", () => {
    it("createTestCourse accepts accessLevel override", async () => {
      const { user: teacher } = await createTestUser({ role: "user" });
      const { course } = await createTestCourse(teacher._id, { accessLevel: "published" });
      expect(course.accessLevel).toBe("published");
    });
  });
});
