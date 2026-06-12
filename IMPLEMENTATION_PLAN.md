# Caption Fox — Full Implementation Plan
## 9 Levels · 56 Steps · Zero Arm-and-a-Leg APIs

**Version:** 1.0 | **Date:** 2026-06-10 | **Author:** Claude Code

---

## Core Principles

1. **Never break what works.** Every step is additive. Each level can ship independently.
2. **Zero-cost APIs first.** If a feature requires an expensive API, we build it so the user provides their own credentials — we provide the UI, they provide the keys.
3. **Simulate before integrate.** Every data-dependent feature has a demo/seed mode so it works immediately without real API keys.
4. **AI = Claude Haiku only** (cheapest Anthropic model — ~$0.0004/1K tokens). Never call a paid third-party AI unless the user explicitly enables it.
5. **Supabase Edge Functions** for all background processing. Never block the UI.
6. **Resend** for all outbound email. Free tier: 3,000 emails/month, 100/day — sufficient for launch.

---

## Free API Strategy (What We Actually Use)

| Service | Cost | What We Use It For | Limit |
|---|---|---|---|
| **Reddit API** | Free (OAuth) | Brand mention search | 1,000 posts/min |
| **YouTube Data API v3** | Free | Video/comment keyword search | 10,000 units/day |
| **Google News RSS** | Free (no key) | News mention feed | ~100 articles/keyword |
| **Hugging Face Inference** | Free | Image generation (FLUX.1-schnell) | Rate-limited |
| **Pexels API** | Free | Stock photos & video | 20,000 req/month |
| **Pixabay API** | Free | Stock images (commercial licence) | 5,000 req/hour |
| **Unsplash API** | Free | Curated stock photos | 50 req/hr (production: 5K) |
| **Telegram Bot API** | Fully free | Notifications + DM inbox | No limit |
| **Resend** | Free | Transactional + report emails | 3,000/mo, 100/day |
| **Slack Webhooks** | Free | Team notifications | No limit |
| **Google Analytics 4** | Free | Embedded analytics | No limit |
| **Canva Design Button** | Free (approval) | In-editor design tool | No limit |

**Paid APIs — User Provides Their Own Keys (We Build the UI):**
- **WhatsApp Cloud API** (Meta) — user connects their own Business account
- **X/Twitter API** — user provides their own developer credentials (pay-per-use, their cost)
- **Stability AI** — user provides key if they want premium image gen
- **Stripe** — user provides own keys (already planned)

---

## Level Overview

| Level | Theme | Steps | Estimated Build Time |
|---|---|---|---|
| 1 | Platform Hardening & Infrastructure | 1–6 | 1 week |
| 2 | Social Listening Engine | 7–13 | 2 weeks |
| 3 | AI Content Intelligence | 14–20 | 2 weeks |
| 4 | Inbox & Messaging Expansion | 21–27 | 2 weeks |
| 5 | Analytics & Automated Reporting | 28–33 | 1.5 weeks |
| 6 | Team, Permissions & Agency | 34–39 | 1.5 weeks |
| 7 | Integrations & Webhooks | 40–45 | 1.5 weeks |
| 8 | Link-in-Bio & Commerce | 46–50 | 1 week |
| 9 | Platform Polish & Launch | 51–56 | 1 week |
| | **Total** | **56 steps** | **~14 weeks** |

---

## LEVEL 1: Platform Hardening & Infrastructure
### Theme: Make the platform bulletproof before adding more features

---

### Step 1 — Error Boundary System
**What:** Add React Error Boundaries to every major page section so a broken component doesn't crash the whole page.

**Files to create:**
- `src/components/ui/ErrorBoundary.tsx` — class component with fallback UI
- `src/components/ui/PageErrorFallback.tsx` — styled "something went wrong" card with retry button

**Implementation:**
- Wrap every tab panel in `<ErrorBoundary>`
- Wrap every modal body in `<ErrorBoundary>`
- Log caught errors to `audit_logs` (resource_type: 'client_error')
- Show user: "This section had an error. Our team has been notified." with a retry button

**Why first:** Every feature we add can fail. Without error boundaries, a bad API response crashes the whole dashboard.

**Cost:** Zero.

---

### Step 2 — Environment Variables Audit & `.env.local.example` Cleanup
**What:** Audit all API keys, document required vs optional env vars, add runtime validation.

**Files:**
- `.env.local.example` — complete list of all env vars with descriptions
- `src/lib/env.ts` — runtime check: on startup, log warnings for missing optional vars, throw for missing required vars

