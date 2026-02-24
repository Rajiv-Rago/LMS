import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import Notification from "@/lib/models/Notification";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { limit: 20, maxLimit: 50 });

    await dbConnect();

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: user.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: user.userId }),
      Notification.countDocuments({ userId: user.userId, read: false }),
    ]);

    return NextResponse.json({
      data: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    captureException(error, { operation: "List notifications error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    await Notification.updateMany(
      { userId: user.userId, read: false },
      { $set: { read: true } }
    );

    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) {
    captureException(error, { operation: "Mark all notifications read error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
