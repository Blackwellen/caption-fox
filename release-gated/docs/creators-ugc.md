# Creators & UGC — Release Evidence

- **Section:** Creators & UGC (one shared module for the Business, Brand and Agency workspace types)
- **Routes:** `/{type}/creators` (Overview), `/{type}/creators/creators`, `/{type}/creators/briefs`,
  `/{type}/creators/submissions`, `/{type}/creators/rights`, `/{type}/creators/payments`, plus a
  `[id]` detail route under each of the last five. `{type}` is `business`, `brand` or `agency`.
- **Legacy:** `/app/creators/*` redirects to `/{type}/creators/*` (`src/app/app/creators/[[...rest]]/page.tsx`).
- **Export API:** `GET /api/creators/export?entity=…` (uses the same filters as the screen, and an optional `ids` list).
- **Sub-tab evidence:** `release-gated/docs/creators-ugc/{overview,creators,briefs,submissions,rights,payments}.md`
- **Build tracker:** `docs/CAPTION_FOX_CREATORS_UGC_IMPLEMENTATION_TRACKER.md`

## 1. Design parity (1448×1086)

Reference images: `designs/Universal Sections/UGC & CReators/ChatGPT Image Jul 24, 2026, 04_14_59 AM (1…6).png`.
Evidence is in `docs/ui-verification/caption-fox/creators-ugc/` as `{page}-reference.png`,
`{page}-implementation.png` and `{page}-side-by-side.png` for all six pages, plus `payments-mobile.png`,
`briefs-mobile.png` and `rights-tablet.png`.

These parts match the references:
- page header and actions
- six-card KPI row with sparklines
- filter bar and view toggles
- main panels and right-hand rails
- tables, board, gallery and bottom chart rows, including their order and proportions

These differences are intentional:
1. **Shell.** The real Caption Fox sidebar and top bar are used, as CLAUDE.md requires; the design's sidebar is context only. The only sidebar change is the "Creators & UGC" entry.
2. **Section tabs row.** The design puts the six sub-pages in its sidebar. That sidebar can't be changed here, so a tabs row sits under the header. It pushes content down about 44px, so the last row of each design sits slightly below the fold at 1086px.
3. **Data.** Numbers come from the live database, not the design (for example, 28 seeded creators rather than 2,847). Currency is GBP, and dates use UK format in the Europe/London timezone.

## 2. Screen sizes tested (Chrome MCP)
- **1448×1086:** all six pages
- **1440, 1280 and 1024:** overflow checked on all six pages
- **820 (tablet):** all six pages; the tabs become a sliding tray
- **390 (mobile/PWA):** all six pages; the tabs become a dropdown

At every size, `scrollWidth - clientWidth === 0` on the page and on every table container.

## 3. Buttons and actions tested end to end (each confirmed in the database)
| Action | Result |
|---|---|
| Creators: niche filter | 3 Beauty rows, and the URL state persists after refresh |
| Save View | `creator_saved_views` row with `{"niche":"beauty"}` |
| Brief board: move draft → open (keyboard select) | Status persisted and activity row written; only valid transitions are offered |
| Upload submission (brief detail) | Status `waiting_review`, private storage object, asset row and thumbnail; brief `deliverables_submitted` incremented |
| Record payout (payment row menu) | Status `paid`, a `ugc_payout_attempts` row, batch rolled up to `processing`, activity written |
| Approve Payouts | Pending batch moved to `scheduled` |
| Export | CSV uses the on-screen filters; cells that start with a formula character are neutralised |
| Flag issue, reassign reviewer, usage-request responses | The UI is wired to server actions. The browser click-through was **interrupted** when the session restarted, so these are covered by the server-action code and RLS checks only |

## 4. Data sources and Supabase tables
- **UGC tables:** `ugc_creators`, `ugc_briefs`, `ugc_brief_creators`, `ugc_brief_deliverables`, `ugc_submissions`, `ugc_submission_assets`, `ugc_submission_reviews`, `ugc_submission_issues`, `ugc_rights`, `ugc_rights_requests`, `ugc_payments`, `ugc_payment_batches`, `ugc_payout_attempts`, `ugc_activity`
- **Creator lists and views:** `creator_lists`, `creator_list_members`, `creator_invitations`, `creator_saved_views`
- **Shared tables (read only):** `campaigns`, `workspace_members`, `profiles`, `workspaces`
- **Storage:** private bucket `ugc-submissions` with path `{workspace}/{uuid}/{file}`, read through signed URLs only; r2 avatars are signed with `signReadUrls`

## 5. RLS policies and security
Migration `supabase/migrations/20260916200000_creators_ugc_release.sql` was applied through the Management API. It adds the following.

**Role-aware policies.** Each rule is enforced by `ugc_has_role(workspace, roles[])`.

