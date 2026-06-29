import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect, withTransaction } from "@/lib/db";
import { authenticate, requireCsrf } from "@/lib/auth";
import {
  User,
  Submission,
  AIChatSession,
  Notification,
  Session,
  AuthSession,
} from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { captureException } from "@/lib/logger";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required for account deletion"),
});

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = deleteAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify password
    const userDoc = await User.findById(user.userId).select("+password");
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await userDoc.comparePassword(validation.data.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 403 }
      );
    }

    await withTransaction(async (session) => {
      // Anonymize submissions (preserve data integrity for grading)
      await Submission.updateMany(
        { student: user.userId },
        {
          $set: {
            content: "[deleted]",
            fileUrl: null,
            url: null,
          },
        },
        { session }
      );

      // Remove enrollment records
      await Enrollment.deleteMany({ student: user.userId }, { session });

      // Delete chat sessions
      await AIChatSession.deleteMany({ user: user.userId }, { session });

      // Delete notifications
      await Notification.deleteMany({ userId: user.userId }, { session });

      // Delete all sessions
      await Session.deleteMany({ userId: user.userId }, { session });
      await AuthSession.deleteMany({ userId: user.userId }, { session });

      // Anonymize user record
      userDoc.email = `deleted-${user.userId}@deleted.invalid`;
      userDoc.name = "Deleted User";
      userDoc.password = "DELETED_ACCOUNT";
      userDoc.deletedAt = new Date();
      userDoc.failedLoginAttempts = 0;
      userDoc.lockUntil = undefined;
      userDoc.aiPreferences = undefined;
      await userDoc.save({ session });
    });

    // The account is soft-deleted, so authenticate()'s User lookup now fails
    // and the Auth.js session dies on its own — no cookie to clear.
    return NextResponse.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    captureException(error, { operation: "Delete user account error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
