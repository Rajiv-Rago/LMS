import type { Account, Profile } from "next-auth";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import OAuthAccount, { OAuthProvider } from "@/lib/models/OAuthAccount";
import AuditLog, { AuditAction } from "@/lib/models/AuditLog";
import { createAuthSession } from "./sessionRegistry";
import { captureException } from "@/lib/logger";

export interface OAuthAppUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  subscriptionTier: "free" | "plus" | "admin";
  sessionId: string;
}

interface OAuthSignInParams {
  account: Account;
  profile?: Profile;
  linkUserId?: string;
}

interface TrustedOAuthEmail {
  email: string;
  verified: boolean;
}

const SUPPORTED_PROVIDERS = new Set(["google", "github", "facebook"]);
const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000");

export async function resolveOAuthSignIn({
  account,
  profile,
  linkUserId,
}: OAuthSignInParams): Promise<OAuthAppUser | null> {
  if (!isOAuthProvider(account.provider) || !account.providerAccountId) {
    return null;
  }
  const provider = account.provider;

  await dbConnect();

  const trustedEmail = await getTrustedEmail(account, profile);
  if (!trustedEmail) {
    await logOAuthAudit("oauth.login.rejected", SYSTEM_USER_ID, provider, {
      reason: "untrusted_email",
    });
    return null;
  }

  const existingLink = await OAuthAccount.findOne({
    provider: account.provider,
    providerAccountId: account.providerAccountId,
  });

  if (existingLink) {
    if (linkUserId && existingLink.userId.toString() !== linkUserId) {
      await logOAuthAudit("oauth.login.rejected", existingLink.userId, provider, {
        reason: "provider_linked_to_other_user",
      });
      return null;
    }

    const user = await User.findById(existingLink.userId);
    if (!user) {
      await logOAuthAudit("oauth.login.rejected", existingLink.userId, provider, {
        reason: "linked_user_missing",
      });
      return null;
    }

    existingLink.email = trustedEmail.email;
    existingLink.emailVerified = trustedEmail.verified;
    existingLink.name = getProfileName(profile);
    existingLink.image = getProfileImage(profile);
    existingLink.lastLoginAt = new Date();
    await existingLink.save();

    await logOAuthAudit("oauth.login.success", user._id, provider);
    return buildOAuthAppUser(user);
  }

  if (linkUserId) {
    return linkOAuthAccount({
      account,
      provider,
      profile,
      trustedEmail,
      userId: linkUserId,
    });
  }

  const userByEmail = await User.findOne({ email: trustedEmail.email }).setOptions({
    includeSoftDeleted: true,
  });

  if (userByEmail?.deletedAt) {
    await logOAuthAudit("oauth.login.rejected", userByEmail._id, provider, {
      reason: "deleted_user",
    });
    return null;
  }

  if (userByEmail) {
    await logOAuthAudit("oauth.login.rejected", userByEmail._id, provider, {
      reason: "email_already_registered",
    });
    return null;
  }

  const user = await User.create({
    email: trustedEmail.email,
    name: getProfileName(profile) || trustedEmail.email.split("@")[0],
    role: "user",
    subscriptionTier: "free",
  });

  await OAuthAccount.create({
    provider,
    providerAccountId: account.providerAccountId,
    userId: user._id,
    email: trustedEmail.email,
    emailVerified: trustedEmail.verified,
    name: getProfileName(profile),
    image: getProfileImage(profile),
    linkedAt: new Date(),
    lastLoginAt: new Date(),
  });

  await logOAuthAudit(
    "oauth.account.created",
    user._id,
    provider
  );
  await logOAuthAudit("oauth.login.success", user._id, provider);

  return buildOAuthAppUser(user);
}

