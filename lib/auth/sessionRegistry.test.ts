import { NextRequest } from "next/server";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import { createTestUser } from "../../__tests__/helpers/fixtures";
import AuthSession from "@/lib/models/AuthSession";
import {
  AUTH_SESSION_MAX_AGE_SECONDS,
  createAuthSession,
  validateAuthSession,
} from "./sessionRegistry";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("sessionRegistry", () => {
  it("creates a 30-day session with request metadata", async () => {
    const { user } = await createTestUser();
    await AuthSession.deleteMany({});
    const before = Date.now();

    const sessionId = await createAuthSession(
      user._id.toString(),
      new NextRequest("http://localhost/api/auth/callback/credentials", {
        headers: {
          "user-agent": "Test Browser",
          "x-forwarded-for": "203.0.113.10",
        },
      })
    );

    const session = await AuthSession.findOne({ sessionId });
    expect(session?.userAgent).toBe("Test Browser");
    expect(session?.ip).toBe("203.0.113.10");
    expect(session!.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + AUTH_SESSION_MAX_AGE_SECONDS * 1000
    );
  });

  it("creates a session from a standard Request without forwarded IP headers", async () => {
    const { user } = await createTestUser();

    const sessionId = await createAuthSession(
      user._id.toString(),
      new Request("http://localhost/api/auth/callback/credentials", {
        headers: { "user-agent": "Test Browser" },
      })
    );

    const session = await AuthSession.findOne({ sessionId });
    expect(session?.ip).toBe("unknown");
    expect(session?.userAgent).toBe("Test Browser");
  });

  it("rejects missing and expired sessions", async () => {
    const { user } = await createTestUser();
    const session = await AuthSession.findOne({ userId: user._id });
    await AuthSession.updateOne(
      { _id: session!._id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    await expect(
      validateAuthSession(session!.sessionId, user._id.toString())
    ).resolves.toBe(false);
    await expect(
      validateAuthSession("missing", user._id.toString())
    ).resolves.toBe(false);
  });

  it("extends an active session after the activity throttle", async () => {
    const { user } = await createTestUser();
    const session = await AuthSession.findOne({ userId: user._id });
    const oldExpiry = new Date(Date.now() + 60_000);
    await AuthSession.updateOne(
      { _id: session!._id },
      {
        $set: {
          lastActiveAt: new Date(Date.now() - 6 * 60 * 1000),
          expiresAt: oldExpiry,
        },
      }
    );

    await expect(
      validateAuthSession(session!.sessionId, user._id.toString(), true)
    ).resolves.toBe(true);

    const updated = await AuthSession.findById(session!._id);
    expect(updated!.expiresAt.getTime()).toBeGreaterThan(oldExpiry.getTime());
  });
});
