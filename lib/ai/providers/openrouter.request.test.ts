import { OpenRouterProvider } from "./openrouter";

it("sends the schema and routing requirement in the actual OpenRouter HTTP body", async () => {
  const responseSchema = {
    type: "object", properties: { goals: { type: "array", items: { type: "string" } } },
    required: ["goals"], additionalProperties: false,
  };
  const fetch = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
    id: "test-completion", object: "chat.completion", created: 1, model: "test/structured-model",
    choices: [{ index: 0, message: { role: "assistant", content: '{"goals":["Learn loops"]}' }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    const result = await new OpenRouterProvider("test-key").generateText("Suggest goals as JSON", { responseSchema });
    expect(result.content).toBe('{"goals":["Learn loops"]}');
    expect(String(fetch.mock.calls[0][0])).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(body).toMatchObject({
      model: "openrouter/free",
      provider: { require_parameters: true },
      response_format: { type: "json_schema", json_schema: { strict: true, schema: responseSchema } },
    });
  } finally {
    fetch.mockRestore();
  }
});
