# Web Search Plugin for LM Studio — Research-Grade Local Web Search

> **Keywords:** lm studio plugin, web search ai, local web research, fact checking ai, source verification, no api key, offline capable, private browsing ai

A research-grade web search plugin that goes beyond snippets — it reads pages, verifies claims, detects contradictions, finds primary sources, and enforces cross-source fact verification before asserting anything as true.

---

## What's Wrong With Regular Search

Standard search gives you ten links and short snippets. You get:
- Snippets, not actual page content
- One perspective, not multiple angles
- Links, not answers
- No way to verify if a claim is true
- No source quality signals
- No detection of conflicts between sources
- No tracing claims back to primary sources
- Stale and fresh results mixed together with no distinction
- No check on whether a claim comes from one publisher or many independent ones

This plugin fixes all of that.

---

## Who This Is For

- Researchers and students who need verified, multi-source answers — not just the first result that sounds right
- Journalists, analysts, and fact-checkers who need to trace claims to primary sources and surface contradictions
- Anyone who wants local, private web research with no API key, no cloud account, and no per-query costs
- LM Studio users who want research-grade source verification built directly into their local AI workflow

---

## Installation

```bash
cd web-search-plugin
npm install
npx tsc
```

Load the built plugin in LM Studio.

---

## Configuration

| Field | Default | Description |
|---|---|---|
| Max Search Results | `8` | Results retrieved per query |
| Max Pages to Read | `3` | Pages actually fetched and read per search |
| Page Fetch Timeout | `8000ms` | Per-page timeout before giving up |
| Search Language | `en-us` | Language/region for results |
| SearXNG URL | _(blank)_ | **Recommended.** Self-hosted SearXNG instance. Falls back to DDG → Bing if blank. DDG and Bing may block headless requests — SearXNG is the reliable path. |
| Search Recency Window | `year` | Limit results to: `day`, `week`, `month`, `year`, or `any` |
| LM Studio URL | `http://localhost:1234` | Used for embedding-based result reranking via nomic-embed-text |

---

## How It Works

### Clarify Before Searching

Before running any search, the plugin calls a `clarify` step. It detects ambiguity signals in the user's question:

- **Short/vague queries** — fewer than 4 words with no clear intent
- **Ambiguous terms** — e.g. "python" (language vs. snake), "java" (language vs. island vs. coffee), "bank", "swift", "mercury", "rust", "go"
- **Time-sensitive terms without a time context** — e.g. "best", "latest", "current" with no year or window specified
- **Location-dependent queries** — e.g. "near me", "local", "nearby"

If ambiguity is detected, the LLM asks the user focused questions before searching. This avoids wasted searches and produces a much more targeted answer.

### Semantic Reranking

After retrieving search results, the plugin reranks them using embeddings before fetching any pages. This means the pages that actually get read are the most semantically relevant to the query — not just the top SEO results.

How it works:
1. Query + all result snippets are embedded via `nomic-embed-text` (requires the model loaded in LM Studio)
2. Cosine similarity scores each result against the query
3. Results are reordered by score before pages are fetched

If the embedding call fails (model not loaded, wrong URL), it falls back silently to the original search engine ranking.

### Publisher Diversity Signal

`search`, `search_recent`, and `search_news` each report `independent_publishers_read` — the number of distinct root domains among the pages successfully fetched. This feeds a dynamic instruction injected into every result:

| Publishers read | Instruction to the LLM |
|---|---|
| 0 | Do not assert any facts — re-search or inform the user |
| 1 | Hard UNVERIFIED warning — call `fact_check` or label every claim as unverified before presenting |
| 2+ | Report publisher count — flag any claim supported by only one of them as UNVERIFIED |

This prevents the LLM from repeating a claim as fact just because one website said it.

### Hard Verification Rules

The system prompt enforces five non-negotiable rules on top of the publisher diversity signal:

- **SINGLE-SOURCE RULE** — a claim appearing in only one source must be labeled "unverified — found in one source only," regardless of how credible that source is.
- **CONFLICT RULE** — if sources disagree, the LLM must not pick a side. It states the conflict and calls `fact_check` or `compare_sources`.
- **STATISTICS RULE** — for any number or percentage, the LLM must state who published it, when, and what the sample was. If any of those three are missing, it calls `verify_statistic` before asserting the number.
- **AI/ML/TECH RULE** — vendor blogs, SaaS marketing pages, press releases, and LinkedIn posts are not evidence of capability claims. Academic papers or independent journalism are required.
- **WIRE SERVICE RULE** — multiple outlets reporting the same story from the same wire (AP, Reuters) or the same press release does not count as independent verification.

### Search Backend

Results come from SearXNG (if configured) → DuckDuckGo HTML scraper → Bing HTML scraper. No API keys required.

---

## Tools

### `clarify` — Ambiguity check (called automatically first)

Always called before any search. Returns either:
- `STATUS: READY` — question is specific enough, search proceeds
- `STATUS: CLARIFY` — question is ambiguous, LLM asks user before searching

