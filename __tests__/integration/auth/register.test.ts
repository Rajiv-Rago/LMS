import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import { POST } from "@/app/api/auth/register/route";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("POST /api/auth/register", () => {
  const validBody = {
    email: "new@example.com",
    name: "New User",
    password: "Password123!",
  };

  it("registers a new user successfully", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: validBody,
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{
      user: { id: string; email: string; name: string; role: string };
      message: string;
    }>(response);

    expect(status).toBe(201);
    expect(data.user.email).toBe("new@example.com");
    expect(data.user.name).toBe("New User");
    expect(data.user.role).toBe("student");
    expect(data.message).toBe("Registration successful");
  });

  it("sets an auth cookie on success", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: validBody,
    });
    const response = await POST(request);

    const setCookie = response.headers.getSetCookie?.() || [];
    const tokenCookie = setCookie.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });

  it("ignores role field in registration body", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: { ...validBody, email: "teacher-attempt@example.com", role: "teacher" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{
      user: { role: string };
    }>(response);

    expect(status).toBe(201);
    expect(data.user.role).toBe("student");
  });

  it("returns 409 for duplicate email", async () => {
    // Register first user
    const req1 = buildRequest("POST", "/api/auth/register", {
      body: validBody,
    });
    await POST(req1);

    // Try to register same email
    const req2 = buildRequest("POST", "/api/auth/register", {
      body: validBody,
    });
    const response = await POST(req2);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(409);
    expect(data.error).toBe("Email already registered");
  });

  it("returns 400 for password shorter than 8 characters", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: { ...validBody, password: "short" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
    expect(data.error).toContain("8 characters");
  });

  it("returns 400 for missing email", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email: _email, ...noEmail } = validBody;
    const request = buildRequest("POST", "/api/auth/register", {
      body: noEmail,
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });

  it("returns 400 for invalid email format", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: { ...validBody, email: "not-an-email" },
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });

  it("returns 400 for missing name", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _name, ...noName } = validBody;
    const request = buildRequest("POST", "/api/auth/register", {
      body: noName,
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });

  it("returns 400 for name shorter than 2 characters", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: { ...validBody, name: "A" },
    });
    const response = await POST(request);
    const { status } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(400);
  });

  it("always assigns student role", async () => {
    const request = buildRequest("POST", "/api/auth/register", {
      body: { ...validBody, email: "always-student@example.com" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<{
      user: { role: string };
    }>(response);

    expect(status).toBe(201);
    expect(data.user.role).toBe("student");
  });
});
