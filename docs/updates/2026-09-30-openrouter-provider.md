# OpenRouter provider

- Added OpenRouter generation and streaming through the existing LangChain OpenAI client, configured with `OPENROUTER_API_KEY`.
- Added `openrouter/free` to the Advanced model selector; automatic tier selection excludes it.
- Updated provider validation and stored preferences/content schemas to accept OpenRouter.
- Blank models now use provider defaults instead of sending an empty model ID.
- Documented selection precedence and environment setup in the README.

Validation: 52 targeted Jest tests passed; TypeScript compilation passed. Provider calls were mocked; no live OpenRouter request was made.
