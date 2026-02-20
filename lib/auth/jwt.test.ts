import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { IUser } from "@/lib/models/User";

// JWT_SECRET is set in jest.setup.ts
const JWT_SECRET = process.env.JWT_SECRET!;

// Must import after env is set (jest.setup.ts runs before)
import { signToken, verifyToken, decodeToken, JWTPayload } from "./jwt";

function makeFakeUser(
  overrides: Partial<{ _id: mongoose.Types.ObjectId; email: string; role: string }> = {}
): IUser {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    email: overrides.email || "test@example.com",
    role: (overrides.role as IUser["role"]) || "student",
  } as unknown as IUser;
}

describe("JWT utilities", () => {
  describe("signToken", () => {
    it("returns a valid JWT string", () => {
      const user = makeFakeUser();
      const token = signToken(user);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("encodes userId, email, and role in the payload", () => {
      const user = makeFakeUser({
        email: "alice@example.com",
        role: "teacher",
      });
      const token = signToken(user);
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.email).toBe("alice@example.com");
      expect(decoded.role).toBe("teacher");
    });

    it("sets an expiration on the token", () => {
      const user = makeFakeUser();
      const token = signToken(user);
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
    });
  });

  describe("verifyToken", () => {
    it("returns the payload for a valid token", () => {
      const user = makeFakeUser({ email: "bob@test.com", role: "admin" });
      const token = signToken(user);
      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(user._id.toString());
      expect(payload!.email).toBe("bob@test.com");
      expect(payload!.role).toBe("admin");
    });

    it("returns null for a tampered token", () => {
      const user = makeFakeUser();
      const token = signToken(user);
      const tampered = token.slice(0, -5) + "XXXXX";

      expect(verifyToken(tampered)).toBeNull();
    });

    it("returns null for a token signed with a different secret", () => {
      const payload = { userId: "123", email: "x@x.com", role: "student" };
      const token = jwt.sign(payload, "wrong-secret", { expiresIn: "1h" });

      expect(verifyToken(token)).toBeNull();
    });

    it("returns null for an expired token", () => {
      const payload = { userId: "123", email: "x@x.com", role: "student" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "0s" });

      expect(verifyToken(token)).toBeNull();
    });

    it("returns null for garbage input", () => {
      expect(verifyToken("not.a.token")).toBeNull();
      expect(verifyToken("")).toBeNull();
    });
  });

  describe("decodeToken", () => {
    it("decodes a valid token without verifying the signature", () => {
      const user = makeFakeUser({ email: "carol@test.com" });
      const token = signToken(user);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.email).toBe("carol@test.com");
    });

    it("decodes a token even with a wrong secret (no verification)", () => {
      const payload = { userId: "123", email: "x@x.com", role: "student" };
      const token = jwt.sign(payload, "any-secret", { expiresIn: "1h" });
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.email).toBe("x@x.com");
    });

    it("returns null for garbage input", () => {
      expect(decodeToken("garbage")).toBeNull();
    });
  });
});
