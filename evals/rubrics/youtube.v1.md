# YouTube Rubric v1

Applied to: every video lesson in a generated YouTube learning path (`POST /api/courses/youtube/generate` flow, invoked here via `YouTubePathService` directly with no DB writes).

## Three checks

### 1. URL liveness (YouTube Data API)

`videos.list?part=status` over the curated `videoId` set. A video is `live = true` only when `status.privacyStatus === "public"`. Missing-from-response or `private`/`unlisted` → `live = false`. Requires `YOUTUBE_API_KEY` — without it, `live = "unknown"`.

### 2. Channel sanity (YouTube Data API)

`channels.list?part=snippet,statistics` for each unique `channelId`. A channel passes if all hold:

- `subscriberCount >= 1000`
- `videoCount >= 5`
- channel age (`snippet.publishedAt`) ≥ 180 days

Thresholds live as constants at the top of `evals/lib/youtube.ts`. Adjust upward once a baseline is established; v1 deliberately leaves them low to catch only the obvious junk.

### 3. Topic relevance (judge model: `groq:llama-3.1-8b-instant`)

Bounded judge call:

> Topic: `<topic>`
> Target level: `<targetLevel>`
> Video title: `<title>`
> Channel: `<channelName>`
> Curator note: `<whyIncluded>`
>
> Does this video plausibly teach the topic at the target level?
>
> Reply with strict JSON: `{ "relevant": true|false, "reason": "<one sentence>" }`

**v1 limit**: relevance judge sees title + channel + curator's `whyIncluded` only. Transcript-based relevance (when captions exist) is deferred to v2 — see `docs/EVALS_ROADMAP.md`.

## Aggregates per path

```
{
  total: number,
  pctLive: 0..1,
  pctChannelOk: 0..1,
  pctRelevant: 0..1
}
```

## Generation failures

If `YouTubePathService.generatePath` throws (no API key, no videos found, LLM parse failure, etc.) the whole topic produces a result with `generationError` set, empty `videos[]`, and zeroed aggregates. The error is recorded on the run summary.

## What's deliberately out

- Transcript-based relevance — deferred to v2.
- Recency scoring — staleness matters for tech topics but not for organic chemistry; v2 will add a per-domain knob.
- Multi-channel diversity (was the same channel over-used?) — deferred.
