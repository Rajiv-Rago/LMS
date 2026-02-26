import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getJobStatus } from "@/lib/queue";
import { captureException } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = await getJobStatus(jobId, user.userId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const safeJob = {
      ...job,
      error: job.error ? "Job failed — please try again" : undefined,
    };
    return NextResponse.json({ job: safeJob });
  } catch (error) {
    captureException(error, { operation: "Get job status error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
