import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Report } from "@/lib/models";
import { requireRole } from "@/lib/auth/middleware";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

const patchSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
});

export const PATCH = requireRole("admin")(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const invalidId = validateObjectId(id, "Report ID");
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

    const report = await Report.findByIdAndUpdate(
      id,
      { status: validation.data.status },
      { new: true }
    );
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await logAuditEvent(request, {
      userId: user.userId,
      action: "report.status.change",
      resource: "report",
      resourceId: id,
      metadata: { status: validation.data.status },
    });

    return NextResponse.json({ report });
  } catch (error) {
    captureException(error, { operation: "Update report error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
