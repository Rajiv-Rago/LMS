import { NextRequest } from "next/server";
import AuditLog from "@/lib/models/AuditLog";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function logAuditEvent(
  request: NextRequest,
  params: {
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await AuditLog.create({
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      ip: getClientIp(request),
      metadata: params.metadata,
    });
  } catch (error) {
    // Audit logging should never break the request flow
    console.error("Audit log error:", error);
  }
}
