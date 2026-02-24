import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { captureException } from "@/lib/logger";
import { validateFileMagic } from "@/lib/utils/fileMagic";

const UPLOAD_DIR = join(process.cwd(), "data", "uploads", "submissions");

// Ensure upload directory exists
async function ensureUploadDir(submissionId: string): Promise<string> {
  const dir = join(UPLOAD_DIR, submissionId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

// Validate file against assignment settings
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

// POST /api/courses/[id]/assignments/[assignmentId]/files
// Upload file(s) for a project submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isEnrolled) {
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

    // Get or create submission
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

    // Check current file count
    const currentFileCount = submission.files?.length || 0;
    const maxFiles = assignment.projectSettings?.maxFiles || 5;

    // Parse form data
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

    // Validate all files first
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

    // Ensure upload directory exists
    const uploadDir = await ensureUploadDir(submission._id.toString());

    // Process and save files
    const uploadedFiles = [];
    for (const file of files) {
      const fileId = randomUUID();
      const ext = file.name.split(".").pop() || "";
      const filename = `${fileId}.${ext}`;
      const filepath = join(uploadDir, filename);

      // Read file bytes and validate magic bytes
      const bytes = await file.arrayBuffer();
      const fileBuffer = Buffer.from(bytes);
      const magicError = validateFileMagic(
        fileBuffer,
        "." + ext.toLowerCase(),
        settings.allowedFileTypes.length > 0 ? settings.allowedFileTypes : undefined
      );
      if (magicError) {
        return NextResponse.json(
          { error: `${file.name}: ${magicError}` },
          { status: 400 }
        );
      }

      // Write file to disk
      await writeFile(filepath, fileBuffer);

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

    // Update submission with new files
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

// DELETE /api/courses/[id]/assignments/[assignmentId]/files?fileId=xxx
// Remove a file from a project submission
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
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

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isEnrolled) {
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

    // Find the file
    const fileIndex = submission.files?.findIndex((f) => f.id === fileId) ?? -1;
    if (fileIndex === -1) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = submission.files![fileIndex];

    // Delete file from disk
    try {
      const filepath = join(UPLOAD_DIR, submission._id.toString(), file.filename);
      await unlink(filepath);
    } catch {
      // File might not exist on disk, continue anyway
    }

    // Remove from submission
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

// GET /api/courses/[id]/assignments/[assignmentId]/files
// Get list of uploaded files for a submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = course.instructor.toString() === user.userId;
    const isAdmin = user.role === "admin";
    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );

    if (!isInstructor && !isAdmin && !isEnrolled) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // For students, get their own submission
    // For instructors, they can optionally specify a studentId
    const url = new URL(request.url);
    const studentId = (isInstructor || isAdmin)
      ? url.searchParams.get("studentId") || user.userId
      : user.userId;

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
