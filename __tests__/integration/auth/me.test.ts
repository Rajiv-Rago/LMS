import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { GET } from "@/app/api/auth/me/route";
import jwt from "jsonwebtoken";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("GET /api/auth/me", () => {
  it("returns the current user for a valid token", async () => {
    const { token } = await createTestUser({
      email: "me@example.com",
      name: "Me User",
      role: "student",
    });

    const request = buildRequest("GET", "/api/auth/me", { token });
    const response = await GET(request);
    const { status, data } = await parseResponse<{
      user: { id: string; email: string; name: string; role: string };
    }>(response);

    expect(status).toBe(200);
    expect(data.user.email).toBe("me@example.com");
    expect(data.user.name).toBe("Me User");
    expect(data.user.role).toBe("student");
  });

  it("returns 401 when no token is provided", async () => {
    const request = buildRequest("GET", "/api/auth/me");
    const response = await GET(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 for an expired token", async () => {
    const { user } = await createTestUser({ email: "expired@example.com" });

    // Create a token that expires immediately
    const expiredToken = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "0s" }
    );

    const request = buildRequest("GET", "/api/auth/me", {
      token: expiredToken,
    });
    const response = await GET(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const request = buildRequest("GET", "/api/auth/me", {
      token: "invalid.token.here",
    });
    const response = await GET(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
  });

  it("returns 401 if the user was deleted after the session was issued", async () => {
    const { user, token } = await createTestUser({
      email: "deleted@example.com",
    });

    // Delete the user from DB
    const User = (await import("@/lib/models/User")).default;
    await User.findByIdAndDelete(user._id);

    const request = buildRequest("GET", "/api/auth/me", { token });
    const response = await GET(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
