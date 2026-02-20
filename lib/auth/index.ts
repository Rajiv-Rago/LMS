export { signToken, verifyToken, verifyTokenForRefresh, decodeToken } from "./jwt";
export type { JWTPayload } from "./jwt";
export {
  authenticate,
  getAuthenticatedUser,
  requireAuth,
  requireRole,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
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
