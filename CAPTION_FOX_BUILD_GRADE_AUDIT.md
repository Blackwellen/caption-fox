# Caption Fox Build-Grade Product Audit

**Company:** Blackwellen  
**Product:** Caption Fox  
**Repo:** `caption-fox-final-release-v.1.0`  
**Audit date:** 2026-06-13  
**Updated:** 2026-06-29 — Sections 1–18 are the original 2026-06-13 audit and are preserved for history. **Section 20 reconciles them with current reality** (production is now live on Vercel; build passes; some risks resolved, others confirmed). See also Section 19 (commercial-depth & copilot audit), Section 21 (navigation & information-architecture audit), and Section 22 (commercial gaps vs best-in-class + enterprise readiness).  
**Auditor role:** Senior CTO + product engineer  
**Target stack assumption:** Next.js/React, Supabase, Stripe, email provider, RLS tenant isolation

---

## 1. Executive Summary

Caption Fox is positioned as a social media operating system for creators, brands, small businesses, and agencies. It aims to combine AI content generation, content planning, campaign management, approvals, UGC workflows, social inbox, analytics, social listening, scheduled reports, and link-in-bio tools in one workspace.

The repo is significantly more than a static prototype. It contains a full Next.js app, Supabase auth wiring, a large Supabase schema, many authenticated app routes, public marketing pages, admin pages, legal pages, AI API routes, and direct Supabase CRUD flows across multiple modules.

However, it is not launch-ready as a paid production SaaS. The current build reality is best described as a broad, partially wired SaaS shell with several real CRUD workflows, many premium UI surfaces, and several major production gaps around billing, tenant consistency, missing schema resources, social integrations, background jobs, email delivery, quality gates, and launch compliance.

### What The Product Can Do Today

- Present a public marketing website, pricing page, feature page, legal pages, contact page, and auth screens.
- Sign users up and log users in through Supabase Auth.
- Protect `/app`, `/admin`, and `/onboarding` routes from unauthenticated users.
- Create a workspace during onboarding.
- Display a complete app shell with sidebar, top navigation, and AI assistant bubble.
- Use Supabase-backed data for many app modules.
- Generate AI captions, hooks, scripts, hashtags, ideas, UGC briefs, and image prompts through authenticated API routes when required env vars are present.
- Store many product entities in Supabase tables, including workspaces, brands, campaigns, content posts, campaign tasks, UGC briefs, creators, inbox threads, link pages, listening keywords, reports, and support tickets.
- Provide UI for content studio, calendar, campaigns, UGC, inbox, analytics, social listening, link-in-bio, settings, permissions, billing, and admin support.
- Provide a large schema with RLS policies for most workspace-scoped resources.

### Who It Is Suitable For Today

Today, Caption Fox is suitable for internal demos, founder demos, product walkthroughs, and limited controlled beta testing with known users. It is not yet suitable for public self-serve paid launch because billing, plan enforcement, onboarding persistence, data isolation verification, integrations, and release quality gates are incomplete.

### Top 5 Risks Blocking Launch

1. **Release quality gate failure:** `npm run lint` fails with 443 problems, including 183 errors.
2. **Build confidence gap:** `npx tsc --noEmit` passes, but `npm run build` did not complete within a 2 minute test window.
3. **Commercial wiring gap:** Stripe checkout, billing portal, invoices, cancellation, webhooks, trials, and plan enforcement are not production-wired.
4. **Backend mismatch risk:** Code references resources not clearly present in the schema, including `ai_usage_logs`, `competition_judge_scores`, and storage bucket `assets`.
5. **Tenant/workspace consistency risk:** Some creation flows still use placeholder workspace IDs, which blocks real multi-tenant operation.

### Launch Readiness Effort Band

| Area | Effort Band | Reason |
|---|---:|---|
| Fix lint/build blockers | M | Many files affected, but mostly quality and rule compliance |
| Tenant/workspace correctness | M | Needs shared workspace context and replacement of placeholder IDs |
| Stripe billing | M/L | Requires API routes, webhooks, DB sync, portal, plan gates, testing |
| Onboarding completion | S/M | Existing UI exists; persistence needs completing |
| Schema/code alignment | M | Need migrations for missing tables/buckets or code changes |
| Social integrations/publishing | L | Real OAuth/API integrations and background jobs are not trivial |
| Compliance/security hardening | M/L | Requires RLS tests, audit logs, storage policy review, legal docs |
| Beta-ready launch | M | Possible with reduced scope |
| Public paid launch | L | Requires commercial, support, legal, and reliability completion |

---

## 2. Market And Positioning

### One-Sentence Positioning

Caption Fox helps creators, brands, small businesses, and agencies create, organize, approve, schedule, and measure social content from one AI-assisted workspace.

### Target Customer Segments

| Segment | Industry | Company Size | Primary Roles |
|---|---|---:|---|
| Solo creators | Creator economy, influencers, educators, coaches | 1 person | Creator, influencer, founder |
| Small businesses | Ecommerce, beauty, food, fitness, local services, SaaS | 1-20 employees | Founder, social media manager, marketing assistant |
| Growing brands | Consumer, ecommerce, services, SaaS | 20-100 employees | Marketing manager, content lead, brand manager |
| Agencies | Social media, creative, digital marketing | 2-50 employees | Agency owner, account manager, content strategist |
| UGC-heavy teams | DTC, ecommerce, beauty, fitness, apps | 5-100 employees | UGC manager, influencer manager, growth marketer |

### Top 3 Painful Problems

1. **Content operations are scattered.** Teams plan in spreadsheets, write in docs, approve in DMs, schedule in separate tools, and report manually.
2. **Producing consistent content is slow.** Captions, hooks, hashtags, campaign assets, brand voice, and UGC briefs take repeated manual work.
3. **Proving performance is difficult.** Campaigns, UGC activity, inbox activity, competitor performance, and analytics are not connected to a clear operating dashboard.

### Why Caption Fox Can Win

- It goes beyond a basic caption generator by combining planning, campaign execution, UGC, analytics, inbox, listening, and link-in-bio.
- It can give immediate value in a demo: create brand voice, generate content, schedule posts, build a link page, and show campaign/analytics workflows.
- The data model already anticipates agency/team needs, including workspaces, members, roles, campaigns, approvals, audit logs, subscriptions, support tickets, reports, and competitor/listening data.
- The strongest sellable wedge is an AI-assisted content operations workspace for small teams that do not want several separate tools.

### Must-Have Workflows That Prove Value In First 10 Minutes

1. User signs up and creates workspace.
2. User creates a brand profile with voice and brand guidelines.
3. User generates 3 platform-specific captions from a product or campaign idea.
4. User saves one generated caption as a draft content post.
5. User schedules the post on the calendar.
6. User creates a campaign and links the post to it.
7. User creates a link-in-bio page and adds one CTA link.
8. User sees dashboard stats update from the created data.
9. User sees a clear upgrade prompt or trial state.
10. User can export or share something useful, such as a campaign plan, content calendar, or link page.

---

## 3. Product Scope And Build Reality

### What Exists Today

#### Application Structure

- Next.js app in `src/app`.
- Public routes:
  - `/`
  - `/features`
  - `/pricing`
  - `/contact`
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/cookie-policy`
  - `/l/[slug]`
- Auth routes:
  - `/login`
  - `/signup`
  - `/forgot-password`
  - `/reset-password`
  - `/verify-email`
  - `/mfa`
  - `/callback`
- Protected app routes:
  - `/app/home`
  - `/app/studio`
  - `/app/studio/posts/[id]`
  - `/app/studio/brands/[id]`
  - `/app/studio/templates`
  - `/app/studio/hashtags`
  - `/app/calendar`
  - `/app/campaigns`
  - `/app/campaigns/[id]`
  - `/app/campaigns/[id]/tasks`
  - `/app/campaigns/[id]/analytics`
  - `/app/campaigns/giveaways`
  - `/app/campaigns/giveaways/[id]`
  - `/app/campaigns/competitions`
  - `/app/campaigns/competitions/[id]`
  - `/app/ugc`
  - `/app/ugc/[id]`
  - `/app/ugc/creators/[id]`
  - `/app/inbox`
  - `/app/inbox/threads/[id]`
  - `/app/analytics`
  - `/app/analytics/posts/[id]`
  - `/app/analytics/competitors`
  - `/app/analytics/reports`
  - `/app/listening`
  - `/app/links`
  - `/app/links/[id]`
  - `/app/links/[id]/analytics`
  - `/app/links/[id]/public`
  - `/app/settings`
  - `/app/settings/billing`
  - `/app/settings/permissions`
- Admin routes:
  - `/admin`
  - `/admin/users`
  - `/admin/workspaces`
  - `/admin/support`

#### API Routes

- `src/app/api/ai/generate/route.ts`
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/image/route.ts`

These routes authenticate the user with Supabase before running AI logic. There are no found Stripe routes, webhook routes, email routes, social OAuth routes, or Supabase edge functions in the current file list.

#### Supabase Schema

The repo includes `supabase/schema.sql`, which defines approximately 50 public tables and many RLS policies. The schema is broad and ambitious. It supports:

- Profiles and workspaces.
- Workspace membership.
- Brands, brand voices, brand guidelines.
- Social channels.
- Campaigns and campaign tasks.
- Content posts, versions, comments, publishing queue.
- Content templates and content ideas.
- Hashtag sets.
- Media assets.
- AI generations.
- Approvals.
- UGC briefs, creators, submissions, payments.
- Competitor tracking.
- Integrations and webhook logs.
- Inbox threads, messages, saved replies.
- Post and channel analytics.
- Notifications and audit logs.
- Subscriptions.
- Support tickets.
- Listening keywords, brand mentions, listening alerts.
- Giveaways and giveaway entries.
- Competitions, submissions, judges.
- Competitor profiles and snapshots.
- Scheduled reports and report history.
- Link pages and link page items.
- Storage buckets: `media`, `avatars`, `brand-assets`.

### What Is Demo Only Or UI Without Production Wiring

| Area | Current Reality |
|---|---|
| Stripe billing | Billing page uses demo invoices and simulated redirect modals. No found Stripe checkout, portal, or webhook API routes. |
| Plan enforcement | Pricing exists, but feature gates and hard limits are not consistently enforced. |
| Onboarding | Workspace is saved; brand, voice, channels, goals, and generated calendar are largely local UI state. |
| Social channel connection | UI implies social account connection, but OAuth/connectors are not production-wired. |
| Social publishing | Tables exist for posts and publishing queue, but no real social platform publish worker was found. |
| Inbox replies | Inbox UI exists, but code comments indicate production social API sending is not wired. |
| Social listening | Tables and UI exist, but ingestion edge functions are planned, not found. |
| Scheduled reports | Tables and UI exist, but email/report sending infrastructure is missing. |
| Competitor refresh | Some competitor refresh behavior is simulated. |
| Analytics | Some analytics surfaces are backed by tables, while several dashboard/display areas use demo or computed placeholder data. |
| Support replies | Support ticket management exists, but outbound email reply delivery is not clearly wired. |
| Email notifications | No production email provider integration found. |
| Audit trail coverage | `audit_logs` exists, but not all critical mutations appear to write logs. |
| Backups/export/delete | No clear user-facing export, deletion, or backup policy implementation found. |

### Missing But Assumed

- Stripe checkout session route.
- Stripe customer portal route.
- Stripe webhook route.
- Subscription sync logic.
- Plan limit enforcement.
- Email provider integration.
- Transactional email templates.
- Invite acceptance flow completion.
- Background jobs or Supabase Edge Functions.
- Social OAuth flows.
- Publishing workers.
- Webhook receivers for social, email, Zapier/Make, Slack, or Telegram.
- Rate limiting for AI/API routes.
- Central tenant/workspace context provider.
- Robust env var validation.
- Error boundaries.
- Observability/logging.
- Test suite.
- Release checklist.
- Data export/deletion policy.
- Backup/disaster recovery plan.
- Product-specific legal disclaimers.

---

## 4. Architecture Map

### Frontend Structure

| Area | Paths | Notes |
|---|---|---|
| Public marketing | `src/app/page.tsx`, `features`, `pricing`, `contact` | Rich marketing UI; claims should be aligned to actual wired features before launch. |
| Legal | `src/app/legal/*` | Present, but needs review and product-specific compliance text. |
| Auth | `src/app/(auth)/*` | Supabase auth-based flows exist. |
| App shell | `src/app/app/layout.tsx`, `src/components/layout/*` | Sidebar, top nav, AI bubble. |
| Home dashboard | `src/app/app/home/page.tsx` | Uses Supabase counts and workspace data. |
| Studio | `src/app/app/studio/*` | AI content creation, posts, brand pages, templates, hashtags. |
| Calendar | `src/app/app/calendar/page.tsx` | Content post scheduling/approval states. |
| Campaigns | `src/app/app/campaigns/*` | Campaign list/detail/tasks/analytics/giveaways/competitions. |
| UGC | `src/app/app/ugc/*` | Briefs, creators, submissions. Placeholder workspace ID risk in main UGC page. |
| Inbox | `src/app/app/inbox/*` | Threads/messages/saved replies; social sending not wired. |
| Analytics | `src/app/app/analytics/*` | Analytics, post detail, competitor analysis, scheduled reports. |
| Listening | `src/app/app/listening/page.tsx` | Listening keywords/mentions/alerts UI. |
| Links | `src/app/app/links/*`, `src/app/l/[slug]` | Link-in-bio builder and public route. |
| Settings | `src/app/app/settings/*` | Workspace/profile/team/integrations/billing/permissions. |
| Admin | `src/app/admin/*` | Platform admin, workspaces, users, support. |

### Backend Structure

#### Supabase Tables

The schema is broad and includes the main entities needed for a real SaaS. The biggest backend issue is not schema ambition. It is alignment between schema, generated TypeScript types, and the actual code paths.

Known mismatch examples:

- `src/app/api/ai/chat/route.ts` writes to `ai_usage_logs`; schema appears to describe AI usage as merged into `ai_generations`.
- Code references `post_platform_versions`; TypeScript types include it, but the table was not found in the scanned schema output.
- Code references `competition_judge_scores`; this table was not found in the scanned schema output.
- Settings uploads use storage bucket `assets`, but the schema creates `media`, `avatars`, and `brand-assets`.

These mismatches can cause runtime failures even when TypeScript passes.

#### Storage Buckets

Schema creates:

- `media`
- `avatars`
- `brand-assets`

Code also references:

- `assets`

That should be corrected by either creating the `assets` bucket with secure policies or changing settings uploads to use `avatars` and `brand-assets`.

#### Edge Functions

No `supabase/functions` files were found in the file list. The implementation plan references functions such as:

- `ingest-mentions`
- `send-report`
- `trigger-alerts`
- `process-webhook`

These are planned, not implemented in the current repo.

### Auth And Tenancy Model

Current auth:

- Supabase Auth is used.
- Middleware calls `supabase.auth.getUser()`.
- Unauthenticated users are redirected away from protected `/app`, `/admin`, and `/onboarding` routes.
- Authenticated users are redirected away from auth pages.

Current tenancy:

- `workspaces` are owned by `owner_id`.
- `workspace_members` maps users to workspaces.
- Most RLS policies scope workspace resources to workspaces where the current user is a member.
- Many screens fetch the first workspace membership for the current user.

Risks:

- `src/app/app/layout.tsx` fetches workspace by `owner_id`, which can miss workspaces where the user is a member but not owner.
- Some flows use placeholder workspace IDs.
- There is no central workspace selection/provider that all routes consistently use.
- RLS must be tested with multiple users and multiple workspaces before launch.

### Billing Model

Schema includes:

- `subscriptions`
- `workspaces.plan`
- `workspaces.plan_status`
- Stripe customer/subscription fields.

UI includes:

- Public pricing page.
- Onboarding plan selection.
- Billing settings page.

Not found:

- Stripe checkout API route.
- Stripe billing portal API route.
- Stripe webhook API route.
- Stripe product/price ID mapping.
- Subscription entitlement enforcement.
- Trial activation and expiry enforcement.
- Invoice syncing.

Current billing should be treated as UI/demo only.

---

## 5. Feature Inventory