**Required vars:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL
```

**Optional vars (feature flags — missing = feature disabled gracefully):**
```
REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET        → Social Listening (Reddit)
YOUTUBE_API_KEY                                  → Social Listening (YouTube)
HUGGING_FACE_API_KEY                             → AI Image Generation
PEXELS_API_KEY                                   → Stock Media Library
PIXABAY_API_KEY                                  → Stock Media Library
UNSPLASH_ACCESS_KEY                              → Stock Media Library
RESEND_API_KEY                                   → Email Reports + Transactional
TELEGRAM_BOT_TOKEN                               → Telegram Inbox Channel
STABILITY_API_KEY                                → Premium Image Generation (user's key)
STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET        → Billing
SLACK_WEBHOOK_URL                                → Team Notifications
```

**In-app:** Settings > Integrations tab shows which integrations are connected vs missing keys.

**Cost:** Zero.

---

### Step 3 — Supabase Edge Functions Setup
**What:** Create the Supabase Edge Functions infrastructure for background processing (social listening ingestion, email sends, alert triggers).

**Functions to scaffold (empty stubs, filled in later steps):**
- `supabase/functions/ingest-mentions/index.ts` — pulls mentions from Reddit/YouTube/News RSS
- `supabase/functions/send-report/index.ts` — generates and emails scheduled reports
- `supabase/functions/trigger-alerts/index.ts` — checks brand_mentions for alert conditions
- `supabase/functions/process-webhook/index.ts` — handles incoming webhooks

**Deployment:** `supabase functions deploy` — runs on Supabase's infrastructure, no server needed.

**Cron schedule (via Supabase Dashboard → Edge Functions → Schedules):**
- `ingest-mentions`: every 30 minutes
- `trigger-alerts`: every hour
- `send-report`: daily at 07:00 UTC

**Cost:** Zero (included in Supabase free tier: 500K invocations/month).

---

### Step 4 — API Route Rate Limiting
**What:** Prevent abuse of AI generation endpoints. Add per-workspace rate limiting.

**Implementation:**
- Use Supabase to store request counts in a `rate_limits` table
- Each AI route checks: workspace has made < N requests in last hour
- Limits by plan: Free=10/hr, Starter=50/hr, Pro=200/hr, Team=500/hr, Agency=unlimited

**Files:**
- `src/lib/rate-limit.ts` — `checkRateLimit(workspaceId, action, limit)` utility
- Apply to: `/api/ai/generate`, `/api/ai/chat`, `/api/ai/image`

**Schema addition:**
```sql
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  action text not null,
  window_start timestamptz default now(),
  request_count integer default 1
);
create index on public.rate_limits(workspace_id, action, window_start);
```

**Cost:** Zero.

---

### Step 5 — In-App Notification System (Real-Time)
**What:** Real-time toast notifications powered by Supabase Realtime (free). When Fox AI finishes, when a post is approved, when a giveaway winner is picked — user sees a notification instantly.

**Implementation:**
- Subscribe to `notifications` table inserts for the current user using `supabase.channel()`
- `src/components/ui/NotificationToast.tsx` — slides in from bottom-right, auto-dismisses
- `src/components/layout/NotificationBell.tsx` — bell icon in top nav with unread count badge
- `src/app/app/notifications/page.tsx` — full notification history page

**Notification types to wire:**
- Post approved/rejected
- Campaign status changed
- Giveaway winner selected
- New UGC submission received
- Mention alert triggered
- Scheduled report sent
- Team member joined

**Cost:** Zero (Supabase Realtime is free tier).

---

### Step 6 — Global Search
**What:** `Cmd+K` / `Ctrl+K` command palette that searches across posts, campaigns, creators, briefs, inbox threads.

**Implementation:**
- `src/components/ui/CommandPalette.tsx` — modal with search input, results grouped by type
- Keyboard shortcut: `useEffect` listening for `metaKey+k` or `ctrlKey+k`
- Search: Supabase full-text search using `tsquery` on content_posts.title, campaigns.name, ugc_creators.name, inbox_threads.author_handle
- Results: Post (→ studio), Campaign (→ campaign detail), Creator (→ creator CRM), Thread (→ inbox), Setting (→ settings tab)
- Recent items: stored in localStorage, shown when search is empty

**Cost:** Zero.

---

## LEVEL 2: Social Listening Engine
### Theme: Real brand monitoring using free APIs only

---

### Step 7 — Google News RSS Mention Ingestion
**What:** Pull brand mentions from Google News RSS feeds for each listening keyword. No API key required.

**Edge Function: `ingest-mentions/news.ts`**

```
URL pattern: https://news.google.com/rss/search?q={keyword}&hl=en-GB&gl=GB&ceid=GB:en
Parse RSS XML → extract title, link, source, pubDate
For each article: INSERT into brand_mentions if URL not already seen
Sentiment: send content to Claude Haiku (5 words: "Rate sentiment: positive/neutral/negative")
```

**In-app display:**
- Mentions show "News" platform badge with globe icon
- Link opens original article in new tab
- Author = publication name (BBC, Guardian, etc.)

**Setup:** No API key needed. Works immediately on first deploy.

**Cost:** Zero. Claude Haiku sentiment: ~$0.002 per 1,000 mentions.

---

### Step 8 — Reddit Mention Ingestion
**What:** Pull Reddit posts and comments mentioning brand keywords.

**Setup required:** User adds Reddit API credentials in Settings > Integrations:
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (free Reddit app registration)
- Registration: https://www.reddit.com/prefs/apps — takes 5 minutes

**Edge Function: `ingest-mentions/reddit.ts`**
```
OAuth2 token → GET /search.json?q={keyword}&sort=new&limit=100
Parse posts → INSERT into brand_mentions
Subreddit = platform metadata
Author = author_handle
Content = post title + selftext (truncated 500 chars)
```

**In-app display:**
- Platform badge: "Reddit" (Hash icon)
- Upvote count as engagement_count
- Link to original Reddit thread

**Rate limit:** 60 req/min — ingestion runs every 30 min, well within limits.

**Cost:** Zero.

---

### Step 9 — YouTube Mention Ingestion
**What:** Search YouTube for videos mentioning brand keywords. Pull comments from those videos.

**Setup:** `YOUTUBE_API_KEY` in Settings > Integrations (free Google Cloud project, 10K units/day).

**Edge Function: `ingest-mentions/youtube.ts`**
```
GET /search?part=snippet&q={keyword}&type=video&order=date&maxResults=10  (100 units)
For each video: GET /commentThreads?videoId=X (1 unit each)
INSERT brand_mention for the video itself + top 5 comments
```

**In-app display:**
- Platform badge: "YouTube" (PlayCircle icon)
- author_followers = video channel subscriber count (if available)
- Link to video
- Comment content as the mention text

**Quota management:** 10K units/day ÷ ~110 units/keyword = 90 keywords/day max. For Team plan (100 keywords): run in batches, rotate through keywords over 24 hours.

**Cost:** Zero (Google Cloud free tier covers it).

---

### Step 10 — Manual Mention Import (URL → Scrape)
**What:** Users can paste any public URL and we import it as a brand mention. Handles platforms we don't have official API access to (TikTok, Facebook, LinkedIn, Pinterest).

**Implementation:**
- "Import URL" button in Social Listening > Feed tab
- POST to `/api/listening/import` with `{ url, keyword_id }`
- Server: fetch the URL (Next.js server side, no CORS issues), extract:
  - OpenGraph title + description
  - `og:image` for thumbnail
  - Domain as platform name
  - Page title as content
- INSERT into brand_mentions with platform derived from domain
- Claude Haiku: analyse content for sentiment

**Use case:** User finds a TikTok video mentioning their brand → pastes URL → appears in listening feed with correct sentiment.

**Cost:** Zero (URL fetch is free; Claude Haiku ~$0.001 per import).

---

### Step 11 — Sentiment Analysis Pipeline
**What:** Every mention ingested gets a sentiment score via Claude Haiku. Build a proper, consistent pipeline.

**Implementation:**
- `src/lib/sentiment.ts` → `analyseSentiment(content: string): Promise<{ label: 'positive'|'neutral'|'negative', score: number }>`
- Uses Claude Haiku with a consistent system prompt:
  ```
  You are a sentiment classifier. Given text, return JSON: {"sentiment": "positive|neutral|negative", "score": 0.0-1.0}
  Score: 1.0 = strongly positive, 0.5 = neutral, 0.0 = strongly negative.
  ```
- Batch processing: collect 10 mentions → 1 API call (send all as array) → parse back
- Cache: if same content hash already scored → reuse score (saves API calls)

**In-app:**
- Sentiment score shown as a mini progress bar on each mention card
- Aggregate scores drive the Sentiment Analysis tab charts

**Cost:** ~$0.004 per 1,000 mentions (batch mode). For 10,000 mentions/month = $0.04.

---

### Step 12 — Alert Trigger System
**What:** The Edge Function that checks listening data and fires alerts.

**Edge Function: `trigger-alerts/index.ts`**

Runs hourly. Checks each active workspace with listening keywords:

**Alert Types:**
1. **Volume Spike:** mentions in last 2 hours > 2× daily average → INSERT listening_alert type='volume_spike'
2. **Negative Spike:** >30% of mentions in last 4 hours are negative → type='negative_sentiment'
3. **Viral Mention:** single mention has engagement_count > 1,000 → type='viral'
4. **New Competitor Mention:** mention matches a keyword flagged as competitor → type='competitor_mention'
5. **First Mention:** first ever mention found for a keyword → type='new_mention'

**Delivery:**
- INSERT into `listening_alerts` → triggers Supabase Realtime → in-app notification bell
- If `alert_enabled + email notifications on`: send via Resend to workspace owner
- Rate limiting: same alert type for same keyword max 1 per 4 hours

**Cost:** Zero (Edge Function free tier; Resend free tier covers alert emails).

---

### Step 13 — Listening Demo/Seed Mode
**What:** If no API keys are configured, Social Listening shows realistic demo data so users understand the value before setting up.

**Implementation:**
- `src/lib/listening-demo.ts` — generates 50 plausible-looking mock mentions:
  - Random platforms (Reddit/YouTube/News), plausible author handles, realistic content
  - Mix of sentiments (60% positive, 25% neutral, 15% negative)
  - Timestamps spread across last 30 days
- Shown only to workspaces with 0 real brand_mentions AND 0 listening_keywords configured
- Yellow banner: "Showing example data. Add keywords to start real monitoring." with "Set Up Now →" link
- Demo data never saved to DB — generated client-side on demand

**Cost:** Zero.

---

## LEVEL 3: AI Content Intelligence
### Theme: Make Fox AI the most capable AI in any social tool at this price point

---

### Step 14 — Hugging Face Image Generation (Free)
**What:** Replace the Stability AI image generation with Hugging Face's free FLUX.1-schnell model.

**Files:**
- Update `src/app/api/ai/image/route.ts`

**Implementation:**
```typescript
// Primary: Hugging Face (free)
const hfKey = process.env.HUGGING_FACE_API_KEY // free to get at huggingface.co
const resp = await fetch(
  'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: optimizedPrompt })
  }
)
// Returns: binary image blob
const blob = await resp.blob()
// Store in Supabase Storage (media bucket), return public URL
```

**Fallback chain:**
1. Hugging Face (FLUX.1-schnell) — free, good quality
2. Stability AI — if user has their own `STABILITY_API_KEY` in Settings
3. Prompt-only mode — returns the optimised prompt for use in Midjourney/DALL-E

**In-app (Studio > Posts > [id] > AI Assist tab):**
- "Generate Image" section with text prompt input
- Platform selector: Instagram Square / Story / YouTube Thumbnail / etc. → sets aspect ratio
- Style presets: Photo-realistic / Illustration / Minimal / Bold graphic
- Shows generated image with "Use This Image" (adds to post media)
- Shows "Copy Prompt" (for use in Midjourney/DALL-E)

**Cost:** Zero (Hugging Face free tier). If rate-limited: shows "Try again in a moment."

---

### Step 15 — Stock Media Library (Pexels + Pixabay + Unsplash)
**What:** Search 10M+ free-to-use images and videos directly inside Studio without leaving Caption Fox.

**Files:**
- `src/app/api/media/search/route.ts` — unified search across all 3 providers
- `src/app/app/studio/media/page.tsx` — full media library page (update existing)

**API routes:**
```typescript
// GET /api/media/search?q=coffee&type=photo&source=pexels
// Calls Pexels: GET https://api.pexels.com/v1/search?query={q}&per_page=20
// Calls Pixabay: GET https://pixabay.com/api/?key={key}&q={q}&per_page=20
// Calls Unsplash: GET https://api.unsplash.com/search/photos?query={q}&per_page=20
// Merges results, deduplicates, returns unified format
```

**Unified result format:**
```typescript
interface StockMedia {
  id: string; source: 'pexels'|'pixabay'|'unsplash'
  preview_url: string; download_url: string
  photographer: string; photographer_url: string
  width: number; height: number; type: 'photo'|'video'
}
```

**In-app:**
- Search box with source filter tabs (All / Pexels / Pixabay / Unsplash)
- Masonry grid layout
- "Use in Post" → downloads file → uploads to Supabase Storage → attaches to post
- "Save to Library" → saves to media_assets with rights_status = 'stock_free'
- Attribution auto-appended if required (Unsplash requires credit)

**Cost:** Zero (all three have free tiers covering normal usage).

---

### Step 16 — AI Post Scoring (Predict Before Publishing)
**What:** Before a post is scheduled, Fox AI scores it across 5 dimensions and suggests improvements.

**Files:**
- `src/app/api/ai/score/route.ts`
- Integrate into `src/app/app/studio/posts/[id]/page.tsx` — "Score My Post" button in AI Assist tab

**Scoring prompt (Claude Haiku):**
```
Analyse this social media post for {platform}. Score 1-10 on:
1. Hook Strength: Does the first line grab attention?
2. Clarity: Is the message clear?
3. Call to Action: Is there a clear CTA?
4. Hashtag Effectiveness: Are hashtags relevant and appropriate count?
5. Length: Is it optimal for {platform}?