| Access | Roles |
|---|---|
| Read | owner, admin, manager, member, viewer |
| Write creators and invitations | owner, admin, manager |
| Write briefs, submissions, rights and lists | owner, admin, manager, member |
| Read payments and batches | owner, admin, manager |
| Write payments | owner |
| Activity | Insert only, and only as yourself (append-only audit trail) |
| Saved views | Personal views are private; shared views are readable by the workspace |

**Payment guard trigger.** `trg_ugc_payments_guard` rejects illegal payment status transitions. It also locks the amount, currency and creator on `paid`, `refunded` and `cancelled` payments.

**Storage policies.** These are role-based and scoped by the first segment of the object path, which is the workspace.

**Server actions.** Every server action re-checks the capability and workspace ownership. Uploads are validated again on the server:
- path prefix
- MIME allowlist
- 500 MB limit
- the object exists in storage with a matching size

`scripts/verify-creators-rls.mjs` runs **38 positive and negative checks as real users inside rolled-back transactions. All 38 pass.** The checks cover:
- each role's reads
- cross-workspace isolation
- a non-member
- financial visibility
- role-based writes
- the payment trigger
- append-only activity
- saved views
- storage

**Edge functions:** none are used by this module; everything runs through Next.js server actions and one route handler.

## 6. Gating
`src/lib/creators/entitlements.ts`:
- Overview, Creators, Briefs and Submissions are available on every active plan.
- Rights and Payments need **Team** or above.
- Payments is only available to `small_business`, `brand` and `agency` workspaces.
- A cancelled subscription blocks the module.
- A blocked user sees an explanation screen with an upgrade link when an upgrade would help.

Navigation uses `gated(M.creators,'creators')` in `registers.ts`, and `resolver.ts` checks the same function, so the sidebar and a direct URL can't disagree. **There is no separate Platform Admin feature flag for this module**; see user-fixes.

## 7. Bugs found and fixed
- **Hydration mismatch:** Intl compact numbers formatted differently on server and browser. Replaced with a deterministic `compact()`.
- **Expired items:** showed "0 days left". Past dates now floor to negative values.
- **r2: avatars:** did not load. They are now signed on the server.
- **Mobile overflow:** fixed with `grid-cols-[minmax(0,1fr)]` and `relative` scroll containers.
- **Filter bars:** wrapped. KPI labels were truncated. Tables overflowed on Rights, Briefs and Payments.
- **Payment status menu:** allowed jumping to `paid`/`processing` without recording a payout. That now goes through `recordPayoutOutcome` only.
- **Bulk approve:** had no cap or status filter. It is now capped at 200 and only acts on reviewable statuses.
- **Upload success:** did not navigate to the new submission. It now does a hard navigation (fixed this pass).
- **Seed brief counters** (assigned creators and deliverables) disagreed with the rows behind them. They are now derived from the inserted rows (fixed this pass; all three demo workspaces reseeded).
- **Seed script encoding:** comments had been double-encoded. Repaired.

## 8. Tests run (latest pass, 2026-09-17)
- `npx tsc --noEmit`: no errors in creators files.
- `npx eslint` on `src/components/creators`, `src/lib/creators`, `src/app/[workspaceType]/creators`, `src/app/api/creators` and the seed script: exit code 0.
- `npx vitest run src/lib/creators src/lib/navigation`: **61/61 pass**. Covers batch eligibility, lifecycles, dates, CSV injection, link resolution, query parsing, entitlements and role capabilities.
- `node scripts/verify-creators-rls.mjs`: **38/38 pass**.
- Idempotent seed: `node scripts/seed-creators-demo.mjs <brand> <business> <agency>`. Each workspace got 28 creators, 16 briefs, 24 submissions, 16 rights records, 64 payments and 3 batches.

## 9. Performance
Warm renders on the dev server took 1.3–3.3s; Overview is the slowest because it runs about 10 parallel queries. Queries run in parallel with `Promise.all`, are paginated and use indexes on `(workspace_id, status)` and dates. No per-row queries were found. **`next build` was not run this pass** because another session's dev server shares `.next`.

## 10. Cross-section effects
- Activity links are stored in a legacy-neutral form and resolved against the active workspace route at render time.
- Brief detail links to Campaigns.
- Changes revalidate the shared `/[workspaceType]/creators` layout, so KPIs, rails and tabs refresh after every action.
- The top-bar quick-create "Brief" opens `?action=new`.

## 11. Score and decision
**Score: 84 / 100. Decision: ready for owner/admin-only beta.**

Points deducted:
- **Payouts (−5):** no payout provider; outcomes are recorded manually.
- **Creator self-service (−3):** no creator self-service portal or marketplace linking.
- **Feature flag (−2):** no Platform Admin flag.
- **Browser verification (−3):** the latest fixes (upload redirect, seed counters) and the review-tool click-through were not re-verified in Chrome. The browser session expired, and logging it back in by injecting a session cookie was blocked by the permission check.
- **No production build or E2E suite (−3):** there is no automated Playwright suite, and `next build` was not re-run.

The steps are in `release-gated/user-fixes/creators-ugc.md`.
