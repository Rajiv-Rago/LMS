import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import AuthSession from "@/lib/models/AuthSession";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("Auth session flow", () => {
  const credentials = { email: "session@example.com", password: "password123" };

  it("login returns 200 with auth cookie", async () => {
    await createTestUser(credentials);

    const request = buildRequest("POST", "/api/auth/login", {
      body: credentials,
    });
    const response = await loginPOST(request);
    const { status, data } = await parseResponse<{
      user: { email: string };
      message: string;
    }>(response);

    expect(status).toBe(200);
    expect(data.user.email).toBe(credentials.email);
    expect(data.message).toBe("Login successful");

    const setCookie = response.headers.getSetCookie?.() || [];
    const tokenCookie = setCookie.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });

  it("GET /me with valid token returns user data", async () => {
    const { token } = await createTestUser(credentials);

    const request = buildRequest("GET", "/api/auth/me", { token });
    const response = await meGET(request);
    const { status, data } = await parseResponse<{
      user: { email: string; name: string; role: string };
    }>(response);

    expect(status).toBe(200);
    expect(data.user.email).toBe(credentials.email);
    expect(data.user.role).toBe("student");
  });

  it("POST /logout clears auth cookie", async () => {
    const { user, token } = await createTestUser(credentials);

    const request = buildRequest("POST", "/api/auth/logout", { token });
    const response = await logoutPOST(request);
    const { status, data } = await parseResponse<{ message: string }>(response);

    expect(status).toBe(200);
    expect(data.message).toBe("Logged out successfully");

    const setCookie = response.headers.getSetCookie?.() || [];
    const clearCookie = setCookie.find(
      (c: string) => c.startsWith("token=") && c.includes("Max-Age=0")
    );
    expect(clearCookie).toBeDefined();
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
  });

  it("GET /me without token returns 401", async () => {
    const request = buildRequest("GET", "/api/auth/me");
    const response = await meGET(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
