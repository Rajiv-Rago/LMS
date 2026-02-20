import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dbConnect, DatabaseConnectionError } from "@/lib/db";
import User from "@/lib/models/User";
import Session from "@/lib/models/Session";
import { signToken, setAuthCookie, requireCsrf } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { registerSchema } from "@/lib/validation/authSchemas";
import { getClientIp } from "@/lib/utils/request";
import { captureException } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, name, password, role } = validation.data;

    await dbConnect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const user = await User.create({
      email,
      name,
      password,
      role,
    });

    const token = signToken(user);

    // Create session record
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await Session.create({
      userId: user._id,
      tokenHash,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || "unknown",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const response = NextResponse.json(
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        message: "Registration successful",
      },
      { status: 201 }
    );

    setAuthCookie(response, token);

    await logAuditEvent(request, {
      userId: user._id.toString(),
      action: "account.created",
      resource: "user",
      resourceId: user._id.toString(),
    });

    return response;
  } catch (error) {
    captureException(error, { operation: "Registration error" });

    if (error instanceof DatabaseConnectionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
