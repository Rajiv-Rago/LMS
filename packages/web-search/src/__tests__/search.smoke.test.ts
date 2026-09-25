import { describe, it, expect } from "@jest/globals";
import { scrapeDDG, scrapeBing, ddgSearch } from "../toolsProvider";

// Live, network-dependent "rot detector". The scrapers parse search-engine HTML
// with regexes; when DuckDuckGo or Bing change their markup, the regexes silently
// match nothing and the plugin returns "no results" forever. These tests hit the
// engines for real with a query that always has results, so they FAIL LOUD the
// moment parsing breaks — instead of users discovering it months later.
//
// They need outbound network. Run with: npm test
const STABLE_QUERY = "wikipedia";

function assertParseable(hits: { url: string; title: string }[]) {
  expect(hits.length).toBeGreaterThan(0);          // markup-rot guard
  expect(hits[0].url).toMatch(/^https?:\/\//);     // real URL extracted
  expect(hits[0].title.trim().length).toBeGreaterThan(0); // title extracted
}

describe("search scraper parsing (live)", () => {
  it("DuckDuckGo HTML still parses into results", async () => {
    assertParseable(await scrapeDDG(STABLE_QUERY, 5));
  }, 20_000);

  it("Bing HTML still parses into results", async () => {
    assertParseable(await scrapeBing(STABLE_QUERY, 5));
  }, 20_000);

  it("ddgSearch fallback chain yields results", async () => {
    assertParseable(await ddgSearch(STABLE_QUERY, 5));
  }, 30_000);

  it("a cancelled search rejects as AbortError (so safe_impl reports 'cancelled', not 'unreachable')", async () => {
    // safe_impl keys off err.name === "AbortError" to report cancellation. The
    // backend-outage wrapping must NOT mask that — a user cancel is not an outage.
    await expect(
      ddgSearch(STABLE_QUERY, 5, undefined, "en-us", undefined, AbortSignal.abort()),
    ).rejects.toMatchObject({ name: "AbortError" });
  }, 15_000);
});
