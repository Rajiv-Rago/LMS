import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest, parseResponse } from "../../helpers/api";
import { createTestUser } from "../../helpers/fixtures";
import { POST } from "@/app/api/auth/providers/link-intent/route";
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

describe("POST /api/auth/providers/link-intent", () => {
  it("creates a link intent cookie for the current user", async () => {
    const { token } = await createTestUser();
    const response = await POST(
      buildRequest("POST", "/api/auth/providers/link-intent", {
        token,
        body: { provider: "github" },
      })
    );
    const { status, data } = await parseResponse<{
      provider: string;
      redirectTo: string;
    }>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ provider: "github", redirectTo: "/settings" });
    expect(response.headers.get("set-cookie")).toContain("oauth_link_intent=");
  });

  it("rejects unauthenticated requests", async () => {
    const response = await POST(
      buildRequest("POST", "/api/auth/providers/link-intent", {
        body: { provider: "github" },
      })
    );

    expect(response.status).toBe(401);
  });

  it("rejects providers already linked to the current user", async () => {
    const { user, token } = await createTestUser();
    await OAuthAccount.create({
      provider: "github",
      providerAccountId: "github-1",
      userId: user._id,
      email: user.email,
      emailVerified: true,
      linkedAt: new Date(),
      lastLoginAt: new Date(),
    });

    const response = await POST(
      buildRequest("POST", "/api/auth/providers/link-intent", {
        token,
        body: { provider: "github" },
      })
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
