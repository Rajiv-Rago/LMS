import { dbConnect } from "@/lib/db";
import User from "@/lib/models/User";
import { UserAIPreferences } from "../types";

/**
 * Fetches a user's AI preferences from the database.
 * Returns undefined if the user has no preferences set.
 */
export async function getUserAIPreferences(
  userId: string
): Promise<UserAIPreferences | undefined> {
  await dbConnect();

  const user = await User.findById(userId).select("aiPreferences").lean();

  if (!user?.aiPreferences) {
    return undefined;
  }

  return user.aiPreferences as UserAIPreferences;
}
