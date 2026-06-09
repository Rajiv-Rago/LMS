import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authenticate } from "./middleware";
import { signToken } from "./jwt";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { validateAuthSession } from "./sessionRegistry";

const SESSION_COOKIE = "authjs.session-token";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  dbConnect: jest.fn(),
}));

jest.mock("@/lib/models/User", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("./sessionRegistry", () => ({
  validateAuthSession: jest.fn(),
}));

function buildRequest(cookie: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { cookie },
  });
}

describe("authenticate", () => {
  beforeEach(() => {
    jest.mocked(getToken).mockResolvedValue(null);
    jest.mocked(dbConnect).mockResolvedValue(undefined as never);
    jest.mocked(User.findById).mockResolvedValue(null);
    jest.mocked(validateAuthSession).mockResolvedValue(true);
  });

  it("does not accept legacy JWT cookies for protected routes", async () => {
    const token = signToken({
      _id: { toString: () => "legacy-user" },
      email: "legacy@example.com",
      role: "teacher",
      subscriptionTier: "plus",
    } as never);

    await expect(authenticate(buildRequest(`token=${token}`))).resolves.toBeNull();
  });

  it("does not accept legacy bearer tokens for protected routes", async () => {
    const token = signToken({
      _id: { toString: () => "legacy-user" },
      email: "legacy@example.com",
      role: "teacher",
      subscriptionTier: "plus",
    } as never);

    const request = new NextRequest("http://localhost:3000/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(authenticate(request)).resolves.toBeNull();
  });

  it("accepts Auth.js session cookies for active users", async () => {
    jest.mocked(getToken).mockResolvedValue({
      id: "authjs-user",
      email: "authjs@example.com",
      role: "student",
      subscriptionTier: "free",
      sessionId: "session-id",
    });
    jest.mocked(User.findById).mockResolvedValue({
      _id: { toString: () => "authjs-user" },
      email: "authjs@example.com",
      role: "teacher",
      subscriptionTier: "plus",
      sessionId: "session-id",
    } as never);

    await expect(authenticate(buildRequest(`${SESSION_COOKIE}=encrypted-token`))).resolves.toEqual({
      userId: "authjs-user",
      email: "authjs@example.com",
      role: "teacher",
      subscriptionTier: "plus",
      sessionId: "session-id",
    });
  });

  it("returns null when the Auth.js token user no longer exists", async () => {
    jest.mocked(getToken).mockResolvedValue({
      id: "deleted-user",
      email: "deleted@example.com",
      role: "student",
      subscriptionTier: "free",
      sessionId: "session-id",
    });

    await expect(authenticate(buildRequest(`${SESSION_COOKIE}=encrypted-token`))).resolves.toBeNull();
  });

  it("returns null when the Auth.js session registry row was revoked", async () => {
    jest.mocked(getToken).mockResolvedValue({
      id: "authjs-user",
      sessionId: "revoked-session",
    });
    jest.mocked(validateAuthSession).mockResolvedValue(false);

    await expect(
      authenticate(buildRequest(`${SESSION_COOKIE}=encrypted-token`))
    ).resolves.toBeNull();
  });

  it("returns null when no supported session exists", async () => {
    await expect(authenticate(buildRequest(""))).resolves.toBeNull();
  });
});
