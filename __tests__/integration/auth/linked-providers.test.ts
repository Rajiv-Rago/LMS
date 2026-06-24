import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import { createTestUser } from "../../helpers/fixtures";
import { GET } from "@/app/api/auth/providers/linked/route";
import OAuthAccount from "@/lib/models/OAuthAccount";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("GET /api/auth/providers/linked", () => {
  it("lists linked providers for the current user", async () => {
    const { user, token } = await createTestUser();
    await OAuthAccount.create({
      provider: "google",
      providerAccountId: "google-1",
      userId: user._id,
      email: user.email,
      emailVerified: true,
      linkedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const response = await GET(
      buildRequest("GET", "/api/auth/providers/linked", { token })
    );
    const { status, data } = await parseResponse<{
      data: Array<{ provider: string; displayName: string }>;
    }>(response);

    expect(status).toBe(200);
    expect(data.data).toEqual([
      {
        provider: "google",
        displayName: "Google",
      },
    ]);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(
      buildRequest("GET", "/api/auth/providers/linked")
    );

    expect(response.status).toBe(401);
  });
});