You do not need to call this manually. The system prompt enforces it as a mandatory first step.

---

### `search` — Core search with page reading

The main tool. Unlike basic search, it fetches and reads the actual page content — not just snippets.

```
search(query, max_pages_to_read?)
```

Returns:
- Full text of each page read (reranked by semantic similarity)
- Source credibility assessment for each URL
- `independent_publishers_read` — count of distinct root domains among successful page reads
- Additional snippet-only results beyond the read pages
- Dynamic instruction based on publisher count (single-source warning or N-publisher count)

---

### `fetch_and_read` — Read a specific URL

Fetch any URL and return the full readable text content.

```
fetch_and_read(url, max_chars?)
```

Use when:
- Someone shares a link and wants you to read it
- A search result looks relevant but you need the full article
- You want to verify what a source *actually* says vs what others claim it says
- You need exact wording from a policy, study, or report

---

### `deep_search` — Multi-angle research

Runs 3–5 separate searches from different perspectives on the same topic, reads pages for each, and returns everything together. Defeats single-search bias.

```
deep_search(topic, angles?, pages_per_angle?)
```

Default angles: overview facts, latest research, criticism/limitations, expert consensus.

You can specify your own angles, e.g.:
```
angles: ["economic impact", "environmental cost", "industry response", "regulatory landscape"]
```

---

### `fact_check` — Verify a specific claim

Cross-checks a claim across four search angles: direct confirmation, debunking searches, evidence searches, and expert opinion. Returns raw evidence from all angles for the LLM to assess.

```
fact_check(claim)
```

Verdict categories: `supported`, `disputed`, `unsupported`, `nuanced`, `uncertain`.

---

### `verify_statistic` — Verify a number or percentage

Statistics are frequently outdated, misquoted, out of context, or fabricated. This tool searches for the stat, its primary source, fact-check results, and updated data.

```
verify_statistic(statistic, context?)
```

Example: `verify_statistic("90% of startups fail in year one", "venture-backed US tech startups")`

---

### `find_primary_source` — Trace a claim to its origin

Secondary sources often distort original findings. This tool searches for the original study, report, official document, or statement where a claim first appeared.

```
find_primary_source(claim, domain?)
```

Prioritises: peer-reviewed journals, government reports, official organisation publications over secondary citations.

---

### `search_recent` — Time-filtered search

Only returns results from the specified time window. Prevents stale results from dominating on fast-moving topics.

```
search_recent(query, window?, read_pages?)
```

Windows: `day` (last 24h), `week`, `month`, `year`.

Returns `independent_publishers_read` and a dynamic publisher diversity instruction alongside the results.

---

### `compare_sources` — Surface agreements and conflicts

Fetches multiple sources on the same topic and returns them side by side for the LLM to compare framing, spot conflicts, and identify unique claims.

```
compare_sources(topic, urls?, num_sources?)
```

Provide specific URLs to compare, or let it search and pick sources with varied domains automatically.

Returns structured analysis of:
1. **Agreements** — facts all sources confirm
2. **Conflicts** — where sources say different things
3. **Framing differences** — same facts, different emphasis
4. **Unique claims** — things only one source reports

---

### `find_expert_views` — Expert consensus and dissent

Searches specifically for academic research, official positions, expert interviews, and scientific consensus — not what random blogs claim experts say.

```
find_expert_views(topic, field?)
```

Covers four angles: expert consensus, peer-reviewed research, official institutional positions, and active scientific debate.

---

### `search_academic` — Academic papers only

Searches arXiv, PubMed, and Semantic Scholar for peer-reviewed papers and research publications.

```
search_academic(topic, source?, year_from?)
```

Sources: `arxiv`, `pubmed`, `semantic_scholar`, `all`.

Fetches paper pages to extract abstracts, methodology, and findings. The LLM is instructed to distinguish preprints from peer-reviewed work, note sample sizes, and not overstate findings.

---

### `search_news` — News-specific search

News-filtered search that actively ranks established journalism above blogs, product pages, and content farms. Runs two queries — one general, one targeting major news outlets — then ranks high-credibility results first.

```
search_news(query, window?, read_pages?)
```

Windows: `day`, `week`, `month`, `any`.

Unlike `search_recent` (which filters by date), this filters by **source type** — it's about journalistic sourcing, not just recency. Best for: breaking news, corporate announcements, policy changes, anything where "who is reporting it" matters.

Returns `independent_publishers_read` and a dynamic publisher diversity instruction alongside the results.

---

### `research_topic` — Full multi-step research brief

Runs multiple searches from different angles, reads key pages, and instructs the LLM to produce a structured research brief: overview, established facts, contested areas, expert consensus, open questions, key sources, and confidence assessment.

```
research_topic(topic, depth?, focus?)
```

Depths:
- `overview` — 3 angles, 2 pages each
- `detailed` — 5 angles, 2 pages each (default)
- `comprehensive` — 7 angles, 3 pages each

---

### `check_source` — Source credibility assessment

