import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import { createTestUser } from "../../helpers/fixtures";
import { DELETE } from "@/app/api/auth/providers/[provider]/route";
import OAuthAccount, { OAuthProvider } from "@/lib/models/OAuthAccount";
import AuditLog from "@/lib/models/AuditLog";
import mongoose from "mongoose";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

async function linkProvider(
  userId: mongoose.Types.ObjectId,
  provider: OAuthProvider,
  email: string
) {
  await OAuthAccount.create({
    provider,
    providerAccountId: `${provider}-${userId}`,
    userId,
    email,
    emailVerified: true,
    linkedAt: new Date(),
    lastLoginAt: new Date(),
  });
}

function callDelete(provider: string, token?: string) {
  return DELETE(
    buildRequest("DELETE", `/api/auth/providers/${provider}`, { token }),
    { params: Promise.resolve({ provider }) }
  );
}

describe("DELETE /api/auth/providers/[provider]", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await callDelete("github");
    expect(response.status).toBe(401);
  });

  it("rejects unsupported providers", async () => {
    const { token } = await createTestUser();
    const response = await callDelete("twitter", token);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the provider is not connected", async () => {
    const { token } = await createTestUser();
    const response = await callDelete("github", token);
    expect(response.status).toBe(404);
  });

  it("disconnects a linked provider and writes an audit event", async () => {
    const { user, token } = await createTestUser();
    await linkProvider(user._id, "github", user.email);

    const response = await callDelete("github", token);
    const { status, data } = await parseResponse<{ ok: boolean }>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(await OAuthAccount.findOne({ userId: user._id, provider: "github" })).toBeNull();
    expect(
      await AuditLog.findOne({ userId: user._id, action: "oauth.account.unlinked" })
    ).not.toBeNull();
  });

  it("blocks disconnecting the only sign-in method for a passwordless user", async () => {
    const { user, token } = await createTestUser({ password: undefined });
    await linkProvider(user._id, "github", user.email);

    const response = await callDelete("github", token);

    expect(response.status).toBe(409);
    expect(
      await OAuthAccount.findOne({ userId: user._id, provider: "github" })
    ).not.toBeNull();
  });

  it("allows a passwordless user to disconnect when another provider remains", async () => {
    const { user, token } = await createTestUser({ password: undefined });
    await linkProvider(user._id, "github", user.email);
    await linkProvider(user._id, "google", user.email);

    const response = await callDelete("github", token);

    expect(response.status).toBe(200);
    expect(await OAuthAccount.countDocuments({ userId: user._id })).toBe(1);
  });
});
