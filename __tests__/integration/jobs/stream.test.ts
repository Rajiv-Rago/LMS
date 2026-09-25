import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { buildRequest } from "../../helpers/api";
import Job from "@/lib/models/Job";

import { GET } from "@/app/api/jobs/[jobId]/stream/route";

jest.setTimeout(30000);

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (value) text += decoder.decode(value, { stream: true });
    if (done || text.includes("event: status")) break;
  }
  try {
    await reader.cancel();
  } catch {
    // Ignore
  }
  return text;
}

describe("GET /api/jobs/[jobId]/stream", () => {
  it("returns 401 without auth", async () => {
    const request = buildRequest("GET", "/api/jobs/abc/stream");
    const response = await GET(request, { params: Promise.resolve({ jobId: "abc" }) });
    expect(response.status).toBe(401);
  });

  it("streams a status event for a completed job", async () => {
    const { user, token } = await createTestUser();
    const job = await Job.create({
      type: "ai.generate-syllabus",
      status: "completed",
      userId: user._id,
      data: {},
      result: { courseId: "course-1" },
    });

    const request = buildRequest("GET", `/api/jobs/${job._id}/stream`, { token });
    const response = await GET(request, {
      params: Promise.resolve({ jobId: job._id.toString() }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const text = await readStream(response);
    expect(text).toContain("event: status");
    expect(text).toContain("completed");
    expect(text).toContain("course-1");
  });

  it("emits an error event for an unknown job", async () => {
    const { token } = await createTestUser();
    const request = buildRequest("GET", "/api/jobs/000000000000000000000000/stream", { token });
    const response = await GET(request, {
      params: Promise.resolve({ jobId: "000000000000000000000000" }),
    });

    expect(response.status).toBe(200);
    const text = await readStream(response);
    expect(text).toContain("event: error");
  });
});
