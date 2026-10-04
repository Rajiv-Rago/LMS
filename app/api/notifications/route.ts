import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { COURSE_CREATION_NOTIFICATION_FILTER } from "@/lib/utils/courseNotifications";
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

    const { page, limit, skip } = parsePagination(request, { maxLimit: 50 });

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
      pagination: paginationMeta(total, page, limit),
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

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const readCourseNotificationsSchema = z.union([
  z.object({ ids: z.array(objectId).min(1).max(50) }).strict(),
  z.object({ courseId: objectId }).strict(),
]);

// A scoped mutation: never mark another user's or unrelated notices as read.
export async function PATCH(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const validation = readCourseNotificationsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid notification selection" }, { status: 400 });
    }
    const selection = validation.data;
    const scope = "ids" in selection
      ? { _id: { $in: selection.ids } }
      : { link: { $in: [`/courses/${selection.courseId}`, `/courses/${selection.courseId}/overview`] } };

    await dbConnect();
    await Notification.updateMany(
      { userId: user.userId, read: false, ...COURSE_CREATION_NOTIFICATION_FILTER, ...scope },
      { $set: { read: true } }
    );
    return NextResponse.json({ message: "Course notifications marked as read" });
  } catch (error) {
    captureException(error, { operation: "Mark course notifications read error" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
