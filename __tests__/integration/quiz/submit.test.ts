import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
  createTestQuizAssignment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route";
import { POST as START } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route";
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

async function setupQuiz() {
  const { user: teacher } = await createTestUser({ role: "user" });
  const { user: student, token: studentToken } = await createTestUser({ role: "user" });
  const { course } = await createTestCourse(teacher._id, { isPublished: true });
  await createTestEnrollment(course._id, student._id);
  const { assignment } = await createTestQuizAssignment(course._id);

  // Start an attempt
  const startReq = buildRequest(
    "POST",
    `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
    { token: studentToken }
  );
  await START(startReq, {
    params: Promise.resolve({
      id: course._id.toString(),
      assignmentId: assignment._id.toString(),
    }),
  });

  return { teacher, student, studentToken, course, assignment };
}

describe("POST /api/courses/[id]/assignments/[assignmentId]/quiz/submit", () => {
  it("returns 401 for unauthenticated user", async () => {
    const request = buildRequest(
      "POST",
      "/api/courses/000000000000000000000001/assignments/000000000000000000000002/quiz/submit",
      { body: { answers: {} } }
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

  it("returns 400 when no active attempt exists", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: student, token: studentToken } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1 } } }
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

  it("returns 400 when attempt already submitted", async () => {
    const { studentToken, course, assignment } = await setupQuiz();

    // Submit once
    const req1 = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
    );
    await POST(req1, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });

    // Try to submit again
    const req2 = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
    );
    const response = await POST(req2, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(400);
  });

  it("returns 400 when time limit exceeded", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: student, token: studentToken } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id, {
      quizSettings: { timeLimit: 1, shuffleQuestions: false, showCorrectAnswers: true },
    });

    // Create an expired but not yet closed attempt
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
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1 } } }
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

  it("returns score, totalPoints, percentage, bestScore after grading", async () => {
    const { studentToken, course, assignment } = await setupQuiz();

    // q1: correct=1, q2: correct=1, q3: correct=2
    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 0, q3: 2 } } }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      score: number;
      totalPoints: number;
      percentage: number;
      bestScore: number;
      attemptNumber: number;
    }>(response);

    expect(status).toBe(200);
    expect(data.score).toBe(20); // q1 correct (10) + q3 correct (10)
    expect(data.totalPoints).toBe(30);
    expect(data.percentage).toBe(67);
    expect(data.bestScore).toBe(20);
    expect(data.attemptNumber).toBe(1);
  });

  it("includes detailed answers when showCorrectAnswers is enabled", async () => {
    const { studentToken, course, assignment } = await setupQuiz();

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      answers: Array<{ questionId: string; isCorrect: boolean }>;
      questions: Array<{ id: string; correctAnswer: number }>;
    }>(response);

    expect(status).toBe(200);
    expect(data.answers).toBeDefined();
    expect(data.questions).toBeDefined();
    expect(data.answers).toHaveLength(3);
    expect(data.questions).toHaveLength(3);
  });

  it("omits detailed answers when showCorrectAnswers is disabled", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: student, token: studentToken } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id, {
      quizSettings: { timeLimit: 30, shuffleQuestions: false, showCorrectAnswers: false },
    });

    // Start attempt
    const startReq = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/start`,
      { token: studentToken }
    );
    await START(startReq, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
    );
    const response = await POST(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      score: number;
      answers?: unknown;
      questions?: unknown;
    }>(response);

    expect(status).toBe(200);
    expect(data.score).toBeDefined();
    expect(data.answers).toBeUndefined();
    expect(data.questions).toBeUndefined();
  });

  it("updates submission status to graded with bestScore as grade", async () => {
    const { student, studentToken, course, assignment } = await setupQuiz();

    const request = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
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
    expect(submission!.status).toBe("graded");
    expect(submission!.grade).toBe(30);
    expect(submission!.bestScore).toBe(30);
  });
});
