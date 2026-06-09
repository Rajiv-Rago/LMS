import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import { createTestUser } from "../../helpers/fixtures";
import { GET, DELETE as deleteAll } from "@/app/api/auth/sessions/route";
import { DELETE as deleteOne } from "@/app/api/auth/sessions/[id]/route";
import AuthSession from "@/lib/models/AuthSession";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("/api/auth/sessions", () => {
  it("lists only the user's active sessions and marks the current one", async () => {
    const { user, token } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    await AuthSession.create({
      sessionId: "other-device",
      userId: user._id,
      ip: "198.51.100.2",
      userAgent: "Other Browser",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await GET(buildRequest("GET", "/api/auth/sessions", { token }));
    const { status, data } = await parseResponse<{
      data: Array<{ id: string; isCurrent: boolean }>;
    }>(response);

    expect(status).toBe(200);
    expect(data.data).toHaveLength(2);
    expect(data.data.filter((session) => session.isCurrent)).toHaveLength(1);
    expect(
      await AuthSession.countDocuments({ userId: otherUser._id })
    ).toBe(1);
  });

  it("revokes an owned session and rejects another user's session", async () => {
    const { user, token } = await createTestUser();
    const owned = await AuthSession.create({
      sessionId: "owned-device",
      userId: user._id,
      ip: "127.0.0.1",
      userAgent: "Other Browser",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { user: otherUser } = await createTestUser();
    const other = await AuthSession.findOne({ userId: otherUser._id });

    const revoked = await deleteOne(
      buildRequest("DELETE", `/api/auth/sessions/${owned._id}`, { token }),
      { params: Promise.resolve({ id: owned._id.toString() }) }
    );
    expect(revoked.status).toBe(200);
    expect(await AuthSession.findById(owned._id)).toBeNull();

    const rejected = await deleteOne(
      buildRequest("DELETE", `/api/auth/sessions/${other!._id}`, { token }),
      { params: Promise.resolve({ id: other!._id.toString() }) }
    );
    expect(rejected.status).toBe(404);
  });

  it("revokes all sessions for the current user only", async () => {
    const { user, token } = await createTestUser();
    await createTestUser();
    await AuthSession.create({
      sessionId: "second-device",
      userId: user._id,
      ip: "127.0.0.1",
      userAgent: "Other Browser",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await deleteAll(
      buildRequest("DELETE", "/api/auth/sessions", { token })
    );

    expect(response.status).toBe(200);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    expect(await AuthSession.countDocuments()).toBe(1);
  });
});
