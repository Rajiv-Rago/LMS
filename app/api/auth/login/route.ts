import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import Session from "@/lib/models/Session";
import { signToken, setAuthCookie, requireCsrf } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { loginSchema } from "@/lib/validation/authSchemas";
import { getClientIp } from "@/lib/utils/request";
import { captureException } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    await dbConnect();

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.isLocked()) {
      const minutesLeft = Math.ceil(
        (user.lockUntil!.getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Account is locked. Try again in ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Atomic increment to prevent TOCTOU race condition
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $inc: { failedLoginAttempts: 1 },
        },
        { new: true }
      );

      const attempts = updated?.failedLoginAttempts ?? 1;

      // Lock after 5 failed attempts for 15 minutes
      if (attempts >= 5) {
        await User.updateOne(
          { _id: user._id },
          { $set: { lockUntil: new Date(Date.now() + 15 * 60 * 1000) } }
        );
      }

      await logAuditEvent(request, {
        userId: user._id.toString(),
        action: attempts >= 5 ? "account.locked" : "login.failure",
        resource: "user",
        resourceId: user._id.toString(),
        metadata: { email, attempts },
      });

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await User.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } }
      );
    }

    const token = signToken(user);

    // Create session record
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await Session.create({
      userId: user._id,
      tokenHash,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    const response = NextResponse.json(
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        message: "Login successful",
      },
      { status: 200 }
    );

    setAuthCookie(response, token);

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "login.success",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return response;
  } catch (error) {
    captureException(error, { operation: "Login error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
