export type SubscriptionTier = "free" | "plus" | "admin";

// ponytail: the authenticated-user payload returned by authenticate(). Named
// JWTPayload for history — it's no longer JWT-specific (Auth.js backs sessions now).
export interface JWTPayload {
  userId: string;
  email: string;
  role: "student" | "teacher" | "admin";
  subscriptionTier: SubscriptionTier;
  sessionId?: string;
  iat?: number;
  exp?: number;
}
