# User / Manual Actions — Brand & Assets

Items I could not complete, with exact steps. Ordered by what blocks release.

---

## 1. BLOCKER — Free the Chrome DevTools MCP browser profile

**Why it's blocked:** the profile is held by another running agent session:

```
The browser is already running for C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile.
Use --isolated to run multiple browser instances.
```

Without it I cannot screenshot the five routes or run the pixel comparison
against the approved references — the single largest gap in the release score.

**Steps — pick one:**

- **A.** Stop the other agent session using the profile, then tell me to continue.
- **B.** Add `--isolated` to the chrome-devtools MCP server args in your MCP config so concurrent sessions each get their own browser, then restart Claude Code.
- **C.** Point this session at a second profile:
  ```
  --userDataDir=C:\Users\PC\.cache\chrome-devtools-mcp\chrome-profile-2
  ```

**Then I will:** set the viewport to **1491 × 1055**, capture all five routes,
compare each against its reference image, correct spacing/sizing/typography
discrepancies via shared tokens, and re-capture until aligned — plus 1440, 1280,
1024, tablet, mobile and PWA widths.

---

## 2. BLOCKER — Stop the second Next.js dev server

**Why it's blocked:** two Next processes are running in the same directory and
corrupt each other's build output:

```
ENOENT: .next/dev/routes-manifest.json
MODULE_NOT_FOUND: .next/dev/server/pages/_document.js
Persisting failed: Another write batch or compaction is already active
```

This repeatedly killed verification runs mid-suite. Servers on ports 3004, 3005
and 3009 were all returning 500 simultaneously for this reason.

**Steps — pick one:**

- **A.** Stop the other agent's dev server; leave exactly one running.
- **B.** Approve this one-line change to `next.config.ts` (I proposed it; you declined, so it is **not** applied):
  ```ts
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ```
  Default behaviour is unchanged; it only lets a second process use
  `NEXT_DIST_DIR=.next-verify` and stop the collision.

---

## 3. BLOCKER — Fix TypeScript errors in other modules

`npx next build` **compiles** my module successfully but fails at the typecheck
stage in files I did not write. This blocks any production build of the app.

| File | Error |
| --- | --- |
| `src/components/events/charts.tsx:87,165` | recharts `Formatter` type mismatch — `ValueType \| undefined` not assignable to `number` |
| `src/lib/calendar/queries.ts:697` | `MAX_PAGE_SIZE` is not defined |
| `src/lib/calendar/queries.ts:950` | `.catch` used on a `PromiseLike` |
| `src/app/app/creators/briefs/page.tsx:86,111` | `BriefsQuery` missing string index signature |
| `src/app/app/creators/creators/page.tsx:83,109` | `CreatorsQuery` missing string index signature |
| `src/app/app/creators/payments/page.tsx:98,134` | `PaymentsQuery` missing string index signature |

These belong to the concurrent agent's work. I left them untouched to avoid
conflicting edits. **My files report 0 TypeScript errors.**

---

## 4. Deduplicate migration timestamps

Three migrations share the prefix `20260829000000`:

```
20260829000000_advertising.sql
20260829000000_brand_assets.sql      ← mine, already applied
20260829000000_calendar_module.sql
```

Ordering falls back to filename. Harmless between these three (independent
tables), but rename the other two before anyone runs `supabase db push` against
a fresh database. **Do not rename mine** — it is already applied.

---

## 5. Wire the upload pipeline (not built)

The schema is ready and unused: `media_assets.storage_bucket`, `thumbnail_path`,
`preview_path`, `checksum`, `version_no`, `processing_state`, `scan_state`, plus
the `asset_versions` table.

Still required:

1. Choose the store (Cloudflare R2 or Supabase Storage) and create a private bucket.
2. Add credentials to `.env.local` and `.env.local.example`.
3. Signed-upload endpoint enforcing: MIME + extension allowlist, size cap, `brand.assets.upload` capability, storage-quota headroom.
4. Storage path scoping — `{workspace_id}/{brand_id}/{asset_id}`.
5. Duplicate detection on `checksum` → offer *new version* / *keep both* / *cancel*.
6. Thumbnail + metadata extraction (background job, `processing_state` transitions).
7. Signed private read URLs. Never expose bucket URLs directly.
8. Orphan cleanup for cancelled uploads.

**Note:** the Cloudflare MCP server is configured but **not authorised** in this
session, so I could not create or inspect an R2 bucket. Authorise it via your
claude.ai connector settings (or `claude mcp` / `/mcp` in an interactive
session) if you want me to do this.

---

## 6. Install a test framework (none present)

`package.json` has no test tooling. Suggested:

```bash
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

Then I can add:

- **Unit** — `entitlements.ts` capability matrix (all 6 roles × 31 capabilities × plan/flag/status/quota combinations); `filters.ts` URL parsing, clamping and `buildHref` page-reset behaviour; `tokens.ts` UK formatting.
- **Integration** — RLS positive/negative per module table; cross-workspace leakage; queries return only in-workspace rows.
- **E2E** — the customer stories in `scripts/tmp/verify-brand-functional.mjs`, promoted into Playwright.

An interim functional harness already exists at
`scripts/tmp/verify-brand-functional.mjs` (filters, search, sorting, views,
pagination, deep links, entitlement gating, unauthenticated redirects). It was
written but **has not completed a full clean run** — every attempt was killed by
the dev-server collision in item 2.

---

## 7. Confirm two product decisions I made

Both are single-constant changes in `src/lib/brand-assets/entitlements.ts` if
you disagree.

1. **Creator workspaces get Overview + Brand Kits only** — no Assets DAM, Rights
   register or Product Library. Rationale: those are commercial-governance
   surfaces a solo creator has no need for. `MODULES_BY_WORKSPACE_TYPE`.
2. **Rights and Product Library require the Team plan**; Assets requires Creator
   Pro. `MODULE_MIN_PLAN`.

---

## 8. Housekeeping

- `scripts/tmp/` holds two dev-only verification scripts (`render-brand-pages.mjs`, `verify-brand-functional.mjs`). Keep them for re-verification or delete them — they are not imported by the app. Neither writes credentials to disk.
- `scripts/tmp/render/` holds captured HTML from verification runs. Safe to delete; it contains workspace data, so do not commit it.
- A temporary diagnostic function `public._rls_probe()` was created during the RLS investigation and **has been dropped**.