| Feature / Module | Current Status | Main Code Areas | Tables / Backend | Known Issues |
|---|---|---|---|---|
| Public homepage | Partially working | `src/app/page.tsx` | None | Marketing claims may exceed wired product reality. |
| Features page | UI only / marketing | `src/app/features/page.tsx` | None | Feature mockups are presentation assets. |
| Pricing page | UI only | `src/app/pricing/page.tsx` | None | Pricing not aligned with billing/onboarding plans. |
| Contact form | Partially working | `src/app/contact/page.tsx` | `support_tickets` | Needs email notification and spam protection. |
| Legal pages | Present | `src/app/legal/*` | None | Needs real legal review and product-specific disclaimers. |
| Signup/login | Partially working | `src/app/(auth)/*` | Supabase Auth, `profiles` | Needs full verification of email flows and MFA. |
| Middleware route protection | Working basic | `src/middleware.ts` | Supabase Auth | Protects broad routes; role/tenant checks still page-specific. |
| Onboarding | Partially working | `src/app/onboarding/page.tsx` | `workspaces` | Only workspace creation is persisted. |
| App shell | Working basic | `src/app/app/layout.tsx` | `profiles`, `workspaces` | Workspace fetch uses owner lookup, not membership context. |
| Home dashboard | Partially working | `src/app/app/home/page.tsx` | posts, campaigns, inbox, ideas, approvals, audit logs | Depends on seeded/real data; audit coverage incomplete. |
| AI generation | Partially working | `src/app/api/ai/generate/route.ts` | `ai_generations` | Needs env validation, rate limits, plan limits, usage tracking. |
| AI chat | Risky partial | `src/app/api/ai/chat/route.ts` | `ai_usage_logs` referenced | Table mismatch risk. |
| AI image prompt/image | Partially working | `src/app/api/ai/image/route.ts` | `ai_generations`, Stability API optional | Uses Stability if key exists; storage/persistence of generated image not complete. |
| AI assistant bubble | Partial | `src/components/fox-ai/FoxAIBubble.tsx` | API route | Lint hook error found. |
| Studio create flow | Partial | `src/app/app/studio/page.tsx` | `content_posts`, `post_platform_versions`, `media_assets`, `ai_generations` | Placeholder IDs and schema mismatch risks. |
| Post editor | Partial | `src/app/app/studio/posts/[id]/page.tsx` | `content_posts`, `post_platform_versions`, `approvals`, `audit_logs`, `media_assets` | `post_platform_versions` schema mismatch risk. |
| Brands | Partial | `src/app/app/studio/brands/[id]/page.tsx` | brands, voice, guidelines, channels, templates, hashtags, members | Good breadth, needs workspace/permission verification. |
| Templates | Partial | `src/app/app/studio/templates/page.tsx` | `content_templates`, `brands` | CRUD-like behavior appears wired. |
| Hashtags | Partial | `src/app/app/studio/hashtags/page.tsx` | `hashtag_sets`, `brands` | Needs validation and AI research realism. |
| Calendar | Partial | `src/app/app/calendar/page.tsx` | `content_posts`, `approvals`, `workspace_members` | Scheduling is DB state; social publishing not wired. |
| Campaigns | Partial | `src/app/app/campaigns/page.tsx` | `campaigns`, `giveaways`, `competitions` | New campaign insert uses placeholder workspace ID. |
| Campaign detail | Partial | `src/app/app/campaigns/[id]/*` | campaigns, posts, tasks, audit logs | Needs permission checks, audit writes, real analytics. |
| Campaign tasks | Partially working | `src/app/app/campaigns/[id]/tasks/page.tsx` | `campaign_tasks`, `workspace_members` | Useful CRUD module. |
| Giveaways | Partial | `src/app/app/campaigns/giveaways/*` | `giveaways`, `giveaway_entries` | Needs legal terms, fraud controls, public entry workflow verification. |
| Competitions | Partial / risky | `src/app/app/campaigns/competitions/*` | `competitions`, `competition_submissions`, `competition_judges` | References `competition_judge_scores`, not found in schema. |
| UGC | Partial | `src/app/app/ugc/*` | `ugc_briefs`, `ugc_creators`, `ugc_submissions` | Main page uses placeholder workspace ID. |
| Inbox | Partial | `src/app/app/inbox/*` | `inbox_threads`, `inbox_messages`, `saved_replies`, `social_channels` | Sending to external social APIs is not wired. |
| Analytics | Partial | `src/app/app/analytics/*` | `post_analytics`, `channel_analytics`, `campaigns`, posts | Some demo/static data remains. |
| Competitor analysis | Partial | `src/app/app/analytics/competitors/page.tsx` | `competitor_profiles`, `competitor_snapshots` | Refresh can be simulated/manual, not real platform ingest. |
| Scheduled reports | Partial | `src/app/app/analytics/reports/page.tsx` | `scheduled_reports`, `report_history` | No email sending function found. |
| Social listening | Partial | `src/app/app/listening/page.tsx` | `listening_keywords`, `brand_mentions`, `listening_alerts` | No ingestion edge functions found. |
| Link-in-bio builder | Partial / likely usable | `src/app/app/links/*` | `link_pages`, `link_page_items` | Needs public tracking and slug/security validation. |
| Public link page | Partial / likely usable | `src/app/l/[slug]/page.tsx` | `link_pages`, `link_page_items` | Needs analytics/click tracking verification. |
| Settings | Partial | `src/app/app/settings/page.tsx` | profiles, workspaces, members, channels, invitations, integrations, audit logs | Uses missing `assets` bucket. |
| Permissions | Partial | `src/app/app/settings/permissions/page.tsx` | `workspace_members`, `audit_logs` | Needs strict enforcement across pages, not just UI. |
| Billing settings | UI only / partial DB | `src/app/app/settings/billing/page.tsx` | `subscriptions`, `workspaces` | Stripe is simulated. |
| Admin dashboard | Partial | `src/app/admin/*` | profiles, workspaces, support tickets | Needs hardening and real support reply delivery. |

---

## 6. Commercial And Revenue

### Current Pricing Reality

There are three plan definitions competing with each other:

1. Public pricing page:
   - Free
   - Starter
   - Pro
   - Team
   - Agency
   - Enterprise

2. Onboarding:
   - Starter
   - Creator Pro
   - Team

3. Billing settings:
   - Starter
   - Creator Pro
   - Team
   - Brand
   - Enterprise

This must be consolidated before launch.

### Recommended Launch Pricing

For a fast, credible founder-led launch:

| Tier | Price | Target User | Core Limits |
|---|---:|---|---|
| Free | £0/mo | Solo trial users | 1 brand, low AI limit, limited posts |
| Creator Pro | £29/mo | Creators and solo marketers | 3 brands, AI generation, calendar, link page |
| Team | £79/mo | Small teams and brands | 10 brands, 5 seats, approvals, campaigns, UGC, reports |
| Agency Beta | £149/mo | Small agencies | More workspaces/brands, client reporting, priority support |

Avoid selling Enterprise until SSO, audit logging, DPA, SLA, support process, billing, and security posture are much stronger.

### Expected ACV / ARPU

| Segment | Expected Monthly ARPU | Expected ACV |
|---|---:|---:|
| Creator Pro | £29 | £348 |
| Team | £79 | £948 |
| Agency Beta | £149 | £1,788 |
| Assisted agency/custom | £249-£499 | £2,988-£5,988 |

### Sales Motion

Recommended initial motion:

- Founder-led assisted self-serve.
- Product demo first, Stripe payment second.
- Start with 5-20 beta users.
- Avoid a broad public launch until core workflows and billing are stable.

### Day-1 Launch Offer

Sell:

> "Caption Fox Beta: set up your brand voice, generate a 30-day social content calendar, manage campaigns and approvals, and publish a simple link-in-bio page from one workspace."

Do not sell yet:

- Fully automated social publishing.
- Enterprise compliance.
- Guaranteed inbox automation.
- Fully automated social listening.
- Payment rails for creators.
- White-label agency reporting unless verified.

### Sales Readiness Blockers

- Pricing mismatch across public/onboarding/billing pages.
- Stripe not wired.
- No clean demo workspace seed script.
- Lint/build failure.
- Missing demo video.
- Missing support process.
- Missing legal/product disclaimers.
- Incomplete onboarding persistence.
- No public changelog or release status.

---

## 7. Security, Quality, And Compliance

### Required Security Standard

For launch, Caption Fox should target a practical SaaS baseline:

- Supabase RLS enforced and tested.
- No service role key exposed to client.
- Authenticated API routes for all private actions.
- Workspace-scoped reads/writes everywhere.
- Storage policies reviewed.
- Audit logs for sensitive operations.
- Rate limits for AI and public forms.
- Secure webhook signature verification.
- Clear backup/export/delete processes.

For larger teams/agencies later:

- SOC 2 readiness practices.
- DPA and subprocessors.
- Formal incident response.
- Access review process.
- SSO/SAML only after enterprise readiness.

### RLS / Tenant Isolation Status

Positive:

- Most tables enable RLS.
- Many policies scope access to `workspace_members`.
- Profiles are self-scoped.
- Admin platform access exists via `is_platform_admin`.

Risks:

- Placeholder workspace IDs will break tenancy.
- Some public token/insert policies are intentionally broad and need review.
- Storage public read is convenient but must be intentional.
- Membership role checks are inconsistent across UI and mutations.
- Direct client-side mutations rely heavily on RLS correctness.

### Audit Logging Needs

Audit logs should be written for:

- Workspace creation/update/delete.
- Member invite, role change, removal.
- Billing plan changes.
- Subscription cancellation.
- Brand voice/guideline changes.
- Content approval/rejection.
- Post publish/schedule/delete.
- Integration connect/disconnect.
- Giveaway winner selection/disqualification.
- Competition judge scoring changes.
- Support admin status changes.
- Data export/deletion requests.

### Backup And Data Export / Deletion Policy

Missing policy should be defined before launch:

- Daily Supabase backup confirmation.
- User workspace export: posts, campaigns, UGC, analytics, link pages, team metadata.
- User deletion: delete profile and cascade owned workspaces only after confirmation.
- Workspace deletion: soft-delete period or explicit irreversible deletion warning.
- Media deletion from storage when records are deleted.
- Retention policy for audit logs, webhook logs, support tickets, and AI generations.

### Product-Specific Legal Disclaimers

Needed before launch:

- AI content disclaimer: generated copy may be inaccurate and must be reviewed.
- Social platform disclaimer: Caption Fox is not affiliated with Meta, TikTok, X, YouTube, LinkedIn, Pinterest, or other platforms.
- Giveaway/competition disclaimer: users are responsible for complying with local laws and platform rules.
- UGC disclaimer: contracts, rights, and creator payments are user responsibility unless explicitly handled by Caption Fox.
- Analytics disclaimer: metrics may differ from platform-native analytics.
- Social listening disclaimer: data availability depends on platform access and API limitations.
- Privacy policy: include AI providers, Supabase, hosting, analytics, email provider, payment provider.
- DPA: needed for team/agency customers handling client data.

---

## 8. QA And Release Readiness

### Verification Performed

| Command | Result |
|---|---|
| `npx tsc --noEmit --pretty false` | Passed |
| `npm run lint -- --format stylish` | Failed |
| `npm run build` | Timed out after 2 minutes |

### Lint Status

`npm run lint` returned:

- 443 problems.
- 183 errors.
- 260 warnings.

Examples of high-signal lint/build risks:

- Invalid hook use in MFA page.
- Invalid hook use in `FoxAIBubble`.
- Many `react-hooks/set-state-in-effect` errors.
- Many `react/no-unescaped-entities` errors.
- Some Next.js navigation rule errors.
- Many unused imports/variables.
- Some `any` type usage errors.

### Browser / Device Matrix Risks

Needs testing on:

- Desktop Chrome.
- Desktop Safari.
- Desktop Edge.
- iPhone Safari.
- Android Chrome.
- Tablet width.

High-risk UI areas:

- Large tables and dashboards.
- Campaign detail pages.
- UGC detail pages.
- Competition/giveaway management.
- Studio editor.
- Billing plan cards.
- Public pricing page.
- Link-in-bio public pages.

### Performance Risks

- Large client components.
- Many direct Supabase calls in page components.
- Heavy dashboards without pagination.
- Large data tables and repeated queries.
- No clear caching/revalidation strategy.
- Potential slow build due to large route tree and Next.js 16 behavior.

### Observability Gaps

Missing or not found:

- Error boundary system.
- Server-side error logging.
- Client error reporting.
- Request IDs.
- Webhook logs for real webhooks.
- AI usage dashboard.
- Billing event monitoring.
- Background job status views.

---

## 9. Product Projects And Build Pipeline

### Project 1: Initial Build

#### Current State

Screens/routes exist for public site, auth, onboarding, app shell, home, studio, calendar, campaigns, UGC, inbox, analytics, settings, billing, and admin.

Backend tables exist for most core concepts.

Wired:

- Auth.
- Workspace insert.
- Many Supabase reads/writes.
- AI generation routes.
- Link page reads/writes.

Placeholder/missing:

- Full onboarding persistence.
- Stripe.
- Email.
- Social integrations.
- Plan enforcement.
- Consistent tenant context.

#### Target State

The first user journey must work end-to-end:

Signup -> onboarding -> workspace -> brand profile -> AI generation -> saved post -> scheduled calendar item -> dashboard update.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Fix release lint blockers | Frontend | Critical | M | `npm run lint` exits 0. |
| Prove production build | Frontend | Critical | M | `npm run build` exits 0 in local and deployment environment. |
| Add central workspace context | Backend | Critical | M | All app pages resolve active workspace from membership, not owner-only or placeholder values. |
| Persist onboarding brand | Backend | High | S | Step 5 creates `brands` record for active workspace. |
| Persist onboarding voice | Backend | High | S | Step 6 creates `brand_voice_profiles`. |
| Persist onboarding channels | Backend | Medium | S | Step 7 creates placeholder `social_channels` records marked disconnected/manual. |
| Save generated calendar | Backend | High | M | Step 9 creates `content_posts` drafts/scheduled records. |
| Add demo seed script | Backend | High | M | Demo account has workspace, brands, posts, campaigns, UGC, analytics, links. |
| Align env vars | Backend | Critical | S | `.env.local.example` includes all required/optional vars. |
| Add runtime env validation | Backend | High | S | Missing required envs fail with clear error. |

### Project 2: Upgrade Depth Build

#### Target State

Core modules feel operational, not just present.

Must-have deliverables:

- Content studio saves posts and platform versions reliably.
- Calendar supports draft/scheduled/approved/published states.
- Campaigns link posts, tasks, budgets, and analytics.
- UGC briefs, creators, submissions work by workspace.
- Inbox supports internal reply drafting.
- Links builder supports create/edit/publish/analyze.
- Analytics dashboards do not break when data is empty.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Replace placeholder campaign workspace IDs | Backend | Critical | S | Creating campaign records uses active workspace ID. |
| Replace placeholder UGC workspace IDs | Backend | Critical | S | Creating UGC briefs/creators uses active workspace ID. |
| Fix `post_platform_versions` schema alignment | Supabase | Critical | M | Table exists in migration or code uses existing schema table. |
| Fix `competition_judge_scores` alignment | Supabase | Critical | M | Competition judging no longer references missing table. |
| Fix `ai_usage_logs` alignment | Supabase | High | S | Chat route writes to existing table or migration creates table. |
| Fix storage `assets` bucket mismatch | Supabase | High | S | Settings uploads use existing bucket or migration creates `assets`. |
| Add empty/error/loading states consistently | UI | High | M | All main modules handle no data, loading, and Supabase error states. |
| Add pagination to heavy lists | Frontend | Medium | M | Inbox, analytics, posts, UGC, support lists avoid unbounded loads. |
| Add delete confirmation and undo where needed | UI | Medium | S | Destructive actions are confirmed and audited. |
| Add module-level smoke tests | QA | High | M | Core routes render under test/demo data. |

### Project 3: UI Design Upgrade

#### Target State

The UI should feel premium, dense, and operational. It should not feel like a marketing landing page inside the product.

Quality bar:

- Consistent spacing, cards, modals, tables, filters, tabs.
- Mobile layouts do not overlap.
- Tables support responsive scrolling.
- Forms have validation and useful feedback.
- Buttons use clear icons and action hierarchy.
- No encoding artifacts.
- No visible placeholder/demo copy in production mode.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Remove encoding artifacts | UI | High | M | No broken characters like `â€”`, `â€¦`, `Â£`, `ðŸŽ‰` appear. |
| Standardize page headers | UI | Medium | M | Main app pages use consistent `PageHeader` pattern. |
| Standardize modals | UI | Medium | M | Create/edit/delete modals use consistent components. |
| Mobile audit | QA | High | M | All launch routes usable at 390px width. |
| Dashboard density pass | UI | Medium | M | Operational pages are compact and scannable. |
| Form validation pass | Frontend | High | M | Required fields and invalid values show clear inline errors. |
| Empty state pass | UI | Medium | S | Empty modules tell user the next action. |
| Loading skeleton pass | UI | Medium | S | Main data pages avoid abrupt flashes. |
| Accessibility pass | UI | Medium | M | Forms, buttons, dialogs, tabs have accessible labels/states. |
| Public claim alignment | Sales/SEO | High | S | Marketing pages only promise shipped or explicitly beta features. |

### Project 4: Commercial Depth And Gap Analysis

#### Target State

The business model is clear and enforced by product behavior.

Must-have deliverables:

- One pricing source of truth.
- Stripe checkout.
- Stripe portal.
- Stripe webhook subscription sync.
- Trial status.
- Plan gates.
- Usage limits.
- Upgrade prompts.
- Billing support flow.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Consolidate pricing tiers | Finance/Sales | Critical | S | Public, onboarding, billing, and schema use same plan IDs. |
| Define Stripe products/prices | Stripe | Critical | S | Live/test price IDs mapped in config. |
| Add checkout route | Stripe | Critical | M | User can start checkout from pricing/billing. |
| Add portal route | Stripe | Critical | M | User can manage card/invoices/cancel in Stripe portal. |
| Add webhook route | Stripe | Critical | M | Subscription events update `subscriptions` and `workspaces`. |
| Add entitlement helper | Backend | High | M | Code can check active plan and limits. |
| Add usage counters | Backend | High | M | AI generations/posts/brands/seats can be counted by plan. |
| Add upgrade prompts | UI | Medium | S | Blocked premium actions show correct upgrade CTA. |
| Add trial state | Backend | High | M | Trial start/end/status are stored and enforced. |
| Add billing test checklist | QA | Critical | S | Test cards/webhook events documented and verified. |

### Project 5: Security And Backend Hardening

#### Target State

The product is safe enough for real customers and small teams.

Must-have deliverables:

- Tenant isolation tests.
- RLS policy review.
- API auth checks.
- Audit logging.
- Rate limiting.
- Storage policy review.
- Webhook signature validation.
- Data export/delete policy.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Create RLS test matrix | RLS | Critical | M | User A cannot access User B data across core tables. |
| Add AI route rate limits | Backend | Critical | M | AI routes enforce plan/hour limits. |
| Add support/contact spam protection | Backend | High | S | Contact form cannot be abused easily. |
| Add audit log helper | Backend | High | M | Sensitive actions write consistent audit rows. |
| Add storage policy review | Supabase | High | M | Buckets match privacy needs and code references. |
| Lock webhook inserts | Backend | High | M | Webhook endpoints verify signatures before DB writes. |
| Add data export route | Backend | Medium | M | User can request workspace data export. |
| Add account/workspace deletion flow | Backend | Medium | M | Deletion behavior is explicit and documented. |
| Add service-role isolation | Backend | Critical | S | Service role only used server-side. |
| Document backup/DR policy | Admin | Medium | S | Backup, restore, and retention plan is written. |

### Project 6: Final Release Readiness

#### Target State

The product can be deployed, sold to beta users, supported, and improved without firefighting.

Must-have deliverables:

- Clean build.
- Clean lint.
- Core smoke tests.
- Demo data.
- Stripe test pass.
- Legal pages final.
- Support flow.
- Launch assets.
- Monitoring.
- Known limitations list.

#### Top Tasks

