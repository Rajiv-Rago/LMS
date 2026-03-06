import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestAssignment,
  createTestEnrollment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import {
  GET,
  POST,
} from "@/app/api/courses/[id]/assignments/route";
import {
  GET as GET_ONE,
  PATCH,
  DELETE,
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

describe("Assignment CRUD", () => {
  describe("GET /api/courses/[id]/assignments", () => {
    it("returns assignments for the course instructor", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      await createTestAssignment(course._id, { title: "HW 1", isPublished: true });
      await createTestAssignment(course._id, { title: "HW 2", isPublished: false });

      const request = buildRequest("GET", `/api/courses/${course._id}/assignments`, { token });
      const response = await GET(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ assignments: { title: string }[] }>(response);

      expect(status).toBe(200);
      expect(data.assignments).toHaveLength(2);
    });

    it("returns only published assignments for enrolled students", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      await createTestAssignment(course._id, { title: "Published", isPublished: true });
      await createTestAssignment(course._id, { title: "Draft", isPublished: false });

      // Enroll student
      await createTestEnrollment(course._id, student._id);

      const request = buildRequest("GET", `/api/courses/${course._id}/assignments`, {
        token: studentToken,
      });
      const response = await GET(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ assignments: { title: string }[] }>(response);

      expect(status).toBe(200);
      expect(data.assignments).toHaveLength(1);
      expect(data.assignments[0].title).toBe("Published");
    });

    it("returns 200 for non-enrolled users on published course", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: outsiderToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });

      const request = buildRequest("GET", `/api/courses/${course._id}/assignments`, {
        token: outsiderToken,
      });
      const response = await GET(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
    });

    it("returns 404 for non-existent course", async () => {
      const { token } = await createTestUser({ role: "teacher" });
      const fakeId = "000000000000000000000000";

      const request = buildRequest("GET", `/api/courses/${fakeId}/assignments`, { token });
      const response = await GET(request, {
        params: Promise.resolve({ id: fakeId }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe("POST /api/courses/[id]/assignments", () => {
    it("creates a standard assignment", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("POST", `/api/courses/${course._id}/assignments`, {
        token,
        body: {
          title: "New Assignment",
          description: "Test description",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          points: 100,
        },
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{ assignment: { title: string; points: number } }>(response);

      expect(status).toBe(201);
      expect(data.assignment.title).toBe("New Assignment");
      expect(data.assignment.points).toBe(100);
    });

    it("creates a quiz assignment", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("POST", `/api/courses/${course._id}/assignments`, {
        token,
        body: {
          title: "Quiz 1",
          description: "A quiz",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          points: 50,
          assignmentType: "quiz",
          questions: [
            {
              id: "q1",
              question: "What is 2+2?",
              options: ["3", "4", "5"],
              correctAnswer: 1,
              points: 10,
            },
          ],
          quizSettings: { timeLimit: 30, shuffleQuestions: true },
        },
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status, data } = await parseResponse<{
        assignment: { assignmentType: string; questions: unknown[] };
      }>(response);

      expect(status).toBe(201);
      expect(data.assignment.assignmentType).toBe("quiz");
      expect(data.assignment.questions).toHaveLength(1);
    });

    it("returns 401 for unauthenticated users", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("POST", `/api/courses/${course._id}/assignments`, {
        body: {
          title: "Test",
          description: "Test",
          dueDate: new Date().toISOString(),
          points: 10,
        },
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(401);
    });

    it("returns 403 for students", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("POST", `/api/courses/${course._id}/assignments`, {
        token: studentToken,
        body: {
          title: "Test",
          description: "Test",
          dueDate: new Date().toISOString(),
          points: 10,
        },
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });

    it("returns 400 for invalid data", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);

      const request = buildRequest("POST", `/api/courses/${course._id}/assignments`, {
        token,
        body: { title: "" }, // missing required fields
      });
      const response = await POST(request, {
        params: Promise.resolve({ id: course._id.toString() }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(400);
    });
  });

  describe("GET /api/courses/[id]/assignments/[assignmentId]", () => {
    it("returns assignment details for instructor", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });
      const { assignment } = await createTestAssignment(course._id, {
        isPublished: true,
        assignmentType: "quiz",
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token }
      );
      const response = await GET_ONE(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        assignment: { title: string };
        permissions: { canEdit: boolean; canGrade: boolean };
      }>(response);

      expect(status).toBe(200);
      expect(data.permissions.canEdit).toBe(true);
      expect(data.permissions.canGrade).toBe(true);
    });

    it("strips quiz answers for students", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });

      await createTestEnrollment(course._id, student._id);

      const Assignment = (await import("@/lib/models/Assignment")).default;
      const assignment = await Assignment.create({
        title: "Quiz",
        description: "A quiz",
        course: course._id,
        dueDate: new Date(Date.now() + 86400000),
        points: 50,
        isPublished: true,
        assignmentType: "quiz",
        questions: [
          {
            id: "q1",
            question: "What is 2+2?",
            options: ["3", "4"],
            correctAnswer: 1,
            explanation: "Because math",
            points: 10,
          },
        ],
      });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token: studentToken }
      );
      const response = await GET_ONE(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        assignment: { questions: Record<string, unknown>[] };
      }>(response);

      expect(status).toBe(200);
      // correctAnswer and explanation should be stripped
      expect(data.assignment.questions[0]).not.toHaveProperty("correctAnswer");
      expect(data.assignment.questions[0]).not.toHaveProperty("explanation");
    });

    it("returns 404 for unpublished assignment viewed by student", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { user: student, token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id, { isPublished: true });

      await createTestEnrollment(course._id, student._id);

      const { assignment } = await createTestAssignment(course._id, { isPublished: false });

      const request = buildRequest(
        "GET",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token: studentToken }
      );
      const response = await GET_ONE(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/courses/[id]/assignments/[assignmentId]", () => {
    it("updates assignment fields", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { course } = await createTestCourse(teacher._id);
      const { assignment } = await createTestAssignment(course._id);

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        {
          token,
          body: { title: "Updated Title", points: 200 },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{
        assignment: { title: string; points: number };
      }>(response);

      expect(status).toBe(200);
      expect(data.assignment.title).toBe("Updated Title");
      expect(data.assignment.points).toBe(200);
    });

    it("returns 403 for non-instructor", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id);
      const { assignment } = await createTestAssignment(course._id);

      const request = buildRequest(
        "PATCH",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token: studentToken, body: { title: "Hacked" } }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });

  describe("DELETE /api/courses/[id]/assignments/[assignmentId]", () => {
    it("deletes assignment and cascades to submissions", async () => {
      const { user: teacher, token } = await createTestUser({ role: "teacher" });
      const { user: student } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id);
      const { assignment } = await createTestAssignment(course._id);

      // Create a submission
      const Submission = (await import("@/lib/models/Submission")).default;
      await Submission.create({
        assignment: assignment._id,
        student: student._id,
        content: "My answer",
        status: "submitted",
      });

      const request = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status, data } = await parseResponse<{ message: string }>(response);

      expect(status).toBe(200);
      expect(data.message).toContain("deleted");

      // Verify cascade
      const remainingSubmissions = await Submission.countDocuments({
        assignment: assignment._id,
      });
      expect(remainingSubmissions).toBe(0);
    });

    it("returns 403 for non-instructor", async () => {
      const { user: teacher } = await createTestUser({ role: "teacher" });
      const { token: studentToken } = await createTestUser({ role: "student" });
      const { course } = await createTestCourse(teacher._id);
      const { assignment } = await createTestAssignment(course._id);

      const request = buildRequest(
        "DELETE",
        `/api/courses/${course._id}/assignments/${assignment._id}`,
        { token: studentToken }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({
          id: course._id.toString(),
          assignmentId: assignment._id.toString(),
        }),
      });
      const { status } = await parseResponse(response);

      expect(status).toBe(403);
    });
  });
});
