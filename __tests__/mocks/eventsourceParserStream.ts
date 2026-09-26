// @langchain/google imports an ESM-only stream parser through its CJS entrypoint.
// Unit tests mock the model transport; fail loudly if a test attempts real SSE.
export class EventSourceParserStream {
  constructor() {
    throw new Error("Mock the Google model transport in Jest tests");
  }
}
