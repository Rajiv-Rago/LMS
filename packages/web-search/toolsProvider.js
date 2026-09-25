"use strict";
/**
 * Web Search Plugin — toolsProvider
 *
 * Tools:
 *   Core        · search, fetch_and_read, deep_search
 *   Verify      · fact_check, verify_statistic, find_primary_source
 *   Explore     · search_recent, compare_sources, find_expert_views
 *   Research    · search_academic, research_topic
 *   Assess      · check_source
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsProvider = exports.SearchBackendError = void 0;
exports.scrapeDDG = scrapeDDG;
exports.scrapeBing = scrapeBing;
exports.ddgSearch = ddgSearch;
const sdk_1 = require("@lmstudio/sdk");
// Search implemented via HTML scraping — no API key, no rate limits
const zod_1 = require("zod");
const config_1 = require("./config");
// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------
function json(obj) {
    return JSON.stringify(obj, null, 2);
}
function safe_impl(name, fn) {
    return async (params, ctx) => {
        if (ctx.signal.aborted) {
            return JSON.stringify({ tool_error: true, tool: name, error: "cancelled" });
        }
        try {
            return await fn(params, ctx);
        }
        catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                return JSON.stringify({ tool_error: true, tool: name, error: "cancelled" });
            }
            const msg = err instanceof Error ? err.message : String(err);
            return JSON.stringify({
                tool_error: true,
                tool: name,
                error: msg,
                hint: "Read the error above, adjust the parameters if needed, and retry.",
            }, null, 2);
        }
    };
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function truncateAtWord(s, max) {
    if (s.length <= max)
        return s;
    const cut = s.lastIndexOf(" ", max);
    return cut > 0 ? s.slice(0, cut) : s.slice(0, max);
}
function rootDomain(url) {
    try {
        const h = new URL(url).hostname.replace(/^www\./, "");
        const parts = h.split(".");
        return parts.length >= 2 ? parts.slice(-2).join(".") : h;
    }
    catch {
        return url;
    }
}
function publisherDiversityInstruction(successUrls) {
    if (successUrls.length === 0) {
        return "No pages successfully read. Do not assert any facts — re-search or inform the user.";
    }
    const domains = new Set(successUrls.map(rootDomain));
    const count = domains.size;
    if (count === 1) {
        return `WARNING: All pages read are from the same publisher (${[...domains][0]}). Every claim here is SINGLE-SOURCE = UNVERIFIED. Call fact_check on key claims, or explicitly label them as unverified before presenting.`;
    }
    return `${count} independent publisher(s) read. For each key claim: check if 2+ of these publishers support it. Single-source claims must be labeled UNVERIFIED.`;
}
// ---------------------------------------------------------------------------
// Embedding + reranking (nomic-embed-text via LM Studio)
// ---------------------------------------------------------------------------
async function embedTexts(texts, baseUrl) {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text", input: texts }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
        throw new Error(`Embeddings API ${res.status}`);
    const data = await res.json();
    return data.data.map((d) => d.embedding);
}
function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
async function rerankHits(query, hits, baseUrl) {
    if (hits.length <= 1)
        return hits;
    try {
        const inputs = [
            `search_query: ${query}`,
            ...hits.map((h) => `search_document: ${h.title} ${h.snippet}`),
        ];
        const embeddings = await embedTexts(inputs, baseUrl);
        if (embeddings.length !== inputs.length)
            return hits;
        const queryEmb = embeddings[0];
        const scored = hits.map((h, i) => ({ h, score: cosine(queryEmb, embeddings[i + 1]) }));
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.h);
    }
    catch {
        return hits;
    }
}
// ---------------------------------------------------------------------------
// Clarify — ambiguity signal detection
// ---------------------------------------------------------------------------
const AMBIGUOUS_TERMS = {
    python: ["programming language", "snake (animal)"],
    java: ["programming language", "island in Indonesia", "coffee"],
    swift: ["programming language", "Taylor Swift", "swift bird"],
    mercury: ["planet", "element", "car brand", "Greek god"],
    bank: ["financial institution", "river bank", "data bank"],
    apple: ["tech company", "fruit"],
    meta: ["Meta (Facebook)", "meta as a concept/adjective"],
    bat: ["cricket/baseball bat", "flying mammal"],
    spring: ["Spring framework (Java)", "season", "water spring"],
    rust: ["Rust programming language", "corrosion"],
    go: ["Go programming language", "board game", "verb"],
    ruby: ["Ruby programming language", "gemstone"],
    crane: ["construction crane", "bird"],
};
function detectAmbiguitySignals(question) {
    const signals = [];
    const lower = question.toLowerCase();
    const words = lower.split(/\s+/);
    if (words.length < 4)
        signals.push("query is very short — likely underspecified");
    for (const [term, meanings] of Object.entries(AMBIGUOUS_TERMS)) {
        if (new RegExp(`\\b${term}\\b`).test(lower)) {
            signals.push(`"${term}" is ambiguous — could mean: ${meanings.join(" or ")}`);
        }
    }
    const timeWords = ["latest", "recent", "current", "now", "today", "new", "best", "top"];
    const hasTimeSensitive = timeWords.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
    const hasTimeContext = /\b(20\d{2}|last (week|month|year)|in \d{4})\b/i.test(question);
    if (hasTimeSensitive && !hasTimeContext) {
        signals.push("time-sensitive terms detected — which time period matters?");
    }
    // "here" omitted — too common a false positive ("here is how it works")
    const locationWords = ["near me", "nearby", "in my area", "around me", "local to"];
    if (locationWords.some((w) => lower.includes(w))) {
        signals.push("location-dependent query — which country/city/region?");
    }
    return signals;
}
// ---------------------------------------------------------------------------
// Page fetching & text extraction
// ---------------------------------------------------------------------------
const FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
};
function cleanHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{2,}/g, " ")
        .trim();
}
/** Strip HTML to readable plain text. Prefers <article>/<main> content over full-page noise. */
function extractText(html, maxChars = 8000) {
    // Try to pull out just the main article body first — much better signal-to-noise
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ??
        html.match(/<div[^>]+(?:class|id)="[^"]*(?:content|article|post|entry|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const source = articleMatch ? articleMatch[1] : html;
    return cleanHtml(source).slice(0, maxChars);
}
function extractTitle(html) {
    const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (m)
        return m[1].trim().replace(/\s+/g, " ");
    // og:title attributes can appear in any order, so match the meta tag then extract content
    const ogTag = html.match(/<meta[^>]+og:title[^>]*>/i);
    if (ogTag) {
        const contentMatch = ogTag[0].match(/content="([^"]{1,200})"/i);
        if (contentMatch)
            return contentMatch[1].trim();
    }
    return "Untitled";
}
async function fetchPage(url, timeoutMs, maxChars = 8000, signal) {
    try {
        const fetchSignal = signal
            ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
            : AbortSignal.timeout(timeoutMs);
        const res = await fetch(url, { signal: fetchSignal, headers: FETCH_HEADERS });
        if (!res.ok) {
            return { url, title: "", text: "", wordCount: 0, error: `HTTP ${res.status}` };
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text")) {
            return { url, title: "", text: "", wordCount: 0, error: `Non-text content: ${contentType}` };
        }
        const html = await res.text();
        const title = extractTitle(html);
        const extracted = extractText(html, maxChars);
        return { url, title, text: extracted, wordCount: extracted.split(/\s+/).length };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { url, title: "", text: "", wordCount: 0, error: msg };
    }
}
function decodeHtmlEntities(s) {
    return s
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function stripTagsSearch(html) {
    return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
async function fetchSearchHtml(url, timeoutMs = 10_000, signal) {
    const fetchSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs);
    const res = await fetch(url, {
        signal: fetchSignal,
        headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return await res.text();
}
async function scrapeDDG(query, max, time, locale = "en-us", signal) {
    // DDG HTML: kl=locale, df=d|w|m|y for time filter
    const params = new URLSearchParams({ q: query, kl: locale });
    if (time)
        params.set("df", time);
    const html = await fetchSearchHtml(`https://html.duckduckgo.com/html/?${params}`, 10_000, signal);
    const links = [];
    const linkRe = /class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = linkRe.exec(html)) !== null && links.length < max) {
        const uddg = m[1].match(/[?]uddg=([^&"]+)/);
        let url = m[1];
        if (uddg) {
            try {
                url = decodeURIComponent(uddg[1]);
            }
            catch {
                continue;
            }
        }
        if (!url.startsWith("http"))
            continue;
        const title = stripTagsSearch(m[2]);
        if (title)
            links.push({ url, title });
    }
    if (links.length === 0)
        return [];
    const snippets = [];
    const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:div|a)>/g;
    let sm;
    while ((sm = snipRe.exec(html)) !== null)
        snippets.push(stripTagsSearch(sm[1]));
    return links.map((l, i) => ({ ...l, snippet: snippets[i] ?? "" }));
}
// Bing HTML search has no reliable URL-based freshness parameter.
// (tbs=qdr:X is Google's parameter and was silently ignored by Bing.)
// Time filtering is handled by SearXNG and DDG tiers above.
async function scrapeBing(query, max, _time, signal) {
    const html = await fetchSearchHtml(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${max}&setlang=en&cc=us`, 10_000, signal);
    const results = [];
    // Bing adds attributes after the class (e.g. `<li class="b_algo" data-id iid=...>`),
    // so match b_algo anywhere in the class list rather than requiring an exact tag.
    const liRe = /<li class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = liRe.exec(html)) !== null && results.length < max) {
        const block = m[1];
        const linkM = block.match(/<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!linkM)
            continue;
        const title = stripTagsSearch(linkM[2]);
        if (!title)
            continue;
        const snipM = block.match(/<div class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) ??
            block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        results.push({ title, url: linkM[1], snippet: snipM ? stripTagsSearch(snipM[1]) : "" });
    }
    return results;
}
// SearXNG time_range values: day | week | month | year
const SEARXNG_TIME = { d: "day", w: "week", m: "month", y: "year" };
async function searchSearXNG(baseUrl, query, max, timeoutMs = 10_000, time, signal) {
    const params = { q: query, format: "json" };
    if (time)
        params["time_range"] = SEARXNG_TIME[time] ?? "";
    const url = `${baseUrl.replace(/\/$/, "")}/search?${new URLSearchParams(params)}`;
    const fetchSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
    const res = await fetch(url, { signal: fetchSignal, headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" } });
    if (!res.ok)
        throw new Error(`SearXNG HTTP ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).slice(0, max).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.content ?? "",
    }));
}
/** Thrown when every search backend is unreachable (network/HTTP/block) — as
 *  opposed to backends responding with genuinely zero results. Lets the tool
 *  layer say "search is down" instead of silently "no results found". */
