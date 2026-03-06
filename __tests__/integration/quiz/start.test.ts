import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
  createTestQuizAssignment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route";
import Submission from "@/lib/models/Submission";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("POST /api/courses/[id]/assignments/[assignmentId]/quiz/start", () => {
  it("returns 401 for unauthenticated user", async () => {
    const request = buildRequest(
      "POST",
      "/api/courses/000000000000000000000001/assignments/000000000000000000000002/quiz/start"
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: "000000000000000000000001",
        assignmentId: "000000000000000000000002",
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(401);
  });

  it("returns 400 for invalid course ObjectId", async () => {
    const { token } = await createTestUser();
    const request = buildRequest(
      "POST",
      "/api/courses/not-valid/assignments/000000000000000000000002/quiz/start",
      { token }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: "not-valid",
        assignmentId: "000000000000000000000002",
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(400);
  });

  it("returns 400 for invalid assignment ObjectId", async () => {
    const { token } = await createTestUser();
    const request = buildRequest(
      "POST",
      "/api/courses/000000000000000000000001/assignments/not-valid/quiz/start",
      { token }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: "000000000000000000000001",
        assignmentId: "not-valid",
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(400);
  });

  it("returns 404 for non-existent course", async () => {
    const { token } = await createTestUser();
    const fakeId = "000000000000000000000099";
    const request = buildRequest(
      "POST",
      `/api/courses/${fakeId}/assignments/000000000000000000000002/quiz/start`,
      { token }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: fakeId,
        assignmentId: "000000000000000000000002",
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(404);
  });

  it("returns 403 for non-enrolled student", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(403);
  });

  it("returns 404 for non-existent quiz assignment", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);

    const fakeAssignmentId = "000000000000000000000099";
    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${fakeAssignmentId}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: fakeAssignmentId,
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(404);
  });

  it("returns 400 for unpublished quiz", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id, {
      isPublished: false,
    });

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(400);
  });

  it("returns questions without correctAnswer for enrolled student", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      attempt: { attemptNumber: number; startedAt: string; remainingTime: number | null };
      questions: Array<{ id: string; question: string; options: string[]; points: number; correctAnswer?: number }>;
      totalPoints: number;
    }>(response);

    expect(status).toBe(200);
    expect(data.attempt.attemptNumber).toBe(1);
    expect(data.questions).toHaveLength(3);
    expect(data.questions[0]).not.toHaveProperty("correctAnswer");
    expect(data.totalPoints).toBe(30);
  });

  it("creates a Submission document on first attempt", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });

    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    expect(submission).not.toBeNull();
    expect(submission!.quizAttempts).toHaveLength(1);
  });

  it("resumes existing incomplete attempt instead of creating new", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    // Start first attempt
    const req1 = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    await POST(req1, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });

    // Start again without submitting - should resume
    const req2 = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(req2, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      attempt: { attemptNumber: number };
    }>(response);

    expect(status).toBe(200);
    expect(data.attempt.attemptNumber).toBe(1);

    // Should still only have 1 attempt
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    expect(submission!.quizAttempts).toHaveLength(1);
  });

  it("auto-closes expired attempt and starts fresh", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id, {
      quizSettings: { timeLimit: 1, shuffleQuestions: false, showCorrectAnswers: true },
    });

    // Create an expired attempt (started 2 minutes ago with 1 min time limit)
    await Submission.create({
      assignment: assignment._id,
      student: student._id,
      status: "draft",
      quizAttempts: [
        {
          attemptNumber: 1,
          answers: [],
          score: 0,
          startedAt: new Date(Date.now() - 2 * 60 * 1000),
        },
      ],
    });

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      attempt: { attemptNumber: number };
    }>(response);

    expect(status).toBe(200);
    expect(data.attempt.attemptNumber).toBe(2);

    // Verify expired attempt was auto-closed
    const submission = await Submission.findOne({
      assignment: assignment._id,
      student: student._id,
    });
    expect(submission!.quizAttempts).toHaveLength(2);
    expect(submission!.quizAttempts![0].completedAt).toBeTruthy();
  });
});
