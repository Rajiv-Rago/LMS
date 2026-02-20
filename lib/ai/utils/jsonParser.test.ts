import { cleanMarkdownCodeBlock, parseAIJsonResponse } from "./jsonParser";

describe("jsonParser", () => {
  describe("cleanMarkdownCodeBlock", () => {
    it("removes ```json wrapper", () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });

    it("removes ``` wrapper without language tag", () => {
      const input = '```\n{"key": "value"}\n```';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });

    it("handles content without code block markers", () => {
      const input = '{"key": "value"}';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });

    it("trims whitespace around the content", () => {
      const input = '  ```json\n  {"key": "value"}  \n```  ';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });

    it("handles empty content inside code block", () => {
      const input = "```json\n\n```";
      expect(cleanMarkdownCodeBlock(input)).toBe("");
    });

    it("handles content with only closing backticks", () => {
      const input = '{"key": "value"}\n```';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });

    it("handles content with only opening backticks", () => {
      const input = '```json\n{"key": "value"}';
      expect(cleanMarkdownCodeBlock(input)).toBe('{"key": "value"}');
    });
  });

  describe("parseAIJsonResponse", () => {
    it("parses valid JSON from a clean string", () => {
      const result = parseAIJsonResponse('{"name": "test"}', (parsed) => {
        const obj = parsed as { name: string };
        return obj;
      });

      expect(result).toEqual({ name: "test" });
    });

    it("parses JSON wrapped in markdown code block", () => {
      const input = '```json\n{"name": "test"}\n```';
      const result = parseAIJsonResponse(input, (parsed) => {
        return parsed as { name: string };
      });

      expect(result).toEqual({ name: "test" });
    });

    it("throws on invalid JSON", () => {
      expect(() =>
        parseAIJsonResponse("not json at all", (p) => p)
      ).toThrow("Failed to parse AI response as JSON");
    });

    it("throws on truncated JSON", () => {
      expect(() =>
        parseAIJsonResponse('{"key": "val', (p) => p)
      ).toThrow("Failed to parse AI response as JSON");
    });

    it("propagates validator errors as-is", () => {
      const validatorError = new Error("Validation failed: missing field");

      expect(() =>
        parseAIJsonResponse('{"valid": "json"}', () => {
          throw validatorError;
        })
      ).toThrow("Validation failed: missing field");
    });

    it("handles arrays in JSON response", () => {
      const input = '```json\n[1, 2, 3]\n```';
      const result = parseAIJsonResponse(input, (parsed) => parsed as number[]);

      expect(result).toEqual([1, 2, 3]);
    });

    it("handles nested objects", () => {
      const input = '{"course": {"title": "Test", "modules": [{"name": "M1"}]}}';
      const result = parseAIJsonResponse(input, (parsed) => parsed);

      expect(result).toEqual({
        course: { title: "Test", modules: [{ name: "M1" }] },
      });
    });
  });
});
