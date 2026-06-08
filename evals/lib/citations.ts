import { judgeJson } from "./judge";
import type {
  AnySource,
  CitationCheck,
  CitationEvalResult,
  GeneratorSpec,
  JudgeCall,
} from "./types";

const FETCH_TIMEOUT_MS = 5000;
const MAX_PAGE_CHARS = 500;

const OFFICIAL_DOMAINS: string[] = [
  "docs.python.org",
  "developer.mozilla.org",
  "mdn.io",
  "kernel.org",
  "ietf.org",
  "w3.org",
  "rust-lang.org",
  "doc.rust-lang.org",
  "go.dev",
  "golang.org",
  "nodejs.org",
  "react.dev",
  "reactjs.org",
  "vuejs.org",
  "angular.io",
  "kubernetes.io",
  "docker.com",
  "postgresql.org",
  "mysql.com",
  "mongodb.com",
  "redis.io",
  "tensorflow.org",
  "pytorch.org",
  "scikit-learn.org",
  "numpy.org",
  "pandas.pydata.org",
  "wikipedia.org",
  "arxiv.org",
  "oreilly.com",
  "acm.org",
  "ieee.org",
  "nist.gov",
  "nature.com",
  "sciencedirect.com",
  "khanacademy.org",
  "ocw.mit.edu",
];

const ESTABLISHED_DOMAINS: string[] = [
  "css-tricks.com",
  "smashingmagazine.com",
  "infoq.com",
  "stackoverflow.com",
  "stackexchange.com",
  "martinfowler.com",
  "joelonsoftware.com",
  "thoughtworks.com",
  "digitalocean.com",
  "linode.com",
  "cloudflare.com",
  "github.blog",
  "gitlab.com",
  "atlassian.com",
  "freecodecamp.org",
  "realpython.com",
  "fullstackpython.com",
  "javascript.info",
  "baeldung.com",
  "thenewstack.io",
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

export function scoreDomain(url: string): {
  score: 0 | 1 | 2;
  category: CitationCheck["domainCategory"];
} {
  let host: string;
  try {
    host = normalizeHost(new URL(url).hostname);
  } catch {
    return { score: 0, category: "other" };
  }

  if (host.endsWith(".edu") || host.endsWith(".gov")) {
    return { score: 2, category: "official" };
  }

  for (const dom of OFFICIAL_DOMAINS) {
    if (host === dom || host.endsWith(`.${dom}`)) {
      return { score: 2, category: "official" };
    }
  }
  for (const dom of ESTABLISHED_DOMAINS) {
    if (host === dom || host.endsWith(`.${dom}`)) {
      return { score: 1, category: "established" };
    }
  }
  return { score: 0, category: "other" };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface UrlProbe {
  live: boolean | "unknown";
  status?: number | string;
  pageSnippet?: string;
  fetchError?: string;
}

async function probeUrl(url: string): Promise<UrlProbe> {
  try {
    const headRes = await fetchWithTimeout(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "KantigoEvals/1.0" },
    });
    if (headRes.ok || (headRes.status >= 300 && headRes.status < 400)) {
      const snippet = await tryFetchSnippet(url);
      return { live: true, status: headRes.status, pageSnippet: snippet };
    }
    if (headRes.status === 405 || headRes.status === 403) {
      const getRes = await fetchWithTimeout(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": "KantigoEvals/1.0" },
      });
      if (getRes.ok) {
        const snippet = await readSnippet(getRes);
        return { live: true, status: getRes.status, pageSnippet: snippet };
      }
      return { live: false, status: getRes.status };
    }
    return { live: false, status: headRes.status };
  } catch (err) {
    return { live: "unknown", fetchError: (err as Error).message };
  }
}

async function tryFetchSnippet(url: string): Promise<string | undefined> {
  try {
    const res = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "KantigoEvals/1.0" },
    });
    if (!res.ok) return undefined;
    return readSnippet(res);
  } catch {
    return undefined;
  }
}

async function readSnippet(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let acc = "";
  while (acc.length < MAX_PAGE_CHARS * 4) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
  }
  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  const titleMatch = acc.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const stripped = acc
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
  return [title, stripped].filter(Boolean).join(" — ");
}

interface RelevanceVerdict {
  relevant: boolean;
  reason: string;
}

async function judgeRelevance(
  lessonTitle: string,
  source: AnySource,
  snippet: string
): Promise<{ result: RelevanceVerdict; call: JudgeCall }> {
  const prompt = `You are evaluating whether a web page is topically relevant to a specific lesson.

Lesson title: "${lessonTitle}"

Source title: "${source.title}"
Source URL: ${source.url}
Page excerpt (truncated):
"""
${snippet || "(no page content available)"}
"""

Question: Does this page cover material relevant to the lesson?

Reply with strict JSON only:
{ "relevant": true|false, "reason": "<one short sentence>" }`;

  const { parsed, call } = await judgeJson<RelevanceVerdict>("bounded", prompt, {
    maxTokens: 200,
  });
  return {
    result: {
      relevant: Boolean(parsed.relevant),
      reason: String(parsed.reason ?? ""),
    },
    call,
  };
}

export interface EvalCitationsOptions {
  topicId: string;
  lessonTitle: string;
  sources: AnySource[];
  generator: GeneratorSpec;
  rubricVersion: string;
  skipJudge?: boolean;
}

export async function evalCitations(opts: EvalCitationsOptions): Promise<CitationEvalResult> {
  const checks: CitationCheck[] = [];
  const judgeCalls: JudgeCall[] = [];

  for (const source of opts.sources) {
    if (!source.url || !source.url.startsWith("http")) {
      checks.push({
        url: source.url || "",
        title: source.title || "",
        live: false,
        status: "invalid-url",
        domainScore: 0,
        domainCategory: "other",
        relevant: "unknown",
      });
      continue;
    }

    const probe = await probeUrl(source.url);
    const domain = scoreDomain(source.url);

    let relevant: boolean | "unknown" = "unknown";
    let relevanceReason: string | undefined;

    if (!opts.skipJudge && probe.live === true) {
      try {
        const { result, call } = await judgeRelevance(opts.lessonTitle, source, probe.pageSnippet ?? "");
        relevant = result.relevant;
        relevanceReason = result.reason;
        judgeCalls.push(call);
      } catch (err) {
        relevanceReason = `judge-error: ${(err as Error).message}`;
      }
    }

    checks.push({
      url: source.url,
      title: source.title || "",
      live: probe.live,
      status: probe.status,
      domainScore: domain.score,
      domainCategory: domain.category,
      relevant,
      relevanceReason,
      fetchError: probe.fetchError,
    });
  }

  const total = checks.length;
  const liveCount = checks.filter((c) => c.live === true).length;
  const relevantDenominator = checks.filter((c) => c.relevant !== "unknown").length;
  const relevantCount = checks.filter((c) => c.relevant === true).length;
  const meanDomainScore =
    total > 0 ? checks.reduce((sum, c) => sum + c.domainScore, 0) / total : 0;

  return {
    topicId: opts.topicId,
    lessonTitle: opts.lessonTitle,
    rubricVersion: opts.rubricVersion,
    generator: opts.generator,
    sources: checks,
    aggregates: {
      total,
      pctLive: total > 0 ? liveCount / total : 0,
      meanDomainScore,
      pctRelevant: relevantDenominator > 0 ? relevantCount / relevantDenominator : 0,
    },
    judgeCalls,
  };
}
