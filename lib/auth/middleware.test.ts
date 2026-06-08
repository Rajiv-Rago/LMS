import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authenticate } from "./middleware";
import { signToken } from "./jwt";

const SESSION_COOKIE = "authjs.session-token";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

function buildRequest(cookie: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { cookie },
  });
}

describe("authenticate", () => {
  beforeEach(() => {
    jest.mocked(getToken).mockResolvedValue(null);
  });

  it("keeps accepting legacy JWT cookies", async () => {
    const token = signToken({
      _id: { toString: () => "legacy-user" },
      email: "legacy@example.com",
      role: "teacher",
      subscriptionTier: "plus",
    } as never);

    await expect(authenticate(buildRequest(`token=${token}`))).resolves.toMatchObject({
      userId: "legacy-user",
      email: "legacy@example.com",
      role: "teacher",
      subscriptionTier: "plus",
    });
  });

  it("accepts Auth.js session cookies during the Sprint 2 compatibility window", async () => {
    jest.mocked(getToken).mockResolvedValue({
      id: "authjs-user",
      email: "authjs@example.com",
      role: "student",
      subscriptionTier: "free",
    });

    await expect(authenticate(buildRequest(`${SESSION_COOKIE}=encrypted-token`))).resolves.toEqual({
      userId: "authjs-user",
      email: "authjs@example.com",
      role: "student",
      subscriptionTier: "free",
    });
  });

  it("returns null when no supported session exists", async () => {
    await expect(authenticate(buildRequest(""))).resolves.toBeNull();
  });
});
