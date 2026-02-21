import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { authenticate } from "@/lib/auth";
import { updateAIPreferencesSchema } from "@/lib/validation/aiSchemas";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const dbUser = await User.findById(user.userId).select("aiPreferences");

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      aiPreferences: dbUser.aiPreferences ?? {},
    });
  } catch (error) {
    captureException(error, { operation: "Get user preferences error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateAIPreferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const update: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};

    for (const [key, value] of Object.entries(validation.data)) {
      if (value === null || value === undefined) {
        unset[`aiPreferences.${key}`] = 1;
      } else {
        update[`aiPreferences.${key}`] = value;
      }
    }

    const updateOp: Record<string, unknown> = {};
    if (Object.keys(update).length > 0) updateOp.$set = update;
    if (Object.keys(unset).length > 0) updateOp.$unset = unset;

    if (Object.keys(updateOp).length === 0) {
      return NextResponse.json({ aiPreferences: {} });
    }

    const dbUser = await User.findByIdAndUpdate(user.userId, updateOp, {
      new: true,
    }).select("aiPreferences");

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      aiPreferences: dbUser.aiPreferences ?? {},
    });
  } catch (error) {
    captureException(error, { operation: "Update user preferences error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
