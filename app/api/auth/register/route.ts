import { NextRequest, NextResponse } from "next/server";
import { dbConnect, DatabaseConnectionError } from "@/lib/db";
import User from "@/lib/models/User";
import { requireCsrf } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { registerSchema } from "@/lib/validation/authSchemas";
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

    const { email, name, password } = validation.data;

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
      role: "user",
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
