import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { authenticate } from "@/lib/auth";
import { User, Course, Submission, AIChatSession } from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { captureException } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const enrolledCourseIds = await Enrollment.find({ student: user.userId }).distinct("course");

    const [profile, enrolledCourses, ownedCourses, submissions, chatSessions] =
      await Promise.all([
        User.findById(user.userId).select("-password -resetPasswordToken -resetPasswordExpires"),
        Course.find({ _id: { $in: enrolledCourseIds } }).select("title description createdAt"),
        Course.find({ instructor: user.userId }).select("title description createdAt"),
        Submission.find({ student: user.userId }).populate("assignment", "title"),
        AIChatSession.find({ user: user.userId }).select("title messages createdAt"),
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: profile?.toObject(),
      enrollments: enrolledCourses.map((c) => c.toObject()),
      ownedCourses: ownedCourses.map((c) => c.toObject()),
      submissions: submissions.map((s) => s.toObject()),
      chatSessions: chatSessions.map((s) => s.toObject()),
    };

    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="user-data-export-${user.userId}.json"`,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Export user data error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
