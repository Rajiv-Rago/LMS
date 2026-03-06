import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { captureException } from "@/lib/logger";
import { validateFileMagic } from "@/lib/utils/fileMagic";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads", "submissions");

async function ensureUploadDir(submissionId: string): Promise<string> {
  const dir = join(UPLOAD_DIR, submissionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

function validateFile(
  file: File,
  settings: { maxFileSize: number; allowedFileTypes: string[] }
): string | null {
  if (file.size > settings.maxFileSize) {
    const maxMB = Math.round(settings.maxFileSize / (1024 * 1024));
    return `File too large. Maximum size is ${maxMB}MB`;
  }

  if (settings.allowedFileTypes?.length > 0) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!settings.allowedFileTypes.includes(ext)) {
      return `File type not allowed. Allowed types: ${settings.allowedFileTypes.join(", ")}`;
    }
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id, assignmentId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.isEnrolled) {
      return NextResponse.json(
        { error: "You must be enrolled to submit files" },
        { status: 403 }
      );
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
      assignmentType: "project",
    });

    if (!assignment) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!assignment.isPublished) {
      return NextResponse.json(
        { error: "Project not available" },
        { status: 400 }
      );
    }

    let submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    if (!submission) {
      submission = await Submission.create({
        assignment: assignmentId,
        student: user.userId,
        status: "draft",
        files: [],
      });
    }

    if (submission.status === "graded" || submission.status === "returned") {
      return NextResponse.json(
        { error: "Cannot modify graded submission" },
        { status: 400 }
      );
    }

    const currentFileCount = submission.files?.length || 0;
    const maxFiles = assignment.projectSettings?.maxFiles || 5;

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (currentFileCount + files.length > maxFiles) {
      return NextResponse.json(
        { error: `Maximum ${maxFiles} files allowed` },
        { status: 400 }
      );
    }

    const settings = {
      maxFileSize: assignment.projectSettings?.maxFileSize || 10 * 1024 * 1024,
      allowedFileTypes: assignment.projectSettings?.allowedFileTypes || [],
    };

    for (const file of files) {
      const error = validateFile(file, settings);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }
    }

    const uploadDir = await ensureUploadDir(submission._id.toString());

    const uploadedFiles = [];
    for (const file of files) {
      const fileId = randomUUID();
      const ext = file.name.split(".").pop() || "";
      const filename = `${fileId}.${ext}`;
      const filepath = join(uploadDir, filename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const magicError = validateFileMagic(buffer, file.name);
      if (magicError) {
        return NextResponse.json({ error: magicError }, { status: 400 });
      }

      await writeFile(filepath, buffer);

      const uploadedFile = {
        id: fileId,
        filename,
        originalName: file.name,
        url: `/api/files/submissions/${submission._id}/${filename}`,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date(),
      };

      uploadedFiles.push(uploadedFile);
    }

    submission.files = submission.files || [];
    submission.files.push(...uploadedFiles);
    await submission.save();

    return NextResponse.json({
      files: uploadedFiles,
      totalFiles: submission.files.length,
    });
  } catch (error) {
    captureException(error, { operation: "File upload error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id, assignmentId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const fileId = url.searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.isEnrolled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: user.userId,
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status === "graded" || submission.status === "returned") {
      return NextResponse.json(
        { error: "Cannot modify graded submission" },
        { status: 400 }
      );
    }

    const fileIndex = submission.files?.findIndex((f) => f.id === fileId) ?? -1;
    if (fileIndex === -1) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = submission.files![fileIndex];

    try {
      const filepath = join(UPLOAD_DIR, submission._id.toString(), file.filename);
      await unlink(filepath);
    } catch {
      // File might not exist on disk, continue anyway
    }

    submission.files!.splice(fileIndex, 1);
    await submission.save();

    return NextResponse.json({
      message: "File deleted successfully",
      totalFiles: submission.files!.length,
    });
  } catch (error) {
    captureException(error, { operation: "File delete error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;
    const invalidAssignmentId = validateObjectId(assignmentId, "Assignment ID");
    if (invalidAssignmentId) return invalidAssignmentId;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = await getCoursePermissions(course, user);

    if (!perms.canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const studentId = perms.canEdit
      ? url.searchParams.get("studentId") || user.userId
      : user.userId;

    if (studentId !== user.userId) {
      const isStudentEnrolled = await Enrollment.isEnrolled(id, studentId);
      if (!isStudentEnrolled) {
        return NextResponse.json(
          { error: "Student not enrolled in this course" },
          { status: 403 }
        );
      }
    }

    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId,
    });

    return NextResponse.json({
      files: submission?.files || [],
      totalFiles: submission?.files?.length || 0,
    });
  } catch (error) {
    captureException(error, { operation: "Get files error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
