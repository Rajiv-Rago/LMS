# Citations Rubric v1

Applied to: every `source` returned with each sampled lesson's generated content.

## Three layers (cheapest first)

### 1. URL liveness (no LLM)

`HEAD` request with 5s timeout via `evals/lib/citations.ts::probeUrl`.
- `200` / `3xx` → `live = true`
- `4xx` / `5xx` → `live = false`
- timeout / DNS error → `live = "unknown"` (recorded with `fetchError`)
- If `HEAD` returns 403/405, falls back to `GET`.

### 2. Domain quality (no LLM)

Score 0/1/2 via static lists in `evals/lib/citations.ts`:

- **2 — Official / authoritative**: `.edu`, `.gov`, MDN, official language/framework docs, IETF, W3C, RFCs, ACM, IEEE, arXiv, Wikipedia, O'Reilly, NIST, Nature, ScienceDirect, Khan Academy, MIT OCW, etc.
- **1 — Established tech/educational**: CSS-Tricks, Smashing Magazine, InfoQ, Stack Overflow, Martin Fowler, freeCodeCamp, Real Python, javascript.info, Baeldung, etc.
- **0 — Unknown / SEO / low-confidence**: anything not in the above lists. Includes most Medium posts and unknown blogs.

The lists are intentionally short and conservative. Add domains in `OFFICIAL_DOMAINS` or `ESTABLISHED_DOMAINS` as evidence accumulates.

### 3. Topic relevance (judge model: `groq:llama-3.1-8b-instant`)

Only run if `live === true`. Fetches the page, extracts `<title>` + first ~500 characters of stripped body text. Sends to bounded judge:

> Lesson title: `<title>`
> Source title: `<source.title>`
> Source URL: `<url>`
> Page excerpt: `<snippet>`
>
> Does this page cover material relevant to the lesson?
>
> Reply with strict JSON: `{ "relevant": true|false, "reason": "<one sentence>" }`

Pages that error or aren't live get `relevant = "unknown"` and are excluded from the relevance percentage denominator.

## Aggregates per lesson

```
{
  total: number,
  pctLive: 0..1,
  meanDomainScore: 0..2,
  pctRelevant: 0..1   // over the live + judged subset
}
```

## What's deliberately out

- Golden citation overlap per topic (deferred to v2 — needs hand-curated reference lists).
- Claim-grounding (does the cited page back the cited fact?) — deferred to v3.
- Paywall detection — soft 200s that hide content behind a wall will pass liveness but may score low relevance, which is the desired behavior.

## Calibration

Citation relevance is a binary judge call; calibrate via human Y/N labels with Cohen's kappa.
