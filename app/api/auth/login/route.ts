import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { signToken, setAuthCookie } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
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
      // Increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update: Record<string, unknown> = { failedLoginAttempts: attempts };

      // Lock after 5 failed attempts for 15 minutes
      if (attempts >= 5) {
        update.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await User.updateOne({ _id: user._id }, { $set: update });

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
    captureException(error, { message: "Login error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
