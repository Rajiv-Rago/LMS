export { signToken, verifyToken, decodeToken } from "./jwt";
export type { JWTPayload } from "./jwt";
export {
  authenticate,
  getAuthenticatedUser,
  requireAuth,
  requireRole,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
} from "./middleware";
export type { AuthenticatedRequest } from "./middleware";