Return JSON: { hook: 7, clarity: 8, cta: 5, hashtags: 9, length: 7, overall: 7.2,
  improvements: ["Add a question in the first line", "Move CTA to end"] }
```

**In-app:**
- 5 circular progress indicators (one per dimension) with colour coding
- Overall score badge (red/amber/green)
- Expandable "Suggestions" list with "Apply" button on each
- Score updates live as user edits the caption

**Cost:** ~$0.001 per score. Negligible.

---

### Step 17 — Content Calendar AI Suggestions
**What:** Fox AI proactively suggests content ideas based on trending topics, upcoming dates, and the workspace's brand voice.

**Files:**
- `src/app/api/ai/calendar-suggestions/route.ts`
- Integrate into `src/app/app/calendar/page.tsx` — "AI Suggestions" panel (sidebar or modal)

**Logic:**
1. Fetch upcoming dates: UK/US bank holidays + user-added events from calendar
2. Fetch brand voice profile for the workspace
3. Fetch recent top-performing posts (most engagement)
4. Send to Claude Haiku:
   ```
   Brand: {brand_name}, Voice: {tone}, Industry: {industry}
   Upcoming dates: {next 14 days of holidays/events}
   Top content recently: {titles of 3 best posts}
   Suggest 5 post ideas for the next 7 days. For each: ideal day, platform, hook, content_type.
   ```
5. Return as content idea cards in the calendar

**In-app:**
- "Get Suggestions" button in calendar header
- Slides in a "Fox AI Ideas" panel showing 5 cards
- Each card: day badge, platform, post type icon, hook text
- "Add to Calendar" → opens NewPostModal pre-filled with that idea
- "Dismiss" → removes idea

**Cost:** ~$0.003 per suggestion run. Run max once per day per workspace.

---

### Step 18 — Brand Voice Fine-Tuning
**What:** Let users teach Fox AI their brand voice with real examples, banned words, and approved phrases — then enforce this across all generations.

**What already exists:** `brand_voice_profiles` table with tone[], banned_phrases[], approved_phrases[], style_rules, example_copy.

**What to add:**

**Files:**
- Enhance `src/app/app/settings/page.tsx` → Brand Voice tab with:
  - "Voice Examples" section: paste 3–5 real posts you've written → AI learns your style
  - "Banned Words" tag input (already exists — enhance UI)
  - "Required Phrases" tag input
  - "Tone Sliders": Formal ←→ Casual, Short ←→ Long, Serious ←→ Playful (store as 3 numbers 1-10)
  - "Voice Preview": type a topic → generate a test caption → shows how AI will write

**API route update: `src/app/api/ai/generate/route.ts`**
- Always fetch brand_voice_profile before generating
- Include in system prompt:
  ```
  Brand voice rules:
  - Tone: {tone_description from sliders}
  - Style: {style_rules}
  - Never use: {banned_phrases.join(', ')}
  - Always include: {approved_phrases.join(', ')}
  - Examples of our writing: {example_copy}
  ```

**Cost:** Zero (adds tokens to existing Haiku calls — small increase).

---

### Step 19 — Competitor Content Spy (AI Analysis)
**What:** User pastes a competitor's recent post URLs → Fox AI analyses their content strategy and suggests ways to compete.

**Files:**
- `src/app/api/ai/competitor-analyse/route.ts`
- Integrate into `src/app/app/analytics/competitors/page.tsx` → new "AI Analysis" tab

**Flow:**
1. User pastes 3–5 competitor post URLs
2. Server fetches each URL → extracts OG title + description + image alt text
3. Sends to Claude Haiku:
   ```
   Analyse these competitor posts and identify:
   1. Their content themes (what do they talk about most?)
   2. Their tone and voice
   3. Their CTAs (what do they want people to do?)
   4. Content gaps (what are they NOT covering that we could own?)
   5. Suggested counter-strategy for {our_brand_name}
   ```
4. Returns structured analysis

**In-app:**
- "Analyse Competitor Posts" card in Competitor Analysis page
- URL input (add up to 5)
- Shows analysis report with themed sections
- "Create Competing Post" button → opens Studio with AI-suggested counter-post

**Cost:** ~$0.005 per analysis run. Negligible.

---

### Step 20 — AI Content Recycler
**What:** Take high-performing old posts and repurpose them for new platforms/formats using Fox AI.

**Files:**
- `src/app/api/ai/recycle/route.ts`
- Feature in `src/app/app/studio/page.tsx` — "Recycle Top Posts" section

**Logic:**
1. Fetch top 10 posts by engagement from last 90 days
2. User selects a post + target platform + new format
3. Claude Haiku rewrites it:
   ```
   Original post (Instagram caption, performed well): {original_content}
   Rewrite this for {target_platform} as a {format}. 
   Keep the core message. Adapt for {platform}'s audience and character limits.
   ```
4. Returns 3 variations

**Use cases:**
- Top Instagram post → LinkedIn article intro
- Best tweet → Instagram caption
- Long YouTube script → 3 TikTok hooks

**Cost:** ~$0.002 per recycle run.

---

## LEVEL 4: Inbox & Messaging Expansion
### Theme: One inbox for every channel — free channels first

---

### Step 21 — Telegram Inbox Channel (Fully Free)
**What:** Connect a Telegram Bot to Caption Fox inbox. Receive DMs and group mentions in the unified inbox.

**Setup flow (user):**
1. User creates a Telegram Bot via @BotFather (takes 2 minutes, free)
2. Pastes bot token in Settings > Channels > Add Channel > Telegram
3. Caption Fox registers a webhook: `POST https://api.telegram.org/bot{token}/setWebhook?url={APP_URL}/api/webhooks/telegram`

