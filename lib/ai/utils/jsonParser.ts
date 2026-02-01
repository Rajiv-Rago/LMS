/**
 * Cleans markdown code block formatting from AI responses.
 * AI models sometimes wrap JSON in ```json ... ``` blocks despite instructions.
 */
export function cleanMarkdownCodeBlock(content: string): string {
  let cleaned = content.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Parses an AI response as JSON after cleaning markdown formatting.
 *
 * @param content - Raw AI response content
 * @param validator - Function to validate and transform the parsed object
 * @returns The validated and transformed object
 * @throws Error if JSON parsing fails or validation fails
 */
export function parseAIJsonResponse<T>(
  content: string,
  validator: (parsed: unknown) => T
): T {
  const cleanedContent = cleanMarkdownCodeBlock(content);

  try {
    const parsed = JSON.parse(cleanedContent);
    return validator(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
    }
    throw error;
  }
}
