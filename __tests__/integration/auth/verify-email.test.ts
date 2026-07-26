import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../helpers/db";
import { buildRequest } from "../../helpers/api";
import { GET } from "@/app/api/auth/verify-email/route";
import User from "@/lib/models/User";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

const EMAIL = "verify-me@example.com";

async function createUserWithToken(expiresInMs = 60 * 60 * 1000) {
  const user = await User.create({
    email: EMAIL,
    name: "Verify Me",
    password: "Password123!",
    role: "user",
  });

  const token = crypto.randomBytes(32).toString("hex");
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        verificationToken: await bcrypt.hash(token, 10),
        verificationExpires: new Date(Date.now() + expiresInMs),
      },
    }
  );

  return { user, token };
}

function verifyRequest(token: string, email: string = EMAIL) {
  return buildRequest("GET", "/api/auth/verify-email", {
    searchParams: { token, email },
  });
}

function redirectResult(response: Response): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location).searchParams.get("verified");
}

describe("GET /api/auth/verify-email", () => {
  it("verifies a user with a valid token and clears the token", async () => {
    const { user, token } = await createUserWithToken();

    const response = await GET(verifyRequest(token));
    expect(redirectResult(response)).toBe("success");

    const updated = await User.findById(user._id).select(
      "+verificationToken +verificationExpires"
    );
    expect(updated!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(updated!.verificationToken).toBeUndefined();
    expect(updated!.verificationExpires).toBeUndefined();
  });

  it("treats a second use of the link as success (already verified)", async () => {
    const { token } = await createUserWithToken();

    await GET(verifyRequest(token));
    const response = await GET(verifyRequest(token));

    expect(redirectResult(response)).toBe("success");
  });

  it("rejects an expired token", async () => {
    const { user, token } = await createUserWithToken(-1000);

    const response = await GET(verifyRequest(token));
    expect(redirectResult(response)).toBe("expired");

    const updated = await User.findById(user._id);
    expect(updated!.emailVerifiedAt).toBeNull();
  });

  it("rejects a wrong token", async () => {
    const { user } = await createUserWithToken();

    const response = await GET(verifyRequest("not-the-token"));
    expect(redirectResult(response)).toBe("invalid");

    const updated = await User.findById(user._id);
    expect(updated!.emailVerifiedAt).toBeNull();
  });

  it("rejects an unknown email", async () => {
    const { token } = await createUserWithToken();

    const response = await GET(verifyRequest(token, "nobody@example.com"));
    expect(redirectResult(response)).toBe("invalid");
  });

  it("rejects missing params", async () => {
    const response = await GET(
      buildRequest("GET", "/api/auth/verify-email")
    );
    expect(redirectResult(response)).toBe("invalid");
  });
});
