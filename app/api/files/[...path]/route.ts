import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const DATA_DIR = path.join(process.cwd(), "data", "uploads");

// Only these path prefixes are served — default-deny everything else
const ALLOWED_PREFIXES = ["submissions"];

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".py": "text/x-python",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".html": "text/html",
  ".css": "text/css",
  ".json": "application/json",
  ".csv": "text/csv",
};

function sanitizeFilename(name: string): string {
  return name.replace(/["\n\r]/g, "_");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const segments = await params;
    const requestedPath = segments.path.join("/");

    // Authorization: only allowed prefixes
    const prefix = segments.path[0];
    if (!ALLOWED_PREFIXES.includes(prefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Path traversal protection
    const resolved = path.resolve(DATA_DIR, requestedPath);
    const relative = path.relative(DATA_DIR, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(`..${path.sep}`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(resolved);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const filename = sanitizeFilename(path.basename(resolved));

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    captureException(error, { operation: "File serve error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
