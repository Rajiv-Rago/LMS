import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import { createTestUser } from "../../__tests__/helpers/fixtures";
import { resolveOAuthSignIn } from "./oauth";
import User from "@/lib/models/User";
import OAuthAccount from "@/lib/models/OAuthAccount";
import AuthSession from "@/lib/models/AuthSession";
import AuditLog from "@/lib/models/AuditLog";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("resolveOAuthSignIn", () => {
  it("creates a free student for a trusted Google email", async () => {
    const result = await resolveOAuthSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-1",
        type: "oauth",
      },
      profile: {
        email: "New.Google@Example.com",
        email_verified: true,
        name: "Google User",
        picture: "https://example.com/avatar.png",
      },
    });

    expect(result).toMatchObject({
      email: "new.google@example.com",
      name: "Google User",
      role: "user",
      subscriptionTier: "free",
      sessionId: expect.any(String),
    });

    const user = await User.findOne({ email: "new.google@example.com" }).select("+password");
    expect(user).toBeTruthy();
    expect(user?.password).toBeUndefined();
    expect(await OAuthAccount.countDocuments({ userId: user!._id })).toBe(1);
    expect(await AuthSession.countDocuments({ userId: user!._id })).toBe(1);
    expect(await AuditLog.exists({ action: "oauth.account.created" })).toBeTruthy();
  });

  it("rejects a trusted matching email without an explicit link intent", async () => {
    const { user } = await createTestUser({
      email: "teacher@example.com",
      role: "user",
    });
    await User.updateOne({ _id: user._id }, { $set: { subscriptionTier: "plus" } });

    const result = await resolveOAuthSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-teacher",
        type: "oauth",
      },
      profile: {
        email: "teacher@example.com",
        email_verified: true,
        name: "Teacher Name",
      },
    });

    expect(result).toBeNull();
    expect(await User.countDocuments({ email: "teacher@example.com" })).toBe(1);
    expect(await OAuthAccount.countDocuments()).toBe(0);
    expect(await AuditLog.exists({ action: "oauth.login.rejected" })).toBeTruthy();
  });

  it("links a trusted matching email with an explicit link intent", async () => {
    const { user } = await createTestUser({
      email: "teacher@example.com",
      role: "user",
    });
    await User.updateOne({ _id: user._id }, { $set: { subscriptionTier: "plus" } });

    const result = await resolveOAuthSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-teacher",
        type: "oauth",
      },
      profile: {
        email: "teacher@example.com",
        email_verified: true,
        name: "Teacher Name",
      },
      linkUserId: user._id.toString(),
    });

    expect(result).toMatchObject({
      id: user._id.toString(),
      role: "user",
      subscriptionTier: "plus",
    });
    expect(await OAuthAccount.exists({ provider: "google", userId: user._id })).toBeTruthy();
    expect(await AuditLog.exists({ action: "oauth.account.linked" })).toBeTruthy();
  });

  it("uses an existing provider link without creating a duplicate", async () => {
    const { user } = await createTestUser({ email: "linked@example.com" });
    await OAuthAccount.create({
      provider: "google",
      providerAccountId: "google-linked",
      userId: user._id,
      email: "linked@example.com",
      emailVerified: true,
      linkedAt: new Date(Date.now() - 60_000),
      lastLoginAt: new Date(Date.now() - 60_000),
    });

    const result = await resolveOAuthSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-linked",
        type: "oauth",
      },
      profile: {
        email: "linked@example.com",
        email_verified: true,
        name: "Linked User",
      },
    });

    expect(result.id).toBe(user._id.toString());
    expect(await OAuthAccount.countDocuments()).toBe(1);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(2);
  });

  it("rejects untrusted provider emails", async () => {
    await expect(
      resolveOAuthSignIn({
        account: {
          provider: "google",
          providerAccountId: "google-unverified",
          type: "oauth",
        },
        profile: {
          email: "unverified@example.com",
          email_verified: false,
        },
      })
    ).resolves.toBeNull();

    expect(await User.countDocuments()).toBe(0);
    expect(await OAuthAccount.countDocuments()).toBe(0);
    expect(await AuditLog.exists({ action: "oauth.login.rejected" })).toBeTruthy();
  });

  it("rejects linking a second account for the same provider with a link intent", async () => {
    const { user } = await createTestUser({ email: "provider@example.com" });
    await OAuthAccount.create({
      provider: "google",
      providerAccountId: "google-old",
      userId: user._id,
      email: user.email,
      emailVerified: true,
      linkedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const result = await resolveOAuthSignIn({
      account: {
        provider: "google",
        providerAccountId: "google-new",
        type: "oauth",
      },
      profile: {
        email: "new-provider@example.com",
        email_verified: true,
      },
      linkUserId: user._id.toString(),
    });

    expect(result).toBeNull();
    expect(await OAuthAccount.countDocuments()).toBe(1);
    expect(await AuditLog.exists({ action: "oauth.login.rejected" })).toBeTruthy();
  });

  it("uses GitHub's primary verified email endpoint", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          email: "secondary@example.com",
          primary: false,
          verified: true,
        },
        {
          email: "github@example.com",
          primary: true,
          verified: true,
        },
      ],
    } as Response);

    const result = await resolveOAuthSignIn({
      account: {
        provider: "github",
        providerAccountId: "github-1",
        type: "oauth",
        access_token: "github-token",
      },
      profile: {
        name: "GitHub User",
      },
    });

    expect(result?.email).toBe("github@example.com");
    expect(global.fetch).toHaveBeenCalledWith("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer github-token",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  });
});