**Webhook handler: `src/app/api/webhooks/telegram/route.ts`**
```typescript
// Receives: { message: { from, chat, text, date } }
// → INSERT into inbox_threads (platform='telegram', author_handle=from.username)
// → INSERT into inbox_messages with content
// → Supabase Realtime fires → inbox shows new thread
```

**Reply flow:**
- User types reply in Inbox → POST to `/api/inbox/reply`
- Server calls `POST https://api.telegram.org/bot{token}/sendMessage`
- Confirmation modal ("Are you sure you want to send this reply?") — required by AI safety rules

**Cost:** Zero. Telegram Bot API is completely free with no limits.

---

### Step 22 — WhatsApp Inbox Channel (User's Own WABA Account)
**What:** Connect WhatsApp Business to Caption Fox. We build the UI and webhook handler. User provides their own Meta Business/WhatsApp credentials.

**Setup flow (user):**
1. User has a Meta Business account + WhatsApp Business API (WABA)
2. In Settings > Channels > Add Channel > WhatsApp:
   - Paste: Phone Number ID, WABA ID, Permanent Access Token, Verify Token
3. Caption Fox registers their webhook with Meta

**Webhook handler: `src/app/api/webhooks/whatsapp/route.ts`**
```typescript
// GET: verify token challenge (Meta requirement)
// POST: receive messages → INSERT inbox_threads/messages
// Message types: text, image, document, audio, video
// Sent back via: POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
```

**UI in Inbox:**
- WhatsApp threads show green badge
- Full conversation view
- Reply composer with character count
- Media attachment support (image/document)
- Mandatory confirmation modal before sending
- Note shown: "Marketing messages cost money via your Meta account. This tool only sends replies to messages you received (free service conversations)."

**Cost to Caption Fox:** Zero. User pays Meta for any marketing messages they initiate. Replies to incoming messages are free (service conversations).

---

### Step 23 — Email Inbox Channel
**What:** Parse inbound emails into Caption Fox inbox (support@, hello@, info@ etc.).

**Implementation using Resend Inbound (or manual forwarding):**

**Option A — Resend Inbound (if available in their region):**
- User adds a forwarding rule in their email provider → `inbound@resend.dev`
- Resend fires a webhook to `POST /api/webhooks/email`

**Option B — Forwarding to unique address:**
- Caption Fox generates a unique address per workspace: `{workspace-slug}@inbox.captionfox.com`
- User sets up email forwarding in their provider to this address
- Use Supabase email inbound (via Resend catch-all forwarding)

**Webhook handler: `src/app/api/webhooks/email/route.ts`**
```typescript
// Parse: from, subject, text/html body, attachments
// → INSERT inbox_threads (platform='email', author_handle=from_email)
// → Claude Haiku: classify email (support/sales/press/spam/other)
// → auto-assign to team member based on classification
// → notify assigned member via Supabase Realtime
```

**Reply:** send via Resend API using `from: workspace@captionfox.com` (or their custom domain).

**Cost:** Resend free: 3,000 emails/month. For most workspaces, sufficient.

---

### Step 24 — Inbox Smart Routing
**What:** Auto-assign inbox threads to the right team member based on rules.

**Files:**
- `src/app/app/inbox/routing/page.tsx` — routing rules builder
- Applied in webhook handlers and ingest functions

**Rule types:**
- **Keyword → Assignee**: "if message contains 'refund' → assign to {billing_member}"
- **Platform → Assignee**: "all Twitter threads → assign to {social_manager}"
- **Sentiment → Priority**: "if sentiment=negative → mark as urgent, notify owner"
- **Time of day → Queue**: "outside 9–5 UK → mark as 'after hours', no auto-assign"
- **Language detect**: "if non-English → flag for translation"

**Schema addition:**
```sql
create table public.inbox_routing_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  rule_type text not null, -- keyword/platform/sentiment/time
  condition jsonb not null, -- flexible: { keyword: 'refund' } or { platform: 'email' }
  action jsonb not null,   -- { assign_to: uuid, priority: 'urgent', tag: 'billing' }
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

**Cost:** Zero (Claude Haiku used for language detection only, ~$0.0001/thread).

---

### Step 25 — Inbox SLA Tracking
**What:** Track first response time and resolution time. Show SLA health in inbox.

**Schema additions:**
```sql
alter table public.inbox_threads add column if not exists
  first_response_at timestamptz,
  resolved_at timestamptz,
  sla_breach boolean default false,
  sla_target_hours integer default 24;
