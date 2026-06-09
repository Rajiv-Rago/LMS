import { authCallbacks } from "./authjsCallbacks";
import { validateAuthSession } from "./sessionRegistry";

jest.mock("./sessionRegistry", () => ({
  validateAuthSession: jest.fn(),
}));

beforeEach(() => {
  jest.mocked(validateAuthSession).mockResolvedValue(true);
});

describe("authCallbacks", () => {
  it("adds id, role, and subscription tier to JWTs", async () => {
    const token = await authCallbacks.jwt!({
      token: {},
      user: {
        id: "user-id",
        email: "user@example.com",
        name: "User",
        role: "teacher",
        subscriptionTier: "plus",
        sessionId: "session-id",
      },
      account: null,
      profile: undefined,
      trigger: "signIn",
    });

    expect(token).toMatchObject({
      id: "user-id",
      role: "teacher",
      subscriptionTier: "plus",
      sessionId: "session-id",
    });
  });

  it("adds id, role, and subscription tier to sessions", async () => {
    const session = await authCallbacks.session!({
      session: {
        user: {
          name: "User",
          email: "user@example.com",
          image: null,
        },
        expires: "2030-01-01T00:00:00.000Z",
      },
      token: {
        id: "user-id",
        role: "teacher",
        subscriptionTier: "plus",
      },
      user: undefined,
      newSession: undefined,
      trigger: "update",
    });

    expect(session.user).toMatchObject({
      id: "user-id",
      role: "teacher",
      subscriptionTier: "plus",
    });
  });

  it("rejects a revoked JWT session", async () => {
    jest.mocked(validateAuthSession).mockResolvedValue(false);

    const token = await authCallbacks.jwt!({
      token: { id: "user-id", sessionId: "revoked-session" },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: "update",
      session: undefined,
    });

    expect(token).toBeNull();
  });
});
