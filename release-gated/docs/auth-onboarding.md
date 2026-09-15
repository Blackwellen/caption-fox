# Release evidence — Authentication, Registration & Onboarding

**Date:** 15 September 2026 · **Surface:** public auth, affiliate portal, admin sign-in, workspace onboarding
**Release score:** 92 / 100 · **Decision:** blocked pending manual fix (see `release-gated/user-fixes/auth-onboarding.md`). The three blockers are config/ops steps only Caption Fox staff can do; code is complete.

## Routes

| Page | Route | Reference image |
|---|---|---|
| Login | `/login` | (1) |
| Registration (5 types) | `/signup` | (2) |
| Affiliate login | `/affiliates/login` → `/affiliates/portal` | (3) |
| Affiliate application (3 steps) | `/affiliates/signup?step=1..3` | (4) |
| Admin login (password + TOTP) | `/admin-login` | (5) |
| Creator / Business / Brand / Agency / Supplier onboarding | `/onboarding/{type}?step=1..4` | (6)–(10) |
| Supporting | `/continue`, `/callback`, `/onboarding` (chooser, `?change=1`, `?new=1`), `/invite/[token]`, `/mfa`, `/admin/affiliates`, `/legal/affiliate-terms` | — |

## Screen sizes tested (Chrome MCP)
- **1448×1088 (reference size):** all 10 pages, compared side by side with refs (1)–(10).
- **834×1112 tablet:** affiliate application and agency onboarding.
- **390×844 mobile touch:** login, affiliate login, register and brand onboarding. No horizontal overflow (`scrollWidth` = 390).
- **Not yet captured:** 1280/1024/768/430/360 for every page, and PWA standalone.

**Responsive behaviour:**
- **Auth pages:** the marketing copy and product preview show at `lg` (≥1024px) only. On tablet and mobile the form stands alone, per user feedback that the scrolled-down marketing was pointless there.
- **Onboarding steppers:** phones show a compact "Step N of 4 — Label" indicator with a progress bar. Tablets and up show the full stepper. The inline (agency and creator) stepper hides step descriptions below `xl`, so four steps fit at tablet width.

## 1:1 visual pass (15 Sep, second round)
Font stack now matches the homepage (Inter / Inter Tight via `.cf-home`; Caveat for the supplier handwriting). Headings use extra-bold with −0.025em tracking, and onboarding uses a dedicated `compact` field size: 40px on desktop, 44px touch targets below `sm`. Measured positions at 1448×1088, ours vs the reference:

| Page | Primary CTA (y, centre) | Notes |
|---|---|---|
| Creator (6) | 997 vs ~1005 | Intro on one line; the stepper fits without truncation. |
| Business (7) | 1003 vs 999 | Dense line stepper; no divider above the nav, as in the ref. |
| Brand (8) | 1026 vs 1013 | |
| Agency (9) | 983 vs 1007 | Service lines on one row; the completed step shows a check ring. |
| Supplier (10) | ~1100 vs 1037 | **Residual:** one deliverable tag wraps to a third row at our font metrics. The ref's tags use ~12px text, which we don't copy because of readability. |

`cn()` is plain `clsx` (no tailwind-merge), so per-flow overrides of shared classes use `!` modifiers.