| Task | Area | Priority | Complexity | Done Criteria |
|---|---|---|---:|---|
| Create release checklist | Admin | High | S | Every launch requirement has owner/status/evidence. |
| Create beta onboarding guide | Sales | High | S | Beta users can be onboarded consistently. |
| Create demo video | Sales | High | M | 3-5 minute demo covers core paid workflow. |
| Create support inbox process | Admin | High | S | Support tickets route to a real process. |
| Final legal review | Legal | Critical | M | Public policies cover actual providers and risks. |
| Add status page or uptime note | Admin | Low | S | Users know where to check service status. |
| Add changelog | Sales | Low | S | Beta users can see product updates. |
| Run mobile/browser QA | QA | High | M | Launch routes pass matrix. |
| Run Stripe test mode QA | QA | Critical | M | Checkout, webhook, cancel, portal tested. |
| Deploy staging then production | Admin | Critical | M | Staging and production envs are documented and working. |

---

## 10. Notion-Ready Task Database

Use these fields:

`Task Name | Related Product | Related Project | Area | Priority | Status | Due Date | Owner | Complexity | Done Criteria | Evidence Link Type | Blocker? | Notes`

### Initial Build Tasks

| Task Name | Related Product | Related Project | Area | Priority | Status | Owner | Complexity | Done Criteria | Evidence Link Type | Blocker? | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|---|
| Fix all lint errors blocking release | Caption Fox | Initial Build | Frontend | Critical | Todo | Jamahl | M | `npm run lint` exits 0 with no errors. | PR | Y | Current lint has 183 errors. |
| Prove production build completes | Caption Fox | Initial Build | Frontend | Critical | Todo | Jamahl | M | `npm run build` exits 0 locally and in deploy preview. | Screenshot/PR | Y | Build timed out in audit. |
| Add active workspace context helper | Caption Fox | Initial Build | Backend | Critical | Todo | Jamahl | M | All app modules read the same active workspace from membership. | PR | Y | Removes owner-only/first-workspace inconsistencies. |
| Replace placeholder workspace IDs in campaigns | Caption Fox | Initial Build | Backend | Critical | Todo | Jamahl | S | Creating a campaign stores the active workspace ID. | PR | Y | Existing code uses `workspace_id: 'placeholder'`. |
| Replace placeholder workspace IDs in UGC | Caption Fox | Initial Build | Backend | Critical | Todo | Jamahl | S | Creating briefs/creators stores active workspace ID. | PR | Y | Existing UGC page uses placeholder. |
| Persist onboarding brand profile | Caption Fox | Initial Build | Backend | High | Todo | Jamahl | S | Completing brand step creates a `brands` row. | PR/Loom | N | Connects onboarding to app value. |
| Persist onboarding brand voice | Caption Fox | Initial Build | Backend | High | Todo | Jamahl | S | Completing voice step creates/updates `brand_voice_profiles`. | PR/Loom | N | Required for AI personalization. |
| Persist onboarding channel selections | Caption Fox | Initial Build | Backend | Medium | Todo | Jamahl | S | Selected channels create `social_channels` rows with safe disconnected state. | PR | N | Real OAuth can come later. |
| Save generated onboarding calendar | Caption Fox | Initial Build | AI/Backend | High | Todo | Jamahl | M | Generated week creates `content_posts` draft/scheduled rows. | Loom | N | First 10-minute value proof. |
| Add required env vars to example file | Caption Fox | Initial Build | Admin | Critical | Todo | Jamahl | XS | `.env.local.example` includes `ANTHROPIC_API_KEY`, app URL, Stripe/email optional vars. | PR | Y | Current AI routes require missing env. |

### Upgrade Depth Tasks

| Task Name | Related Product | Related Project | Area | Priority | Status | Owner | Complexity | Done Criteria | Evidence Link Type | Blocker? | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|---|
| Fix `ai_usage_logs` mismatch | Caption Fox | Upgrade Depth | Supabase | High | Todo | Jamahl | S | Chat route writes to existing schema table or migration creates table. | PR | Y | Runtime failure risk. |
| Fix `post_platform_versions` mismatch | Caption Fox | Upgrade Depth | Supabase | Critical | Todo | Jamahl | M | Studio post save/load works without missing table errors. | PR/Loom | Y | Code/types/schema alignment needed. |
| Fix `competition_judge_scores` mismatch | Caption Fox | Upgrade Depth | Supabase | Critical | Todo | Jamahl | M | Competition judging works end-to-end. | PR/Loom | Y | Referenced in competition detail. |
| Fix storage bucket mismatch | Caption Fox | Upgrade Depth | Supabase | High | Todo | Jamahl | S | Settings uploads use a bucket that exists and has correct policy. | PR | Y | Code uses `assets`; schema creates other buckets. |
| Add campaign creation validation | Caption Fox | Upgrade Depth | Backend | High | Todo | Jamahl | S | Invalid/missing required fields show inline errors and no bad rows are inserted. | Screenshot | N | Improves demo quality. |
| Add UGC brief end-to-end workflow | Caption Fox | Upgrade Depth | Backend | High | Todo | Jamahl | M | Create brief, add creator, add submission, approve/reject in one workspace. | Loom | N | Strong commercial module. |
| Complete link-in-bio analytics tracking | Caption Fox | Upgrade Depth | Backend | High | Todo | Jamahl | M | Public views/clicks increment and appear in analytics page. | Loom | N | Quick sellable value. |
| Add inbox reply draft workflow | Caption Fox | Upgrade Depth | AI/Inbox | Medium | Todo | Jamahl | M | User can draft, save, and mark reply ready without external send. | Loom | N | Avoids false promise of sending. |
| Add scheduled reports preview | Caption Fox | Upgrade Depth | Email/Reports | Medium | Todo | Jamahl | M | User can generate report preview before email integration. | Screenshot | N | Useful beta feature. |
| Add robust empty states to main modules | Caption Fox | Upgrade Depth | UI | Medium | Todo | Jamahl | M | Empty modules show next best action and no broken UI. | Screenshots | N | Critical for new accounts. |

### Commercial Tasks

| Task Name | Related Product | Related Project | Area | Priority | Status | Owner | Complexity | Done Criteria | Evidence Link Type | Blocker? | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|---|
| Choose final launch pricing tiers | Caption Fox | Commercial Gap | Finance | Critical | Todo | Jamahl | S | One written pricing table approved for launch. | Doc | Y | Must align public/onboarding/billing. |
| Centralize plan config | Caption Fox | Commercial Gap | Backend | Critical | Todo | Jamahl | M | App uses one config for plan IDs, prices, names, limits. | PR | Y | Prevents plan drift. |
| Add Stripe checkout route | Caption Fox | Commercial Gap | Stripe | Critical | Todo | Jamahl | M | Checkout session is created server-side for selected plan. | PR/Loom | Y | Required for paid launch. |
| Add Stripe portal route | Caption Fox | Commercial Gap | Stripe | Critical | Todo | Jamahl | M | User can open Stripe portal from billing page. | Loom | Y | Required for card/invoice management. |
| Add Stripe webhook route | Caption Fox | Commercial Gap | Stripe | Critical | Todo | Jamahl | M | Subscription events update Supabase correctly. | PR | Y | Required for entitlement correctness. |
| Add plan gate helper | Caption Fox | Commercial Gap | Backend | High | Todo | Jamahl | M | Premium actions check active plan and show upgrade prompt. | PR | N | Needed before public launch. |
| Add billing status banners | Caption Fox | Commercial Gap | UI | High | Todo | Jamahl | S | Trial/past due/cancelled states are visible and actionable. | Screenshot | N | Reduces support burden. |
| Add demo workspace seed data | Caption Fox | Commercial Gap | Sales | High | Todo | Jamahl | M | Demo account has realistic content across key modules. | Loom | N | Needed for sales/demo. |
| Create demo video script | Caption Fox | Commercial Gap | Sales | Medium | Todo | Jamahl | S | 3-5 minute script covers sellable workflow. | Doc | N | Use once beta flow is stable. |
| Create beta launch offer page copy | Caption Fox | Commercial Gap | Sales/SEO | Medium | Todo | Jamahl | S | Landing page accurately describes beta offer and limitations. | Doc/PR | N | Avoid overpromising. |

### Security Hardening Tasks

| Task Name | Related Product | Related Project | Area | Priority | Status | Owner | Complexity | Done Criteria | Evidence Link Type | Blocker? | Notes |
|---|---|---|---|---|---|---|---:|---|---|---|---|
| Write RLS tenant isolation tests | Caption Fox | Security Hardening | RLS | Critical | Todo | Jamahl | M | Cross-workspace access attempts fail for core tables. | PR | Y | Required for customer data. |
| Review broad public insert/select policies | Caption Fox | Security Hardening | RLS | Critical | Todo | Jamahl | M | Public policies are limited to intended use cases only. | PR | Y | Especially support and invitation token flows. |
| Add AI rate limiting | Caption Fox | Security Hardening | AI | Critical | Todo | Jamahl | M | AI routes enforce per-workspace/user limits. | PR | Y | Prevents cost abuse. |
| Add contact form spam protection | Caption Fox | Security Hardening | Backend | High | Todo | Jamahl | S | Contact endpoint has basic rate limit/honeypot/captcha strategy. | PR | N | Public abuse risk. |
| Add audit logging helper | Caption Fox | Security Hardening | Backend | High | Todo | Jamahl | M | Sensitive actions call a shared audit helper. | PR | N | Needed for teams/agencies. |
| Review storage public access | Caption Fox | Security Hardening | Supabase | High | Todo | Jamahl | M | Media privacy model is documented and policies updated. | Doc/PR | N | Public buckets may be fine but must be deliberate. |
| Add data export policy | Caption Fox | Security Hardening | Legal/Admin | Medium | Todo | Jamahl | S | Export scope and process documented. | Doc | N | Needed for trust. |
| Add deletion policy | Caption Fox | Security Hardening | Legal/Admin | Medium | Todo | Jamahl | S | Account/workspace deletion behavior documented and implemented. | Doc/PR | N | Privacy requirement. |
| Add backup/restore policy | Caption Fox | Security Hardening | Admin | Medium | Todo | Jamahl | S | Backup cadence and restore process documented. | Doc | N | Needed before paid customers. |
| Add webhook signature verification plan | Caption Fox | Security Hardening | Backend | High | Todo | Jamahl | M | Stripe and future webhook endpoints verify signatures. | PR | Y | Required before webhooks go live. |

---

## 11. Launch And Sales Pipeline

### Recommended Launch Stages

| Stage | Target Date | Goal | Exit Criteria |
|---|---|---|---|
| Internal demo hardening | 2026-06-30 | Make demo flow reliable | Signup/onboarding/studio/calendar/link page works with seed data. |
| Private beta | 2026-07-15 | 5-10 controlled users | Critical lint/build/schema/workspace blockers fixed. |
| Paid beta | 2026-08-01 | First paying users | Stripe checkout/webhooks/portal working in production. |
| Public launch | 2026-08-15 or later | Broader self-serve launch | Support/legal/security/QA/release checklist complete. |

### Beta Plan

| Item | Recommendation |
|---|---|
| Beta users | 5-20 users |
| User type | Creators, small brands, social media managers, small agencies |
| Onboarding | 30-minute assisted setup call |
| Feedback | Weekly feedback form + direct support channel |
| Offer | Free 30-day beta or discounted Creator Pro/Team |
| Success metric | Each beta user creates at least 10 content drafts and 1 campaign/link page |

### Minimum Marketing Assets

- One clear landing page focused on the beta offer.
- 3-5 minute demo video.
- 10 screenshot pack.
- Pricing table.
- FAQ with limitations.
- Case study template.
- Founder-led outreach message.
- Support email and response expectation.
- Legal links in footer.

### Launch Blockers Checklist

| Blocker | Status |
|---|---|
| Lint clean | Blocked |
| Production build proven | Blocked |
| Stripe checkout live | Blocked |
| Stripe webhook live | Blocked |
| Plan tiers consistent | Blocked |
| Workspace/tenant context fixed | Blocked |
| Placeholder IDs removed | Blocked |
| Missing schema resources resolved | Blocked |
| Onboarding persists core data | Blocked |
| Demo seed data exists | Blocked |
| Legal disclaimers complete | Blocked |
| Support process ready | Blocked |

---

## 12. Customer Acquisition

### Recommended Channels

| Channel | Product | Type | Cost | Time Required | Difficulty | Expected Lead Quality | Status | Next Action |
|---|---|---|---:|---:|---|---|---|---|
| Founder LinkedIn outreach | Caption Fox | Outreach | £0 | 5 hrs/week | Medium | High | Not started | Build list of 50 creators/agencies. |
| Creator communities | Caption Fox | Community | £0 | 3 hrs/week | Medium | Medium | Not started | Share beta invite with transparent limitations. |
| Agency cold email | Caption Fox | Outreach | Low | 5 hrs/week | Medium | High | Not started | Create short offer for 10 agencies. |
| SEO templates | Caption Fox | SEO | £0 | 4 hrs/week | Medium | Medium | Not started | Publish giveaway terms template, UGC brief template, content calendar template. |
| Demo video ads | Caption Fox | Paid | Optional | 2 hrs/week | Medium | Medium | Later | Only after conversion flow works. |
| Partnerships | Caption Fox | Partnerships | £0 | 2 hrs/week | High | High | Later | Find creator coaches/social media consultants. |

### First Outreach Message

Subject/message:

> I am opening a small beta for Caption Fox, an AI-assisted content workspace for creators and small marketing teams. It helps create brand voice, generate posts, organize campaigns, and build a simple content calendar from one dashboard. I am looking for 10 users to test it with real workflows and give blunt feedback. I can set it up with you in 30 minutes.

Next action:

- Create a list of 50 target users.
- Send 10 highly personalized messages.
- Book 3 demos.
- Watch users use the product instead of only asking for opinions.

---

## 13. Legal And Compliance Register

| Item | Product | Type | Required Before Launch | Status | Risk | Owner | Notes |
|---|---|---|---|---|---|---|---|
| Privacy Policy | Company-wide | Legal | Yes | Present but needs review | High | Jamahl | Must include Supabase, hosting, AI provider, Stripe, email provider. |
| Terms of Service | Company-wide | Legal | Yes | Present but needs review | High | Jamahl | Must include acceptable use, AI outputs, account termination. |
| Cookie Policy | Company-wide | Legal | Yes | Present | Medium | Jamahl | Must match actual analytics/cookie tools used. |
| AI Disclaimer | Caption Fox | Legal | Yes | Missing | High | Jamahl | Users must review AI-generated content. |
| Social Platform Disclaimer | Caption Fox | Legal | Yes | Missing | Medium | Jamahl | State no affiliation with social platforms. |
| Giveaway/Competition Disclaimer | Caption Fox | Legal | Yes if giveaways sold | High | High | Jamahl | Users responsible for platform/local law compliance. |
| UGC Rights Disclaimer | Caption Fox | Legal | Yes if UGC sold | High | High | Jamahl | Clarify rights, usage, contracts, payments. |
| Refund Policy | Company-wide | Legal | Yes before paid launch | Missing | Medium | Jamahl | Must match Stripe/subscription cancellation behavior. |
| DPA | Company-wide | Legal | Before team/agency | Missing | High | Jamahl | Needed for B2B customers. |
| Subprocessor List | Company-wide | Compliance | Before team/agency | Missing | Medium | Jamahl | Supabase, hosting, AI, Stripe, email provider. |
| Data Deletion Policy | Company-wide | Compliance | Yes | Missing | High | Jamahl | Define account/workspace deletion behavior. |
| Backup Policy | Company-wide | Compliance | Yes | Missing | Medium | Jamahl | Define backup cadence and restore scope. |

---

## 14. Domains, Emails, And Brand Assets

Recommended asset register fields:

`Asset Name | Product | Type | Provider | Renewal Date | Cost | Status | Link | Notes`

Initial records to create:

| Asset Name | Product | Type | Provider | Status | Notes |
|---|---|---|---|---|---|
| captionfox.com | Caption Fox | Domain | TBD | Unknown | Confirm ownership, renewal, DNS. |
| support@captionfox.com | Caption Fox | Email | TBD | Unknown | Needed for support and legal pages. |
| hello@captionfox.com | Caption Fox | Email | TBD | Unknown | Sales/contact address. |
| Caption Fox logo | Caption Fox | Logo | Repo/public | Present | `public/caption-fox-logo-transparent.png`. |
| Caption Fox favicon | Caption Fox | Favicon | Repo/public | Present | `public/caption fox favicon.png`. |
| GitHub repo | Caption Fox | Repo | Local/GitHub | Local present | Confirm remote and branch policy. |
| Supabase project | Caption Fox | Backend | Supabase | Unknown | Confirm project, backups, env vars. |
| Stripe account | Caption Fox | Billing | Stripe | Missing/unknown | Required before paid launch. |
| Email provider | Caption Fox | Email | Resend or alternative | Missing/unknown | Required for auth/support/reports. |

---

## 15. Decision Log

Use these fields:

`Decision | Date | Product | Area | Context | Options Considered | Final Decision | Reason | Impact | Revisit Date | Notes`

### Immediate Decisions Needed

| Decision | Date | Product | Area | Context | Options | Recommended Decision | Impact | Revisit Date |
|---|---|---|---|---|---|---|---|---|
| Launch scope | 2026-06-13 | Caption Fox | Product | Product is broad but not fully wired. | Full platform, reduced beta, AI studio only | Reduced beta: AI studio, calendar, campaigns, UGC basics, link-in-bio | Faster credible launch | 2026-07-01 |
| Pricing tiers | 2026-06-13 | Caption Fox | Finance | Public/onboarding/billing plans conflict. | Keep all, simplify, custom only | Simplify to Free, Creator Pro, Team, Agency Beta | Removes confusion | 2026-06-20 |
| Social publishing promise | 2026-06-13 | Caption Fox | Product/Legal | Publishing not wired. | Promise publishing, mark beta, omit | Omit automated publishing from launch promise | Avoids false claims | 2026-08-01 |
| Social listening promise | 2026-06-13 | Caption Fox | Product | Ingestion not implemented. | Sell now, beta label, defer | Label as beta/demo until ingestion exists | Reduces support risk | 2026-08-01 |
| Stripe priority | 2026-06-13 | Caption Fox | Commercial | Paid launch impossible without billing. | Manual invoices, Stripe now, wait | Build Stripe before paid beta | Enables self-serve | 2026-07-15 |
| Enterprise sales | 2026-06-13 | Caption Fox | Sales | Enterprise features incomplete. | Sell now, waitlist, remove | Enterprise waitlist/contact only | Avoids compliance overreach | 2026-09-01 |