class SearchBackendError extends Error {
    constructor(message) {
        super(message);
        this.name = "SearchBackendError";
    }
}
exports.SearchBackendError = SearchBackendError;
const errMsg = (e) => (e instanceof Error ? e.message : String(e));
async function ddgSearch(query, maxResults, time, locale = "en-us", searxngUrl, signal) {
    const errors = [];
    let anyResponded = false; // at least one backend returned HTTP 200 (even with 0 hits)
    if (searxngUrl) {
        try {
            const r = await searchSearXNG(searxngUrl, query, maxResults, 10_000, time, signal);
            anyResponded = true;
            if (r.length > 0)
                return r;
        }
        catch (e) {
            errors.push(`SearXNG: ${errMsg(e)}`);
        }
    }
    try {
        const r = await scrapeDDG(query, maxResults, time, locale, signal);
        anyResponded = true;
        if (r.length > 0)
            return r;
    }
    catch (e) {
        errors.push(`DDG: ${errMsg(e)}`);
    }
    try {
        const r = await scrapeBing(query, maxResults, time, signal);
        anyResponded = true;
        if (r.length > 0)
            return r;
    }
    catch (e) {
        errors.push(`Bing: ${errMsg(e)}`);
    }
    // All tiers exhausted with no hits. Distinguish the failure modes:
    // 1. User cancelled mid-search → every fetch threw AbortError. Re-throw it so
    //    safe_impl reports "cancelled", not a misleading "backends unreachable".
    signal?.throwIfAborted();
    // 2. Genuinely no backend responded (network down / blocked).
    if (!anyResponded) {
        throw new SearchBackendError(`All search backends unreachable — ${errors.join("; ")}`);
    }
    // ponytail: a backend responded 200 but we parsed 0 results. Could be a genuine
    // empty, or markup-rot in our regex parser. We can't tell at runtime — the live
    // smoke test (search.smoke.test.ts) is what catches rot before it ships.
    return [];
}
/** Search and then fetch+read the top N pages. Skips URLs already in `fetchedUrls` (dedup). */
async function searchAndRead(query, maxResults, maxPages, timeoutMs, time, locale = "en-us", fetchedUrls, searxngUrl, lmStudioUrl, signal) {
    let hits = await ddgSearch(query, maxResults, time, locale, searxngUrl, signal);
    if (lmStudioUrl && hits.length > 1) {
        hits = await rerankHits(query, hits, lmStudioUrl);
    }
    const pages = [];
    for (const h of hits) {
        if (signal?.aborted)
            break;
        // Stop when we have enough successful reads; errors don't fill the slot
        if (pages.filter((p) => !p.error).length >= maxPages)
            break;
        if (fetchedUrls?.has(h.url))
            continue;
        fetchedUrls?.add(h.url);
        const p = await fetchPage(h.url, timeoutMs, 8000, signal);
        pages.push(p);
        await sleep(300);
    }
    return { hits, pages };
}
// ---------------------------------------------------------------------------
// Source credibility signals
// ---------------------------------------------------------------------------
const GOV_DOMAINS = /\.(gov|mil)(\.[\w]+)?$/i;
const EDU_DOMAINS = /\.(edu|ac\.\w{2}|edu\.\w{2})(\.[\w]+)?$/i;
const NEWS_DOMAINS = new Set([
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com",
    "nytimes.com", "washingtonpost.com", "economist.com", "ft.com",
    "bloomberg.com", "wsj.com", "npr.org", "aljazeera.com", "theatlantic.com",
    "nature.com", "science.org", "scientificamerican.com", "newscientist.com",
    "technologyreview.com", "arstechnica.com", "wired.com",
]);
const ACADEMIC_DOMAINS = new Set([
    "arxiv.org", "pubmed.ncbi.nlm.nih.gov", "semanticscholar.org",
    "scholar.google.com", "jstor.org", "researchgate.net",
    "ncbi.nlm.nih.gov", "springer.com", "nature.com", "cell.com",
]);
const LOW_CREDIBILITY_SIGNALS = ["blogspot.com", "wordpress.com", "reddit.com",
    "quora.com", "yahoo.com", "medium.com"];
