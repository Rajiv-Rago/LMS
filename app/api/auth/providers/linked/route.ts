import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import OAuthAccount, { OAuthProvider } from "@/lib/models/OAuthAccount";
import { captureException } from "@/lib/logger";

const PROVIDER_DISPLAY_NAMES: Record<OAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
};

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const accounts = await OAuthAccount.find({ userId: user.userId })
      .select("provider")
      .sort({ provider: 1 });

    return NextResponse.json({
      data: accounts.map((account) => ({
        provider: account.provider,
        displayName: PROVIDER_DISPLAY_NAMES[account.provider],
      })),
    });
  } catch (error) {
    captureException(error, { operation: "List linked auth providers error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