---

## 16. Weekly Founder Questions

Answer these every week:

1. What is the next single workflow that must work end-to-end?
2. What is the biggest commercial gap that prevents someone paying?
3. What is the biggest security/compliance gap that creates liability?
4. What is the one thing that improves demo quality the most this week?
5. What are the top 3 blockers stopping launch readiness?

### Current Answers

1. **Next workflow:** Signup -> onboarding -> brand voice -> AI generated post -> save to calendar.
2. **Commercial gap:** Stripe billing and pricing consistency.
3. **Security/compliance gap:** Tenant isolation proof and placeholder workspace IDs.
4. **Demo quality improvement:** Seeded demo workspace with realistic posts, campaigns, UGC, analytics, and link page.
5. **Top blockers:** Lint/build quality, schema/code mismatches, Stripe not wired.

---

## 17. Recommended Next 10 Engineering Moves

1. Fix lint errors that block release.
2. Make `npm run build` complete successfully.
3. Create a central `getActiveWorkspace` pattern and use it across app modules.
4. Remove all `workspace_id: 'placeholder'` writes.
5. Resolve schema/code mismatches for `ai_usage_logs`, `post_platform_versions`, `competition_judge_scores`, and `assets`.
6. Persist full onboarding data.
7. Consolidate pricing tiers and plan IDs.
8. Implement Stripe checkout, portal, and webhook routes.
9. Add AI rate limiting and env validation.
10. Create demo seed data and record a controlled product demo.

---

## 18. Launch Readiness Verdict

Caption Fox has strong product breadth and enough existing implementation to become a sellable SaaS. The repo already contains the skeleton and many real data-backed surfaces for a serious social media operations product.

The current state should not be treated as final release despite the repo name. It is closer to a late prototype or early beta candidate. The safest commercial path is to narrow launch scope, fix build and tenant blockers, wire billing properly, and launch to a small beta group before making public claims about full platform automation.

### Practical Launch Target

- **Private beta:** Around 2026-07-15 if critical blockers are fixed.
- **Paid beta:** Around 2026-08-01 if Stripe and core workflows are complete.
- **Public launch:** No earlier than 2026-08-15 unless scope is reduced further.

### Minimum Paid Beta Scope

- Auth.
- Workspace onboarding.
- Brand profile and voice.
- AI content generation.
- Save generated content as posts.
- Calendar scheduling.
- Campaign/task basics.
- UGC brief/creator basics.
- Link-in-bio builder and public page.
- Billing through Stripe.
- Legal/support basics.
- Clean build and lint.

Everything else should be labeled beta, coming soon, or kept internal until wired and tested.

---

## 19. Commercial Depth & Enterprise Expansion Audit (2026-06-29)

*Added 2026-06-29. This section answers the founder's expansion questions (supplier portal, marketplace/escrow, automations, PWA, accounting, financing, full copilot), provides an exhaustive route-by-route commercial-depth audit, a Propvora feature/copilot comparison, and a commercial + pricing + gap analysis toward world-class enterprise. Deployment context: production is live at https://caption-fox.vercel.app (Supabase env vars and PAT now set on Vercel; build passes; favicon and login a11y fixed).*

## 19.1 Strategic Direction — Answers to the Founder Questions

The core decision: **most of the requested additions would convert Caption Fox from a single-sided SaaS (the marketer/brand/agency is the customer) into a two-sided marketplace + fintech platform.** That can be the long-term moat, but it is a different, larger, and regulated business. The recommendation is to **phase** it, not build it all into v1. The main workspace should stay anchored to the marketer/brand/agency (the buyer/payer).

| # | Question | Verdict | Phase | Rationale |
|---|---|---|---|---|
| 1 | Supplier portal | Not now; lightweight later | P2 | You already have an `external_creator` role + UGC creators. Extend that into a scoped creator/supplier portal rather than a full separate account system. |
| 2 | Separate suppliers/agencies entity for marketers/creators/influencers | Partial — a Talent/Creator directory | P2 | Build a talent directory + external-creator portal, not a full separate supplier account type, until marketplace demand is proven. |
| 3 | Main workspace = the marketer | **Yes** | P1 | Correct anchor. The brand/agency/marketer is the buyer and payer; keep them as workspace owner. |
| 4 | More commercial depth (sub-tabs, detail pages, wizards) | **Yes — highest ROI** | P1 | This is the single best near-term investment. See the route-by-route audit in 19.2. |
| 5 | Automations | Yes, but staged | P2 | Very high commercial value (trigger→condition→action recipes, auto-repurpose, scheduled posting). Not v1-launch-blocking. Propvora's node-graph + AI builder is the template (19.3). |
| 6 | Calendar & scheduling | Calendar exists; real publishing is the gap | P2/P3 | Planning/scheduling state is built. Real social publishing (OAuth + workers) is a large lift — keep marketing honest until wired. |
| 7 | Financing | Only with marketplace | P3 | Defer. Only meaningful once there is GMV flowing through the platform. |
| 8 | Marketplace + escrow to hire marketers/influencers/creators | **Validate first; do not build for v1** | P3 | This is a separate Fiverr/Upwork-style business. Big build, big regulatory surface. Prove brands want to source talent inside Caption Fox before committing. |
| 9 | Escrow + dispute systems | With marketplace only | P3 | Escrow can make you a money transmitter unless you use Stripe Connect + a licensed provider. Use Connect (Express/Custom) + held transfers; do not custody funds yourself. |
| 10 | PWA full setup | **Yes** | P1 | Cheap, high-perceived-value: manifest + service worker + installable + offline shell. Good UX upgrade now. |
| 11 | Accounting | Light invoicing yes; full accounting no | P2/P3 | Stripe invoices/receipts + a simple ledger view is enough. A full accounting module is out of scope. |
| 12 | Supplier sourcing | Part of marketplace | P3 | Defer with the marketplace. |
| 13 | Team management in full | **Yes** | P1 | You have `workspace_members` + 8 roles. Finish invites, role UI, seat usage, and server-side permission enforcement. Launch-relevant. |
| 14 | Proper commercial depth | **Yes** | P1 | See 19.2 + 19.5. |
| 15 | Full copilot like Propvora | **Yes — and it is currently broken** | P1 | FoxAI must be fixed (P0 bug below) then upgraded to tool-calling + context-aware in-app actions. See 19.3. |

### Phasing summary

- **Phase 1 (launch depth, low regulatory risk):** route-by-route commercial depth, full team management, PWA, fix + upgrade the copilot, Stripe billing, pricing consolidation, honest calendar/publishing claims.
- **Phase 2 (operational depth):** automations engine, talent/creator directory + external-creator portal, scheduled-report email delivery, social publishing workers, AI credits/metering, light invoicing.
- **Phase 3 (platform pivot — validate demand first):** marketplace + Stripe Connect escrow + disputes + supplier sourcing + financing. Significant legal/financial lift; build only after Phase 1/2 prove retention and demand.

### P0 — FoxAI copilot is broken end-to-end (fix before any "full copilot" work)

Confirmed by reading the code:
- `src/components/fox-ai/FoxAIBubble.tsx:66` sends `body: JSON.stringify({ message, mode })` (a single string).
- `src/app/api/ai/chat/route.ts:15` requires `messages: []` (an array) and returns **HTTP 400** otherwise.
- `FoxAIBubble.tsx:71` reads `data.response`, but the route returns `{ text, usage }` — so even on success nothing renders.

**Net effect: every copilot request fails today.** Fix the request/response contract (align on a `messages[]` array + `{ text }`/stream response) before investing in copilot depth.

## 19.2 Route-by-Route Commercial Depth & UX Audit

*Audited 51 routes across `src/app` against the installed stack (Next.js 16, Supabase, Tailwind, recharts 3.8, date-fns 4 — no map/DnD/gantt/lightbox/carousel libraries present). Shared primitives in `src/components/ui` cover Button, Badge, Input, Tabs, Modal/ConfirmModal, Skeleton, EmptyState, PageHeader, BulkImportModal. A global `FoxAIBubble` copilot and `Sidebar`/`TopNav` shell wrap all `/app` routes.*

### Public / Marketing

| Route | Current State | Recommended Additions |
|---|---|---|
| `/` | Static landing: gradient hero, sticky nav + mobile menu, CSS-drawn dashboard mockup, 5-logo social proof, problem cards, 6 feature sections, Fox AI chat mockup, 3-card pricing preview, FAQ accordion, footer. No Supabase data. | Replace CSS mockups with **real product screenshots / autoplay loop video**; **animated metric counters**; **logo marquee**; **testimonial cards with avatars + star ratings**; **interactive ROI/savings calculator**; **scroll-reveal motion**; **G2/Trustpilot badges**; comparison teaser. |
| `/features` | Gradient hero, 8 feature sections with icon + checklist + CSS mockups. Static. | **Sticky sub-nav with scroll-spy**; real annotated screenshots / looping clips; **before/after sliders** for AI; per-feature testimonial avatars; hover-to-play micro-demos; bottom feature-matrix table. |
| `/pricing` | Monthly/yearly toggle, 6 plan cards, 7×6 comparison table, competitor table (vs Buffer/Later/Sprout), FAQ. Hardcoded. | **Interactive seat/usage slider** with live price; **currency switcher (GBP/USD/EUR)**; **plan-recommendation quiz**; customer logos per tier; sticky comparison header; tooltip explainers; small **TCO-vs-competitor bar chart**. |
| `/contact` | Hero, 3 info cards, contact form → `support_tickets`, success state. | **Region map / timezone-aware hours**; **Calendly / live-chat embed**; SLA chip; department routing avatars; **file-attachment upload**; inline validation; "book a demo" path. |
| `/legal/privacy` · `/legal/terms` · `/legal/cookie-policy` | Prose sections, last-updated stamp; cookie page has a 4-row table. | **Sticky ToC with scroll-spy + anchor links**; version/changelog history; plain-English summary callouts; **print/PDF export**; cookie page → **interactive consent-preference manager** wired to the live banner. |

### Auth

| Route | Current State | Recommended Additions |
|---|---|---|
| `/login` | Split layout, email/password + show-hide, Google OAuth, `next` redirect. | Brand-panel **testimonial rotation with avatar**; **magic-link/passwordless**; remember-me; social-proof metric; in-button spinner. |
| `/signup` | 3 feature bullets, password-strength gauge, "check email" success → `profiles`. | **Inline email-availability check**; SSO buttons; per-rule password checklist; invite-context banner; trust badges (SOC2/GDPR). |
| `/forgot-password` · `/reset-password` · `/verify-email` | Email form / new-password / resend flows with success states. | **Resend cooldown timers**; masked-email confirmation; per-rule strength checklist; token-expired states; **auto-poll for verification**; "open mail app" deep links. |
| `/mfa` | 6-box OTP (auto-focus/paste/backspace); resend is a **stub**. | **Implement resend + cooldown**; expiry countdown; trust-this-device; backup-codes fallback; auto-submit on 6th digit. |

### Onboarding

| Route | Current State | Recommended Additions |
|---|---|---|
| `/onboarding` | 10-step wizard (welcome → workspace → type → plan → brand → voice → channels → goals → 7-day calendar → done). Inserts `workspaces` at step 4 only. | **Live preview right-rail** (brand card/calendar builds as you type); **channel OAuth with real avatars/follower pull**; logo upload → instant brand card; "skip & explore"; **resume-later persistence**; confetti on done; step 9 → **mini calendar grid preview**. Persist brand/voice/channels/calendar (currently local state — see §9 tasks). |

### Dashboard / Home

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/home` | 4 KPI cards, recent-activity list, quick actions; tabs Overview/Today/Approvals/Ideas/Activity/Health. Loads real Supabase data. | **Clickable KPI drill-downs + sparkline trends + WoW % deltas**; **mini month calendar heatmap**; "best time to post" insight; avatars on activity/approvals; **draggable widget grid** or saved-view switcher; Health → **gauge/score ring**; empty-state-to-onboarding nudge. |

### Studio

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/studio` | Tabs Ideas/AI Generator/Post Builder/Creative Canvas/Brand Voice/Templates. Generator + per-platform editors + canvas + compliance score. Ideas/Templates partly **stubbed**. | **Wire Ideas + Templates to Supabase**; **live multi-platform preview cards** (real IG/TikTok/LinkedIn frames with avatar + media); **media gallery/asset library tab** with drag-to-canvas + AI image/stock search; compliance → **gauge cards**; version history + A/B compare; generation history with re-run. |
| `/app/studio/templates` | Filter bar, template cards, form modal with placeholder inserter, toasts → `content_templates`. | **Card/table view switcher**; **usage analytics + sparkline per template**; folders/categories; preview modal; duplicate/clone; favorites; starter-template gallery. |
| `/app/studio/hashtags` | KPI cards, filter bar, set cards (tag cloud), 2-step modal, research tool → `hashtag_sets`. | **Reach/competition charts**; trending sparklines; performance tracking; bulk merge; platform-limit warnings (IG 30-tag cap); save research as a view. |
| `/app/studio/posts/[id]` | Tabs Editor/Media/AI Assist/Approvals/History + preview card → `content_posts`, `post_platform_versions`, `approvals`. | **Realistic per-platform device frames + media carousel + lightbox**; **inline comment/annotation threads** for approvers; **platform-version diff**; predicted-engagement gauge; History → **revert-to-version**. |
| `/app/studio/brands/[id]` | Brand hero + 9 tabs (overview/voice/guidelines/channels/templates/hashtags/team/analytics/audit), logo/cover upload, color pickers. | **Shareable brand style-guide sheet with export**; channel **follower sparklines + avatars**; Analytics → **recharts (platform pie, volume bar, engagement line) + top-posts gallery**; Team → avatars + role badges; "share brand kit" public link. |

### Calendar

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/calendar` | Tabs Calendar/Scheduled/Published/Drafts/Needs Approval/Failed/Queue. Month/week/list switcher, filters, status-colored pills, PostTable, 4-step wizard, bulk import → `content_posts`, `publishing_queue`. | **Drag-and-drop reschedule + drag-to-create** (needs DnD lib); **media thumbnails in pills + rich hover popover**; **timeline/agenda + per-channel swimlane views**; saved filter views; bulk multi-select; **best-time heat overlay**; live queue status with retry/ETA. |

### Campaigns

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/campaigns` | Tabs Overview/Giveaways/Competitions; Cards/Table/Kanban switcher (DnD only "planned"), 5-step wizard → `campaigns`, `giveaways`, `competitions`. | **Real DnD kanban**; **portfolio Gantt** across dates; **budget roll-up KPI strip + burn chart**; owner avatars + cover thumbnails; saved views + filters; template-campaign gallery. |
| `/app/campaigns/[id]` | Flagship detail: tabs Overview/Brief/Content/Calendar/Tasks/UGC/Budget/Assets/Results/Audit → many tables. | **Invest here.** KPI strip + status timeline + avatars; **mini month grid** (Calendar); **task Gantt with dependencies** (Tasks); **burn-down line + spend donut** (Budget); **media gallery + lightbox** (Assets); **reach/engagement charts + top-posts thumbnails** (Results); persistent **right-rail summary**. |
| `/app/campaigns/[id]/tasks` | Kanban/List switcher, priority/assignee/due, hover status menu → `campaign_tasks`. | **True DnD between columns**; **Gantt/timeline + calendar views**; real assignee avatars + workload; subtasks/checklists, labels, dependencies; filters; overdue highlighting; bulk-status toolbar. |
| `/app/campaigns/[id]/analytics` | 5-KPI strip; line (impr vs reach) + top-10 bar; Posts table; ROI cards → `post_analytics`. | Add **platform donut + funnel (impr→reach→eng→clicks→conv)**; thumbnails in tooltips; benchmark reference lines; date-range scrubber; **CSV/PDF export**; cost-per-result trend. |
| `/app/campaigns/giveaways` + `/[id]` | Cards/Table switcher, 4-step wizard; detail has Entries/Pick Winners/Announce/Analytics/Content/Settings/Audit (bar+pie+line charts). | List: **entries sparkline + prize media + avatars + timeline view**. Detail: **participant avatars**, **animated winner reveal**, **geo map of entries** (needs map lib), funnel (impr→entries→valid→winners), fraud flags, multi-platform announce previews. |
| `/app/campaigns/competitions` + `/[id]` | Cards/Table switcher, 5-step wizard; detail has Submissions/Judging/Leaderboard/Voting/Announce/Analytics + score matrix + podium → `competition_*`. | **Submission media gallery + lightbox**; **per-criterion radar + judge-variance heatmap**; animated podium + live vote bars; real voting media cards; votes-over-time line; public gallery link. (Note schema gap: `competition_judge_scores` — see §4.) |

### UGC

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/ugc` | 8 tabs; Submissions grid has **placeholder media**; Rights/Samples/Payments are **empty**; Performance has **empty chart area** → `ugc_*`. | Real **submission thumbnails + video previews + lightbox**; build **Rights (e-sign/license tracker)**, **Samples (shipment tracker)**, **Payments (creator payout table)**; wire Performance charts; creator sparklines + card view + avatars. |
| `/app/ugc/[id]` | Brief detail tabs Overview/Creators/Submissions/Scripts/Performance + breakdown bar. | Submissions → **media gallery + inline player + revision compare**; brief-to-asset funnel; creator avatars + mini-stats; **deliverable checklist with mini-Gantt**; rights status per asset. |
| `/app/ugc/creators/[id]` | Profile hero + tabs Profile/Submissions/Notes/Portfolio; Portfolio is **bare URLs**. | **Portfolio media gallery + lightbox**; engagement/follower charts; avatar uploader; audience-demographics donut; collaboration timeline; **rate card + payment history**; "message creator" link; rating/tags. |

### Inbox

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/inbox` | 9 tabs, split list/detail, **placeholder message bodies**, AI-draft composer, Reviews tab **empty** → `inbox_threads`, `social_channels`. | Real **message content + media attachments + reactions**; sentiment/volume header charts; **SLA timers**; assignee avatars + bulk assign; canned replies with variables; saved-view filters; build Reviews (star-rating cards); labels + keyboard triage. |
| `/app/inbox/threads/[id]` | Metadata sidebar + message feed + composer + send-confirm → `inbox_messages`. | **Media/attachment rendering + lightbox**; **sender profile card with avatar + history + sentiment trend**; internal-note vs public-reply toggle; @mention teammates; snooze/schedule reply; linked records; suggested-reply chips. |

