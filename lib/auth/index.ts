export type { JWTPayload, SubscriptionTier } from "./types";
export {
  authenticate,
  getAuthenticatedUser,
  requireAuth,
  requireRole,
  requireCsrf,
} from "./middleware";
export type { AuthenticatedRequest } from "./middleware";
export {
  checkCourseOwnership,
  canModifyAICourse,
  canAccessAICourse,
} from "./courseOwnership";
export type { CourseOwnershipResult } from "./courseOwnership";
export { logAuditEvent } from "./auditLog";
