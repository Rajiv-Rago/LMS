import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Report } from "@/lib/models";
import { requireAuth } from "@/lib/auth/middleware";
import { enforceRateLimit } from "@/lib/rateLimit";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException, logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { courseReportTemplate } from "@/lib/email/templates";
import { env } from "@/lib/env";

const reportSchema = z.object({
  reason: z.enum(["spam", "copyright", "inappropriate", "other"]),
  details: z.string().max(2000).optional(),
});

export const POST = requireAuth(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const body = await request.json();
    const validation = reportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const limited = await enforceRateLimit("report", user.userId, 5, "day");
    if (limited) return limited;

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const { reason, details } = validation.data;

    await Report.create({
      course: course._id,
      reporter: user.userId,
      reason,
      details,
    });

    // Non-fatal: the report is saved even if the admin email fails
    if (env.ADMIN_EMAIL) {
      const template = courseReportTemplate({
        courseTitle: course.title,
        courseUrl: `${env.APP_URL}/courses/${id}`,
        reason,
        details,
        reporterEmail: user.email,
      });
      const emailResult = await sendEmail({
        to: env.ADMIN_EMAIL,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      if (!emailResult.success) {
        logger.warn("Course report email failed to send", {
          courseId: id,
          error: emailResult.error,
        });
      }
    }

    await logAuditEvent(request, {
      userId: user.userId,
      action: "course.reported",
      resource: "course",
      resourceId: id,
      metadata: { reason },
    });

    return NextResponse.json({ message: "Report submitted" }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Report course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