```

**SLA defaults by plan:**
- Free/Starter: No SLA tracking
- Pro: 24-hour target
- Team: 8-hour target (configurable)
- Agency: Custom per client (configurable per thread)

**In-app:**
- Each thread shows: "Awaiting response — 3h 22m" with green/amber/red colour
- Red = SLA breached
- Inbox overview: SLA health strip showing % threads within SLA
- Notification: "Thread from @handle is approaching SLA breach (1h remaining)"

**Cost:** Zero.

---

### Step 26 — Auto-Reply Templates
**What:** Save, organise and deploy canned responses for common questions. With variable substitution.

**Schema addition:**
```sql
create table public.inbox_reply_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  category text default 'general', -- support/sales/ugc/giveaway/general
  title text not null,
  content text not null, -- supports {{author_name}}, {{brand_name}}, {{date}}
  platforms text[] default '{}',
  usage_count integer default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
```

**In-app (Inbox thread view — reply composer):**
- "Templates" button opens a popover with searchable template list
- Categories: Support / Sales / UGC / Giveaway / General
- Click a template: fills reply box with content
- Variables auto-substituted: `{{author_name}}` → `@handle`, `{{brand_name}}` → workspace brand name
- "Save as Template" button from any reply draft

**Cost:** Zero.

---

### Step 27 — Unified Thread View (All Channels)
**What:** One conversation view that shows the full history across platforms when the same person messages on multiple channels.

**Implementation:**
- Match threads by `author_handle` similarity or exact email match
- "Also messaged on" badge on thread detail: "This contact also has 2 threads on Email"
- Link to related threads
- "Merge Contact" feature: mark two handles as the same person, merge their thread history

**Schema addition:**
```sql
alter table public.inbox_threads add column if not exists
  contact_id uuid; -- optional linkage to a contact record

create table public.inbox_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text,
  email text,
  handles jsonb default '{}', -- { instagram: '@handle', twitter: '@handle', email: 'x@y.com' }
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now()
);
```

**Cost:** Zero.

---

## LEVEL 5: Analytics & Automated Reporting
### Theme: Sprout Social-level reporting at zero extra cost

---

### Step 28 — Resend Email Reports (Real Implementation)
**What:** Wire the scheduled_reports system to actually send real emails via Resend.

**Edge Function: `supabase/functions/send-report/index.ts`**

Runs daily at 07:00 UTC. For each `scheduled_reports` where `is_active=true` and `next_send_at <= now()`:

1. Build the report data (queries against Supabase from the Edge Function)
2. Generate HTML email using a template (see below)
3. POST to Resend API: `POST https://api.resend.com/emails`
4. INSERT into `report_history` with status
5. UPDATE `scheduled_reports SET last_sent_at=now(), next_send_at={next_calculated}`

**Email template structure:**
```html
<!-- Branded HTML email -->
Header: Caption Fox logo + Report name + Date range
KPI Cards: 4 top metrics (formatted numbers)
Chart Section: Simple SVG bar chart (no canvas needed in email)
Top Posts Table: Title | Platform | Engagement | CTA
Campaign Status: Active campaigns + their progress
Footer: Unsubscribe link | "Made with Caption Fox"
```

**Cost:** Resend free: 3,000 emails/month, 100/day. Sufficient for most workspaces at launch.

---

### Step 29 — PDF Report Generation
**What:** "Download PDF" on any report generates a real PDF — not just window.print().

**Implementation using React → PDF (no external service needed):**
- Install: `npm install @react-pdf/renderer` (MIT licence, free)
- `src/components/reports/ReportPDF.tsx` — React component using @react-pdf/renderer primitives
- `/api/reports/generate-pdf` — server route that renders the PDF and returns as blob

**PDF sections:**
- Cover page: brand logo, report name, date range, workspace name
- KPI summary page: large number cards
- Charts page: recharts → SVG → embedded in PDF
- Top posts table
- Campaign breakdown
- Footer with Caption Fox branding

**In-app:** "Download PDF" button on any report preview → triggers download.

**Cost:** Zero (@react-pdf/renderer is free and open source).

---

### Step 30 — Custom Dashboard Builder
**What:** Let users build their own analytics dashboard by dragging widgets onto a canvas.

**Implementation (no drag library needed — use click-to-add):**
- `src/app/app/analytics/dashboard/page.tsx` — custom dashboard builder
- `src/app/api/analytics/widgets/route.ts` — serves widget data

**Widget types:**
- KPI Card (single number: followers, posts, engagement rate)
- Line Chart (metric over time)
- Bar Chart (comparison)
- Donut Chart (breakdown)
- Top Posts List
- Recent Mentions (from listening)
- Campaign Progress Bar
- Team Activity Feed

**Schema:**
```sql
create table public.custom_dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  widgets jsonb default '[]', -- array of { type, config, position: { col, row } }
  is_default boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
```

**Grid system:** 12-column grid, widgets have col-span 3/4/6/12 options. User adds widgets via a palette, drags via sort_order (same click-up/down pattern as link builder).

**Cost:** Zero.

---

### Step 31 — Goal Tracking & ROI Calculator
**What:** Set marketing goals, track progress, calculate ROI.

**Files:**
- `src/app/app/analytics/goals/page.tsx`

**Schema:**
```sql
create table public.marketing_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id),
  goal_type text, -- followers/engagement/reach/leads/revenue/ugc_submissions
  target_value numeric not null,
  current_value numeric default 0,
  start_date date,
  end_date date,
  status text default 'active',
  created_at timestamptz default now()
);
```

**In-app:**
- Goals page: cards per goal showing progress bar, % complete, days remaining
- ROI calculator: "Spent: £{budget} / Revenue attributed: £{revenue} / ROI: {%}"
- Breakdown by campaign, channel, content type
- "Goal achieved!" celebration state (confetti animation — CSS only)

**Cost:** Zero.

---

### Step 32 — Slack Notifications (Free)
**What:** Send Caption Fox alerts to a Slack channel using Slack's free Incoming Webhooks.

**Setup:**
1. User creates Incoming Webhook in their Slack workspace (free, 5 minutes)
2. Pastes webhook URL in Settings > Integrations > Slack

**Notification types to Slack:**
- Post approved/rejected
- Campaign went live
- Giveaway winner selected
- Brand mention alert (volume spike / negative)
- Scheduled report sent
- Team member invited

**Implementation:**
- `src/lib/notify-slack.ts` → `sendSlackMessage(webhookUrl, payload)`
- Called from relevant Supabase Edge Functions and API routes
- Slack message format: rich blocks with icon, title, detail, link button

**Cost:** Zero. Slack Incoming Webhooks are completely free.

---

## LEVEL 6: Team, Permissions & Agency Features
### Theme: Make Caption Fox the platform agencies actually want

---

### Step 33 — Enforce Permissions Across All Routes
**What:** The permissions system exists but isn't yet checked in API routes. Every API route that mutates data must check the user's permissions.

