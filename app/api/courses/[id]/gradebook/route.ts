import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

interface GradebookEntry {
  student: {
    _id: string;
    name: string;
    email: string;
  };
  grades: {
    assignmentId: string;
    grade: number | null;
    status: string;
    submittedAt: Date | null;
  }[];
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id).populate(
      "enrolledStudents",
      "name email"
    );

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = course.instructor.toString() === user.userId;
    const isAdmin = user.role === "admin";

    if (!isInstructor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const assignments = await Assignment.find({
      course: id,
      isPublished: true,
    }).sort({ dueDate: 1 });

    const submissions = await Submission.find({
      assignment: { $in: assignments.map((a) => a._id) },
    });

    const submissionMap = new Map<string, typeof submissions[0]>();
    submissions.forEach((sub) => {
      const key = `${sub.student.toString()}-${sub.assignment.toString()}`;
      submissionMap.set(key, sub);
    });

    const totalPossiblePoints = assignments.reduce((sum, a) => sum + a.points, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gradebook: GradebookEntry[] = (course.enrolledStudents as any[]).map(
      (student: { _id: { toString: () => string }; name: string; email: string }) => {
        const grades = assignments.map((assignment) => {
          const key = `${student._id.toString()}-${assignment._id.toString()}`;
          const submission = submissionMap.get(key);

          return {
            assignmentId: assignment._id.toString(),
            grade: submission?.grade ?? null,
            status: submission?.status || "not_submitted",
            submittedAt: submission?.submittedAt || null,
          };
        });

        const earnedPoints = grades.reduce((sum, g) => sum + (g.grade || 0), 0);

        return {
          student: {
            _id: student._id.toString(),
            name: student.name,
            email: student.email,
          },
          grades,
          totalPoints: totalPossiblePoints,
          earnedPoints,
          percentage:
            totalPossiblePoints > 0
              ? Math.round((earnedPoints / totalPossiblePoints) * 100)
              : 0,
        };
      }
    );

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        _id: a._id,
        title: a.title,
        points: a.points,
        dueDate: a.dueDate,
        assignmentType: a.assignmentType || "standard",
      })),
      gradebook,
      summary: {
        totalStudents: course.enrolledStudents.length,
        totalAssignments: assignments.length,
        totalPossiblePoints,
      },
    });
  } catch (error) {
    captureException(error, { message: "Get gradebook error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