## E2E customer stories run (live Supabase)
| Story | Result |
|---|---|
| Wrong password → "Email or password is incorrect." (no provider leak) | ✅ |
| Creator: login → `/onboarding/creator` → 4 steps → double-click "Create workspace" → exactly **1** workspace, owner membership, default brand, completed draft, `onboarding.completed` audit → `/app/home` | ✅ |
| Validation focuses first invalid control; keyboard Space selects radio; step heading receives focus on step change | ✅ |
| Refresh / resume: business and brand resumed at the saved step from server draft | ✅ |
| Business: goals/channels/team + 1 invite → `small_business` workspace, 64-char invite token, 14-day expiry | ✅ |
| Brand: private logo upload (`onboarding-uploads/{uid}/logo/…`) with signed preview, live brand-kit preview; brand + voice profile (Playful + messaging) + guidelines (4 colours) | ✅ |
| Agency: `client_model=separate`, 4 service lines, workflow/reporting stored | ✅ |
| Supplier: portfolio upload autosaved to draft, published to `media/suppliers/…`; `verified=false`, "Pending verification", `status=active` only because consent ticked; no workspace created → `/supplier` | ✅ |
| Invite: signed-out invitee → sign in → back to invite → accept → Member of workspace, `accepted_at` set | ✅ |
| Affiliate (signed-in applicant): 3 steps, email locked, draft restored after re-login, submitted → `pending`; portal shows "still under review", no metrics | ✅ |
| Admin: non-admin credentials → "This account does not have access to the admin console.", signed out locally, `admin.login.denied` audit with IP/UA | ✅ |
| Admin: real admin password + TOTP enrolment/verify → AAL2 → `/admin` | ⚠️ not run (needs a platform-admin test account — manual step) |
| Affiliate approval in `/admin/affiliates` → portal dashboard | ⚠️ not run (same) |
| Anonymous affiliate applicant (signUp + application) | ⚠️ not run to avoid sending real email under the 2/hour SMTP limit |