**Files:**
- `src/lib/auth-check.ts` → `requirePermission(userId, workspaceId, permission)` utility
- Apply to all API routes: `/api/posts/*`, `/api/campaigns/*`, `/api/ugc/*`, `/api/inbox/*`

**Pattern:**
```typescript
// In every mutating API route:
const permitted = await requirePermission(user.id, workspace_id, 'publish_post')
if (!permitted) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
```

**In-app:** Buttons/actions that the user lacks permission for should be:
- Greyed out with a lock icon (not hidden — users should know the feature exists)
- Tooltip on hover: "You need {permission_label} permission. Contact your workspace admin."

**Cost:** Zero.

---

### Step 34 — Client Portal (Read-Only Access for Clients)
**What:** Agency clients can log in to see their campaign progress, analytics, and post approvals — without seeing other clients' data.

**Implementation:**
- `client` role already exists in WORKSPACE_ROLES
- Create `/app/client/` route group with restricted layout (no sidebar, clean header)
- `src/app/app/client/layout.tsx` — minimal shell, shows only client's brand data
- `src/app/app/client/page.tsx` — client dashboard: campaign progress, scheduled posts awaiting approval, recent analytics
- `src/app/app/client/posts/page.tsx` — posts the client can approve/reject

**RLS:** `client` role members can only see records where `brand_id` matches their assigned brand.

**Invite flow:**
- Agency sends invite → client gets email → creates account → lands in client portal
- Cannot access full app (`/app/*` routes redirect to `/app/client/` if role=client)

**Cost:** Zero.

---

### Step 35 — White-Label Domain Support
**What:** Agency plan users can serve Caption Fox under their own domain/subdomain.

**Implementation:**
- Workspace setting: `custom_domain` field in workspaces table
- When a request comes in on a custom domain, resolve the workspace from the domain
- `src/middleware.ts` — check `request.headers.get('host')` against `custom_domains` table

**Schema:**
```sql
create table public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  domain text not null unique,
  verified boolean default false,
  ssl_provisioned boolean default false,
  created_at timestamptz default now()
);
```

**Setup flow (in Settings > White Label for Agency plan):**
1. User adds their domain (e.g., `social.theiragency.com`)
2. We show CNAME record to add: `social.theiragency.com CNAME captionfox.com`
3. We verify (check DNS resolution), mark `verified=true`
4. They access Caption Fox on their domain — looks like their product

**Logo/branding:** Agency can upload their logo, set their colour scheme — replaces Caption Fox branding.

**Cost:** Zero (Next.js handles custom domains; Vercel/hosting handles SSL).

---

### Step 36 — Team Performance Dashboard
**What:** See which team members are most active, what they're producing, and their approval rates.

**Files:**
- `src/app/app/settings/team/performance/page.tsx`

**Metrics per team member:**
- Posts created (last 30 days)
- Posts approved vs rejected
- Avg time to publish (draft → published)
- AI generations used
- UGC submissions reviewed
- Inbox threads handled
- Last active at

**Queries:** Aggregate from `content_posts.created_by`, `ai_generations.user_id`, `ugc_submissions` (reviewed_by), `inbox_threads` (assignee_id).

**In-app:** Table with member cards, sortable by each metric. Clicking a member shows their full activity timeline.

**Cost:** Zero.

---

### Step 37 — Multi-Workspace Switcher (Agency)
**What:** Agency admins can manage multiple workspaces from one account and switch between them instantly.

**Implementation:**
- User can be a member of multiple workspaces (already supported by `workspace_members`)
- `src/components/layout/WorkspaceSwitcher.tsx` — dropdown in sidebar header showing all workspaces the user belongs to
- Selecting a workspace: sets `workspace_id` cookie → page reloads with new workspace context
- "Create New Workspace" option at bottom

**Schema:** No change needed — workspace_members already supports M:M.

**In-app:**
- Sidebar shows current workspace name + logo at top
- Click → dropdown shows all workspaces with role badges
- Keyboard: `Cmd+[` previous workspace, `Cmd+]` next workspace

**Cost:** Zero.

---

### Step 38 — Bulk Team Actions
**What:** Manage multiple team members at once — bulk role change, bulk remove, bulk permission reset.

**In Settings > Team page:**
- Checkboxes on each team member row
- Bulk action bar appears when any selected: "Change Role" / "Reset Permissions" / "Remove" / "Invite to Another Workspace"
- All bulk actions require ConfirmModal
- "Export Team CSV" — downloads member list with role, joined date, last active

**Cost:** Zero.

---

### Step 39 — Approval Workflow Engine (Real Implementation)
**What:** When a post is in "pending approval" status, the configured approvers receive a notification and can approve/reject with comments.

**Flow:**
1. Creator submits post for review → status = 'pending_review'
2. System: INSERT into `approvals` table with reviewer_ids from approval config
3. Each approver: gets in-app notification + email (via Resend)
4. Approver opens post → sees Approvals tab → clicks Approve or Reject + comment
5. If approved: status = 'approved', creator notified
6. If rejected: status = 'changes_requested', creator notified with comment
7. Multi-approver option: "All must approve" vs "Any one can approve"
8. Approval reminder: if no action after 24h → send reminder via Resend

**Cost:** Zero (Resend free tier).

---

## LEVEL 7: Integrations & Webhooks
### Theme: Connect Caption Fox to the tools teams already use

---

### Step 40 — Zapier/Make Webhook Receiver
**What:** Accept incoming webhooks from Zapier and Make.com — enabling connections to 5,000+ apps without native integrations.

**Files:**
- `src/app/api/webhooks/zapier/route.ts` — validates signature, processes payload
- `src/app/app/settings/integrations/zapier/page.tsx` — setup guide + webhook URL

**In-app Setup:**
1. User copies their unique webhook URL from Settings > Integrations > Zapier
2. In Zapier: "Webhooks by Zapier" → their Caption Fox URL
3. Payload maps to Caption Fox actions:
   - `action: 'create_post'` → INSERT content_posts
   - `action: 'create_campaign'` → INSERT campaigns
   - `action: 'add_mention'` → INSERT brand_mentions
   - `action: 'trigger_report'` → schedule immediate report send

**Outgoing webhooks:**
- Users can configure webhook URLs to receive events FROM Caption Fox
- Events: `post.published`, `giveaway.winner_selected`, `mention.alert`, `approval.requested`

**Cost:** Zero (Zapier free plan works for basic connections).

---

### Step 41 — Google Analytics 4 Integration
**What:** Embed GA4 tracking into link-in-bio pages and track conversions back to social posts.

**Implementation:**
- `src/app/app/settings/integrations/analytics/page.tsx` — input GA4 Measurement ID
- Store `ga4_measurement_id` in workspace settings
- Public link pages (`/l/[slug]`) inject GA4 script if configured
- Track events: `page_view`, `link_click` (with link title as label)

**Bonus:** UTM parameter auto-builder in Studio post editor:
- Toggle "Add UTM tracking" → auto-appends `?utm_source={platform}&utm_medium=social&utm_campaign={campaign_name}` to any URL in the post

**Cost:** Zero (GA4 is free).

---

### Step 42 — Canva Design Button Integration
**What:** Embed Canva's editor inside Studio so users can design without leaving Caption Fox.

