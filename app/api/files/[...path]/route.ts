import { NextRequest, NextResponse } from "next/server";
import { join, resolve, extname } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { authenticate } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Submission, Course, Assignment } from "@/lib/models";
import { captureException } from "@/lib/logger";

const DATA_DIR = join(process.cwd(), "data", "uploads");

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".py": "text/x-python",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".html": "text/html",
  ".css": "text/css",
  ".md": "text/markdown",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "File path required" }, { status: 400 });
    }

    // Reject path traversal attempts
    const requestedPath = pathSegments.join("/");
    if (requestedPath.includes("..") || requestedPath.includes("~")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Resolve and verify the file is within DATA_DIR
    const filePath = resolve(DATA_DIR, requestedPath);
    if (!filePath.startsWith(DATA_DIR)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Authorization: check the user has access to this file
    // Submission files follow pattern: submissions/<submissionId>/<filename>
    if (pathSegments[0] === "submissions" && pathSegments.length >= 3) {
      const submissionId = pathSegments[1];
      await dbConnect();

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const isOwner = submission.student.toString() === user.userId;
      const isAdmin = user.role === "admin";

      if (!isOwner && !isAdmin) {
        // Check if user is the instructor of the course this assignment belongs to
        const assignment = await Assignment.findById(submission.assignment).select("course");
        if (!assignment) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const course = await Course.findById(assignment.course).select("instructor");
        if (!course || course.instructor.toString() !== user.userId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Read and serve the file
    const fileBuffer = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${pathSegments[pathSegments.length - 1]}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    captureException(error, { operation: "File serving error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