## Security findings & fixes (all verified with live REST calls as an authenticated user)
| # | Finding (severity) | Fix | Verified |
|---|---|---|---|
| 1 | Any user could set `profiles.is_platform_admin=true` (critical) | `guard_profile_privileges` trigger | 42501 |
| 2 | Owners could set `plan='enterprise'` (critical, billing bypass); old onboarding let users pick paid plans | `guard_workspace_billing` trigger forces starter/trialing on insert, blocks plan/owner changes | insert returned starter |
| 3 | Anyone could self-create an affiliate row; anon could insert `approved` applications (high) | dropped insert policy; admin-only `review_affiliate_application` RPC; own-draft policies + field guard | RLS denial ×3, RPC 42501 |
| 4 | Suppliers could self-verify / fake ratings (high) | `guard_supplier_trust_fields` | inserted `verified=false` |
| 5 | `team_invitations` `USING (true)` exposed every token/email (critical) | policy dropped; `get_invitation` (masked email) / `accept_invitation` (email-matched) RPCs | `[]` |
| 6 | `affiliates` SELECT policy recursed (42P17) — broke affiliate dashboard | `my_affiliate_id()` definer helper | reads succeed |
| 7 | Admin console had no MFA | AAL2 required in `admin/layout.tsx` per request; TOTP enrol/verify at login | code review |
| 8 | Open redirect via `next` on login/callback | `safeNext` (unit-tested: `//`, `/\`, encoded, `javascript:`) | tests |
| 9 | Auth `site_url` was `localhost:3000`, empty allow-list (verification emails broken in prod); password min 6 | set to production + allow-list; min 8 (PAT) | config read-back |
| 10 | Denied admin/affiliate sign-in used global sign-out (logged user out everywhere) | `signOut({scope:'local'})` | found in E2E |
| 11 | `/mfa` "Enable MFA" was a fake email-OTP screen with a dead button | real TOTP enrolment | — |
| 12 | Settings invite insert used non-existent `status` column and invalid `editor` role | fixed | — |
| 13 | Onboarding save reported success on 0-row updates | row-count check + server log | — |

Other: cross-user draft read returned `[]`; draft status/workspace_id tamper → RLS denial; upload paths sanitised to caller's folder (unit-tested incl. `../`, foreign uid, SVG).

## Supabase
- **Tables:** profiles (+`account_type`), workspaces, workspace_members, brands, brand_voice_profiles, brand_guidelines, team_invitations, onboarding_drafts (new), marketplace_suppliers (+website_url, regions_served, deliverables, lead_time_days, capacity, contact_preference), affiliates, affiliate_referrals, affiliate_applications (+country, primary_channel, audience_size, platforms, content_categories, promotion_method, audience_links, terms_accepted_at, review_note, submitted_at, updated_at; status adds `draft`,`needs_info`), audit_logs.
- **RPCs:** `complete_onboarding` (transactional, idempotent, row lock), `restart_onboarding`, `review_affiliate_application`, `get_invitation`, `accept_invitation`, `my_affiliate_id`.
- **Storage:** new private `onboarding-uploads` (25 MB; jpeg/png/webp/mp4/mov; owner-folder policies). Published copies → `avatars`, `brand-assets`, `media` via service role at completion.
- **Edge functions:** none used.
- **Migrations applied (PAT):** `20260915000000_auth_onboarding_security.sql`, `20260915000100_onboarding_restart.sql`, `20260915000200_affiliates_policy_recursion.sql`.

## Tests
- Unit (vitest): 125/125 passing, including new `auth/redirect.test.ts` and `onboarding/schema.test.ts` (hidden-field stripping, enum spoofing, upload path traversal, step-skip guard).
- `tsc --noEmit`: clean for all auth/onboarding code. ESLint: all changed files clean, including the 7 former errors in `src/app/app/home/page.tsx`, which are now fixed.
- **Second visual pass:** auth and onboarding unit tests passed 25/25, and `tsc --noEmit` is clean for all auth and onboarding code.
- **Earlier shell build break (`toggleNavCollapsed`):** fixed by the shell owner. All pages return 200.
- **`next build` (`NEXT_DIST_DIR=.next-build`):** could not complete on this machine because of memory, not because of a code error.
  - Run 1: the Turbopack PostCSS worker connection was forcibly closed (os error 10054).
  - Run 2: exit 134 (out of memory).
  - Cause: only ~2.9 GB of 16 GB RAM was free while another session's `next dev` held ~2.2 GB. ESLint also hit out-of-memory at the same time.
  - The other session's server was left running.
  - To finish: run the build with the dev server stopped, or let Vercel build it (see user-fixes #3).
- **Lighthouse:** deferred for the same memory reason.

## Deviations from the reference designs (functional truth over mockup)
1. The real Caption Fox logo (white fox on blue) replaces the mockups' black fox.
2. "Continue with Google" is hidden because the Google provider is disabled in Supabase. It's fully wired behind `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.
3. Admin: "Remember this device" is removed (not securely supported). The MFA field is real TOTP with a first-login enrolment panel.
4. Affiliate step 1: "Referral method or payout preference" is replaced with a password field for new applicants. Payout details are collected after approval.
5. Supplier: "Verified supplier" becomes "Pending verification", and the favourite heart (a dead control) is removed.
6. Agency header: the public nav ("Sign in / Start free") is replaced with a step-progress header for signed-in users. The "all in one workspace" option now states that the whole team sees every client. Preview clients are labelled "Example", and the dead "Open preview" link is removed.
7. Preview metrics are labelled "Sample data" / "Examples", amounts are in GBP, and gradient tiles replace stock photos.
8. Upload hints say PNG/JPG/WebP rather than SVG or PDF (SVG is an XSS risk on public buckets).
9. Selection ≠ connection: channel steps explain that accounts are connected afterwards in Social › Connections.
10. Footer trust line reads "Secured with encrypted connections." (factual).
11. Tag fields (regions, deliverables) put the native `<select>` behind the chevron column, so the tags keep the row width. This matches the ref and stays keyboard/screen-reader accessible.
12. Agency intro says "Define your clients…" rather than "Add your clients…", because clients are added after setup, not during it.

## Cross-section effects checked
- `/app/home` activity shows "completed setup of this workspace" (the raw `Onboarding.Completed` label is fixed).
- The workspace switcher's "Create workspace" now goes to `/onboarding?new=1`, which uses `restart_onboarding`.
- `/app/affiliates` no longer self-enrols; it links to the application instead.
- The admin nav gained an "Affiliates" review queue.
- Supplier sidebar label: "Agencie" is fixed to "Agency".

## Remaining gaps before 100/100
- Full responsive matrix and PWA screenshots.
- Lighthouse accessibility pass (≥98).
- Production build.
- The admin MFA and affiliate-approval E2E runs, and the anonymous affiliate applicant E2E run.
- Custom SMTP.
- Product analytics events: no analytics layer exists in the repo, so none are emitted.
