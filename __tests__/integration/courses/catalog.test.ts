import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { GET } from "@/app/api/courses/route";
import { GET as GET_COURSE } from "@/app/api/courses/[id]/route";
import Course from "@/lib/models/Course";
import * as cache from "@/lib/cache";

beforeAll(async () => {
  await connectTestDb();
  await Course.ensureIndexes();
}, 30000);

afterEach(async () => {
  cache.invalidatePrefix("catalog:");
  cache.invalidatePrefix("courses:");
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Course Catalog", () => {
  describe("GET /api/courses?catalog=true", () => {
    it("returns only published courses for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, { title: "Published", accessLevel: "published" });
      await createTestCourse(teacher._id, { title: "Unlisted", accessLevel: "unlisted" });
      await createTestCourse(teacher._id, { title: "Restricted", accessLevel: "restricted" });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true" },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.pagination.total).toBe(1);
      expect(data.courses).toHaveLength(1);
      expect(data.courses[0].title).toBe("Published");
    });

    it("excludes restricted and unlisted courses from catalog", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, { title: "Unlisted", accessLevel: "unlisted" });
      await createTestCourse(teacher._id, { title: "Restricted", accessLevel: "restricted" });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true" },
      });
      const response = await GET(request);
      const { data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(data.pagination.total).toBe(0);
      expect(data.courses).toHaveLength(0);
    });

    it("supports keyword search across titles and descriptions", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, {
        title: "JavaScript Fundamentals",
        description: "Learn JS basics",
        accessLevel: "published",
      });
      await createTestCourse(teacher._id, {
        title: "Python Programming",
        description: "Learn Python basics",
        accessLevel: "published",
      });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true", search: "JavaScript" },
      });
      const response = await GET(request);
      const { data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(data.courses.length).toBeGreaterThanOrEqual(1);
      expect(data.courses.some((c) => c.title === "JavaScript Fundamentals")).toBe(true);
    });

    it("returns empty results for non-matching search", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, {
        title: "Some Course",
        accessLevel: "published",
      });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true", search: "xyznonexistent" },
      });
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.courses).toHaveLength(0);
    });

    it("excludes enrolled/owned courses for authenticated users in catalog mode", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({ role: "student" });

      const { course: enrolledCourse } = await createTestCourse(teacher._id, {
        title: "Enrolled",
        accessLevel: "published",
      });
      await createTestEnrollment(enrolledCourse._id, student._id);

      await createTestCourse(student._id, {
        title: "Owned",
        accessLevel: "published",
        owner: student._id,
      });

      await createTestCourse(teacher._id, {
        title: "Available",
        accessLevel: "published",
      });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true" },
        token: studentToken,
      });
      const response = await GET(request);
      const { data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(data.courses).toHaveLength(1);
      expect(data.courses[0].title).toBe("Available");
    });

    it("sorts by enrollment count descending", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });

      const { course: c1 } = await createTestCourse(teacher._id, {
        title: "Low Enrollment",
        accessLevel: "published",
      });
      const { course: c2 } = await createTestCourse(teacher._id, {
        title: "High Enrollment",
        accessLevel: "published",
      });
      const { course: c3 } = await createTestCourse(teacher._id, {
        title: "Mid Enrollment",
        accessLevel: "published",
      });

      await Course.findByIdAndUpdate(c1._id, { enrolledCount: 5 });
      await Course.findByIdAndUpdate(c2._id, { enrolledCount: 100 });
      await Course.findByIdAndUpdate(c3._id, { enrolledCount: 50 });

      const request = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true" },
      });
      const response = await GET(request);
      const { data } = await parseResponse<{
        courses: Array<{ title: string; enrolledCount: number }>;
      }>(response);

      expect(data.courses[0].title).toBe("High Enrollment");
      expect(data.courses[1].title).toBe("Mid Enrollment");
      expect(data.courses[2].title).toBe("Low Enrollment");
    });

    it("paginates with Load More support", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      for (let i = 0; i < 15; i++) {
        await createTestCourse(teacher._id, {
          title: `Course ${String(i).padStart(2, "0")}`,
          accessLevel: "published",
        });
      }

      const request1 = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true", page: "1" },
      });
      const response1 = await GET(request1);
      const { data: page1 } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number; page: number; limit: number; pages: number };
      }>(response1);

      expect(page1.courses).toHaveLength(12);
      expect(page1.pagination.total).toBe(15);
      expect(page1.pagination.pages).toBe(2);

      const request2 = buildRequest("GET", "/api/courses", {
        searchParams: { catalog: "true", page: "2" },
      });
      const response2 = await GET(request2);
      const { data: page2 } = await parseResponse<{
        courses: Array<{ title: string }>;
      }>(response2);

      expect(page2.courses).toHaveLength(3);
    });

    it("backward compatible: non-catalog GET still returns user's courses", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, { title: "My Restricted Course", accessLevel: "restricted" });
      await createTestCourse(teacher._id, { title: "My Published Course", accessLevel: "published" });

      const request = buildRequest("GET", "/api/courses", { token: teacherToken });
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.pagination.total).toBe(2);
    });
  });

  describe("GET /api/courses/[id] OG metadata", () => {
    it("returns OG metadata fields for published courses", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher", name: "Prof Smith" });
      const { course } = await createTestCourse(teacher._id, {
        title: "Public Course",
        description: "A great course for everyone",
        accessLevel: "published",
      });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: {
          title: string;
          description: string;
          instructor: { name: string };
        };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Public Course");
      expect(data.course.description).toBe("A great course for everyone");
      expect(data.course.instructor.name).toBe("Prof Smith");
    });

    it("returns OG metadata fields for unlisted courses", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher", name: "Dr Jones" });
      const { course } = await createTestCourse(teacher._id, {
        title: "Unlisted Course",
        description: "An unlisted but accessible course",
        accessLevel: "unlisted",
      });

      const request = buildRequest("GET", `/api/courses/${course._id}`);
      const response = await GET_COURSE(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        course: {
          title: string;
          description: string;
          instructor: { name: string };
        };
      }>(response);

      expect(status).toBe(200);
      expect(data.course.title).toBe("Unlisted Course");
      expect(data.course.description).toBe("An unlisted but accessible course");
      expect(data.course.instructor.name).toBe("Dr Jones");
    });
  });

  describe("GET /api/courses without catalog param", () => {
    it("unauthenticated query uses accessLevel filter", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      await createTestCourse(teacher._id, { title: "Published", accessLevel: "published" });
      await createTestCourse(teacher._id, { title: "Restricted", accessLevel: "restricted" });

      const request = buildRequest("GET", "/api/courses");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        courses: Array<{ title: string }>;
        pagination: { total: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.pagination.total).toBe(1);
      expect(data.courses[0].title).toBe("Published");
    });
  });
});
