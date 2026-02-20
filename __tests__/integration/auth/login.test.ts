import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser } from "../../helpers/fixtures";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST } from "@/app/api/auth/login/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials", async () => {
    await createTestUser({
      email: "login@example.com",
      password: "password123",
    });

    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "login@example.com", password: "password123" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{
      user: { email: string; name: string; role: string };
      message: string;
    }>(response);

    expect(status).toBe(200);
    expect(data.user.email).toBe("login@example.com");
    expect(data.message).toBe("Login successful");
  });

  it("sets an auth cookie on success", async () => {
    await createTestUser({
      email: "cookie@example.com",
      password: "password123",
    });

    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "cookie@example.com", password: "password123" },
    });
    const response = await POST(request);

    const setCookie = response.headers.getSetCookie?.() || [];
    const tokenCookie = setCookie.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });

  it("returns user info with correct role", async () => {
    await createTestUser({
      email: "teacher@example.com",
      password: "password123",
      role: "teacher",
    });

    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "teacher@example.com", password: "password123" },
    });
    const response = await POST(request);
    const { data } = await parseResponse<{
      user: { role: string };
    }>(response);

    expect(data.user.role).toBe("teacher");
  });

  it("returns 401 for wrong password", async () => {
    await createTestUser({
      email: "wrong@example.com",
      password: "password123",
    });

    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "wrong@example.com", password: "wrongpassword" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Invalid email or password");
  });

  it("returns 401 for non-existent email", async () => {
    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "nobody@example.com", password: "password123" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Invalid email or password");
  });

  it("returns 400 for invalid email format", async () => {
    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "not-an-email", password: "password123" },
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });

  it("returns 400 for missing password", async () => {
    const request = buildRequest("POST", "/api/auth/login", {
      body: { email: "test@example.com" },
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });
});
