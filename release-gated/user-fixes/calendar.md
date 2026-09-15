# Manual actions — Campaign Manager › Calendar

Items Claude Code could not complete in this pass, with exact steps.

## 1. Finish the in-progress sidebar collapse change (blocks every Campaign Manager page)

**Symptom:** every `/{type}/calendar*` (and Advertising, etc.) page shows a Next.js *Build Error*.

**Cause:** another session is mid-edit on the shared shell:
- `src/lib/shell/nav-preference.ts` now starts with `import 'server-only'` and `import { cookies } from 'next/headers'`, and no longer exports `toggleNavCollapsed`.
- `src/components/shell/CampaignManagerShellClient.tsx` (a client component) still does `import { toggleNavCollapsed } from '@/lib/shell/nav-preference'` (line 17).
- `src/components/shell/CampaignManagerShell.tsx` line 53 calls `readNavCollapsed()` without the new `userId` argument.

**Steps (for whoever owns the sidebar change):**
1. Move `toggleNavCollapsed` into a `'use server'` action file (e.g. `src/lib/shell/nav-preference-actions.ts`) and import it from there in `CampaignManagerShellClient.tsx`, so the client component never imports the `server-only` module.
2. Pass the signed-in user's id to `readNavCollapsed(userId)` in `CampaignManagerShell.tsx`.
3. Run `npx tsc --noEmit -p .` — it must exit 0.
4. Load `http://localhost:3004/business/calendar` and confirm the page renders.

Claude Code did not change these files: the standing rule forbids altering the side menu, and they were being edited concurrently.

## 2. Fix the ambiguous profile embed outside Calendar (names silently missing)

`workspace_members` has two foreign keys to `profiles`, so `profiles(...)` in a `workspace_members` select is rejected. Replace it with `profiles!workspace_members_user_id_fkey(...)` in:
`src/app/app/settings/page.tsx`, `src/app/app/settings/permissions/page.tsx`, `src/app/app/messaging/page.tsx`, `src/components/messaging/MessagingChannelPage.tsx`, `src/lib/messaging/data.ts`, `src/lib/web/data.ts`, `src/lib/partnerships/data.ts`, `src/components/inbox/InboxThreePane.tsx`, `src/components/inbox/AssignmentsWorkload.tsx`, `src/lib/campaigns/data.ts`, `src/lib/social/queries.ts`, `src/app/app/campaigns/import-actions.ts`.

## 3. Clean duplicate demo campaigns

The pre-existing demo workspaces contain ~480–650 campaigns each, including 124 identical "Growth Co. — Autumn Refresh" rows ending 30 Sept. Remove duplicates (keep one per name) with a dev-only cleanup, or re-run the workspace demo provisioning.

## 4. Re-run the Calendar demo seed when needed (dev only)

```
node scripts/seed-calendar-demo.mjs 173b63f8-3263-4609-a4f7-c6e113f25bda d7b7c61e-7685-4b15-8a0c-d9fa85f25103 0cf44b57-cf4c-45c8-b600-e435e3bd4e9e 48d161b1-5db4-4a28-82a4-e19b839aa3ce
```
Idempotent; removes and recreates only rows tagged demo (`is_demo`, `metadata.demo`, `tags: calendar_demo`). Creates 8 demo teammate logins on the reserved `@captionfox-demo.invalid` domain with random passwords. Refuses to run in production.

## 5. Remaining QA once item 1 is fixed

- Responsive screenshots at 1440, 1366, 1280, 1024, iPad portrait/landscape, 390 px mobile, PWA. Save them in `docs/ui-verification/caption-fox/calendar/` (the folder now exists and holds the 1491 × 1055 evidence from this pass).
- Browser-exercise every mutation (approve, publish-to-worker, retry, cancel, reschedule by drag and by drawer, resolve / dismiss / reopen, apply recommendation, create item, create task, import CSV/ICS — the Import dialog has a template download — and export). The seeded Growth Co. workspace now has data for all of these.
- Re-run the earlier live RLS negative suite (anonymous, wrong user, `WITH CHECK` forgery — see the main evidence doc §7a) after this pass's changes, with a second, non-member account.

## 6. Real publishing-provider verification (carried forward, not blocking)

`Publish now` hands jobs to the delivery worker; the browser never calls a provider. No real social channel is connected in the demo workspaces (seeded channels are demo rows), so queue → worker → provider → `published` has not been exercised live. Connect a real channel in one workspace and publish one item to prove the path.

## 7. Dev environment: `.next` cache contention (carried forward)

With several Claude Code sessions and dev servers running against this repo at once, the Turbopack/webpack cache in `.next/` has corrupted ("Another write batch or compaction is already active", missing manifests). Five other sessions were active in this repo during this pass. Either give each concurrent session its own `distDir` in `next.config.ts`, or run only one `next dev` / `next build` against this folder at a time. No source change fixes this.

## 8. Earlier process-kill incident — check for interrupted work (carried forward)

The earlier audit session disclosed that it killed processes by matching "caption-fox" in the command line, which also stopped two `next build` runs it had not started. If a build of yours was interrupted around then, restart it. (This pass did not kill any processes.)

## 9. RLS probe clean-up — verify (carried forward)

The earlier audit reported deleting all probe data. To double-check, confirm no workspace named "RLS Probe Workspace" exists and no `calendar_items` / `calendar_conflicts` row contains `RLS-TEST-PROBE`, `WRONG-USER-RLS-PROBE` or `FORGED-WORKSPACE-ID`.

## Resolved since the earlier audit

- The "missing key" console warning under `<SecondaryHeaderActions>` was root-caused (server-built `primary` elements passed into client header actions without a key) and fixed on Agenda, Queue and Conflicts; the console is clean.
