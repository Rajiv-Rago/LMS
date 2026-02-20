import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect, DatabaseConnectionError } from "@/lib/db";
import User from "@/lib/models/User";
import { signToken, setAuthCookie } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["student", "teacher"]).default("student"),
});

export async function POST(request: NextRequest) {
  try {
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
    captureException(error, { message: "Registration error" });

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
