import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import { createTestUser } from "../../__tests__/helpers/fixtures";
import { buildRequest } from "../../__tests__/helpers/api";
import { authorizeCredentials } from "./credentials";
import AuditLog from "@/lib/models/AuditLog";
import User from "@/lib/models/User";
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

describe("authorizeCredentials", () => {
  it("returns Auth.js-compatible user data for valid credentials", async () => {
    const { user } = await createTestUser({
      email: "authjs@example.com",
      name: "Auth User",
      password: "password123",
      role: "teacher",
    });

    await User.updateOne({ _id: user._id }, { $set: { subscriptionTier: "plus" } });
    await AuthSession.deleteMany({ userId: user._id });

    const request = buildRequest("POST", "/api/auth/callback/credentials");
    const result = await authorizeCredentials(
      { email: " AUTHJS@example.com ", password: "password123" },
      request
    );

    expect(result).toMatchObject({
      id: user._id.toString(),
      email: "authjs@example.com",
      name: "Auth User",
      role: "teacher",
      subscriptionTier: "plus",
    });
    expect(result?.sessionId).toEqual(expect.any(String));
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);

    const auditLog = await AuditLog.findOne({ action: "login.success" });
    expect(auditLog?.userId.toString()).toBe(user._id.toString());
  });

  it("returns null and increments failed attempts for a bad password", async () => {
    const { user } = await createTestUser({
      email: "bad-password@example.com",
      password: "password123",
    });

    const request = buildRequest("POST", "/api/auth/callback/credentials");
    const result = await authorizeCredentials(
      { email: "bad-password@example.com", password: "wrongpassword" },
      request
    );

    expect(result).toBeNull();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.failedLoginAttempts).toBe(1);

    const auditLog = await AuditLog.findOne({ action: "login.failure" });
    expect(auditLog?.metadata).toEqual({ attempts: 1 });
  });

  it("locks the account and logs account.locked on the fifth bad password", async () => {
    const { user } = await createTestUser({
      email: "lock@example.com",
      password: "password123",
    });
    await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 4 } });

    const request = buildRequest("POST", "/api/auth/callback/credentials");
    const result = await authorizeCredentials(
      { email: "lock@example.com", password: "wrongpassword" },
      request
    );

    expect(result).toBeNull();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.failedLoginAttempts).toBe(5);
    expect(updatedUser?.lockUntil?.getTime()).toBeGreaterThan(Date.now());

    const auditLog = await AuditLog.findOne({ action: "account.locked" });
    expect(auditLog?.metadata).toEqual({ attempts: 5 });
  });

  it("returns null for a locked user", async () => {
    const { user } = await createTestUser({
      email: "locked@example.com",
      password: "password123",
    });
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 5, lockUntil: new Date(Date.now() + 60_000) } }
    );

    const request = buildRequest("POST", "/api/auth/callback/credentials");
    const result = await authorizeCredentials(
      { email: "locked@example.com", password: "password123" },
      request
    );

    expect(result).toBeNull();
    expect(await AuditLog.countDocuments()).toBe(0);
  });

  it("resets failed attempts and exposes id, role, and subscription tier on success", async () => {
    const { user } = await createTestUser({
      email: "reset@example.com",
      password: "password123",
      role: "admin",
    });
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: 3,
          lockUntil: new Date(Date.now() - 60_000),
          subscriptionTier: "admin",
        },
      }
    );

    const request = buildRequest("POST", "/api/auth/callback/credentials");
    const result = await authorizeCredentials(
      { email: "reset@example.com", password: "password123" },
      request
    );

    expect(result).toMatchObject({
      id: user._id.toString(),
      role: "admin",
      subscriptionTier: "admin",
    });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.failedLoginAttempts).toBe(0);
    expect(updatedUser?.lockUntil).toBeUndefined();
  });

  it("returns null for missing or non-string credentials", async () => {
    const request = buildRequest("POST", "/api/auth/callback/credentials");

    await expect(authorizeCredentials(undefined, request)).resolves.toBeNull();
    await expect(
      authorizeCredentials({ email: "missing-password@example.com" }, request)
    ).resolves.toBeNull();
    await expect(
      authorizeCredentials({ email: "invalid@example.com", password: 123 }, request)
    ).resolves.toBeNull();
  });
});
