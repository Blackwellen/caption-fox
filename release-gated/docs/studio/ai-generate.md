# Release evidence — Studio › AI Generate

| | |
|---|---|
| Parent section / route | Studio · `/{type}/studio` |
| Sub-tab / route | AI Generate · `/{type}/studio/ai-generate` (`?batch=`, `?all=1`) |
| API | `POST /api/studio/ai/generate` (generate + assist, incl. `enhance_prompt`) |
| Required plan / flag | Studio `ai-generate` module; `generateAi` capability; monthly AI credits (`limits.aiMonthly`) |
| Roles tested | Owner (browser) |
| Reference | `designs/Universal Sections/Studio/ai-generate.png` @ 1491 × 1055 |
| Score | **84 / 100** |
| Decision | **Ready for admin-only beta** |

## Tested (browser)
KPI strip (real day-over-day deltas), prompt box (Tips, Enhance prompt, Insert variable, Add brief, Save prompt, Clear, count), model/channel/tone/objective/audience/length/format/brand voice/more options, Generate / Regenerate / Create variations, outputs list, output detail + edit, LinkedIn preview, Use in Compose, generation settings rail, prompt history (now populated for the owner), saved prompts, credits & usage, recent AI outputs table with row actions.

## Server-side guards (code-reviewed)
Workspace from session (never the body); plan gate; capability check; credit check before the provider call (failed provider calls write nothing, so no credit is spent); burst rate limit (`enforceAiRateLimit`); request schema allow-lists for model/channel/tone/objective/audience/language; output-token ceilings; provider errors logged server-side with a safe reference only.

## Bugs fixed
Ref read during render (Regenerate disabled state); KPI label truncation; empty prompt history for the owner in demo data.

## Outstanding
Live provider call not exercised in this pass (Azure credentials environment-specific); prompt-injection test fixtures; per-role negative tests.
