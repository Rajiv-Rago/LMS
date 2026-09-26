import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface WebSource {
  url: string;
  title: string;
  description: string;
  sourceVerified: false;
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
}

const timeout = (ms: number) => AbortSignal.timeout(ms);

/** Prefer an indexed search API. The HTML fallback is best effort and may be blocked. */
export async function searchWeb(query: string, count = 5): Promise<SearchResult[]> {
  if (!query.trim() || query.length > 300) throw new Error("Invalid search query");
  const limit = Math.min(Math.max(count, 1), 10);
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (key) {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(limit));
    const response = await fetch(url, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
      signal: timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Web search unavailable (${response.status})`);
    const data = await response.json() as {
      web?: { results?: Array<{ url: string; title: string; description?: string }> };
    };
    return (data.web?.results ?? []).filter((r) => /^https?:\/\//.test(r.url))
      .slice(0, limit).map((r) => ({ url: r.url, title: r.title, description: stripHtml(r.description ?? "").slice(0, 500) }));
  }

  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    signal: timeout(10_000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Web search unavailable (${response.status})`);
  const html = await response.text();
  const hits: SearchResult[] = [];
  const links = /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b)[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(links)) {
    try {
      const wrapped = new URL(decodeEntities(match[1]), url);
      const target = wrapped.searchParams.get("uddg") ?? wrapped.href;
      if (!/^https?:\/\//.test(target)) continue;
      hits.push({ url: target, title: stripHtml(match[2]), description: "" });
    } catch { continue; }
    if (hits.length >= limit) break;
  }
  if (!hits.length) throw new Error("Search returned no usable results; configure BRAVE_SEARCH_API_KEY for reliable results");
  return hits;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(?:39|x27);/gi, "'");
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 ||
      a === 192 && b === 0 || a === 198 && (b === 18 || b === 19));
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return publicAddress(normalized.slice(7));
  return !(/^(::|::1$|fe[89ab]|fc|fd|ff|2001:db8)/i.test(normalized));
}

/** Read a public HTML page only. Do not expose this as an unauthenticated URL fetch endpoint. */
export async function readWebPage(input: string): Promise<{ url: string; title: string; text: string }> {
  let url = new URL(input);
  for (let redirect = 0; redirect < 3; redirect++) {
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        (url.port && !["80", "443"].includes(url.port))) throw new Error("Unsafe page URL");
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((entry) => !publicAddress(entry.address))) throw new Error("Unsafe page host");
    const response = await fetch(url, {
      redirect: "manual", signal: timeout(8000), cache: "no-store",
      headers: { "User-Agent": "KantigoResearchBot/1.0", Accept: "text/html" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      throw new Error("Page is unavailable or is not HTML");
    }
    if (Number(response.headers.get("content-length")) > 1_000_000) throw new Error("Page too large");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Page has no body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_000_000) { await reader.cancel(); throw new Error("Page too large"); }
      chunks.push(value);
    }
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    const title = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname);
    const main = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] ?? html;
    const text = stripHtml(main.replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")).slice(0, 8_000);
    return { url: url.href, title, text };
  }
  throw new Error("Too many page redirects");
}

export async function researchTopic(topic: string): Promise<WebSource[]> {
  const hits = await searchWeb(topic, 5);
  const pages = await Promise.all(hits.slice(0, 3).map(async (hit) => {
    try {
      const page = await readWebPage(hit.url);
      return { url: page.url, title: page.title || hit.title,
        description: page.text.slice(0, 500) || hit.description, sourceVerified: false as const };
    } catch {
      return { ...hit, sourceVerified: false as const };
    }
  }));
  return [...pages, ...hits.slice(3).map((hit) => ({ ...hit, sourceVerified: false as const }))];
}
