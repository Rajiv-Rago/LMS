/** Describe known failures without exposing stored exceptions or model content. */
export function publicJobError(error?: string): string | undefined {
  if (!error) return undefined;
  if (error.includes("AI_GENERATION_PARSE_FAILED") || error.startsWith("Failed to parse AI response as JSON"))
    return "The selected AI model returned an invalid response. Try a different model.";
  if (/output was truncated/i.test(error))
    return "The AI response exceeded its output limit. Try a smaller course or a different model.";
  if (error.includes("AI_PROVIDER_RATE_LIMITED"))
    return "The AI provider is busy or rate-limited. Try again later or choose a different model.";
  return "Job failed — please try again";
}