function assessDomainCredibility(url) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        const signals = [];
        let type = "website";
        let credibility = "unknown";
        if (GOV_DOMAINS.test(hostname)) {
            type = "government";
            credibility = "high";
            signals.push("government domain");
        }
        else if (EDU_DOMAINS.test(hostname)) {
            type = "academic institution";
            credibility = "high";
            signals.push("educational domain");
        }
        else if (ACADEMIC_DOMAINS.has(hostname)) {
            type = "academic/research";
            credibility = "high";
            signals.push("known academic platform");
        }
        else if (NEWS_DOMAINS.has(hostname)) {
            type = "established news outlet";
            credibility = "high";
            signals.push("established journalism");
        }
        else if (hostname === "wikipedia.org" || hostname.endsWith(".wikipedia.org")) {
            type = "encyclopedia";
            credibility = "medium";
            signals.push("Wikipedia — reliable overview but verify citations for facts");
        }
        else if (LOW_CREDIBILITY_SIGNALS.some((s) => hostname.includes(s))) {
            type = "user-generated content";
            credibility = "low";
            signals.push("user-generated / blog platform — verify claims independently");
        }
        else {
            credibility = "unknown";
            signals.push("unknown publication — check About page, author credentials, citations");
        }
        return { type, credibility, signals };
    }
    catch {
        return { type: "unknown", credibility: "unknown", signals: ["could not parse URL"] };
    }
}
// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
const toolsProvider = async (ctl) => {
    const cfg = ctl.getPluginConfig(config_1.pluginConfigSchematics);
    const maxResults = () => cfg.get("maxSearchResults");
    const maxPages = () => cfg.get("maxPagesPerSearch");
    const timeoutMs = () => cfg.get("fetchTimeoutMs");
    const locale = () => cfg.get("defaultLanguage").trim() || "en-us";
    const searxng = () => cfg.get("searxngUrl").trim() || undefined;
    const lmStudio = () => cfg.get("lmStudioUrl").trim() || "http://localhost:1234";
    const WIN_MAP = { day: "d", week: "w", month: "m", year: "y" };
    const searchWindow = () => {
        const v = cfg.get("searchRecencyWindow").trim().toLowerCase();
        return WIN_MAP[v];
    };
    const ddg = (query, max, time, signal) => ddgSearch(query, max, time ?? searchWindow(), locale(), searxng(), signal);
    const sar = (query, max, pages, time, dedup, signal) => searchAndRead(query, max, pages, timeoutMs(), time ?? searchWindow(), locale(), dedup, searxng(), lmStudio(), signal);
    const tools = [
        // =========================================================================
        // CLARIFY — MUST be called before any search tool
        // =========================================================================
        (0, sdk_1.tool)({
            name: "clarify",
            description: (0, sdk_1.text) `
        ALWAYS call this tool FIRST before calling any search tool.
        Never skip this step, even if the question seems clear.

        This tool detects ambiguity in the user's question and tells you whether
        you need to ask the user clarifying questions before searching.

        Two outcomes:
          STATUS: READY    — question is specific enough, search immediately with the refined_query.
          STATUS: CLARIFY  — question is ambiguous or underspecified. Ask the user the listed
                             questions first. Do NOT search until the user answers.

        Asking one focused round of questions upfront saves wasted searches and
        gives the user a much better, targeted answer.
      `,
            parameters: {
                question: zod_1.z.string().describe("The user's question exactly as they asked it."),
            },
            implementation: safe_impl("clarify", async ({ question }, ctx) => {
                ctx.status("Analysing query…");
                const signals = detectAmbiguitySignals(question);
                if (signals.length === 0) {
                    return json({
                        status: "READY",
                        refined_query: question,
                        instruction: "Question is specific enough. Call the appropriate search tool now using refined_query.",
                    });
                }
                return json({
                    status: "CLARIFY",
                    ambiguity_signals: signals,
                    instruction: [
                        "DO NOT search yet.",
                        "Ask the user 1–3 focused questions based on the ambiguity signals above.",
                        "Keep questions short and concrete — one topic per question.",
                        "Only call a search tool after the user answers.",
                    ].join(" "),
                });
            }),
        }),
        // =========================================================================
        // CORE
        // =========================================================================
        (0, sdk_1.tool)({
            name: "search",
            description: (0, sdk_1.text) `
        The primary research tool. Unlike a basic search engine, this tool:
        • Retrieves search results AND actually reads the top pages (not just snippets)
        • Returns structured facts with source attribution
        • Surfaces the full page text for you to reason over
        • Flags source credibility for each result

        Use for: most questions that need factual answers from the web.
        Prefer deep_search when you need multiple angles or research_topic for comprehensive reports.
      `,
            parameters: {
                query: zod_1.z.string().describe("What you want to find. Be specific — vague queries get vague results."),
                max_pages_to_read: zod_1.z.coerce.number().int().min(1).max(6).default(3)
                    .describe("How many pages to actually fetch and read (1=quick, 3=default, 6=thorough)."),
            },
            implementation: safe_impl("search", async ({ query, max_pages_to_read }, ctx) => {
                ctx.status(`Searching: ${query}`);
                const { hits, pages } = await sar(query, maxResults(), max_pages_to_read, undefined, undefined, ctx.signal);
                const pageDetails = pages.map((p) => ({
                    url: p.url,
                    title: p.title,
                    status: p.error ? `error: ${p.error}` : `read (${p.wordCount} words)`,
                    credibility: assessDomainCredibility(p.url),
                    content: p.error ? null : p.text,
                }));
                const snippetOnlyHits = hits.slice(max_pages_to_read).map((h) => ({
                    title: h.title,
                    url: h.url,
                    snippet: h.snippet,
                    credibility: assessDomainCredibility(h.url),
                }));
                const successUrls = pages.filter((p) => !p.error).map((p) => p.url);
                return json({
                    query,
                    total_results_found: hits.length,
                    pages_read: successUrls.length,
                    independent_publishers_read: new Set(successUrls.map(rootDomain)).size,
                    pages_read_content: pageDetails,
                    additional_snippets: snippetOnlyHits,
                    instruction: publisherDiversityInstruction(successUrls) + " Cite specific sources. Distinguish facts from inferences.",
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "fetch_and_read",
            description: (0, sdk_1.text) `
        Fetch a specific URL and read its full content. This is the tool that regular
        search CANNOT do — it gives you the actual article text, not a short snippet.

        Use when:
        • The user shares a URL and wants you to read it
        • A search result looks relevant but you need the full text
        • You need the exact wording of a policy, study, or article
        • You want to verify what a source actually says vs what's quoted elsewhere
      `,
            parameters: {
                url: zod_1.z.string().url().describe("The full URL to fetch and read."),
                max_chars: zod_1.z.coerce.number().int().min(1000).max(20000).default(8000)
                    .describe("How many characters of text to extract (default 8000, max 20000 for very long pages)."),
            },
            implementation: safe_impl("fetch_and_read", async ({ url, max_chars }, ctx) => {
                ctx.status(`Fetching: ${url}`);
                const page = await fetchPage(url, timeoutMs(), max_chars, ctx.signal);
                if (page.error) {
                    return json({ url, error: page.error, hint: "Try a different URL or use the search tool." });
                }
                const cred = assessDomainCredibility(url);
                return json({
                    url,
                    title: page.title,
                    word_count: page.wordCount,
                    source_credibility: cred,
                    content: page.text,
                    instruction: "Reason over this content directly. Quote specific passages when citing facts.",
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "deep_search",
            description: (0, sdk_1.text) `
        Multi-angle research. Runs 3–5 separate searches from different perspectives
        on the same topic, reads pages for each, and returns everything together.

        This defeats single-search bias — you get coverage from different angles,
        not just the top SEO results for one query.

        Angles can be: different framings, pro/con, historical vs current, expert vs critic,
        technical vs practical, etc. Provide your own angles or let the tool pick.

        Use when: you need a complete picture, not just one answer. Complex topics,
        controversies, research questions, anything where one search could miss something important.
      `,
            parameters: {
                topic: zod_1.z.string().describe("The central topic to research deeply."),
                angles: zod_1.z.array(zod_1.z.string()).max(5).default([])
                    .describe("Specific search angles (e.g. ['benefits', 'risks', 'recent studies', 'expert criticism']). Leave empty to use default angles."),
                pages_per_angle: zod_1.z.coerce.number().int().min(1).max(3).default(2)
                    .describe("Pages to read per search angle (1=faster, 2=default, 3=thorough)."),
            },
            implementation: safe_impl("deep_search", async ({ topic, angles, pages_per_angle }, ctx) => {
                const defaultAngles = [
                    `${topic} overview key facts`,
                    `${topic} latest research findings`,
                    `${topic} criticism problems limitations`,
                    `${topic} expert consensus`,
                ];
                const searchAngles = angles.length > 0 ? angles : defaultAngles;
                const results = [];
                ctx.status(`Deep-searching "${topic}" across ${searchAngles.length} angles…`);
                // Dedup: never fetch the same URL twice across angles
                const fetchedUrls = new Set();
                for (const [i, angle] of searchAngles.entries()) {
                    ctx.status(`Angle ${i + 1}/${searchAngles.length}: ${angle}`);
                    const query = angles.length > 0 ? `${topic} ${angle}` : angle;
                    const { hits, pages } = await sar(query, maxResults(), pages_per_angle, undefined, fetchedUrls, ctx.signal);
                    results.push({
                        angle,
                        query,
                        hits: hits.slice(pages_per_angle).map((h) => ({
                            title: h.title, url: h.url, snippet: h.snippet,
                        })),
                        pages: pages.map((p) => ({
                            url: p.url,
                            title: p.title,
                            credibility: assessDomainCredibility(p.url),
                            content: p.error ? null : p.text,
                            ...(p.error ? { error: p.error } : {}),
                        })),
                    });
                    await sleep(400);
                }
                return json({
                    topic,
                    angles_searched: searchAngles.length,
                    results,
                    instruction: [
                        "Synthesize across ALL angles above. Do NOT just summarize angle 1.",
                        "Surface agreements and disagreements between angles.",
                        "Identify what is well-established vs what is contested.",
                        "Flag any angle where sources were thin or contradicted each other.",
                    ].join(" "),
                });
            }),
        }),
        // =========================================================================
        // VERIFICATION
        // =========================================================================
        (0, sdk_1.tool)({
            name: "fact_check",
            description: (0, sdk_1.text) `
        Cross-check a specific claim against multiple sources — both supporting
        and opposing. Returns evidence for and against, then a verdict signal.

        Verdict signals:
          supported    — multiple independent sources confirm it
          disputed     — credible sources on both sides
          unsupported  — no solid evidence found for it
          nuanced      — true in some context but misleading as stated
          uncertain    — thin coverage, very recent, or inconclusive

        Use when: someone asserts something as fact and you want to verify it
        before repeating it, or when the user asks "is it true that...".
      `,
            parameters: {
                claim: zod_1.z.string().describe("The specific claim to check, stated clearly and concisely."),
            },
            implementation: safe_impl("fact_check", async ({ claim }, ctx) => {
                ctx.status("Fact-checking across 4 search angles…");
                const searches = [
                    { angle: "direct", query: claim },
                    { angle: "opposing", query: `"${truncateAtWord(claim, 60)}" false wrong debunked myth` },
                    { angle: "evidence", query: `evidence research study "${truncateAtWord(claim, 80)}"` },
                    { angle: "expert", query: `experts scientists say ${claim.slice(0, 80)}` },
                ];
                const angleResults = [];
                for (const [i, s] of searches.entries()) {
                    ctx.status(`Checking angle ${i + 1}/4: ${s.angle}`);
                    const { hits, pages } = await sar(s.query, maxResults(), Math.min(maxPages(), 2), undefined, undefined, ctx.signal);
                    angleResults.push({
                        angle: s.angle,
                        hits: hits.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })),
                        pages: pages.map((p) => ({
                            url: p.url,
                            title: p.title,
                            credibility: assessDomainCredibility(p.url),
                            content: p.error ? null : p.text,
                            ...(p.error ? { error: p.error } : {}),
                        })),
                    });
                    await sleep(350);
                }
                return json({
                    claim,
                    search_angles: angleResults,
                    verdict_guide: {
                        supported: "Multiple independent, credible sources directly confirm the claim.",
                        disputed: "Credible sources exist on both sides — the claim is contested.",
                        unsupported: "No solid evidence found; sources either don't address it or contradict it.",
                        nuanced: "Partially true — accurate in a specific context but misleading as a general statement.",
                        uncertain: "Coverage is thin, very recent, or sources are inconclusive.",
                    },
                    instruction: [
                        "Analyse ALL four search angles above.",
                        "Count how many HIGH-credibility sources support vs oppose the claim.",
                        "Assign a verdict from the guide.",
                        "Explain the key evidence for your verdict.",
                        "Flag any important context or caveats.",
                    ].join(" "),
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "verify_statistic",
            description: (0, sdk_1.text) `
        Verify a specific number, percentage, or statistic and trace it to its
        primary source. Essential because statistics are often:
        • Outdated (cited from a 10-year-old study)
        • Misquoted (the real number is different)
        • Out of context (applies to a subset, not the general claim)
        • Fabricated (no original source exists)

        Returns: primary source candidates, original publisher, date, actual number found.
      `,
            parameters: {
                statistic: zod_1.z.string().describe("The specific stat to verify, e.g. '90% of startups fail in year one'."),
                context: zod_1.z.string().default("").describe("Domain context to narrow the search, e.g. 'venture-backed US tech startups'."),
            },
            implementation: safe_impl("verify_statistic", async ({ statistic, context }, ctx) => {
                ctx.status("Verifying statistic across 4 angles…");
                const base = context ? `${statistic} ${context}` : statistic;
                const searches = [
                    { angle: "direct", query: base },
                    { angle: "primary_source", query: `source study report "${statistic.slice(0, 60)}" original data` },
                    { angle: "fact_check", query: `${statistic.slice(0, 80)} true false actual number` },
                    { angle: "updated_data", query: `latest ${base} statistics data ${new Date().getFullYear()}` },
                ];
                const results = [];
                for (const [i, s] of searches.entries()) {
                    ctx.status(`Verifying angle ${i + 1}/4: ${s.angle}`);
                    const { hits, pages } = await sar(s.query, maxResults(), Math.min(maxPages(), 2), undefined, undefined, ctx.signal);
                    results.push({
                        angle: s.angle,
                        hits: hits.map((h) => ({
                            title: h.title, url: h.url, snippet: h.snippet,
                            credibility: assessDomainCredibility(h.url),
                        })),
                        pages: pages.map((p) => ({
                            url: p.url,
                            title: p.title,
                            credibility: assessDomainCredibility(p.url),
                            content: p.error ? null : p.text,
                            ...(p.error ? { error: p.error } : {}),
                        })),
                    });
                    await sleep(350);
                }
                return json({
                    statistic,
                    context: context || null,
                    search_results: results,
                    instruction: [
                        "Look for: (1) the actual number, (2) who published it, (3) the date, (4) the sample/scope.",
                        "Identify the most credible primary source (gov, academic, major research org preferred).",
                        "Note if the number you found differs from the stated statistic.",
                        "Flag if the stat appears to be outdated, misattributed, or out of context.",
                        "Never confirm a statistic without finding a credible source that explicitly states it.",
                    ].join(" "),
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "find_primary_source",
            description: (0, sdk_1.text) `
        Trace a claim back to its original source — the study, report, speech,
        or official document where it was first published. This matters because
        secondary and tertiary sources often distort the original finding.

        Use when: something is widely cited but the original source is unclear,
        or when you want the most authoritative version of a claim.
      `,
            parameters: {
                claim: zod_1.z.string().describe("The claim to trace back to its origin."),
                domain: zod_1.z.string().default("").describe("Domain hint — e.g. 'medical', 'economics', 'climate science'."),
            },
            implementation: safe_impl("find_primary_source", async ({ claim, domain }, ctx) => {
                ctx.status("Tracing claim to primary source…");
                const base = domain ? `${claim} ${domain}` : claim;
                const searches = [
                    { angle: "original_study", query: `original study research "${truncateAtWord(claim, 70)}"` },
                    { angle: "first_published", query: `first published source "${truncateAtWord(claim, 70)}" journal report` },
                    { angle: "official_source", query: `official government organization report ${base}` },
                    { angle: "citation_trace", query: `cite source reference ${base} who found` },
                ];
                const results = [];
                for (const [i, s] of searches.entries()) {
                    ctx.status(`Source angle ${i + 1}/4: ${s.angle}`);
                    const { hits, pages } = await sar(s.query, maxResults(), 1, undefined, undefined, ctx.signal);
                    results.push({
                        angle: s.angle,
                        hits: hits.map((h) => ({
                            title: h.title, url: h.url, snippet: h.snippet,
                            credibility: assessDomainCredibility(h.url),
                        })),
                        top_page: pages[0]
                            ? {
                                url: pages[0].url,
                                title: pages[0].title,
                                credibility: assessDomainCredibility(pages[0].url),
                                content: pages[0].error ? null : pages[0].text,
                            }
                            : null,
                    });
                    await sleep(350);
                }
                return json({
                    claim,
                    domain: domain || null,
                    search_results: results,
                    credibility_priority: ["government", "academic institution", "academic/research", "established news outlet"],
                    instruction: [
                        "Find the single most authoritative source that originally made this claim.",
                        "Prefer: peer-reviewed journals, government reports, official org publications.",
                        "Avoid: secondary citations (articles that cite the study, not the study itself).",
                        "State the publisher, year, and direct URL if found.",
                        "If no primary source exists, say so clearly — the claim may be fabricated.",
                    ].join(" "),
                });
            }),
        }),
        // =========================================================================
        // EXPLORATION
        // =========================================================================
        (0, sdk_1.tool)({
            name: "search_recent",
            description: (0, sdk_1.text) `
        Time-filtered search — only returns results from the specified window.
        Critical for fast-moving topics where older results can be actively misleading.

        Use when: asking about current events, recent developments, new research,
        product releases, policy changes, or anything where recency matters.
      `,
            parameters: {
                query: zod_1.z.string().describe("What to search for."),
                window: zod_1.z.enum(["day", "week", "month", "year"]).default("week")
                    .describe("Time window: 'day' (last 24h), 'week', 'month', 'year'."),
                read_pages: zod_1.z.coerce.number().int().min(1).max(4).default(2)
                    .describe("How many pages to fetch and read."),
            },
            implementation: safe_impl("search_recent", async ({ query, window, read_pages }, ctx) => {
                ctx.status(`Searching (last ${window}): ${query}`);
                const timeMap = { day: "d", week: "w", month: "m", year: "y" };
                const { hits, pages } = await sar(query, maxResults(), read_pages, timeMap[window], undefined, ctx.signal);
                const successUrls = pages.filter((p) => !p.error).map((p) => p.url);
                return json({
                    query,
                    window,
                    results_found: hits.length,
                    independent_publishers_read: new Set(successUrls.map(rootDomain)).size,
                    results: hits.map((h) => ({
                        title: h.title,
                        url: h.url,
                        snippet: h.snippet,
                        credibility: assessDomainCredibility(h.url),
                    })),
                    pages_read: pages.map((p) => ({
                        url: p.url,
                        title: p.title,
                        credibility: assessDomainCredibility(p.url),
                        content: p.error ? null : p.text,
                        ...(p.error ? { error: p.error } : {}),
                    })),
                    instruction: publisherDiversityInstruction(successUrls) + " Focus on what is NEW here. Note publication dates when visible in the content. Flag if results are actually older than the requested window.",
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "compare_sources",
            description: (0, sdk_1.text) `
        Fetch multiple sources on the same topic and surface where they agree,
        where they conflict, and what each source uniquely claims.

        This is the tool for detecting spin, bias, and framing differences.
        The same fact can be framed very differently by different publications.

        Use when: you have multiple URLs to compare, or want to compare coverage
        of an event/topic across different types of sources.
      `,
            parameters: {
                topic: zod_1.z.string().describe("The topic or event to compare sources on."),
                urls: zod_1.z.array(zod_1.z.string().url()).max(5).default([])
                    .describe("Specific URLs to compare. Leave empty to search and pick top sources automatically."),
                num_sources: zod_1.z.coerce.number().int().min(2).max(5).default(3)
                    .describe("If no URLs given, how many sources to find and compare."),
            },
            implementation: safe_impl("compare_sources", async ({ topic, urls, num_sources }, ctx) => {
                ctx.status(`Comparing sources on: ${topic}`);
                let targetUrls = urls;
                if (targetUrls.length === 0) {
                    const hits = await ddg(topic, num_sources * 2, undefined, ctx.signal);
                    // Pick sources with varied domains for diversity
                    const seen = new Set();
                    for (const h of hits) {
                        if (targetUrls.length >= num_sources)
                            break;
                        try {
                            const domain = new URL(h.url).hostname;
                            if (!seen.has(domain)) {
                                seen.add(domain);
                                targetUrls.push(h.url);
                            }
                        }
                        catch { /* skip */ }
                    }
                }
                const pages = [];
                for (const url of targetUrls) {
                    if (ctx.signal.aborted)
                        break;
                    ctx.status(`Reading: ${url}`);
                    const p = await fetchPage(url, timeoutMs(), 8000, ctx.signal);
                    pages.push({
                        url,
                        title: p.title,
                        credibility: assessDomainCredibility(url),
                        content: p.error ? null : p.text,
                        ...(p.error ? { error: p.error } : {}),
                    });
                    await sleep(300);
                }
                return json({
                    topic,
                    sources_compared: pages.length,
                    sources: pages,
                    instruction: [
                        "After reading all sources, identify:",
                        "1. AGREEMENTS — facts all sources agree on (high confidence).",
                        "2. CONFLICTS — where sources say different things (flag explicitly).",
                        "3. FRAMING DIFFERENCES — same facts, different emphasis or spin.",
                        "4. UNIQUE CLAIMS — things only one source reports (treat with lower confidence).",
                        "Note the credibility level of each source when weighing disagreements.",
                    ].join(" "),
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "find_expert_views",
            description: (0, sdk_1.text) `
        Find what domain experts, researchers, and authoritative institutions
        actually say about a topic — not what random websites claim they say.

        Targets: academic papers, official statements, expert interviews,
        research organization reports, professional body guidelines.

        Use when: you need the scientific/expert consensus, not just the popular view.
        Especially useful for health, science, policy, and technical topics.
      `,
            parameters: {
                topic: zod_1.z.string().describe("Topic to find expert views on."),
                field: zod_1.z.string().default("").describe("Relevant field (e.g. 'medicine', 'climate science', 'AI safety', 'economics')."),
            },
            implementation: safe_impl("find_expert_views", async ({ topic, field }, ctx) => {
                ctx.status(`Finding expert views on: ${topic}`);
                const base = field ? `${topic} ${field}` : topic;
                const searches = [
                    { angle: "consensus", query: `${base} expert consensus scientists agree research shows` },
                    { angle: "research", query: `${base} peer reviewed study findings evidence` },
                    { angle: "official", query: `${base} official position WHO CDC government report` },
                    { angle: "dissent", query: `${base} experts disagree controversy scientific debate` },
                ];
                const results = [];
                for (const [i, s] of searches.entries()) {
                    ctx.status(`Expert angle ${i + 1}/4: ${s.angle}`);
                    const { hits, pages } = await sar(s.query, maxResults(), Math.min(maxPages(), 2), undefined, undefined, ctx.signal);
                    results.push({
                        angle: s.angle,
                        hits: hits.map((h) => ({
                            title: h.title, url: h.url, snippet: h.snippet,
                            credibility: assessDomainCredibility(h.url),
                        })),
                        top_pages: pages.map((p) => ({
                            url: p.url, title: p.title,
                            credibility: assessDomainCredibility(p.url),
                            content: p.error ? null : p.text,
                            ...(p.error ? { error: p.error } : {}),
                        })),
                    });
                    await sleep(400);
                }
                return json({
                    topic,
                    field: field || null,
                    search_results: results,
                    instruction: [
                        "Prioritise HIGH-credibility sources (academic, gov, established science outlets).",
                        "Clearly separate: (a) established consensus, (b) areas of active debate, (c) minority/fringe views.",
                        "Quote or paraphrase specific expert statements with attribution.",
                        "If consensus and dissent both exist, explain why — methodological differences, new evidence, etc.",
                    ].join(" "),
                });
            }),
        }),
        // =========================================================================
        // RESEARCH
        // =========================================================================
        (0, sdk_1.tool)({
            name: "search_academic",
            description: (0, sdk_1.text) `
        Search specifically for academic papers, studies, and research publications.
        Targets: arXiv, Semantic Scholar, PubMed, and major research journals.

        Returns: paper titles, authors, abstracts, publication year, direct links.

        Use when: the question requires scientific evidence, medical guidance,
        technical research, or any topic where peer review matters.
      `,
            parameters: {
                topic: zod_1.z.string().describe("Research topic to search for."),
                source: zod_1.z.enum(["arxiv", "pubmed", "semantic_scholar", "all"]).default("all")
                    .describe("Which academic database to search. 'all' searches across multiple."),
                year_from: zod_1.z.coerce.number().int().min(1900).max(2030).optional()
                    .describe("Only return papers published from this year onwards."),
            },
            implementation: safe_impl("search_academic", async ({ topic, source, year_from }, ctx) => {
                ctx.status(`Searching academic sources for: ${topic}`);
                // DuckDuckGo does not support Google's `after:` operator — append year as a term instead
                const yearStr = year_from ? ` ${year_from}` : "";
                const sourceMap = {
                    arxiv: [`site:arxiv.org ${topic}${yearStr}`],
                    pubmed: [`site:pubmed.ncbi.nlm.nih.gov ${topic}${yearStr}`],
                    semantic_scholar: [`site:semanticscholar.org ${topic}${yearStr}`],
                    all: [
                        `site:arxiv.org ${topic}${yearStr}`,
                        `site:pubmed.ncbi.nlm.nih.gov ${topic}${yearStr}`,
                        `site:semanticscholar.org ${topic}${yearStr}`,
                    ],
                };
                const queries = sourceMap[source] ?? sourceMap.all;
                const allHits = [];
                for (const q of queries) {
                    const hits = await ddg(q, maxResults(), undefined, ctx.signal);
                    allHits.push(...hits);
                    await sleep(400);
                }
                // Deduplicate by URL
                const seen = new Set();
                const dedupedHits = allHits.filter((h) => {
                    if (seen.has(h.url))
                        return false;
                    seen.add(h.url);
                    return true;
                });
                // Fetch top papers to get abstracts
                const paperPages = [];
                for (const h of dedupedHits.slice(0, Math.min(maxPages(), 3))) {
                    const p = await fetchPage(h.url, timeoutMs(), 4000, ctx.signal);
                    paperPages.push(p);
                    await sleep(300);
                }
                return json({
                    topic,
                    source,
                    year_from: year_from ?? null,
                    papers_found: dedupedHits.length,
                    results: dedupedHits.map((h) => ({
                        title: h.title,
                        url: h.url,
                        snippet: h.snippet,
                    })),
                    paper_content: paperPages.map((p) => ({
                        url: p.url,
                        title: p.title,
                        content: p.error ? null : p.text,
                        ...(p.error ? { error: p.error } : {}),
                    })),
                    instruction: [
                        "Extract: paper title, authors (if visible), publication year, key findings, methodology.",
                        "Distinguish: (a) preprints (not peer reviewed), (b) peer-reviewed journal papers, (c) review papers.",
                        "Note sample sizes, confidence intervals, and limitations where visible.",
                        "Do not overstate findings — say 'the study found X in Y context' not 'it is proven that X'.",
                    ].join(" "),
                });
            }),
        }),
        // -------------------------------------------------------------------------
        (0, sdk_1.tool)({
            name: "research_topic",
            description: (0, sdk_1.text) `
        Full multi-step research. Runs multiple searches from different angles,
        reads key pages, and assembles everything into a structured research brief.

        Returns a comprehensive evidence base: key facts, source diversity,
        open questions, and confidence map.

        Depth levels:
          overview      — 3 search angles, 1–2 pages each (faster)
          detailed      — 5 angles, 2–3 pages each
          comprehensive — 7 angles, 3 pages each (thorough, takes longer)

        Use when: someone asks a complex question that needs a full picture,
        not a quick answer — and you want to do it properly in one call.
      `,
            parameters: {
                topic: zod_1.z.string().describe("The topic to research thoroughly."),
                depth: zod_1.z.enum(["overview", "detailed", "comprehensive"]).default("detailed")
                    .describe("How deep to go. 'comprehensive' fetches many more pages."),
                focus: zod_1.z.string().default("").describe("Optional focus area within the topic (e.g. 'health implications', 'economic impact')."),
            },
            implementation: safe_impl("research_topic", async ({ topic, depth, focus }, ctx) => {
                const focusStr = focus ? ` (focus: ${focus})` : "";
                const base = focus ? `${topic} ${focus}` : topic;
                const angleTemplates = {
                    overview: [
                        `${base} what is overview`,
                        `${base} key facts evidence`,
                        `${base} expert opinion research`,
                    ],
                    detailed: [
                        `${base} definition background history`,
                        `${base} evidence research studies findings`,
                        `${base} criticism limitations problems`,
                        `${base} expert consensus latest developments`,
                        `${base} practical implications examples`,
                    ],
                    comprehensive: [
                        `${base} overview definition`,
                        `${base} historical background`,
                        `${base} recent research ${new Date().getFullYear()} studies`,
                        `${base} evidence data statistics`,
                        `${base} criticism counterargument debate`,
                        `${base} expert consensus official position`,
                        `${base} practical applications examples case studies`,
                    ],
                };
                const pagesPerAngle = { overview: 2, detailed: 2, comprehensive: 3 };
                const angles = angleTemplates[depth];
                const ppa = pagesPerAngle[depth];
                const sections = [];
                ctx.status(`Researching "${topic}" (${depth}, ${angles.length} angles)…`);
                // Dedup: never fetch the same URL twice across angles
                const fetchedUrls = new Set();
                for (const [i, angle] of angles.entries()) {
                    ctx.status(`Research angle ${i + 1}/${angles.length}: ${angle.slice(0, 60)}`);
                    const { hits, pages } = await sar(angle, maxResults(), ppa, undefined, fetchedUrls, ctx.signal);
                    sections.push({
                        angle,
                        pages: pages.map((p) => ({
                            url: p.url,
                            title: p.title,
                            credibility: assessDomainCredibility(p.url),
                            content: p.error ? null : p.text,
                            ...(p.error ? { error: p.error } : {}),
                        })),
                        additional_hits: hits.slice(ppa).map((h) => ({
                            title: h.title, url: h.url, snippet: h.snippet,
                        })),
                    });
                    await sleep(400);
                }
                return json({
                    topic,
                    focus: focus || null,
                    depth,
                    angles_covered: angles.length,
                    research_sections: sections,
                    instruction: [
                        `Produce a structured research brief on: "${topic}${focusStr}".`,
                        "Structure your answer:",
                        "1. OVERVIEW — what is this, why it matters (2–3 sentences).",
                        "2. KEY ESTABLISHED FACTS — what the evidence clearly shows (cite sources).",
                        "3. CONTESTED AREAS — where sources disagree or evidence is mixed.",
                        "4. EXPERT CONSENSUS — what the mainstream expert view is.",
                        "5. OPEN QUESTIONS — what remains unknown or actively debated.",
                        "6. KEY SOURCES — the 3–5 most credible sources found.",
                        "7. CONFIDENCE ASSESSMENT — overall confidence in the picture (high/medium/low) and why.",
                        "Be direct. Cite sources. Never pad with filler.",
                    ].join(" "),
                });
            }),
        }),
        // =========================================================================
        // NEWS
        // =========================================================================
        (0, sdk_1.tool)({
            name: "search_news",
            description: (0, sdk_1.text) `
        News-specific search. Targets established journalism and press sources,
        not SEO content farms. Returns recent news coverage with publication signals.

        Unlike search_recent (which filters by date), this filters by SOURCE TYPE —
        it actively prefers news outlets over blogs, product pages, and opinion sites.

        Use when: the question is about a current event, breaking news, policy change,
        corporate announcement, or anything where journalistic sourcing matters.
        Pair with search_recent for time-filtered news coverage.
      `,
            parameters: {
                query: zod_1.z.string().describe("News topic or event to search for."),
                window: zod_1.z.enum(["day", "week", "month", "any"]).default("week")
                    .describe("Time window for news: 'day', 'week', 'month', or 'any' for no time filter."),
                read_pages: zod_1.z.coerce.number().int().min(1).max(4).default(2)
                    .describe("How many articles to actually fetch and read."),
            },
            implementation: safe_impl("search_news", async ({ query, window, read_pages }, ctx) => {
                ctx.status(`Searching news (last ${window}): ${query}`);
                const timeMap = { day: "d", week: "w", month: "m", any: undefined };
                const time = timeMap[window];
                // Run two queries: one general news query, one targeting known news sites
                const queries = [
                    query,
                    `${query} site:reuters.com OR site:apnews.com OR site:bbc.com OR site:theguardian.com OR site:npr.org`,
                ];
                const allHits = [];
                const seenUrls = new Set();
                for (const q of queries) {
                    const hits = await ddg(q, maxResults(), time, ctx.signal);
                    for (const h of hits) {
                        if (!seenUrls.has(h.url)) {
                            seenUrls.add(h.url);
                            allHits.push(h);
                        }
                    }
                    await sleep(350);
                }
                // Precompute credibility once per hit — used for ranking, output, and count
                const hitsWithCred = allHits.map((h) => ({ ...h, cred: assessDomainCredibility(h.url) }));
                // Rank: high-credibility news sources first
                const ranked = [
                    ...hitsWithCred.filter((h) => h.cred.type === "established news outlet"),
                    ...hitsWithCred.filter((h) => h.cred.type !== "established news outlet"),
                ];
                // allHits is already deduped by seenUrls — no fetchedUrls Set needed here
                const pages = [];
                for (const h of ranked) {
                    if (pages.length >= read_pages)
                        break;
                    if (ctx.signal.aborted)
                        break;
                    ctx.status(`Reading article: ${h.title.slice(0, 60)}`);
                    const p = await fetchPage(h.url, timeoutMs(), 8000, ctx.signal);
                    pages.push({
                        url: h.url,
                        title: p.title || h.title,
                        credibility: h.cred,
                        content: p.error ? null : p.text,
                        ...(p.error ? { error: p.error } : {}),
                    });
                    await sleep(300);
                }
                const successUrls = pages.filter((p) => !p.error).map((p) => p.url);
                return json({
                    query,
                    window,
                    total_results: ranked.length,
                    high_credibility_count: ranked.filter((h) => h.cred.credibility === "high").length,
                    independent_publishers_read: new Set(successUrls.map(rootDomain)).size,
                    results: ranked.map((h) => ({
                        title: h.title,
                        url: h.url,
                        snippet: h.snippet,
                        credibility: h.cred,
                    })),
                    articles_read: pages,
                    instruction: publisherDiversityInstruction(successUrls) + " Focus on what the HIGH-credibility news sources report. Note: (1) who is reporting it, (2) what primary sources they cite, (3) what is confirmed vs alleged. Distinguish official statements, named sources, and anonymous sources.",
                });
            }),
        }),
        // =========================================================================
        // ASSESS
        // =========================================================================
        (0, sdk_1.tool)({
            name: "check_source",
            description: (0, sdk_1.text) `
        Assess the credibility and reliability of a URL or domain. Returns:
        • Domain type (government, academic, news, blog, etc.)
        • Known credibility signals from the URL
        • Search results about the publication's reputation
        • Red flags to watch for

        Use when: a source looks unfamiliar, suspicious, or you want to know
        how much weight to give it before citing it.
      `,
            parameters: {
                url: zod_1.z.string().describe("The URL or domain to assess."),
            },
            implementation: safe_impl("check_source", async ({ url }, ctx) => {
                ctx.status(`Assessing source: ${url}`);
                // Normalize to domain
                let domain = url;
                try {
                    domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
                }
                catch { /* use as-is */ }
                const credibility = assessDomainCredibility(url.startsWith("http") ? url : `https://${url}`);
                // Search for reputation info about this source
                const reputationSearches = [
                    `"${domain}" media bias reliability credibility`,
                    `"${domain}" about publication editorial standards`,
                ];
                const repResults = [];
                for (const q of reputationSearches) {
                    const hits = await ddg(q, 5, undefined, ctx.signal);
                    repResults.push({
                        query: q,
                        hits: hits.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })),
                    });
                    await sleep(300);
                }
                // Also fetch the source's About page if we have a full URL
                let aboutPage = { content: null };
                const aboutUrl = url.startsWith("http")
                    ? new URL(url).origin + "/about"
                    : `https://${domain}/about`;
                const fetched = await fetchPage(aboutUrl, Math.min(timeoutMs(), 5000), 3000, ctx.signal);
                aboutPage = { content: fetched.error ? null : fetched.text };
                return json({
                    url,
                    domain,
                    credibility_assessment: credibility,
                    about_page: {
                        url: aboutUrl,
                        content: aboutPage.content,
                    },
                    reputation_search: repResults,
                    red_flags_to_check: [
                        "No named authors or editorial team",
                        "No 'About' page or contact information",
                        "Domain registered recently with no track record",
                        "Known for publishing misleading or sensationalist content",
                        "Listed on media bias databases as unreliable",
                        "Primary revenue from clickbait advertising",
                        "No corrections policy",
                    ],
                    instruction: [
                        "Give a credibility verdict: HIGH / MEDIUM / LOW / UNKNOWN.",
                        "Explain what you found about this source.",
                        "Note any red flags.",
                        "Say whether it is safe to cite this source for factual claims.",
                    ].join(" "),
                });
            }),
        }),
    ];
    return tools;
};
exports.toolsProvider = toolsProvider;