async function linkOAuthAccount({
  account,
  provider,
  profile,
  trustedEmail,
  userId,
}: {
  account: Account;
  provider: OAuthProvider;
  profile?: Profile;
  trustedEmail: TrustedOAuthEmail;
  userId: string;
}): Promise<OAuthAppUser | null> {
  const user = await User.findById(userId);
  if (!user) {
    await logOAuthAudit(
      "oauth.login.rejected",
      new mongoose.Types.ObjectId(userId),
      provider,
      { reason: "link_user_missing" }
    );
    return null;
  }

  const existingProviderForUser = await OAuthAccount.findOne({
    userId: user._id,
    provider,
  });
  if (existingProviderForUser) {
    await logOAuthAudit("oauth.login.rejected", user._id, provider, {
      reason: "provider_already_linked",
    });
    return null;
  }

  await OAuthAccount.create({
    provider,
    providerAccountId: account.providerAccountId,
    userId: user._id,
    email: trustedEmail.email,
    emailVerified: trustedEmail.verified,
    name: getProfileName(profile),
    image: getProfileImage(profile),
    linkedAt: new Date(),
    lastLoginAt: new Date(),
  });

  await logOAuthAudit("oauth.account.linked", user._id, provider);
  await logOAuthAudit("oauth.login.success", user._id, provider);

  return buildOAuthAppUser(user);
}

function isOAuthProvider(provider: string): provider is OAuthProvider {
  return SUPPORTED_PROVIDERS.has(provider);
}

async function getTrustedEmail(
  account: Account,
  profile?: Profile
): Promise<TrustedOAuthEmail | null> {
  if (account.provider === "google") {
    const email = getProfileEmail(profile);
    if (!email || profile?.email_verified !== true) return null;
    return { email, verified: true };
  }

  if (account.provider === "github") {
    return getGitHubPrimaryEmail(account.access_token);
  }

  if (account.provider === "facebook") {
    const email = getProfileEmail(profile);
    if (!email) return null;
    return { email, verified: true };
  }

  return null;
}

async function getGitHubPrimaryEmail(
  accessToken: string | undefined
): Promise<TrustedOAuthEmail | null> {
  if (!accessToken) return null;

  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return null;

    type GitHubEmail = {
      email?: unknown;
      primary?: unknown;
      verified?: unknown;
    };
    type VerifiedGitHubEmail = GitHubEmail & { email: string };

    const emails = (await response.json()) as GitHubEmail[];
    const primary = emails.find(
      (item): item is VerifiedGitHubEmail =>
        item.primary === true &&
        item.verified === true &&
        typeof item.email === "string"
    );

    if (!primary) return null;
    return { email: normalizeEmail(primary.email), verified: true };
  } catch (error) {
    captureException(error, { operation: "GitHub OAuth email lookup" });
    return null;
  }
}

function getProfileEmail(profile?: Profile): string | null {
  if (typeof profile?.email !== "string") return null;
  return normalizeEmail(profile.email);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getProfileName(profile?: Profile): string | undefined {
  if (typeof profile?.name === "string" && profile.name.trim()) {
    return profile.name.trim();
  }
  return undefined;
}

function getProfileImage(profile?: Profile): string | undefined {
  if (typeof profile?.image === "string") return profile.image;
  if (typeof profile?.picture === "string") return profile.picture;
  return undefined;
}

async function buildOAuthAppUser(user: {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  role: "user" | "admin";
  subscriptionTier: "free" | "plus" | "admin";
}): Promise<OAuthAppUser> {
  const sessionId = await createAuthSession(user._id.toString(), {
    ip: "oauth",
    userAgent: "Auth.js OAuth",
  });

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    sessionId,
  };
}

async function logOAuthAudit(
  action: AuditAction,
  userId: mongoose.Types.ObjectId,
  provider: OAuthProvider,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await AuditLog.create({
      userId,
      action,
      resource: "oauth",
      resourceId: provider,
      ip: "oauth",
      metadata: { provider, ...metadata },
    });
  } catch (error) {
    captureException(error, { operation: "OAuth audit log error" });
  }
}
