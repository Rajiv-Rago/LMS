import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { requireRole } from "@/lib/auth/middleware";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";
import * as cache from "@/lib/cache";

const patchSchema = z.object({
  removed: z.boolean(),
});

export const PATCH = requireRole("admin")(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const body = await request.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const { removed } = validation.data;
    const course = await Course.findByIdAndUpdate(
      id,
      { moderationRemovedAt: removed ? new Date() : null },
      { new: true }
    );
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    cache.invalidate(`course:${id}`);
    cache.invalidatePrefix("courses:published");
    cache.invalidatePrefix("catalog:published");

    await logAuditEvent(request, {
      userId: user.userId,
      action: removed ? "course.moderation.remove" : "course.moderation.restore",
      resource: "course",
      resourceId: id,
    });

    return NextResponse.json({ course });
  } catch (error) {
    captureException(error, { operation: "Course moderation error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