**Implementation:**
- Register at https://www.canva.dev/docs/design-button/ (free, requires approval)
- `src/components/studio/CanvaDesignButton.tsx`:
  ```typescript
  // Loads Canva's SDK script
  // Creates a design with preset dimensions for the selected platform
  // On publish: receives the image blob → uploads to Supabase Storage → attaches to post
  ```
- Shown in Studio > Posts > [id] > Media tab as "Design in Canva" button

**Fallback:** If Canva API not configured, show "Open Canva" link that opens canva.com in new tab with the correct template size pre-selected.

**Cost:** Zero (Canva is free for users with Canva accounts; API is free for the integration).

---

### Step 43 — Stripe Billing (Real Implementation)
**What:** Connect Stripe to actually process plan upgrades and downgrades.

**Files:**
- `src/app/api/billing/create-checkout/route.ts` — create Stripe Checkout session
- `src/app/api/billing/portal/route.ts` — redirect to Stripe Customer Portal
- `src/app/api/webhooks/stripe/route.ts` — handle subscription events
- Update `src/app/app/settings/billing/page.tsx`

**Webhook events to handle:**
- `checkout.session.completed` → UPDATE workspace plan
- `customer.subscription.updated` → plan change
- `customer.subscription.deleted` → downgrade to free
- `invoice.payment_failed` → notify + show banner

**Plan enforcement:** On every API route, check workspace.plan against the feature being used. If exceeded: return 402 with upgrade prompt.

**User provides:** Their own Stripe API keys in `.env.local` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` IDs).

**Cost:** Stripe takes 1.4% + 20p per transaction (UK). No monthly fee.

---

### Step 44 — HubSpot / CRM Webhook Output
**What:** When a lead comes in via inbox or a giveaway entry is collected, push it to HubSpot.

**Implementation:**
- `src/app/app/settings/integrations/hubspot/page.tsx` — connect HubSpot (OAuth)
- `src/lib/crm-push.ts` → `pushContact(email, name, source, workspaceId)`
- POST to HubSpot Contacts API
- Triggered: giveaway entry with email, inbox thread from new contact, UGC submission with email

**Also supports:** Any generic CRM via webhook URL (same pattern as Zapier receiver).

**Cost:** Zero (HubSpot has a free tier with API access).

---

### Step 45 — Content Approval API (External Approvers)
**What:** External stakeholders (e.g., legal, client) can approve posts via email link without needing a Caption Fox account.

**Flow:**
1. Post sent for review → system generates a secure token
2. Email sent to external approver via Resend: "Please review this post" + secure link
3. Link opens `/review/{token}` — no login required, shows post content + Approve/Reject buttons
4. Action recorded in `approvals` table
5. Creator notified of decision

**Security:** Token is UUID, 7-day expiry, single-use.

**Files:**
- `src/app/review/[token]/page.tsx` — public review page (minimal UI, no sidebar)
- `src/app/api/review/[token]/route.ts` — GET: fetch post, POST: record decision

**Cost:** Zero (Resend free tier).

---

## LEVEL 8: Link-in-Bio & Commerce
### Theme: Make link pages a revenue driver for creators

---

### Step 46 — Link Page Public Analytics
**What:** Track real view and click data on link pages — not simulated counts.

**Schema additions:**
```sql
create table public.link_page_views (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.link_pages(id) on delete cascade,
  workspace_id uuid references public.workspaces(id),
  referrer text, -- which platform sent them (extracted from UTM/referer header)
  country_code text, -- from CF-IPCountry header if on Cloudflare/Vercel
  device_type text, -- 'mobile'|'desktop'|'tablet' from User-Agent
  created_at timestamptz default now()
);

create table public.link_page_clicks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.link_pages(id) on delete cascade,
  item_id uuid references public.link_page_items(id) on delete cascade,
  workspace_id uuid references public.workspaces(id),
  referrer text,
  created_at timestamptz default now()
);
```

**In link page (`/l/[slug]`):** POST to `/api/links/track` on load (view) and on each link click.

**In analytics tab of link builder:** Real charts — views by day, clicks by link, device breakdown, referrer breakdown (Instagram/TikTok/Direct/etc.).

**Cost:** Zero.

---

### Step 47 — Link Page Templates Gallery
**What:** Pre-built link page templates that users can clone and customise.

**Files:**
- `src/app/app/links/templates/page.tsx` — gallery of 12 templates
- Each template: a complete `link_pages` + `link_page_items` config stored as JSON

**Template categories:**
- Creator (clean white, minimal)
- Brand (dark bold, full-width)
- Agency (professional navy)
- E-commerce (product-focused)
- Music (dark gradient)
- Fitness (energetic orange)

**"Use Template" flow:** Clones the template config → creates a new link page → opens builder.

**Cost:** Zero.

---

### Step 48 — A/B Testing for Link Pages
**What:** Test two versions of a link page — different headlines, button colours, or link order — and see which gets more clicks.

**Implementation:**
- "Create A/B Test" button in link builder
- Duplicates the page → Page A + Page B
- Traffic split: 50/50 by default (alternates views via cookie)
- After X views (configurable), shows winner stats
- "Declare Winner" → sets winning version as the primary page

**Schema:**
```sql
alter table public.link_pages add column if not exists
  ab_test_id uuid, -- links two pages as A/B variants
  ab_variant text; -- 'a' or 'b'
```

**Cost:** Zero.

---

### Step 49 — Product Showcase Block (E-commerce Links)
**What:** A special link item type for product listings — shows product image, name, price, and a buy button.

**New item_type: `product`**

Fields: `product_name`, `product_price`, `product_currency`, `product_image_url`, `buy_url`

**In-app (link builder):**
- "Add Product" in the AddItemDropdown
- Form: product name, price, currency, product image (upload or URL), buy URL
- Renders on public page as a product card (image left, name+price right, Buy button)

**Integration:** Optional Shopify connection (user pastes Shopify store URL + API key → we fetch their products to add directly).

**Cost:** Zero.

---

### Step 50 — UTM Link Builder
**What:** Standalone UTM parameter builder integrated into posts, campaigns, and link pages.

**Files:**
- `src/components/ui/UTMBuilder.tsx` — reusable modal component
- Accessible via: Post editor URL field, Link page item editor, Campaign settings

**Features:**
- Input: destination URL + source + medium + campaign + content + term
- Auto-preview: shows full UTM URL
- Save as preset: save common UTM combinations
- QR Code: generate QR code for the URL (using `qrcode` npm package — free, MIT)
- Copy button

**Cost:** Zero.

---

## LEVEL 9: Platform Polish & Launch
### Theme: The details that separate a £9/mo tool from a £99/mo tool

---

### Step 51 — Onboarding Flow Improvements
**What:** Make the onboarding wizard smarter — skip steps that aren't relevant, pre-fill from existing data.

**Improvements:**
- Add workspace type detection: "I'm a..." (Creator / Small Business / Brand / Agency) → skips irrelevant steps
- For Agency: jump straight to multi-brand setup
- For Creator: skip brand guidelines, jump to content calendar setup
- Import existing content: "Connect your Instagram/TikTok to see your existing posts in the calendar" (coming soon state)
- Progress auto-save: if user closes mid-wizard, resumes where they left off
- Video: 90-second onboarding video embed on the Welcome step (YouTube embed — free)

**Cost:** Zero.

---

### Step 52 — In-App Changelog & What's New
**What:** Show users new features as they're released, inside the app.

**Files:**
- `src/app/app/changelog/page.tsx` — full changelog page
- `src/components/ui/WhatsNewBanner.tsx` — shows once per user per release

**Schema:**
```sql
create table public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  description text,
  features jsonb default '[]', -- [{ title, description, badge: 'new'|'improved'|'fixed' }]
  published_at timestamptz default now()
);

