import { createConfigSchematics } from "@lmstudio/sdk";

export const pluginConfigSchematics = createConfigSchematics()
  .field("maxSearchResults", "numeric", {
    int: true, min: 3, max: 20,
    displayName: "Max Search Results",
    subtitle: "Number of search results to retrieve per query.",
    slider: { min: 3, max: 20, step: 1 },
  }, 8)
  .field("maxPagesPerSearch", "numeric", {
    int: true, min: 1, max: 6,
    displayName: "Max Pages to Read",
    subtitle: "How many pages to actually fetch and read per search. Higher = more thorough, slower.",
    slider: { min: 1, max: 6, step: 1 },
  }, 3)
  .field("fetchTimeoutMs", "numeric", {
    int: true, min: 2000, max: 20000,
    displayName: "Page Fetch Timeout (ms)",
    subtitle: "How long to wait when reading a page before giving up.",
    slider: { min: 2000, max: 20000, step: 1000 },
  }, 8000)
  .field("defaultLanguage", "string", {
    displayName: "Search Language",
    subtitle: "Language/region for search results (e.g. 'en-us', 'en-gb'). Leave blank for global.",
  }, "en-us")
  .field("searxngUrl", "string", {
    displayName: "SearXNG URL",
    subtitle:
      "Base URL of your self-hosted SearXNG instance (e.g. http://localhost:8080). " +
      "Leave blank to use the built-in DDG/Bing scraper. " +
      "SearXNG aggregates many engines and has no rate limits.",
  }, "")
  .field("searchRecencyWindow", "string", {
    displayName: "Search Recency Window",
    subtitle:
      "Limit all web searches to results published within this window. " +
      "Options: day, week, month, year, any (no filter). " +
      "Narrower windows give fresher results but may reduce result count.",
  }, "year")
  .field("lmStudioUrl", "string", {
    displayName: "LM Studio URL",
    subtitle:
      "Base URL of your LM Studio instance for embeddings (e.g. http://localhost:1234). " +
      "Used to rerank search results via nomic-embed-text before fetching pages.",
  }, "http://localhost:1234")
  .build();