### Analytics

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/analytics` | 6-KPI strip; 11 tabs; area/line/pie + sortable tables; date-range selector → many tables. Chart-rich already. | **KPI sparklines + period deltas**; thumbnails in top-posts; **best-time heatmap (day×hour)**; funnel; **audience demographics (age/gender/geo donuts + map)**; saved dashboards; **scheduled-PDF export**; comparison mode (period A vs B); fill Engagement/Benchmarks tabs. |
| `/app/analytics/posts/[id]` | 4-KPI strip + 4 charts + raw-data table → `post_analytics`. | **Post preview (media + caption + frame)** at top; benchmark reference lines; audience/geo; **share-velocity/virality chart**; "compare to similar"; annotations. |
| `/app/analytics/reports` | Scheduled/History tables, 3-step wizard, preview modal → `scheduled_reports`. | **Drag-and-drop report builder**; **branded PDF preview with logo/cover**; recipient avatars + delivery-status timeline; open/click tracking; template gallery; delivery-success chart. |
| `/app/analytics/competitors` | 5 KPI cards; 6 tabs; multi-line/bars/pies/donut → `competitor_*`. | **Competitor logos/avatars**; **head-to-head side-by-side view**; **radar across dimensions**; posting-cadence heatmap; top-competitor-posts gallery; spike alerts; SoV → **stacked-area over time**. |

### Listening

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/listening` | 5 KPI cards; 6 tabs; feed (grid/list toggle, filters, mention cards), sentiment + volume charts, word cloud → `listening_*`. | **Author avatars + influencer-score ranking**; **geographic mention map** (needs map lib); per-keyword sentiment sparkline; emerging-topic visual; saved views; sentiment-colored timeline; **bulk triage → assign to inbox**; build Alerts (history timeline + threshold charts). |

### Links

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/links` + `/[id]` + `/[id]/analytics` | KPI cards, link-page cards with mini preview, 3-step wizard; editor with up/down reorder + live phone/desktop preview; analytics bar + table → `link_pages`, `link_page_items`. | **DnD reordering** (replace arrows); **media/thumbnail + avatar/cover uploads**; more block types (video embed, product card, email capture); QR-code generator; theme-template gallery; A/B variants; analytics → **clicks-over-time line + geo/device/referrer breakdowns (donuts/map) + conversion funnel + CSV**. |
| `/l/[slug]` (public) | Public bio page, avatar, item blocks, OG meta, increments `total_views`. | **Media/thumbnail per link + embedded video/social previews**; button hover/entrance motion; share + add-to-contacts; glass/gradient theme presets; branded loading; **OG image auto-generation**; click beacons. |

### Settings

| Route | Current State | Recommended Additions |
|---|---|---|
| `/app/settings` | 11 tabs; logo/avatar uploaders, channels table, team table with roles + invites, billing cards, toggles → many tables. | Channels: **real follower/avatar pull + health/last-sync + reconnect**. Team: **avatars, last-active, seat-usage meter, permission preview**. Audit: filterable timeline + export. Security: **active-session list with device/location map, MFA QR, login-history chart**. Integrations: status cards with logos. Add settings search + left sub-nav. |
| `/app/settings/billing` | Plan cards, payment-method, billing-history (**demo data**), cancel flow → `subscriptions`. | **Usage-vs-limit dashboard (seats/AI/posts gauges) + spend trend**; **real invoice PDF downloads**; proration preview; annual/monthly savings toggle; plan-comparison modal; upcoming-invoice estimate; payment-failure recovery banner. |
| `/app/settings/permissions` | Role×permission matrix (8 roles), member overrides, approval-workflow collapsibles, change audit → `workspace_members`. | **Member avatars**; **"simulate as role" preview**; search/filter matrix; **diff highlighting** for overrides; bulk-apply; approval workflows → **visual flow/stepper diagram**; audit timeline + export. |

### Admin

| Route | Current State | Recommended Additions |
|---|---|---|
| `/admin` | 4 KPI cards (**MRR/active-subs hardcoded 0/£0**), system-health badges, quick actions. Sidebar advertises 12 sections — **~8 are unbuilt**. | Wire **real MRR/ARR/churn + growth charts, signups line, plan-distribution donut**; uptime sparklines + latency gauges + incident feed; recent-activity feed; trial-conversion funnel; alert cards. **Build or hide the ~8 unbuilt admin sections.** |
| `/admin/workspaces` | Filter buttons, table (owner shown as raw UUID) → `workspaces` (50). | **Search + pagination**; resolve **owner UUID → profile + avatar**; MRR/seat/usage columns with mini-bars; charts above table; **workspace detail drill-down page** (none exists); saved filters; bulk actions. |
| `/admin/users` | Search, filter buttons, table → `profiles` (50). | **Pagination + working search/filters**; **user-detail drill-down** (workspaces, activity, login history, devices); last-active + signup-source; bulk actions; signups chart; suspicious-activity flags. |
| `/admin/support` | 4 KPI cards, filter buttons, table, ticket-detail modal (single message) → `support_tickets` (100). | **SLA countdown + breach highlighting**; volume + resolution-time trend charts; canned responses/macros; **conversation thread history**; assignee avatars + workload; tags/saved views; CSAT; pagination; link to originating workspace/user. |

### Cross-cutting findings

- **Stubbed/empty surfaces to finish before "commercial depth" reads as real:** Studio Ideas & Templates (stub data), UGC Rights/Samples/Payments tabs, Inbox message bodies (placeholder) & Reviews tab, Admin KPI hardcoded zeros, and ~8 advertised admin sections with no route.
- **Missing capability libraries:** no **DnD** lib (true kanban, calendar reschedule, link/report builders), no **map** lib (geo analytics, listening, entries, sessions), no **lightbox/carousel** (media galleries across Studio/UGC/Campaigns/Inbox), no **motion** lib (marketing scroll-reveal, micro-interactions). **recharts is present but underused** outside Analytics — extend to Home KPIs, Brand analytics, Campaign lists, UGC performance, and Admin.
- **Highest-leverage premium upgrades:** real media thumbnails + lightbox everywhere submissions/posts/assets appear; avatars on every person/creator/competitor reference; KPI sparklines + period deltas on all dashboards; saved-views/filters as a shared pattern; detail-page right-rail summaries on Campaign/Giveaway/Competition/Creator pages.

### Suggested dependencies (to enable the above)

| Capability | Suggested lib | Used by |
|---|---|---|
| Drag & drop | `@dnd-kit/core` | Kanban, calendar reschedule, link/report builders, widget grid |
| Maps | `react-leaflet` (+ OSM tiles) or Mapbox | Geo analytics, listening, giveaway entries, sessions |
| Lightbox / media | `yet-another-react-lightbox` | Studio/UGC/Campaign/Inbox media galleries |
| Motion | `framer-motion` | Marketing scroll-reveal, micro-interactions, winner reveal |
| Gantt | custom recharts/CSS (no good RSC-friendly lib) | Campaign + task timelines |

## 19.3 Propvora Comparison & Copilot Gap Analysis

Propvora (https://github.com/Blackwellen/propvora) is a UK property-operations SaaS on the **same stack** (Next.js 16.2, React 19, Tailwind v4, Supabase + RLS, Cloudflare R2, Stripe, Resend). Despite the different vertical, its architecture is a near-perfect template for a mature Caption Fox.

### (a) Propvora sections & platform features

- **Operator sections:** portfolio, work, money, accounting, compliance, planning, legal, contacts, calendar, messages, **automations**, bookings, listings, **marketplace**, orders, **suppliers**, network, **verification**, notifications, **portals**, affiliates, account/workspace settings, help, changelog.
- **Route groups / surfaces:** `(app)` operator, `(supplier-workspace)`, `(admin)` + `(admin-auth)`, `(auth)`, external portals `(customer)/(tenant)/(landlord)/(supplier)/(portal)`, `(public-booking)`, `(affiliate)`, shared `(states)` empty/error/loading shells.
- **Platform features (with code evidence):** Stripe billing with **plan gates** (`gateAiCopilot`, `getPlanLimits`); a real **automations engine + AI builder** (`automations/ai-builder`, `@xyflow/react` flow canvas); R2 storage; an **admin AI model catalogue + per-workspace AI-usage monitoring**; i18n "country packs" with jurisdiction-gated legal/tax behaviour; security suites (RLS isolation tests, billing-gate tests, Playwright E2E); observability (`captureException`, request IDs).
- **AI beyond chat:** AI automation builder; AI form-field suggestions; AI planning review; document generation; a workspace **RAG indexer** (`ai_embeddings` via `bge-m3`); a **credits/metering economy** (`credits.ts`, `metering.ts`, `caps.ts`); copilot inbox triage.

### (b) Patterns Caption Fox should adopt

1. **Multi-persona workspaces + external portals** → ship a **client/approver portal** for agencies' clients to review/approve scheduled content.
2. **Real automations engine with an AI builder** (node-graph) → auto-repurpose, auto-DM responders, scheduled posting, performance-triggered alerts.
3. **Credits/metering + hard caps** → Caption Fox logs to `ai_usage_logs` but enforces **no caps or rate limits** today — a cost and abuse hole before launch.
4. **Admin AI catalogue + usage console** → DB-driven model selection instead of hard-coding the model in the route.
5. **RAG over workspace data** → index posts, captions, performance history, brand-voice docs so Fox answers with the user's actual data.
6. **Brand-safety guardrails as injected system clauses** → reusable for platform-policy and brand-voice enforcement.

### (c) Copilot deep-dive: Propvora vs FoxAI

| Dimension | Propvora copilot | Caption Fox FoxAI |
|---|---|---|
| Streaming | Yes — `ReadableStream` token stream | **No** — single `await res.json()` |
| Tool-calling / actions | Full executor (`navigate.to`, `record.create/update`, `comms.email.draft`, `doc.generate`, `compare.entities`) via `/api/ai/tool` with permission→credit→execute→audit | **None** — and **currently 400s on every request** (contract bug, §19.1 P0) |
| Context-awareness | Live RLS-scoped workspace snapshot, named key records, page context, `@`-mentions, memory tiers, RAG | **Zero** |
| In-app actions | Deterministic nav, record edits, multi-step agent (`/api/ai/agent`) | None |
| Approval / safety | 7-level permission engine; drafts never auto-execute; prompt-injection fencing; non-negotiable safety clauses | Prompt-level only; no server enforcement, no fencing |
| Model strategy | Multi-provider gateway with DB-driven model chain + fallback + role-based routing | Single hard-coded `claude-haiku-4-5`, no fallback |
| Slash commands | 37 capability-gated commands + palette | 5 static chips that prefill the textarea |
| Persistence / memory | `ai_chat_threads` + `ai_chat_messages`, entity-pinned threads, durable memory | In-memory React state only — lost on close |
| Citations / grounding | RAG "RELEVANT RECORDS" + forced key-records | None |

### Copilot upgrade roadmap

- **P0 (broken/unsafe):** fix the request/response contract; enforce rate limits + monthly cap + per-plan output-token ceiling server-side; move "never publish/delete/approve own content" from the prompt into a real permission gate.
- **P1 (close the gap):** **stream** responses; add a **tool registry + executor** (`post.create_draft`, `post.schedule` [approval-gated], `caption.generate`, `hashtags.generate`, `reply.draft`, `navigate.to`, `campaign.create`); **inject live page + workspace context** (connected accounts, this week's scheduled posts, top/under-performing content, brand voice — the single biggest quality lever); `@`-mention real records; **persist threads + memory**.
- **P2 (differentiate):** **RAG over content history** with citation chips; a real **slash-command palette**; a **multi-step agent** ("repurpose this week's top post into 5 platform-native drafts and schedule them" → validated, approval-gated batch); DB-driven model catalogue + fallback chain.

*Reference files to port from Propvora: `src/app/api/ai/{chat,agent,tool}/route.ts`, `src/lib/ai/{tools,gateway,permissions,safety,embeddings,workspace-context,commands,caps,metering,credits}.ts`, `src/features/copilot/screens/CopilotChatScreen.tsx`.*

## 19.4 Commercial Depth & Pricing Analysis

### Pricing — consolidate to one source of truth

Today there are **three conflicting plan sets** (public pricing page: Free/Starter/Pro/Team/Agency/Enterprise; onboarding: Starter/Creator Pro/Team; `constants.ts` PLANS: free/starter/pro/team/agency/enterprise; homepage shows Free/Pro £59/Agency £199). This must be unified into one config consumed by pricing, onboarding, billing, and entitlement checks.

**Recommended launch tiers (one source of truth):**

| Tier | Price (mo / yr) | Target | Core limits | Gated premium depth |
|---|---|---|---|---|
| Free | £0 | Trial / solo | 1 brand, 3 scheduled posts/mo, FoxAI 5 msgs/mo, 1 seat | No analytics history, no automations |
| Creator Pro | £29 / £23 | Creators, solo marketers | 3 brands, unlimited posts, FoxAI 200 msgs/mo, calendar, link page, 1 seat | Basic analytics, basic templates |
| Team | £79 / £63 | Small teams/brands | 10 brands, 5 seats, approvals, campaigns, UGC, reports, FoxAI 1,000 msgs/mo | Full analytics, automations (basic), saved views |
| Agency | £199 / £159 | Agencies | Unlimited brands, unlimited seats, social listening, competitor analysis, white-label reports, FoxAI unlimited* | Automations (advanced), client portal, priority support |
| Enterprise | Contact | Larger orgs | SSO/SAML, SCIM, DPA, audit export, SLA | Dedicated support, custom limits |

*\*"Unlimited" should still be protected by a fair-use rate limit + per-plan output-token ceiling (Propvora's caps pattern) to control AI cost.*

**Monetisation levers unlocked by the depth work:**
- **AI credits / add-on packs** once metering exists (overage beyond plan message cap).
- **Seat-based expansion** (Team/Agency) — finish team management to make this real.
- **Phase 3 marketplace take-rate** (typically 10–20% of GMV) + escrow fee, via Stripe Connect — only after demand is proven.
- **White-label / client portal** as an Agency-tier upsell.

### Commercial-depth ROI ranking (near-term)

1. Fix + upgrade FoxAI copilot (broken today; biggest perceived-value lever once context-aware).
2. Finish team management + permissions enforcement (unlocks seat-based revenue + agency use).
3. Stripe billing + entitlement gates + pricing consolidation (enables any paid revenue).
4. Detail-page depth (Campaign/Studio/UGC/Analytics) + shared media-gallery/avatar/sparkline patterns.
5. PWA (cheap perceived-value upgrade).
6. Automations engine (Phase 2 — strong retention/expansion driver).

## 19.5 Gap Analysis — Toward World-Class Enterprise

| Capability | Status today | Needed for enterprise |
|---|---|---|
| Billing & entitlements | UI/demo only | Stripe checkout + portal + webhooks + plan gates + usage caps |
| AI cost control | Logged, **no caps/rate limits** | Per-plan rate limits, monthly caps, output-token ceilings, credits |
| Copilot | **Broken**; text-only | Streaming, tool-calling, context/RAG, server-enforced safety, audit |
| Tenant isolation | RLS present, **unverified**; placeholder workspace IDs | RLS test matrix, remove placeholders, central workspace context |
| Team & RBAC | Roles exist; enforcement inconsistent | Server-side permission enforcement, invites, seat management, SCIM |
| SSO / SAML | None | Enterprise SSO + provisioning |
| Compliance | Legal pages present; gaps in disclaimers | DPA, subprocessor list, data export/delete, retention, SOC2 readiness |
| Observability | None found | Error boundaries, server logging, request IDs, AI-usage dashboard, alerting |
| Automations | Stub tabs | Trigger→condition→action engine + AI builder |
| Publishing | Scheduling state only | Social OAuth + publishing workers + webhook receivers |
| Schema/code alignment | Mismatches (`ai_usage_logs`, `post_platform_versions`, `competition_judge_scores`, `assets` bucket) | Migrations or code fixes (see §4) |
| Media/asset platform | Uploads partial | R2/Supabase storage policies, lightbox galleries, OG image gen |
| Admin platform | KPIs hardcoded; ~8 sections unbuilt | Real metrics + charts, workspace/user drill-downs, build or hide stubs |
| PWA | None | Manifest + service worker + offline shell + installable |
| Quality gates | Lint failing, no tests | Lint clean, unit/integration/E2E (Playwright), CI |
| Marketplace/escrow (Phase 3) | None | Stripe Connect, escrow via licensed provider, disputes, KYC |

### Recommended sequencing to "world-class enterprise"

- **Now (Phase 1):** fix copilot P0 + caps; Stripe billing + pricing consolidation; team management + permission enforcement; tenant-isolation fixes (placeholder IDs, central workspace context, RLS tests); schema/code alignment; PWA; route-depth pass on the flagship detail pages; lint clean + smoke tests.
- **Next (Phase 2):** automations engine + AI builder; copilot tool-calling + context + RAG + streaming; social publishing workers; scheduled-report email; AI credits/metering; client/approver portal; observability + admin metrics; media galleries (lightbox) + maps + DnD across the app.
- **Later (Phase 3, validate first):** marketplace + Stripe Connect escrow + disputes + supplier sourcing + financing + light accounting; SSO/SAML/SCIM; SOC2; white-label.

---

## 20. Reconciliation — 2026-06-13 Audit vs Current Reality (2026-06-29)

*The audit in Sections 1–18 was written on 2026-06-13 and is preserved for history. Several of its blocking findings have since changed. This section reconciles them. **Where this section conflicts with Sections 1–18, this section is authoritative.***

### 20.1 What changed since 2026-06-13

| Item | 2026-06-13 state | 2026-06-29 state | Evidence |
|---|---|---|---|
| Deployment | Not deployed | **Live in production on Vercel** at https://caption-fox.vercel.app | `vercel ls` shows Ready production deploys |
| Vercel env vars | n/a | **Set** — `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_ACCESS_TOKEN` (prod + dev) | `vercel env ls` |
| Site loading | n/a | Was **500 `MIDDLEWARE_INVOCATION_FAILED`** (missing env) → **fixed**; homepage + login render clean (0 console errors) | Chrome MCP |
| Production build | Timed out after 2 min | **Passes** (`next build` compiles ~7.7s; Vercel build Ready) | local + Vercel |
| `.env.local.example` | Incomplete (missing AI/app vars) | **Complete** — documents Supabase, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY`, optional Stability/PAT | repo |
| Favicon | Default Next.js logo (404 on `/favicon.ico`) | **Replaced** with Caption Fox icon (16/32/48 ICO + 512 PNG) | committed `7af812f` |
| Login a11y | Unlabeled inputs, no autocomplete | **Fixed** (`htmlFor`/`id`/`name`/`autoComplete`) | committed `d14809f` |

