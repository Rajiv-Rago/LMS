import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireCsrf } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import OAuthAccount, { OAuthProvider } from "@/lib/models/OAuthAccount";
import { captureException } from "@/lib/logger";
import {
  createOAuthLinkIntent,
  OAUTH_LINK_INTENT_COOKIE,
  oauthLinkIntentCookieOptions,
} from "@/lib/auth/oauthLinkIntent";

const PROVIDERS = new Set<OAuthProvider>(["google", "github"]);

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { provider?: unknown };
    if (typeof body.provider !== "string" || !isOAuthProvider(body.provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    await dbConnect();

    const existingProvider = await OAuthAccount.exists({
      userId: user.userId,
      provider: body.provider,
    });
    if (existingProvider) {
      return NextResponse.json(
        { error: "Provider already connected" },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      provider: body.provider,
      redirectTo: "/settings",
    });
    response.cookies.set(
      OAUTH_LINK_INTENT_COOKIE,
      createOAuthLinkIntent(user.userId, body.provider),
      oauthLinkIntentCookieOptions()
    );

    return response;
  } catch (error) {
    captureException(error, { operation: "Create OAuth link intent error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function isOAuthProvider(provider: string): provider is OAuthProvider {
  return PROVIDERS.has(provider as OAuthProvider);
}
