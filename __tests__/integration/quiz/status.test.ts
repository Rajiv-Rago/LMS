import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import {
  createTestUser,
  createTestCourse,
  createTestEnrollment,
  createTestQuizAssignment,
} from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { GET } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/route";
import { POST as START } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/start/route";
import { POST as SUBMIT } from "@/app/api/courses/[id]/assignments/[assignmentId]/quiz/submit/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("GET /api/courses/[id]/assignments/[assignmentId]/quiz", () => {
  it("returns quiz info and attempts for enrolled student", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: studentToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      quiz: { title: string; questionCount: number; timeLimit: number };
      attempts: unknown[];
      bestScore: number | null;
      hasActiveAttempt: boolean;
    }>(response);

    expect(status).toBe(200);
    expect(data.quiz.title).toBe("Test Quiz");
    expect(data.quiz.questionCount).toBe(3);
    expect(data.attempts).toHaveLength(0);
    expect(data.bestScore).toBeNull();
    expect(data.hasActiveAttempt).toBe(false);
  });

  it("returns full assignment details for instructor", async () => {
    const { user: teacher, token: teacherToken } = await createTestUser({ role: "teacher" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: teacherToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      assignment: { title: string };
      isInstructor: boolean;
    }>(response);

    expect(status).toBe(200);
    expect(data.isInstructor).toBe(true);
    expect(data.assignment).toBeDefined();
  });

  it("returns full assignment details for admin", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { token: adminToken } = await createTestUser({ role: "admin" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: adminToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      isInstructor: boolean;
    }>(response);

    expect(status).toBe(200);
    expect(data.isInstructor).toBe(true);
  });

  it("returns 200 for non-enrolled outsider on published course", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { token: outsiderToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    const { assignment } = await createTestQuizAssignment(course._id);

    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: outsiderToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status } = await parseResponse(response);
    expect(status).toBe(200);
  });

  it("detects active attempt", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
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

    // Check status
    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: studentToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      hasActiveAttempt: boolean;
      attempts: Array<{ attemptNumber: number }>;
    }>(response);

    expect(status).toBe(200);
    expect(data.hasActiveAttempt).toBe(true);
    expect(data.attempts).toHaveLength(1);
  });

  it("shows completed attempts after submission", async () => {
    const { user: teacher } = await createTestUser({ role: "teacher" });
    const { user: student, token: studentToken } = await createTestUser({ role: "student" });
    const { course } = await createTestCourse(teacher._id, { isPublished: true });
    await createTestEnrollment(course._id, student._id);
    const { assignment } = await createTestQuizAssignment(course._id);

    // Start and submit an attempt
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

    const submitReq = buildRequest(
      "POST",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz/submit`,
      { token: studentToken, body: { answers: { q1: 1, q2: 1, q3: 2 } } }
    );
    await SUBMIT(submitReq, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });

    // Check status
    const request = buildRequest(
      "GET",
      `/api/courses/${course._id}/assignments/${assignment._id}/quiz`,
      { token: studentToken }
    );
    const response = await GET(request, {
      params: Promise.resolve({
        id: course._id.toString(),
        assignmentId: assignment._id.toString(),
      }),
    });
    const { status, data } = await parseResponse<{
      hasActiveAttempt: boolean;
      bestScore: number;
      attempts: Array<{ attemptNumber: number; completedAt: string }>;
    }>(response);

    expect(status).toBe(200);
    expect(data.hasActiveAttempt).toBe(false);
    expect(data.bestScore).toBe(30);
    expect(data.attempts).toHaveLength(1);
    expect(data.attempts[0].completedAt).toBeTruthy();
  });
});
