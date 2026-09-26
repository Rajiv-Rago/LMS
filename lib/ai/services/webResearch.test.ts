import { readWebPage, searchWeb } from "./webResearch";

describe("web research", () => {
  const originalKey = process.env.BRAVE_SEARCH_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
    else process.env.BRAVE_SEARCH_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  it("returns indexed results without exposing the API key in the URL", async () => {
    process.env.BRAVE_SEARCH_API_KEY = "test-key";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: [{ url: "https://example.com/guide", title: "Guide", description: "<b>Useful</b> guide" }] } }),
    });
    global.fetch = fetchMock;

    await expect(searchWeb("TypeScript basics")).resolves.toEqual([
      { url: "https://example.com/guide", title: "Guide", description: "Useful guide" },
    ]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("q=TypeScript+basics");
    expect(String(url)).not.toContain("test-key");
    expect(options.headers["X-Subscription-Token"]).toBe("test-key");
  });

  it("refuses private page URLs before fetching them", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await expect(readWebPage("http://127.0.0.1/admin")).rejects.toThrow("Unsafe page host");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("extracts a search result without an API key", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fguide">Example &amp; guide</a>',
    });
    await expect(searchWeb("example")).resolves.toEqual([
      { url: "https://example.com/guide", title: "Example & guide", description: "" },
    ]);
  });
});