Assesses a URL or domain and returns its credibility type, known signals, reputation search results, and red flags to watch for.

```
check_source(url)
```

Domain types: government, academic institution, academic/research platform, established news outlet, encyclopedia, user-generated content, unknown.

Credibility levels: `high`, `medium`, `low`, `unknown`.

Red flags checked:
- No named authors or editorial team
- No About page or contact information
- Recently registered domain with no track record
- Known for misleading content
- Listed on media bias databases as unreliable
- No corrections policy

---

## Source Credibility System

Every search result and fetched page gets a credibility assessment based on domain signals:

| Domain Type | Credibility | Examples |
|---|---|---|
| Government | HIGH | `.gov`, `.mil`, WHO, CDC |
| Academic institution | HIGH | `.edu`, `.ac.uk`, universities |
| Academic platforms | HIGH | arXiv, PubMed, Semantic Scholar |
| Established news | HIGH | Reuters, AP, BBC, Nature, NYT |
| Wikipedia | MEDIUM | Good overview, verify citations |
| User-generated / blogs | LOW | Blogspot, WordPress, Reddit, Quora |
| Unknown | UNKNOWN | Check About page and author credentials |

---

## How Reasoning Works

The plugin's system prompt instructs the LLM to:

1. **Always call `clarify` first** — ask focused questions before searching if the query is ambiguous
2. **Always cite sources** — format: "According to [title] ([url])..."
3. **Distinguish facts from inferences** — facts are directly stated; inferences are concluded
4. **Show reasoning** — explain *why*, not just *what*
5. **Never fabricate** — if evidence isn't found, say so
6. **Surface contradictions** — "Source A says X, but Source B says Y — here's why..."
7. **Signal confidence** using exactly five labels:
   - **HIGH** — 2+ independent publishers agree AND at least one is a primary source (.gov, .edu, peer-reviewed journal)
   - **MEDIUM** — 2+ sources agree but no primary source, OR 1 high-credibility primary source alone
   - **LOW** — only 1 source found, OR all sources are from the same publisher or wire service
   - **UNVERIFIED** — claim was found but no corroboration exists (must use this label, not LOW)
   - **UNCERTAIN** — sources conflict, coverage is thin, or claim is under 2 weeks old

---

## Example Queries

**Simple fact:**
> "What is the Dunning-Kruger effect?"
→ `clarify` (READY) → `search`

**Ambiguous query:**
> "Tell me about python"
→ `clarify` (CLARIFY) → asks: "Do you mean the programming language or the snake?" → `search`

**Verify a claim:**
> "Is it true that we only use 10% of our brains?"
→ `clarify` (READY) → `fact_check`

**Verify a statistic:**
> "Someone told me 50,000 species go extinct every year. Is that right?"
→ `clarify` (READY) → `verify_statistic`

**Recent developments:**
> "What's happened with GPT-5 in the last week?"
→ `clarify` (READY) → `search_recent(window: "week")`

**Compare perspectives:**
> "What do different sources say about seed oils and health?"
→ `clarify` (READY) → `compare_sources` or `deep_search`

**Scientific consensus:**
> "What does the research actually say about intermittent fasting?"
→ `clarify` (READY) → `find_expert_views` + `search_academic`

**Deep research:**
> "Give me a thorough research brief on quantum error correction"
→ `clarify` (READY) → `research_topic(depth: "comprehensive")`

**Read a specific article:**
> "Can you read this paper and summarise the key findings? [url]"
→ `clarify` (READY) → `fetch_and_read`

**Check if a source is reliable:**
> "Is naturalhealth365.com a reliable source?"
→ `clarify` (READY) → `check_source`

**AI capability claim:**
> "I read that [model X] achieves 95% accuracy on [benchmark]. Is that right?"
→ `clarify` (READY) → `fact_check` — vendor blogs and press releases are not accepted as evidence; requires independent academic or journalistic confirmation

---

## Peer Plugin Behaviour

Other `altra` plugins that include web search as a secondary capability will **automatically defer to this plugin** when it is installed alongside them. Their duplicate search/fetch tools are omitted at startup so this plugin's richer versions take over:

| Plugin | Tools deferred to web-search |
|---|---|
| `altra/research` | `search_sources`, `read_source` |
| `altra/ideas` | `research` |
| `altra/high-perf-tools` | `fetch_url`, `search_web` |

Installing this plugin is the recommended way to get the best search quality across all plugins at once. Each affected plugin also shows a tip on first message when this plugin is not installed.

## 💚 Support Development

This plugin is **free and open source**. If you find it useful, consider supporting development:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-ff5e5b?logo=ko-fi&logoColor=white)](https://ko-fi.com/thriloke96)

| Tier | Amount | Perks |
|------|--------|-------|
| ☕ Coffee | $3 | Name in credits |
| 🍔 Lunch | $10 | + Priority support |
| 🍕 Pizza | $25 | + Name in README |
| 🏆 Founding | $50 | + Lifetime support, consultation |

Every coffee helps keep this project alive! ☕
