import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireCsrf } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import OAuthAccount, { OAuthProvider } from "@/lib/models/OAuthAccount";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

const PROVIDERS = new Set<OAuthProvider>(["google", "github", "facebook"]);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { provider } = await params;
    if (!isOAuthProvider(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    await dbConnect();

    // Don't let a user remove their only way back in.
    const [account, linkedCount, dbUser] = await Promise.all([
      OAuthAccount.findOne({ userId: user.userId, provider }),
      OAuthAccount.countDocuments({ userId: user.userId }),
      User.findById(user.userId).select("password"),
    ]);

    if (!account) {
      return NextResponse.json({ error: "Provider not connected" }, { status: 404 });
    }

    if (!dbUser?.password && linkedCount <= 1) {
      return NextResponse.json(
        { error: "Can't disconnect your only sign-in method. Set a password first." },
        { status: 409 }
      );
    }

    await account.deleteOne();

    await logAuditEvent(request, {
      userId: user.userId,
      action: "oauth.account.unlinked",
      resource: "oauth",
      resourceId: provider,
      metadata: { provider },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureException(error, { operation: "Disconnect OAuth provider error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function isOAuthProvider(provider: string): provider is OAuthProvider {
  return PROVIDERS.has(provider as OAuthProvider);
}
