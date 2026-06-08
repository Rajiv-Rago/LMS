import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { logAuditEvent } from "@/lib/auth/auditLog";

export interface AuthJsUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "teacher" | "admin";
  subscriptionTier: "free" | "plus" | "admin";
}

interface Credentials {
  email?: unknown;
  password?: unknown;
}

const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export async function authorizeCredentials(
  credentials: Credentials | undefined,
  request: NextRequest
): Promise<AuthJsUser | null> {
  if (
    !credentials ||
    typeof credentials.email !== "string" ||
    typeof credentials.password !== "string"
  ) {
    return null;
  }

  const email = credentials.email.trim().toLowerCase();
  if (!email || !credentials.password) {
    return null;
  }

  await dbConnect();

  const user = await User.findOne({ email }).select("+password");
  if (!user || user.isLocked()) {
    return null;
  }

  const isPasswordValid = await user.comparePassword(credentials.password);
  if (!isPasswordValid) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { failedLoginAttempts: 1 } },
      { new: true }
    );

    const attempts = updated?.failedLoginAttempts ?? 1;

    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        { $set: { lockUntil: new Date(Date.now() + LOCKOUT_MS) } }
      );
    }

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? "account.locked" : "login.failure",
      resource: "user",
      resourceId: user._id.toString(),
      metadata: { attempts },
    });

    return null;
  }

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } }
    );
  }

  await logAuditEvent(request, {
    userId: user._id.toString(),
    action: "login.success",
    resource: "user",
    resourceId: user._id.toString(),
  });

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
  };
}