create table public.changelog_reads (
  user_id uuid references public.profiles(id),
  changelog_id uuid references public.changelog_entries(id),
  read_at timestamptz default now(),
  primary key (user_id, changelog_id)
);
```

**In-app:**
- "What's New" bell in nav → shows unread count
- Banner on first login after release: "We shipped X new things. See what's new →"

**Cost:** Zero.

---

### Step 53 — Help Centre (In-App)
**What:** Built-in help documentation so users never need to leave to find answers.

**Files:**
- `src/app/help/page.tsx` — searchable help centre
- `src/app/help/[category]/[article]/page.tsx` — article pages
- `src/components/ui/HelpButton.tsx` — floating "?" button on every app page

**Content structure:**
```
Getting Started/
  - Setting up your workspace
  - Connecting social channels
  - Creating your first post
Campaigns/
  - How to run a giveaway
  - Setting up competitions
  - UGC campaign best practices
Fox AI/
  - How to get the best captions
  - AI safety rules explained
  - Image generation guide
Analytics/
  - Reading your dashboard
  - Scheduled reports setup
  - Competitor tracking
Agency/
  - Setting up client workspaces
  - Role-based permissions guide
  - White-label configuration
```

**Search:** Full-text search across all articles using Supabase `tsquery`.

**Cost:** Zero.

---

### Step 54 — SEO & Marketing Page Optimisation
**What:** Ensure every public page is properly SEO-optimised to drive organic traffic.

**Files to update:**
- `src/app/layout.tsx` — global metadata
- Every marketing page: `/`, `/pricing`, `/features`, `/contact` — add `generateMetadata()`

**Schema for each page:**
```typescript
export const metadata: Metadata = {
  title: 'Caption Fox — Run Campaigns, Not Just Posts',
  description: '...',
  openGraph: { title, description, images: ['/og-image.png'] },
  twitter: { card: 'summary_large_image', ... },
  alternates: { canonical: 'https://captionfox.com/...' },
}
```

**New pages to create:**
- `/blog` — static blog (MDX files) for SEO — "How to run a giveaway on Instagram" etc.
- `/compare/caption-fox-vs-buffer` — comparison landing page
- `/compare/caption-fox-vs-later` — comparison landing page
- `/compare/caption-fox-vs-hootsuite` — comparison landing page
- `/use-cases/agencies` — agency-specific landing
- `/use-cases/creators` — creator-specific landing

**Cost:** Zero.

---

### Step 55 — Performance Audit & Core Web Vitals
**What:** Measure and fix page performance before launch.

**Tasks:**
- Run Lighthouse on all major pages
- Lazy load all heavy components (recharts, Canva SDK)
- Image optimization: ensure all uploaded images go through Next.js `<Image>`
- Bundle analysis: `npx @next/bundle-analyzer` — identify and code-split large deps
- Supabase query audit: add `.limit()` to every unbounded query
- Add `loading.tsx` to every app route (Next.js built-in skeleton)
- Add `error.tsx` to every app route (error recovery)

**Target metrics:**
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

**Cost:** Zero (all tooling is free).

---

### Step 56 — Production Deployment Checklist
**What:** Everything needed to go live on a real domain.

**Infrastructure checklist:**
- [ ] Vercel deployment (or Netlify) — set env vars in dashboard
- [ ] Supabase: enable production mode, set up backup schedule
- [ ] Resend: verify custom sending domain (e.g., notifications@captionfox.com)
- [ ] Stripe: live mode API keys + webhook endpoint registered
- [ ] Error monitoring: Sentry free tier (5K errors/month) — `npm install @sentry/nextjs`
- [ ] Uptime monitoring: Better Uptime free tier (20 monitors)
- [ ] Domain: Set up captionfox.com with DNS → Vercel
- [ ] SSL: auto-provisioned by Vercel
- [ ] Rate limiting: Vercel Edge Config or Upstash Redis free tier

**Security checklist:**
- [ ] All API routes have auth checks (`supabase.auth.getUser()`)
- [ ] All Supabase tables have RLS enabled
- [ ] No secrets in client-side code (`NEXT_PUBLIC_` prefix only for public values)
- [ ] CORS configured for API routes
- [ ] CSP headers set in `next.config.js`
- [ ] `.env.local` excluded from git (check `.gitignore`)

**Launch checklist:**
- [ ] Seed database with 5 demo accounts across all plan tiers
- [ ] Test full user journey: signup → onboarding → create post → publish
- [ ] Test billing: upgrade, downgrade, cancel
- [ ] Test all AI routes with real API keys
- [ ] Test email sending via Resend
- [ ] Load test: simulate 100 concurrent users (use `k6` — free)

**Cost:** Vercel free tier (Hobby plan) handles launch traffic. Upgrade to Pro ($20/mo) when needed.

---

## Summary: Total Ongoing Cost at Launch

| Service | Free Tier | Cost at Scale |
|---|---|---|
| Supabase | 500MB DB, 2GB storage, 500K Edge invocations | $25/mo (Pro) |
| Vercel | Hobby free; Pro $20/mo | $20/mo |
| Anthropic (Claude Haiku) | Pay as you go | ~$5–50/mo depending on usage |
| Resend | 3K emails/mo free | $20/mo (50K emails) |
| Hugging Face | Free (rate-limited) | $0 |
| Pexels/Pixabay/Unsplash | Free | $0 |
| Reddit/YouTube/News RSS | Free | $0 |
| Telegram | Free | $0 |
| Sentry | 5K errors/mo free | $0 |
| **Total at launch** | | **~$0–$50/mo** |
| **Total at 1,000 customers** | | **~$200–400/mo** |

---

## Build Order (Recommended)

Priority is determined by: revenue unlock > customer retention > new customer acquisition.

**Sprint 1 (Steps 1–6):** Platform hardening — do this before anything else
**Sprint 2 (Steps 7–13 + 28):** Social Listening + email reports — biggest revenue unlock (Team tier)
**Sprint 3 (Steps 14–18 + 33):** AI upgrades + permission enforcement — Pro tier justification
**Sprint 4 (Steps 21–27):** Inbox expansion — Telegram + WhatsApp + email threads
**Sprint 5 (Steps 34–39):** Agency features — white label, client portal, multi-workspace
**Sprint 6 (Steps 40–45):** Integrations — Zapier, Stripe, Canva, Slack
**Sprint 7 (Steps 46–50):** Link-in-Bio commerce — creator segment
**Sprint 8 (Steps 51–56):** Polish + launch

---

*This document covers the complete Caption Fox build to commercial launch. Each step is self-contained and additive — no step breaks what came before. Total estimated build time with parallel agents: 14 weeks.*
