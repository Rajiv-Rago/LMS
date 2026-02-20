import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid notification ID" },
        { status: 400 }
      );
    }

    await dbConnect();

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        read: notification.read,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Mark notification read error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
