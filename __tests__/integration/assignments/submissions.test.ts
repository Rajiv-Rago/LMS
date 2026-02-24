import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestAssignment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  GET as LIST_SUBMISSIONS,
  POST as CREATE_SUBMISSION,
} from "@/app/api/courses/[id]/assignments/[assignmentId]/submissions/route";
import {
  GET as GET_SUBMISSION,
  PATCH as GRADE_SUBMISSION,
} from "@/app/api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

async function enrollStudent(courseId: string, studentId: string) {
  const Course = (await import("@/lib/models/Course")).default;
  await Course.findByIdAndUpdate(courseId, {
    $push: { enrolledStudents: studentId },
  });
}

describe("Submissions", () => {
  describe("POST /api/courses/[id]/assignments/[assignmentId]/submissions", () => {
    it("creates a submission for an enrolled student", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      await enrollStudent(course._id.toString(), student._id.toString());

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "My answer", status: "submitted" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        submission: { content: string; status: string; submittedAt: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.submission.content).toBe("My answer");
      expect(data.submission.status).toBe("submitted");
      expect(data.submission.submittedAt).toBeDefined();
    });

    it("saves a draft without submitting", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      await enrollStudent(course._id.toString(), student._id.toString());

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "Work in progress", status: "draft" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        submission: { status: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.submission.status).toBe("draft");
    });

    it("returns 403 for non-enrolled students", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "My answer", status: "submitted" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it("returns 400 for unpublished assignments", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: false,
      });

      await enrollStudent(course._id.toString(), student._id.toString());

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "My answer", status: "submitted" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });

    it("prevents modifying a graded submission", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      await enrollStudent(course._id.toString(), student._id.toString());

      // Create a graded submission directly
      const Submission = (await import("@/lib/models/Submission")).default;
      await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Original answer",
        status: "graded",
        grade: 90,
      });

      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "Updated answer" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("graded");
    });

    it("updates an existing draft submission", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      await enrollStudent(course._id.toString(), student._id.toString());

      // Create initial draft
      const Submission = (await import("@/lib/models/Submission")).default;
      await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Draft answer",
        status: "draft",
      });

      // Update the draft
      const request = buildRequest(
        "POST",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        {
          token: studentToken,
          body: { content: "Final answer", status: "submitted" },
        }
      );
      const response = await CREATE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        submission: { content: string; status: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.submission.content).toBe("Final answer");
      expect(data.submission.status).toBe("submitted");
    });
  });

  describe("GET /api/courses/[id]/assignments/[assignmentId]/submissions", () => {
    it("lists submissions for instructor", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({
        role: "teacher",
      });
      const { user: student } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Answer",
        status: "submitted",
        submittedAt: new Date(),
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        { token: teacherToken }
      );
      const response = await LIST_SUBMISSIONS(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        data: { content: string }[];
      }>(response);

      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
    });

    it("returns 403 for students", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions`,
        { token: studentToken }
      );
      const response = await LIST_SUBMISSIONS(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });

  describe("PATCH /api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId] (grade)", () => {
    it("grades a submitted assignment", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({
        role: "teacher",
      });
      const { user: student } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      const submission = await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Answer",
        status: "submitted",
        submittedAt: new Date(),
      });

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions/${submission._id}`,
        {
          token: teacherToken,
          body: { grade: 85, feedback: "Good work" },
        }
      );
      const response = await GRADE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
          submissionId: submission._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        submission: { grade: number; feedback: string; status: string };
      }>(response);

      expect(status).toBe(200);
      expect(data.submission.grade).toBe(85);
      expect(data.submission.feedback).toBe("Good work");
      expect(data.submission.status).toBe("graded");
    });

    it("returns 400 when grading a draft submission", async () => {
      const { user: teacher, token: teacherToken } = await createTestUser({
        role: "teacher",
      });
      const { user: student } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      const submission = await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Draft",
        status: "draft",
      });

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions/${submission._id}`,
        {
          token: teacherToken,
          body: { grade: 50 },
        }
      );
      const response = await GRADE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
          submissionId: submission._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{ error: string }>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("submitted");
    });

    it("returns 403 for students trying to grade", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      const submission = await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "Answer",
        status: "submitted",
        submittedAt: new Date(),
      });

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions/${submission._id}`,
        {
          token: studentToken,
          body: { grade: 100 },
        }
      );
      const response = await GRADE_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
          submissionId: submission._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });

  describe("GET /api/courses/[id]/assignments/[assignmentId]/submissions/[submissionId]", () => {
    it("allows student to view own submission", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({
        role: "student",
      });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      const submission = await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "My answer",
        status: "submitted",
        submittedAt: new Date(),
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions/${submission._id}`,
        { token: studentToken }
      );
      const response = await GET_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
          submissionId: submission._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        permissions: { canGrade: boolean; canEdit: boolean };
      }>(response);

      expect(status).toBe(200);
      expect(data.permissions.canGrade).toBe(false);
      expect(data.permissions.canEdit).toBe(true);
    });

    it("returns 403 for other students viewing submission", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student } = await createTestUser({ role: "student" });
      const { token: otherToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
      });

      const Submission = (await import("@/lib/models/Submission")).default;
      const submission = await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "My answer",
        status: "submitted",
        submittedAt: new Date(),
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}/submissions/${submission._id}`,
        { token: otherToken }
      );
      const response = await GET_SUBMISSION(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
          submissionId: submission._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });
});