### 20.2 Original "Top 5 Risks" — status now

| # | Original risk (2026-06-13) | Status now | Note |
|---|---|---|---|
| 1 | Lint fails: 443 problems / 183 errors | **Still open** | Re-run 2026-06-29: **443 problems (183 errors, 260 warnings)** — unchanged. **But** `next build` and Vercel deploy **pass** because Next 16 does not gate the build on ESLint. So lint is a *quality* blocker, not a *build* blocker. Still fix before public launch. |
| 2 | Build did not complete in 2 min | **Resolved** | Build now compiles in ~8s locally and Ready on Vercel. |
| 3 | Stripe billing not wired | **Still open** | No checkout/portal/webhook routes. Billing remains UI/demo. Highest commercial blocker (see §19.4, §22). |
| 4 | Schema/code mismatches (`ai_usage_logs`, `post_platform_versions`, `competition_judge_scores`, `assets` bucket) | **Still open** | Not yet migrated/aligned. Runtime-failure risk on chat logging, post save, competition judging, settings upload. |
| 5 | Placeholder workspace IDs / tenant consistency | **Still open** | No central workspace context; placeholder IDs remain in campaign/UGC create flows. RLS untested across multiple workspaces. |

### 20.3 New blocker discovered after 2026-06-13

- **FoxAI copilot is broken end-to-end (P0).** `FoxAIBubble.tsx:66` sends `{ message, mode }`; `api/ai/chat/route.ts:15` requires a `messages[]` array (returns HTTP 400) and returns `{ text }` while the bubble reads `data.response`. Every copilot request fails today. (Full detail + upgrade plan in §19.1 / §19.3.)
- **AI cost/abuse hole.** AI routes have **no rate limits, no caps, no per-plan token ceilings** — confirmed against Propvora's metering pattern (§19.3). Must close before any paid AI exposure.

### 20.4 Launch Blockers Checklist — refreshed

| Blocker | 2026-06-13 | 2026-06-29 |
|---|---|---|
| Production build proven | Blocked | **Done** |
| Deployed to production | (implied blocked) | **Done** (Vercel live) |
| Env vars configured | Blocked | **Done** (Vercel + example file) |
| Lint clean | Blocked | **Blocked** (443/183 — not build-gating) |
| Stripe checkout/webhook live | Blocked | **Blocked** |
| Plan tiers consistent | Blocked | **Blocked** (3 conflicting sets — target tiers in §19.4) |
| Workspace/tenant context fixed | Blocked | **Blocked** |
| Placeholder IDs removed | Blocked | **Blocked** |
| Schema mismatches resolved | Blocked | **Blocked** |
| Onboarding persists core data | Blocked | **Blocked** |
| FoxAI copilot functional | (not yet found) | **Blocked (new P0)** |
| AI rate limits / caps | (not called out) | **Blocked (new)** |
| Demo seed data | Blocked | **Blocked** |
| Legal disclaimers complete | Blocked | **Blocked** |
| Support process ready | Blocked | **Blocked** |

### 20.5 Pricing reconciliation

The three conflicting plan sets (public page, onboarding, billing) flagged in §6 are **still unconsolidated**. The single source-of-truth target tiers are defined in **§19.4** (Free / Creator Pro £29 / Team £79 / Agency £199 / Enterprise) and supersede the §6 "Recommended Launch Pricing" table. Action unchanged and still open: centralise plan config consumed by pricing, onboarding, billing, and entitlement gates.

### 20.6 Net assessment

Compared with 2026-06-13, Caption Fox has moved from "won't build / not deployed" to **"deployed and rendering in production"** — a real step. The remaining launch-blocking set is now tighter and clearer: **(1) Stripe + entitlements, (2) tenant-context + placeholder IDs + RLS tests, (3) schema/code alignment, (4) FoxAI copilot fix + AI caps, (5) lint cleanup, (6) onboarding persistence + demo seed.** Everything else (depth, nav, enterprise) builds on top of those.

---

## 21. Navigation & Information Architecture Audit

*Goal: take Caption Fox from "10 flat sidebar items + tab-soup inside sections" to an enterprise-grade IA. The guiding decision the founder set: **view types are NOT internal tabs — they are view switchers only.** This section makes that a hard rule and applies it everywhere.*

### 21.1 The IA taxonomy (the rule)

Four distinct UI controls — never conflate them:

