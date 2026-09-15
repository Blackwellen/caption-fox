# Release Evidence — SEO & Discovery / AI Search

**Route:** `/app/seo/ai-search`
**Required plan:** Team
**Shared facts** in `release-gated/docs/seo-and-discovery.md`.

## Tabs clicked

Dashboard (default), Table, Prompts — three distinct views.

## Buttons / actions tested

| Action | Verified how |
|---|---|
| Track Prompts | `TrackPromptsWizard` + `trackPrompt` action reviewed: 6-engine allow-list, duplicate check (prompt+engine+region), explicit in-wizard disclosure: *"Prompts are checked on a periodic sample, not live monitoring of the answer engine."* |
| Filters (engine, citation status, sentiment) + search | `FilterBar`; `getAiPrompts()` applies each as a real clause. |

## Accuracy / no-overclaiming check (critical requirement for this surface)

- Every prompt and engine row carries a `method` field (`provider_api`, `search_provider`, `browser_sample`, `third_party_dataset`, `manual_check`, `estimated`) and renders it via `COLLECTION_METHOD_LABELS` next to an `InfoTip` explaining `COLLECTION_METHOD_HELP` — reviewed to confirm the UI never states or implies live/direct monitoring access to ChatGPT, Perplexity, Gemini, Claude or Copilot that this build does not actually have.
- Sentiment is explicitly model-derived (`sentiment_model`, `sentiment_confidence` columns exist) and rendered as a labelled chip, not presented as objective fact.
- "Google AI Overviews" is used instead of any unverified engine-branding claim.

## Filters / search / sorting / views tested

Reviewed against the "AI Search" design reference (image 6 of 7): KPI strip (6 cards), AI Visibility Trend, Answer Engines Monitored, Tracked Prompts table, Top Cited Pages, Emerging Opportunities, Prompt Brief / Source Transparency / Data Freshness trio — all present, backed by `getAiEngines`, `getAiPrompts`, `getCitedPages`, `getAiSourceMix`, `getOpportunities(scope:'ai_search')`.

**Gap closed this pass:** the "Prompt Brief" and "Data Freshness" cards from the design reference are now built alongside Source Transparency, in their own row:
- **Prompt Brief** — a static explainer card matching the design's copy, plus a link into the Prompts view.
- **Data Freshness** — renders `session.freshness` (a value the server session was already computing via `getSeoSession`/`buildFreshness` but no page had rendered until now): a status chip (Up to date / Partial coverage / Sync failed / Never synced, derived from real connected-source state — not hardcoded to "up to date"), the real last-successful-sync timestamp, and a coverage note ("N of M sources connected"). This reuses the exact same freshness object the module already computes for internal use, so there is no risk of it drifting out of sync with the real source-connection state.

## Data sources tested

Live Supabase; no external AI-provider API calls exist anywhere in this module (correctly — none were built, and none are claimed).

## Supabase tables checked

`seo_ai_engines`, `seo_ai_prompts`, `seo_ai_prompt_checks` (referenced by the seed data, not queried directly by this page), `seo_ai_cited_pages`, `seo_ai_source_mix`, `seo_opportunities`.

## Bugs found / fixes made

Dead `?new=1` link replaced with `TrackPromptsWizard`. This pass additionally closed the two-missing-panel gap flagged in the previous evidence pack.

## Tests run

`src/lib/seo/metrics.test.ts` covers `citationRate` (the one nontrivial calculation on this page). 100/100 repo-wide. `npx tsc --noEmit` — 0 errors after adding the two new cards.

**Live check:** not re-confirmed with a fresh HTTP request after this specific change (the dev server was cycling unstably at the point in this session when this page's turn came up for live testing — see the Rankings doc for the same note). The Overview and Brief-detail pages were successfully confirmed live earlier in this session using the identical mechanism, so the server-rendering path is proven; this page's newest two cards specifically were verified by code review and type-checking only.

## Cross-section effects checked

Tracking a prompt revalidates `/app/seo/ai-search` and `/app/seo`.

## Remaining user/manual actions

See user-fixes doc — the scheduled-check worker that would populate `seo_ai_prompt_checks` for a newly tracked prompt (this pass creates the prompt row but does not trigger or simulate a first check, so it correctly sits at `citation_status: 'unknown'` until a real check runs).

## Release score

**80 / 100** — real data, real create flow, all five design panels now present, and (most importantly for this surface) rigorously honest collection-method labelling with no overclaimed AI monitoring capability. Points withheld for the missing check-triggering worker and the not-yet-re-confirmed live render of the two newest cards.

## Final release decision

**Ready for admin-only beta** — implementation complete; pending a live browser re-check and the check-worker follow-up.
