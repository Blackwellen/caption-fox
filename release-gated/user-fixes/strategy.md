# Strategy — Manual Actions Required

Things I could not complete from here, with exact steps.

**Closed since 2026-09-16:** the Positioning "All markets" filter and Research "+ Add tag" control (previously listed as gaps in the evidence doc, not here) are now built and verified — nothing for you to do there.

---

## 1. Decide how approval and review notifications should be emailed (15 minutes)

**Why:** approval requests, reminders and research review decisions currently create **in-app notifications only**. Sending email needs a sender identity and a decision on whether these go through the workspace's own email settings.

**Steps:**
1. Confirm the sender (e.g. `notifications@captionfox.com`) is verified in Resend.
2. Confirm users can opt out under Account Settings → Notifications.
3. Ask for `strategy_approval_request`, `strategy_approval_reminder`, `strategy_approval_decision` and `strategy_research_review` to be added to the email notification templates.

---

## 2. Connect a CRM before using "Sync CRM" (per workspace, 10 minutes)

**Why:** HubSpot and Salesforce are listed as "coming soon" in the integrations catalogue. Until one is connected with the workspace's own credentials, Sync CRM explains how to connect and does nothing else.

**Steps:** when the CRM integration ships, connect it in Settings → Integrations. No code change is needed on the Strategy side; the action checks `integrations.is_active` for `hubspot` / `salesforce`.

---

## 3. Enable Forecasts for Business workspaces if wanted (2 minutes)

**Why:** Forecasts require the Brand plan for Business workspaces (Team is enough for Brand and Agency). This is a pricing decision, not a technical one.

**Steps:** change `minPlanByType` for `forecasts` in `src/lib/strategy/entitlements.ts`, or set the `strategy_forecasts` flag per workspace from Platform Admin.

---

## 4. Review the role model: members are view-only in Strategy (5 minutes)

**Why:** in the app, `member` maps to the `creator` product role, which only views Strategy; owner, admin and manager edit it. The database now enforces the same rule. If members should contribute research or objectives, that is a product change.

**Steps:** if yes, add the relevant `STRATEGY_*_CREATE` permissions to `creator` in `src/lib/permissions.ts` **and** add `'member'` back to `public.strategy_can_write` in a new migration. Change both together, or the UI and database will disagree.

---

## 5. Backups / PITR (5 minutes)

**Why:** Strategy holds planning, forecast and approval history that customers will expect to recover.

**Steps:** in the Supabase dashboard for project `crazahobtmpipzxbkckf`, confirm Point-in-Time Recovery is enabled (Pro plan add-on) with at least 7 days of retention. Research files live in the private `strategy-research` storage bucket, which is covered by the same project backups.

---

## 6. Remove demo Strategy data before a real customer uses a demo workspace (optional)

```sql
-- Run in the Supabase SQL editor. Only rows marked is_demo are touched;
-- child rows cascade from their parents.
delete from public.strategy_objectives where is_demo;
delete from public.strategy_audiences where is_demo;
delete from public.strategy_research_items where is_demo;
delete from public.strategy_positioning_frameworks where is_demo;
delete from public.strategy_plans where is_demo;
delete from public.strategy_forecasts where is_demo;
delete from public.strategy_actions where is_demo;
delete from public.strategy_insights where is_demo;
delete from public.strategy_records where is_demo;
```

---

## 7. Decide the market list for Positioning frameworks, if the current one isn't right (10 minutes)

**Why:** the "All markets" filter added on 2026-09-18 uses a fixed list — UK, Ireland, Europe, North America, Asia-Pacific, Middle East, Latin America, Africa, Global — enforced by a database check constraint. If your customers need a different or more granular list (e.g. individual EU countries), that's a product decision, not a bug.

**Steps:** update the `STRATEGY_MARKETS` array in `src/lib/strategy/constants.ts` and the matching `check` constraint in a new migration (`alter table strategy_positioning_frameworks drop constraint strategy_frameworks_market_check, add constraint ... check (market in (...))`). Change both together.