1. **Primary navigation (sidebar):** top-level product areas. Target 6–8 groups, not 10 flat items.
2. **Sub-tabs (internal tabs):** genuinely *different surfaces* of one area — different data, purpose, or workflow (e.g. a Campaign's *Brief* vs *Tasks* vs *Results*). Use sparingly; 3–6 max.
3. **View switchers:** the **same data** rendered differently — Cards / Table / Board(Kanban) / Calendar / Timeline / Map. **These must be a segmented control, never tabs.**
4. **Filters / saved views:** narrowing the same dataset — status, platform, date, assignee, sentiment. **Status is a filter, not a tab.**

**Smell test:** if two "tabs" show the same records with a different layout → view switcher. If they show the same records filtered by a status/field → filter chip or saved view. Only if they show *different records or a different job* is it a real sub-tab.

### 21.2 Current sidebar (10 items) — verdict

Current: Home · Calendar · Campaigns · Studio · Links · UGC · Inbox · Analytics · Listening · Settings (+ Admin).

Problems: 10 flat items with no grouping; **Listening is a thin feature given equal billing to Analytics**; **Links is a minor utility at top level**; Studio overlaps with its own sub-routes (Templates/Hashtags/Brands also exist as standalone routes); workspace switcher in the top nav is a non-functional dropdown; ⌘K search is a placeholder (not wired); notifications point at `home?tab=activity` instead of a real notification surface.

### 21.3 Recommended enterprise sidebar (grouped)

Group the 10 items into labelled sections so the rail reads as a product, not a list:

```
CREATE
  • Studio            (compose, AI generate, brand voice, templates, hashtags, media library)
  • Calendar          (plan + schedule; month/week/list = view switcher)
PROMOTE
  • Campaigns         (campaigns, giveaways, competitions)
  • UGC               (briefs, creators, submissions, rights)
  • Link in Bio       (was "Links" — demote visually, keep route)
ENGAGE
  • Inbox             (comments, mentions, DMs, reviews)
MEASURE
  • Analytics         (performance, audience, competitors, reports)
  • Listening         (merge UNDER Analytics/Insights as a sub-area, or keep as a gated add-on)
MANAGE
  • Settings
  • Admin (platform admins only)
```

- **Merge Listening into a "Insights/Measure" group** (or gate it as an Agency add-on). It does not warrant equal top-level billing while ingestion is unwired.
- **Demote "Links" → "Link in Bio"** under a CREATE/PROMOTE group. Keep the route; reduce its visual weight.
- **Studio is the content hub** — Templates, Hashtags, Brands, Media should be **sub-tabs/sub-routes of Studio**, not separate sidebar-level concepts (see 21.5).
- Keep total **primary destinations ≤ 8**; use group headers for scannability.

### 21.4 Per-section tab decision table (apply the rule)

For each section, every current internal "tab" is classified: **KEEP** (real sub-tab) · **VIEW** (→ view switcher) · **FILTER** (→ filter/saved view) · **MOVE** (→ its own sub-route) · **MERGE** · **REMOVE/BUILD** (stub).

| Section | Current internal tabs | Recommended treatment |
|---|---|---|
| **Home** (6: Overview/Today/Approvals/Ideas/Activity/Health) | Overview = dashboard. Today/Activity/Health are dashboard *widgets*, not tabs. Approvals + Ideas are real sub-surfaces. | **KEEP** Overview (as widget dashboard) + Approvals + Ideas. **MERGE** Today/Health into Overview as widgets. **MOVE** Activity → the real Notifications/Activity surface (also fixes the bell link). Result: 3 tabs, not 6. |
| **Studio** (6: Ideas/AI Generator/Post Builder/Creative Canvas/Brand Voice/Templates) + standalone routes (Templates, Hashtags, Brands) | Tabs are real *modes* but duplicate standalone routes. | **KEEP** as Studio sub-tabs: Compose (merge Post Builder + Creative Canvas), AI Generate, Ideas, Brand Voice, Templates, Hashtags, **Media Library (new)**. **MERGE** the duplicate standalone `/studio/templates` + `/studio/hashtags` into these sub-tabs (one home each). Keep `/studio/brands/[id]` as a **detail page**. |
| **Calendar** (7: Calendar/Scheduled/Published/Drafts/Needs Approval/Failed/Queue) | Classic tab-abuse: 6 of 7 are *statuses* of the same posts. | **VIEW**: Month / Week / List / **Timeline(swimlane)** as a view switcher. **FILTER**: Scheduled/Published/Drafts/Needs-Approval/Failed → status filter chips + saved views. **KEEP** "Publishing Queue" as one real sub-tab (operational, live status). Result: 1 calendar + view switcher + filters + 1 queue tab — not 7 tabs. |
| **Campaigns** (Overview/Giveaways/Competitions; Overview has Cards/Table/Kanban) | Cards/Table/Kanban is **already** the correct view-switcher pattern — keep it as a switcher (not tabs). Giveaways/Competitions are distinct campaign *types*. | **KEEP** Giveaways + Competitions as sub-tabs (distinct workflows). **VIEW** stays a switcher. Add a **Timeline/Gantt** view to the switcher. Consider a single "Campaigns" list with a *type* filter rather than 3 tabs — but giveaway/competition workflows differ enough to justify sub-tabs. |
| **Campaign detail** (10: Overview/Brief/Content/Calendar/Tasks/UGC/Budget/Assets/Results/Audit) | All are genuinely different surfaces → legitimate sub-tabs, but 10 is heavy. | **KEEP** but group: Overview, Brief, Content (+Calendar as a view inside Content), Tasks, Budget, Assets, Results, Audit. **MERGE** Calendar into Content (view switcher). **MERGE** UGC into Content or link out. Target ~7 sub-tabs + persistent right-rail summary. |
| **UGC** (8: Briefs/Creators/Submissions/Scripts/Rights/Samples/Payments/Performance) | Briefs/Creators/Submissions/Rights/Payments are real sub-surfaces. Scripts is a tool. Samples is thin. Performance is analytics. | **KEEP** Briefs, Creators, Submissions, Rights, Payments. **MERGE** Scripts into Briefs (AI tool inside the brief). **MERGE** Samples into Rights or Submissions. **MERGE** Performance into Analytics (or a UGC analytics sub-tab). **BUILD** the empty Rights/Samples/Payments (currently stubs). Result: ~5 real sub-tabs. |
| **Inbox** (9: Unified/Comments/Mentions/DMs/Reviews/Assignments/Saved Replies/Escalations/Done) | These are **folders/filters**, not tabs. | **FILTER/FOLDER**: Unified is the inbox; Comments/Mentions/DMs/Reviews/Escalations/Done = **folder list + filters** (left rail), like an email client. **MOVE** Saved Replies → a Settings/Inbox-settings sub-page (it's configuration). **KEEP** Assignments as a saved view ("assigned to me"). Result: an inbox with folders + filters, not 9 top tabs. |
| **Analytics** (11: Overview/Content/Audience/Reach&Impr/Engagement/Campaigns/Competitors/Reports/Export/Benchmarks/Settings) | Way too many; several are not tabs. | **KEEP** as sub-tabs: Overview, Content, Audience, Competitors, Reports. **MERGE** Reach&Impressions + Engagement + Benchmarks into Overview/Content as **chart sections + metric filters**. **MOVE** Export → an action button (not a tab). **MOVE** Settings → Analytics settings sub-page. **MERGE** Campaigns-analytics → link to campaign analytics. Result: ~5 sub-tabs. |
| **Settings** (11 top tabs) | 11 horizontal tabs is unusable. | **MOVE** to a **left sub-nav** with groups: *Workspace* (general, branding, channels, integrations), *People* (team, roles/permissions), *Billing* (plan, usage, invoices), *Account* (profile, security, notifications), *Data* (audit log, export, danger zone). Sub-nav, not a tab bar. |
| **Admin** (12 sidebar links, ~8 unbuilt) | Advertises sections that 404/don't exist. | **BUILD-OR-HIDE**: ship Dashboard, Workspaces, Users, Support, AI/Usage; **hide** Plans/Content&AI/Connections/UGC-Oversight/Compliance/System-Settings/Platform-Analytics/Audit until built. Add workspace/user **detail drill-down pages** (none exist). |

### 21.5 Studio consolidation (resolve duplication)

Today `Templates`, `Hashtags`, and `Brands` exist **both** as Studio tabs **and** as standalone routes (`/app/studio/templates`, `/app/studio/hashtags`, `/app/studio/brands/[id]`). Pick one home each:
- **Templates, Hashtags, Media Library, Brand Voice** → Studio **sub-tabs** (the standalone list routes become those sub-tabs).
- **Brands** → keep the **list inside Studio** but the **`/brands/[id]` detail page** stays a full page (deep entity).
- This removes the "is it a tab or a page?" ambiguity and gives content one operating hub.

### 21.6 Global navigation controls (currently weak)

| Control | Today | Target |
|---|---|---|
| Workspace switcher | Static dropdown (non-functional) in top nav | Real switcher: list memberships, switch active workspace, "create workspace", recent — drives the central workspace context (also fixes §20.2 #5). |
| Search (⌘K) | Placeholder input, not wired | **Command palette**: search posts/campaigns/creators/links + run commands ("New post", "Go to Analytics", "Invite teammate"). |
| Create (+) | 8 hard-coded links | Keep, but make it **context-aware** (top items reflect current section) and route through wizards. |
| Notifications (bell) | Links to `home?tab=activity` | A real **Notification Center** surface with read/unread, preferences, deep links. |
| Breadcrumbs | Inconsistent | Standard breadcrumb on every detail/sub-tab route. |

### 21.7 Mobile / PWA navigation

- Replace the desktop sidebar with a **bottom tab bar** of the 4–5 primary destinations (Home, Calendar/Create, Campaigns, Inbox, More) + a **"More" sheet** for the rest.
- Convert in-section tab bars to **horizontally scrollable segmented controls** or a **dropdown selector** on small screens (per the CLAUDE.md responsive rules).
- View switchers collapse to an icon menu; filters move into a bottom-sheet.
- Ship the **PWA shell** (manifest + service worker + installable + offline fallback) — currently absent (see §19.1 P1, §22).

---

## 22. Commercial Gap Analysis vs Best-in-Class + Enterprise Readiness

*Target: "the best social media marketing platform" — measured against Sprout Social, Hootsuite, Later, Buffer, Planable, Loomly, and Metricool. Caption Fox already has unusual **breadth** (campaigns + giveaways/competitions + UGC + listening + link-in-bio in one app). The gap is **depth and wiring**, not surface area.*

### 22.1 Competitor benchmark matrix

Legend: ✅ strong · 🟡 partial/UI-only · ❌ missing.

| Capability | Caption Fox today | Buffer | Later | Hootsuite | Sprout | Planable | Verdict for CF |
|---|---|---|---|---|---|---|---|
| Multi-platform **publishing** (real OAuth + workers) | ❌ (schedule state only) | ✅ | ✅ | ✅ | ✅ | ✅ | **Table-stakes gap** — biggest single miss |
| Content **calendar/planning** | 🟡 (built, no DnD) | ✅ | ✅ | ✅ | ✅ | ✅ | Strong; needs DnD + previews |
| **AI content** generation | 🟡 (routes exist; copilot broken) | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | **Differentiator** if copilot fixed + agentic |
| **Approval workflows / client collaboration** | 🟡 (approvals UI) | ❌ | 🟡 | 🟡 | ✅ | ✅ | Close to parity; add client portal |
| **Media library / DAM** | ❌ (uploads only) | 🟡 | ✅ | ✅ | ✅ | 🟡 | Gap — needed for teams |
| **Social inbox / engagement** | 🟡 (UI, placeholder bodies) | ❌ | ❌ | ✅ | ✅ | ❌ | Strong concept; must wire |
| **Listening / monitoring** | 🟡 (UI, no ingestion) | ❌ | ❌ | ✅ | ✅ | ❌ | Premium differentiator if wired |
| **Competitor analytics** | 🟡 (some sim data) | ❌ | 🟡 | ✅ | ✅ | ❌ | Differentiator |
| **Analytics + reporting** | 🟡 (charts; some demo) | 🟡 | ✅ | ✅ | ✅ | 🟡 | Good; add white-label + scheduled PDF |
| **Campaigns + giveaways + competitions** | ✅ (broad, built) | ❌ | ❌ | ❌ | ❌ | ❌ | **Unique wedge** — nobody bundles this |
| **UGC workflow** | 🟡 (built, stubs) | ❌ | 🟡 | ❌ | 🟡 | ❌ | **Differentiator** |
| **Link-in-bio** | 🟡 (usable) | ✅ | ✅ | ❌ | ❌ | ❌ | At/above parity |
| **Automations** | ❌ (stub tabs) | 🟡 | 🟡 | ✅ | ✅ | 🟡 | Gap (P2) |
| **Integrations / API / webhooks** | ❌ | ✅ | ✅ | ✅ | ✅ | 🟡 | Gap |
| **Billing / plan enforcement** | ❌ (demo) | ✅ | ✅ | ✅ | ✅ | ✅ | **Revenue blocker** |
| **Enterprise (SSO/SCIM/SOC2)** | ❌ | 🟡 | 🟡 | ✅ | ✅ | 🟡 | Phase 3 |

**Read:** Caption Fox's *moat* is the bundle (campaigns/giveaways/competitions + UGC + listening + link-in-bio + AI in one workspace). Its *liability* is that the table-stakes spine — **publishing, billing, inbox/listening wiring, and a working copilot** — is not yet real. Win = make the bundle real, not add more surface.

### 22.2 Capability gaps (what "best-in-class" requires)

1. **Publishing/scheduling engine (the #1 gap).** Real OAuth per platform (Meta/IG, TikTok, LinkedIn, X, YouTube, Pinterest), a publish worker/queue, retry + failure surfacing, first-comment, threads/carousels, and token-refresh. Without this, Caption Fox is a *planner*, not a *publisher* — and every competitor publishes.
2. **Approval + client collaboration.** Multi-stage approvals (built) + **a client/approver portal** (share a plan, comment, approve without a seat) — Planable/Sprout's wedge. High agency value; you already have the roles.
3. **Media library / DAM.** Central asset library with folders, tags, search, rights/expiry, reuse across posts — plus **lightbox galleries** everywhere assets appear (§19.2). Needed before teams trust it.
4. **Social inbox — wire it.** Real message bodies + attachments + reactions, send via platform APIs (gated), SLA timers, assignment, saved replies. Today it's UI with placeholder text.
5. **Listening + competitor — real ingestion.** Edge functions/workers to ingest mentions and competitor snapshots; otherwise label clearly as beta. This is a premium/Agency-tier differentiator when real.
6. **Reporting + white-label.** Branded PDF/scheduled email reports, client-ready, with logo/cover — Agency upsell. Wire the scheduled-reports email path (currently no sender).
7. **AI depth.** Fix the copilot (P0), then make it **agentic + context-aware + RAG-grounded** with tool-calling in-app actions and **credits/caps** (§19.3). This is where Caption Fox can *beat* incumbents, whose AI is shallow.
8. **Automations engine.** Trigger→condition→action (auto-repurpose to N platforms, auto-DM responders, performance alerts, recycle evergreen). Strong retention/expansion driver (Propvora pattern, §19.3).
9. **Integrations + public API + webhooks.** Canva/Drive/Dropbox/Slack/Zapier/Make + a documented API + outbound webhooks. Table-stakes for teams and the ecosystem flywheel.

### 22.3 Monetization & value-capture gaps

- **No billing = no revenue.** Stripe checkout/portal/webhooks + entitlement gates is the prerequisite for everything (§19.4).
- **No usage metering** → can't sell AI credits, seat overages, or post-volume tiers. Add metering + caps first.
- **Under-priced premium differentiators.** Listening, competitor analysis, UGC, white-label reports, and the client portal are **Agency-tier** value — gate them, don't give them away on lower tiers.
- **Expansion levers unbuilt:** seats (finish team mgmt), AI credit packs, extra brands/workspaces, white-label, and (Phase 3) marketplace take-rate. Single source-of-truth tiers in §19.4.
- **Annual + currency.** Add annual billing (visible savings) and GBP/USD/EUR — the pricing page toggles exist but aren't wired to Stripe.

### 22.4 Enterprise readiness gaps

| Pillar | Status | Needed |
|---|---|---|
| AuthN/AuthZ | Roles exist; enforcement inconsistent | Server-side permission enforcement; SSO/SAML; SCIM provisioning |
| Tenant isolation | RLS present, unverified; placeholder IDs | RLS test matrix; central workspace context; remove placeholders |
| Auditability | `audit_logs` partial | Comprehensive audit on sensitive actions; **admin audit export** |
| Compliance | Legal pages present; gaps | DPA, subprocessor list, data export/delete, retention, **SOC 2 readiness** |
| Reliability/observability | None found | Error boundaries, server logging, request IDs, AI-usage dashboard, alerting, status page |
| AI governance | None | Rate limits, caps, content/safety guardrails, model catalogue, usage logs |
| Data lifecycle | None | Backup/PITR policy, export, deletion/cascade, media cleanup |
| Quality gates | Lint failing, no tests | Lint clean, unit/integration/E2E (Playwright), CI |
| Support | Tickets table only | Real support process + SLAs + CSAT |

### 22.5 Prioritized roadmap to best-in-class

**P0 — make what exists actually work (4–6 weeks)**
1. Fix FoxAI copilot contract + add AI rate limits/caps.
2. Stripe checkout/portal/webhooks + entitlement gates + consolidate pricing.
3. Central workspace context + remove placeholder IDs + RLS test matrix.
4. Resolve schema/code mismatches (`ai_usage_logs`, `post_platform_versions`, `competition_judge_scores`, `assets` bucket).
5. Onboarding persistence + demo seed; lint cleanup; error boundaries.
6. **Nav refactor (Section 21):** grouped sidebar, view-switchers vs tabs vs filters, Settings left sub-nav, command palette + real workspace switcher, build-or-hide Admin.

**P1 — reach competitive parity + premium depth (next)**
7. **Publishing engine** (OAuth + workers + queue) — the defining gap.
8. Media library/DAM + lightbox galleries + avatars + KPI sparklines everywhere (§19.2).
9. Wire social inbox (real sends) + scheduled-report email + white-label reports.
10. Copilot → agentic + context + RAG + tool-calling (§19.3).
11. PWA shell (manifest + service worker + offline + installable).
12. Client/approver portal (agency wedge).

**P2 — differentiate + expand**
13. Automations engine + AI builder.
14. Real listening + competitor ingestion (gate as Agency).
15. Integrations marketplace + public API + webhooks.
16. Observability + admin metrics + status page.

**P3 — enterprise + platform (validate first)**
17. SSO/SAML/SCIM, SOC 2, DPA, advanced audit export.
18. Marketplace + Stripe Connect escrow + disputes + supplier sourcing + financing (§19.1 Phase 3).

**Bottom line:** Caption Fox already has a *wider* surface than Buffer/Later/Planable and a genuinely unique **campaigns + giveaways/competitions + UGC** wedge. To be "the best," don't add more sections — **make the spine real (publishing, billing, inbox/listening, copilot), tighten the IA (Section 21), and gate the premium differentiators**. That converts breadth into a defensible, enterprise-ready platform.

---

## 23. Campaign Operating System, Supplier Marketplace & Automation Re-Audit (2026-07-23)

*Added 2026-07-23 after a further code-level assessment and a current market/documentation review. This section supersedes stale statements in Sections 19, 21 and 22 where the repository has since changed. It distinguishes a rendered scaffold from an operational product and expands the roadmap beyond organic social into paid media, lifecycle/email, influencer, affiliate, search, web and other marketing workstreams.*

### 23.1 Corrected current reality

Several items described as missing in the June audit have now been partially added:

| Area | What now exists in the repository | Honest current verdict |
|---|---|---|
| Grouped app navigation | `Sidebar.tsx` now groups Home, Create, Promote, Engage, Measure and Manage. | **Shipped UI.** Section 21.2's "10 flat items" statement is stale. The rail is still too long once new marketing modules are considered. |
| Command palette | `CommandPalette.tsx` is wired to Cmd/Ctrl+K and includes navigation/create commands. | **Partial.** It searches a static command registry, not posts, campaigns, creators, orders or suppliers. |
| Workspace switcher | `WorkspaceSwitcher.tsx` lists memberships, writes an active-workspace cookie and refreshes. | **Broken semantics.** Many pages still independently select the first `workspace_members` row and ignore the cookie, so the shell can say one workspace while page queries use another. Fix before adding more workspaces. |
| Notification bell | A real `NotificationsBell` is present and the app shell loads notifications. | **Partial.** Needs a full notification centre, pagination/preferences, deep-link validation and cross-workspace scoping. |
| Fox AI contract | `FoxAIBubble` now sends `messages[]` and reads `{ text }`, matching `/api/ai/chat`. | **The old P0 request/response bug is fixed.** Fox remains a stateless prompt chat, not a grounded copilot or agent. |
| Supplier marketplace | Public `/marketplace`, `/marketplace/[id]`, `/marketplace/sell`; separate `/supplier` shell with dashboard, listings, orders, disputes, profile and payouts; marketplace migration and seed exist. | **Scaffold/adminless beta only. Not transaction-safe and not release-ready.** Details in 23.5. |
| Caption Fox affiliate programme | `/app/affiliates` plus affiliate tables/migration. | **Separate product concept.** This promotes Caption Fox subscriptions; it must not be reused for a customer's own affiliate campaigns. |
| PWA | A Next.js manifest exists. | **Partial only.** No complete offline/service-worker/update/install QA was found, so "PWA shipped" is not yet justified. |
| Automations | No automation/workflow route, engine, schema, queue or canvas dependency was found. | **Missing.** The CLAUDE.md automation checklist is a release contract, not an implementation. |
| Marketing campaign breadth | Generic campaign records support 12 labels: standard, launch, awareness, giveaway, competition, UGC, influencer, seasonal, event, lead-gen, retargeting and partnership. | **Taxonomy only.** Paid ads, email, influencer and partner programmes do not yet have their own operational data models or workflows. |

**Net assessment:** Caption Fox has moved from a single-workspace UI toward a platform shell, but it has not yet become a campaign operating system or a safe two-sided marketplace. The immediate job is to make the new foundations true before adding more navigation.

### 23.2 Product and route architecture decision

Use **two operating workspaces plus one discovery surface**, not a separate workspace for every marketing discipline:

1. **Campaign Manager workspace (buyer/marketer):** creators, brands, internal marketing teams and agencies plan and operate marketing here.
2. **Supplier workspace (seller):** freelancers, creators, influencers, media buyers and agencies manage their profile, services, orders, delivery and payouts here.
3. **Marketplace:** public/buyer-facing discovery and purchasing surface connecting the two.

A single user may be a marketer, a supplier, or both. "Creator" is a persona, not a sufficient tenancy boundary. Do not create separate email/password accounts when one identity can have multiple memberships and a supplier profile.

#### Recommended canonical routes

```text
/campaign-manager                       campaign workspace shell
  /home
  /calendar
  /campaigns
  /studio
  /inbox
  /analytics
  /automations
  /settings

/supplier                               supplier workspace shell
  /home                                 redirect from /supplier
  /listings
  /orders
  /orders/[id]
  /messages
  /calendar
  /reviews
  /disputes
  /earnings
  /settings

/marketplace                            public/buyer discovery
  /categories/[slug]
  /suppliers/[slug]                     real public shopfront
  /listings/[id]
  /orders/[id]                          authenticated buyer order room
  /favourites
```

- If the founder wants `/campaign-manager`, use that exact spelling; never ship `/campaign-manaager`.
- Migrate `/app/*` with tested permanent redirects and a route map. Do not run a blind search/replace: emails, notifications, saved links, OAuth callbacks, tests and public links may contain old paths.
- Keep `/app/*` aliases during a deprecation window. The rename is not a product feature and should not displace transaction, publishing or auth work.
- Do not call the existing `/app/campaigns` page "Campaign Manager" while the shell contains Studio, Inbox, Analytics and Settings. `Campaign Manager` describes the whole buyer workspace; `Campaigns` remains one entity area inside it.

#### Workspace switcher target

The top-left switcher should have two levels:

- **Surface:** Campaign Manager / Supplier Workspace / Marketplace.
- **Account context:** the active brand/agency workspace inside Campaign Manager, or the active supplier business inside Supplier Workspace.

The active context must be resolved server-side once and supplied to every page. Remove all "first membership" lookups. Mutations, AI tools, notifications, command search and analytics must use the same active context and must fail closed if it is missing.

#### Onboarding branch

Replace the current four-persona-only choice with an intent gate:

- **Run marketing:** Creator, Small Business, Brand, Agency -> Campaign Manager onboarding.
- **Sell marketing services:** Individual/Freelancer, Creator/Influencer, Agency/Studio -> supplier onboarding.
- **Both:** finish the campaign workspace first, then create a linked supplier profile.

Supplier onboarding needs: legal/business identity, service categories, country/currency, portfolio, availability, terms acceptance, tax/VAT status where relevant, identity/KYC hand-off, Stripe Connect onboarding, payout capability status, moderation/verification and first-listing review. Do not promise escrow or payouts before the connected account is capable and the payment flow is live.

### 23.3 Campaign Manager: full marketing taxonomy without sidebar bloat

The right model is one **universal campaign portfolio** with type-specific workstreams. Do not add 12-15 new top-level sidebar links. The campaign entity should provide common planning and measurement, while adapters add fields and workflows for each channel.

#### Universal campaign object

Every campaign type should share:

- objective, funnel stage, owner, team, brand, market, dates and status;
- audience/segments/personas;
- channel mix and workstreams;
- brief, messaging, offer and creative requirements;
- budget, forecast, actual spend, commitments and supplier costs;
- assets, tasks, dependencies, approvals and comments;
- tracking plan: UTMs, pixels/events, promo codes, referral links and attribution model;
- content/calendar view, automation links and supplier orders;
- targets/KPIs, live results, experiments, learnings and audit history.

The current campaign type enum mixes **strategy** (`brand_awareness`), **occasion** (`seasonal`), **mechanic** (`giveaway`) and **channel** (`influencer`). Replace it with orthogonal fields:

```text
objective: awareness | engagement | traffic | leads | revenue | retention | advocacy
channel: organic_social | paid_media | email_crm | influencer | affiliate_partner |
         ugc | seo_content | web_cro | messaging | event | pr_earned | referral_loyalty
mechanic: always_on | launch | promotion | giveaway | competition | webinar |
          sponsorship | nurture | retargeting | experiment
```

This avoids an enum explosion and supports a product launch that uses email, creators, paid social and a landing page in one campaign.

#### Marketing workstreams to add

| Workstream | Required operating depth | Build/integrate verdict |
|---|---|---|
| **Organic social** | Existing Studio + Calendar + publishing queue, channel variants, approvals, first comments, threads/carousels, evergreen recycling and real API publishing. | **Finish first.** This remains the table-stakes spine. |
| **Paid media / Ads Manager** | Connected ad accounts; campaign/ad-set/ad hierarchy; objective; budget and pacing; bid strategy; audiences; placements; creative variants; tracking/pixels/conversion events; approval; policy status; spend/ROAS/CAC reporting; automated rules. | **Add as a major module.** Start read-only reporting + draft/export, then gated direct creation. |
| **Email and lifecycle CRM** | Audience/consent, segments, suppression lists, sender/domain status, template builder, broadcasts, sequences/journeys, triggers, A/B tests, send-time, deliverability, opens/clicks/conversions and unsubscribes. | **Integrate before becoming an ESP.** Use provider adapters for Mailchimp/Klaviyo/HubSpot/Resend rather than building mail infrastructure first. |
| **Influencer campaigns** | Discovery and shortlists; audience fit/authenticity; outreach; negotiation; contracts; brief; deliverables; content review; disclosure; gifting; usage rights/whitelisting; posting proof; codes/links; payments; performance. | **Dedicated workflow required.** It is not merely a generic `influencer` label and is not the same as UGC. |
| **Customer affiliate/partner campaigns** | Programme/application pages; partner recruitment; terms; links/codes; attribution; commission tiers; validation/locking period; fraud checks; reversals; payouts; partner portal; performance. | **Separate domain from Caption Fox Affiliates.** Name it `Partner Campaigns` or `Affiliate Programmes` to prevent confusion. |
| **UGC** | Briefing, sourcing, product samples, deliverables, review/revisions, rights/licensing, usage expiry, payments and performance. | **Deepen the existing module** and connect it to supplier orders. |
| **SEO and content marketing** | Topic/keyword clusters, content briefs, editorial workflow, on-page checklist, publish URL, Search Console query/page data, refresh tasks and content attribution. | **Add after publishing/analytics.** Integrate Search Console; do not build a crawler/backlink index in v1. |
| **Web, landing pages and CRO** | Landing pages/forms, lead capture, CTA/offer variants, UTM builder, pixels/events, experiments, conversion funnel and lead routing. | **Add a lightweight builder/integration layer.** Keep Link in Bio as one landing-page format. |
| **SMS, WhatsApp and push** | Consent, templates, segments, journeys, quiet hours, frequency caps, replies, delivery status and opt-out compliance. | **Provider integration only at first.** High compliance risk; approval and preference gates are mandatory. |
| **Events and webinars** | Registration page, invitations, speakers, sessions, reminders, attendance, follow-up, recordings, leads and attribution. | **Campaign template + integrations**, not a separate workspace. |
| **PR and earned media** | Media/contact lists, pitches, coverage, mentions, sentiment, share of voice and clipping/reporting. | **Later premium add-on**, connected to Listening. |
| **Referral and loyalty** | Advocate/referral offers, codes, reward rules, milestones, fraud controls, reward fulfilment and cohort/LTV reporting. | **Later growth module**, distinct from affiliate partners. |
| **Offline/direct mail/OOH** | Brief, vendors, placements, print assets, QR/promo codes, proof-of-play/delivery and attributed response. | **Tracking/project template only**, not a native buying system. |

Current platform documentation supports this objective-and-channel separation: Google Ads treats the objective and campaign type as separate decisions and includes Search, Video, Shopping, App, Demand Gen and Performance Max surfaces ([Google Ads objectives](https://support.google.com/google-ads/answer/7450050?hl=en)); Meta optimises around objectives such as awareness, traffic, engagement, leads, app promotion and sales ([Meta ad objectives](https://www.facebook.com/business/ads/ad-objectives?locale=en_GB)); TikTok separates brand objectives from traffic, lead generation, app promotion and sales ([TikTok bidding/objective guide](https://ads.tiktok.com/help/article/bidding-interface)); and Pinterest currently exposes awareness, video completion, consideration, leads and sales objectives ([Pinterest objectives](https://help.pinterest.com/en/business/article/campaign-objectives)).

Email is also more than a composer: current Mailchimp documentation distinguishes regular, plain-text, A/B or multivariate and automated campaigns ([Mailchimp campaign types](https://mailchimp.com/help/getting-started-with-campaigns/)). Shopify Collabs distinguishes open-access and invite-only creator affiliate programmes with commission rules ([Shopify Collabs programmes](https://help.shopify.com/en/manual/promoting-marketing/collabs/merchants/collabs-programs)). Search Console exposes query/page performance, branded vs non-branded analysis and change comparisons, which defines a sensible integration boundary for SEO rather than inventing rankings ([Search Console performance use cases](https://support.google.com/webmasters/answer/17010961?hl=en)).

#### Paid Ads Manager: recommended route depth

```text
/campaign-manager/paid-media
  Overview | Campaigns | Creative | Audiences | Conversions | Rules | Reports | Connections

Campaign detail
  Overview | Ad sets/groups | Ads | Creative tests | Budget | Results | Change history
```

Release in three safe levels:

1. **Observe:** OAuth/connect, import accounts/campaigns/spend/results and reconcile attribution.
2. **Plan:** build briefs, budgets, creatives, audiences and drafts; export/push for approval.
3. **Operate:** create/pause/edit ads through provider APIs behind permissions, spend caps, policy validation, two-person approval, idempotency and audit logs.

Never let Fox AI silently launch, increase spend, broaden an audience or pause a revenue campaign.

### 23.4 Automations and calendar operations

#### Automation product surface

```text
/campaign-manager/automations
  Automations | Recipes | Connections | Run history | Usage & settings

/campaign-manager/automations/[id]
  Visual canvas | Versions | Test data | Runs | Audit
```

The visual builder needs a maintained node/edge library (for example React Flow), accessible keyboard alternatives and a non-canvas form view on mobile. Drag-and-drop is only the editor; the actual product is the durable execution engine.

Required engine components:

- immutable published workflow versions and editable drafts;
- event registry with typed payload schemas;
- trigger, condition, branch, delay, action, approval, error and terminal nodes;
- worker queue, scheduled jobs, retries/backoff, dead-letter queue and replay controls;
- per-step execution log with input/output redaction;
- idempotency keys, deduplication, concurrency controls and loop prevention;
- encrypted connection secrets and credential rotation;
- dry-run/test event, pause, clone, template install and rollback;
- quotas by plan plus workspace/user permissions;
- human approval nodes for publishing, replies, supplier acceptance, spend and money movement;
- webhook signature verification, replay protection, egress allow-list/SSRF protection;
- monitoring for stuck/delayed runs and a support-safe run inspector.

#### Marketing-specific trigger catalogue

Start with a curated catalogue rather than a generic property-management list:

- **Content:** post created/approved/scheduled/published/failed; asset expiring; approval overdue.
- **Calendar:** date reached; schedule gap detected; best-time window; recurring cadence; campaign milestone moved.
- **Social:** comment/DM/mention/review received; keyword/sentiment threshold; follower or engagement anomaly.
- **Campaign:** campaign created/status changed/budget threshold/milestone overdue/goal reached.
- **Paid media:** ad disapproved; spend threshold; CPA/ROAS threshold; pacing deviation; creative fatigue.
- **Email/CRM:** contact subscribed/unsubscribed; segment entered; form submitted; email opened/clicked/bounced; inactivity window.
- **Influencer/UGC:** application received; creator selected; deliverable due/submitted/approved; rights expiring; post detected.
- **Affiliate:** partner applied/approved; conversion tracked/locked/reversed; payout due; fraud threshold.
- **Marketplace:** order paid/accepted/delivered/approved/disputed; evidence due; review eligible; payout status changed.
- **Analytics:** KPI anomaly; report due; attribution data refreshed.
- **External:** inbound signed webhook and scheduled/cron trigger.

Actions should include create/update task, draft content, generate variants, request approval, schedule content, pause for approval, notify/assign, draft reply/email, add/remove segment/tag, create supplier brief/order draft, update campaign budget forecast, send signed webhook and create report. Financial release, refund, paid-ad spend changes and public publishing remain approval-gated.

#### Proper calendar automation

The current calendar is primarily a dated content view. Add:

- drag-to-create and drag-to-reschedule with optimistic rollback and timezone safety;
- dependency-aware campaign timelines and milestone shifting;
- recurring series and evergreen queues with duplicate/repetition guards;
- channel cadence rules, blackout dates, quiet hours and approval lead times;
- best-time recommendations with confidence/source shown;
- gap detection and AI suggestions that create **drafts**, never automatic low-quality filler;
- automatic repurposing windows across channels;
- supplier deliverables and influencer posting windows as optional calendar layers;
- email sends, ads flights, webinars and launches in the same campaign timeline;
- collision, capacity and budget warnings;
- publishing queue with ETA, token-expiry warning, retry, partial-success handling and incident history;
- iCal/Google/Outlook sync with conflict policy and one source of truth.

### 23.5 Supplier workspace and marketplace: what is still missing

#### P0 truth, payment and authorization defects

The current marketplace must not be promoted as escrow-protected yet:

1. `/marketplace/[id]` inserts an order directly with `status: 'escrow_held'`; no PaymentIntent is created and `stripe_payment_intent` remains empty. The UI itself comments that payment capture is stubbed.
2. The insert RLS checks only `buyer_id = auth.uid()`. A malicious client can currently attempt to choose an arbitrary listing/supplier combination, amount, currency and `escrow_held` status. Price, supplier and status must be derived server-side from the active listing and verified PaymentIntent.
3. The supplier Orders UI attempts to update order status, but the migration defines no supplier update policy/RPC. The button is therefore expected to fail under RLS.
4. The supplier Disputes UI attempts to update disputes, but the migration defines select-only dispute access. Evidence submission is therefore expected to fail under RLS.
5. Public screens fall back to demo listings and demo reviews. Demo data must be unmistakably labelled and must never expose an enabled purchase/escrow path.
6. The migration is not reconciled into the canonical `supabase/schema.sql` or generated database types, creating fresh-database/type drift.

**Immediate action:** hide/rename all "escrow", "funds protected" and automatic-payout claims until a test payment passes end-to-end. Replace with "Payments coming soon" behind a feature flag. Do not simulate a held balance from order rows.

Stripe Connect is the correct provider boundary, but not a magic escrow toggle. Stripe documents that marketplaces must onboard and verify connected accounts, choose a charge model and explicitly manage transfers/payouts ([Connect overview](https://docs.stripe.com/connect)). With destination charges or separate charges/transfers, the platform is commonly debited for refunds/disputes and can carry loss exposure ([Connect charge types](https://docs.stripe.com/connect/charges?locale=en-GB), [Connect disputes](https://docs.stripe.com/connect/disputes?locale=en-GB)). Product copy and legal review should use "payment held pending approval" only if the implemented funds flow and jurisdiction permit it; do not imply Caption Fox itself is a regulated escrow agent.

#### Complete buyer-supplier transaction lifecycle

```text
draft request/custom offer
  -> checkout/payment authorised
  -> supplier accepts/declines
  -> requirements and milestones agreed
  -> work in progress
  -> deliverable submitted
  -> buyer approves or requests revision
  -> payment transfer becomes eligible
  -> payout/refund/dispute
  -> transaction-verified review
```

Required missing surfaces:

- buyer order centre and order detail room;
- pre-sale messaging, custom briefs and custom offers;
- requirements form, files, milestones, due dates and revision limits;
- order conversation, internal support notes and notification preferences;
- delivery/evidence upload, versions, preview, acceptance and revision requests;
- cancellation/refund rules, expiry/auto-cancel and no-response timers;
- supplier acceptance and capacity/availability calendar;
- buyer approval plus safe auto-approval policy after a disclosed review window;
- transaction events/timeline and immutable financial ledger;
- admin marketplace operations: supplier moderation, listing review, risk flags, order intervention, disputes, refunds, review moderation and audit export.

#### Supplier shopfront and discovery

The profile editor is not yet a shopfront system. Add:

- public `/marketplace/suppliers/[slug]`;
- avatar/cover, verified identity/business badges and response metrics;
- specialisms, industries, platforms, languages, location/timezone and service area;
- portfolio media/case studies with permission and rights metadata;
- service packages (Basic/Standard/Premium), add-ons, turnaround and revisions;
- hourly, fixed-price, retainer, booking and custom-quote models;
- availability, lead time, minimum notice and pause/holiday mode;
- FAQs, requirements, cancellation/revision terms;
- transaction-verified reviews, supplier response and rating breakdown;
- favourites, saved searches, comparison and shortlist;
- ranking rules that do not fabricate ratings or pay-to-win without disclosure.

Expand supplier capabilities beyond the current five labels: UGC creator, influencer, photographer/videographer, designer/editor, copywriter, social/community manager, paid-media buyer, email/CRM specialist, SEO/content specialist, web/CRO specialist, strategist, PR specialist and agency/studio. Store capabilities as many-to-many tags; do not force one supplier into a single `type`.

#### Reviews, disputes and payouts

- Reviews: one eligible review per completed order/party; verified-purchase marker; edit window; moderation/appeal; aggregate recalculation in a transaction; anti-retaliation and abuse reporting.
- Disputes: reason taxonomy, eligibility/deadline, evidence files, evidence access control, mediation owner, SLA, status timeline, settlement options, refund/transfer reversal, appeal policy and immutable decision log.
- Payouts: Connect onboarding/status, capability requirements, platform fee, tax/VAT fields, pending/available/paid balances derived from provider ledger, payout schedule, failed payout recovery and downloadable statements.
- Security: server-only checkout/order RPC, listing snapshot at purchase, signed webhooks, replay protection, idempotency, amount/currency validation, no client-controlled financial status, rate limits and full negative RLS tests.

### 23.6 Proper Fox copilot and agents

The copilot is no longer broken at the HTTP-contract level, but it is still a generic chatbot:

- the bubble does not send `workspaceId`, brand, route, record or selected campaign context;
- `/api/ai/chat` does not retrieve workspace records or expose tools;
- mode names only change the system prompt; Tasks/Alerts/Inbox do not actually read or act on those domains;
- no streaming, persisted conversation, citations, action preview, approval queue, result receipt or undo;
- no prompt-injection defence around external inbox/listening/supplier content;
- usage logging is attempted, but the user cannot see a reliable quota/cost breakdown.

#### Target architecture

Build one **Fox** experience with specialist skills, not five unrelated chat tabs:

1. **Context resolver:** authenticated user, active surface/workspace, role/permissions, route, selected records, brand voice and plan entitlements.
2. **Read tools:** search campaigns/posts/assets/analytics/inbox/listening/suppliers/orders/calendar, all server-side and RLS-equivalent.
3. **Draft tools:** create campaign brief, content variants, report, task plan, automation draft, supplier brief or reply draft.
4. **Mutation tools:** narrowly typed server actions with validation, idempotency and audit. Always show an action preview.
5. **Approval service:** required for publish/send, paid-media changes, supplier acceptance, refunds/transfers and bulk changes; support two-person approval where risk warrants it.
6. **Grounding/RAG:** workspace documents, brand guidelines and connected data with source links and freshness timestamps.
7. **Conversation/memory:** workspace-scoped threads; explicit saved preferences; retention/delete controls; never silently train or create cross-workspace memory.
8. **Execution receipts:** tool called, records affected, success/failure, links and undo/repair path.
9. **Evaluation/observability:** tool success, hallucination, permission-denial, prompt-injection, latency, cost and human-override metrics.

Anthropic's MCP documentation defines MCP as a standard way to connect models with data sources and tools ([Anthropic MCP documentation](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)). MCP can be an integration boundary, but every Caption Fox tool still needs local auth, workspace scoping, schemas, approvals and audit; the protocol does not supply those controls automatically.

Recommended Fox jobs:

- strategist: campaign plan, audience/message/offer and channel mix;
- creator: captions, scripts, email/ad variants and repurposing;
- campaign operator: status, blockers, dates, tasks, approvals and supplier work;
- analyst: grounded performance explanation, anomaly investigation and recommended experiment;
- community assistant: classify and draft inbox replies/escalations;
- automation assistant: convert a plain-language request into a disabled, testable workflow draft.

Fox should never autonomously publish, send a public reply/email, change ad spend, release/refund money, accept legal terms or resolve a dispute.

### 23.7 Data model additions

Do not bolt each new module onto `campaigns` JSON. Add shared primitives plus adapter tables:

- `campaign_workstreams`, `campaign_objectives`, `campaign_channels`, `campaign_metrics`;
- `campaign_budgets`, `budget_lines`, `campaign_tracking_links`, `conversion_events`;
- `experiments`, `experiment_variants`, `attribution_touchpoints`;
- `ad_accounts`, `ad_campaign_refs`, `ad_groups`, `ads`, `ad_creatives`, `audiences`, `ad_daily_metrics`;
- `contact_lists`, `contacts`, `consent_events`, `segments`, `email_campaigns`, `email_variants`, `journeys`, `message_deliveries`, `suppressions`;
- `influencer_profiles`, `influencer_campaign_members`, `creator_contracts`, `deliverables`, `usage_rights`, `tracking_codes`;
- `partner_programs`, `partners`, `partner_links`, `commissions`, `commission_events`, `partner_payouts`;
- `automation_definitions`, `automation_versions`, `automation_nodes`, `automation_edges`, `automation_runs`, `automation_step_runs`, `automation_secrets`;
- `marketplace_order_events`, `marketplace_messages`, `marketplace_deliverables`, `marketplace_milestones`, `marketplace_evidence`, `marketplace_financial_events`;
- `agent_threads`, `agent_messages`, `agent_tool_calls`, `agent_approvals`, `agent_action_receipts`.

All operational tables need `workspace_id` or an unambiguous parent that enforces workspace ownership, `created_by`, timestamps, version/concurrency strategy, indexes, audit events, retention policy and tested RLS. Financial/provider-derived tables need immutable event records and reconciliation, not editable balance columns.

### 23.8 Recommended buyer workspace navigation

Keep the sidebar compact and let Campaigns own the channel breadth:

```text
OVERVIEW
  Home

PLAN & CREATE
  Studio
  Calendar

CAMPAIGNS
  Campaigns            all campaign types and workstreams
  Paid Media           only when the Ads add-on is enabled
  Partners & Creators  UGC + influencer + affiliate programmes

ENGAGE
  Inbox

MEASURE & OPTIMISE
  Analytics            includes Listening/Competitors as gated sub-areas

AUTOMATE
  Automations

MANAGE
  Settings
```

- Link in Bio becomes a Studio/Web tool rather than a permanent primary destination.
- Listening and Competitors sit under Analytics/Insights.
- Giveaways and Competitions remain campaign mechanics/templates, not primary destinations.
- Email appears as a campaign workstream at first; only promote it to a top-level Lifecycle area after it has enough operational depth and usage.
- Marketplace access belongs in the surface switcher/global menu, not mixed into the campaign sidebar.

### 23.9 Priority order and release gates

#### P0 - correct unsafe or misleading foundations

1. Remove/feature-flag escrow and payout claims; disable fake checkout.
2. Replace client order insertion with a server endpoint/RPC deriving listing, supplier, amount, currency and initial status.
3. Repair and test marketplace RLS/state transitions; add admin-only dispute/refund controls.
4. Reconcile marketplace migrations into canonical schema/types.
5. Fix active-workspace semantics everywhere before the `/campaign-manager` migration.
6. Update Sections 19-22 status statements during implementation so the audit does not remain internally contradictory.

#### P1 - finish the marketing spine

1. Real social account OAuth, publishing workers, queue/retries and ingestion.
2. Billing/entitlements, usage metering, plan/add-on gates and observability.
3. Media library/DAM, approvals/client portal, real inbox and scheduled reports.
4. Route migration `/app/*` -> `/campaign-manager/*` only after route registry, redirects and tests are ready.

#### P2 - supplier marketplace beta

1. Supplier onboarding, Connect/KYC/capabilities and public shopfront.
2. Buyer order room, messaging, deliverables, revisions and transaction timeline.
3. Payment authorisation/transfer lifecycle, refunds, disputes, reviews and admin operations.
4. Private beta with capped categories/countries/GMV and manual support playbooks.

#### P3 - campaign operating depth

1. Universal campaign/workstream model and portfolio timeline.
2. Paid Media observe/plan phases.
3. Influencer + UGC workflow consolidation around deliverables/rights.
4. Customer affiliate/partner programmes, clearly separate from Caption Fox Affiliates.
5. Email/lifecycle provider integrations.

#### P4 - automation and agentic differentiation

1. Durable event/queue engine and recipe library.
2. Visual automation canvas with test/run history.
3. Fox context resolver + read tools, then draft tools.
4. Approval-gated mutation tools and execution receipts.
5. Calendar automation, cross-channel optimisation and supplier/order recipes.

#### P5 - selective breadth and enterprise

SEO/Search Console, web/CRO, messaging, events, PR, loyalty/referral, public API/webhooks, SSO/SCIM, advanced data governance and compliance. Add each only when it has a real owner, integration path, entitlement, schema, RLS/tests and measurable customer demand.

### 23.10 Build-vs-integrate guardrails

Do **not** initially build:

- an email-delivery network/MTA;
- a Google-scale SEO crawler or backlink index;
- a native ad exchange/bidding engine;
- self-custodied escrow, lending or supplier financing;
- native webinar/video hosting;
- every ad network's full editor at once;
- autonomous publishing, spend control or money movement.

Caption Fox should own the **campaign system of record, workflow, creative, approvals, automation, supplier coordination and cross-channel measurement**. Use provider adapters for delivery, money movement, identity verification, ad serving and specialist data. This is the shortest path to broad marketing coverage without creating an unmaintainable collection of shallow tools.

### 23.11 Revised commercial conclusion

The strongest expanded positioning is:

> **Caption Fox is the campaign operating system that brings planning, content, channels, creators, suppliers, approvals, automation and performance into one workspace.**

The supplier marketplace can become a defensible supply-side moat, and paid media/email/influencer/affiliate coverage can make the campaign record genuinely cross-channel. However, the present commercial priority remains **truth and execution depth**: real publishing, consistent workspace context, safe transactions, provider integrations and a permissioned agent. More menu items without those foundations would increase perceived breadth while reducing trust.
