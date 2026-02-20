import { NextRequest } from "next/server";
import AuditLog, { AuditAction } from "@/lib/models/AuditLog";
import { getClientIp } from "@/lib/utils/request";

export async function logAuditEvent(
  request: NextRequest,
  params: {
    userId: string;
    action: AuditAction;
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
