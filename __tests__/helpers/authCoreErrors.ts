// CJS-friendly stand-in for the ESM-only @auth/core/errors module, which Jest
// does not transform. AccessDenied is just an Error subclass in the real package.
export class AccessDenied extends Error {
  type = "AccessDenied";
}
