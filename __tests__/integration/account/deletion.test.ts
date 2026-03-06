import { NextRequest } from "next/server";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { createTestUser, createTestCourse, createTestEnrollment } from "../../helpers/fixtures";
import { parseResponse } from "../../helpers/api";
import { DELETE } from "@/app/api/users/me/delete/route";
import User from "@/lib/models/User";
import Enrollment from "@/lib/models/Enrollment";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

function buildDeleteRequest(token: string, body: Record<string, unknown>): NextRequest {
  const url = new URL("/api/users/me/delete", "http://localhost:3000");
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Authorization: `Bearer ${token}`,
  });
  return new NextRequest(url, {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
}

describe("DELETE /api/users/me/delete", () => {
  it("soft-deletes user with valid password", async () => {
    const { user, token } = await createTestUser({
      email: "delete@example.com",
      password: "password123",
    });

    const request = buildDeleteRequest(token, { password: "password123" });
    const response = await DELETE(request);
    const { status, data } = await parseResponse<{ message: string }>(response);

    expect(status).toBe(200);
    expect(data.message).toBe("Account deleted successfully");

    const found = await User.findById(user._id);
    expect(found).toBeNull();

    const foundWithDeleted = await User.findById(user._id, null, {
      includeSoftDeleted: true,
    });
    expect(foundWithDeleted).not.toBeNull();
    expect(foundWithDeleted!.deletedAt).toBeDefined();
    expect(foundWithDeleted!.deletedAt).not.toBeNull();
  });

  it("cleans up enrollment records on deletion", async () => {
    const { user: admin, token: adminToken } = await createTestUser({
      email: "admin@example.com",
      password: "password123",
      role: "admin",
    });
    const { course } = await createTestCourse(admin._id);
    await createTestEnrollment(course._id, admin._id);

    const enrollmentBefore = await Enrollment.find({ student: admin._id });
    expect(enrollmentBefore).toHaveLength(1);

    const request = buildDeleteRequest(adminToken, { password: "password123" });
    await DELETE(request);

    const enrollmentAfter = await Enrollment.find({ student: admin._id });
    expect(enrollmentAfter).toHaveLength(0);
  });

  it("returns 403 for incorrect password", async () => {
    await createTestUser({
      email: "wrongpw@example.com",
      password: "password123",
    });
    const { token } = await createTestUser({
      email: "wrongpw2@example.com",
      password: "password123",
    });

    const request = buildDeleteRequest(token, { password: "wrongpassword" });
    const response = await DELETE(request);
    const { status, data } = await parseResponse<{ error: string }>(response);

    expect(status).toBe(403);
    expect(data.error).toBe("Incorrect password");
  });
});
