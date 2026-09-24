# Strategy — Manual Actions Required

Things I could not complete from here, with exact steps.

**Closed since 2026-09-16:** the Positioning "All markets" filter and Research "+ Add tag" control (previously listed as gaps in the evidence doc, not here) are now built and verified — nothing for you to do there.

---

## 1. Turn on approval and review emails (per workspace, 10 minutes)

**Status:** built and unit-tested. Approval requests, reminders, decisions and research review decisions always create an in-app notification. They also send an email **only when this workspace supplies its own sender**. Until then Strategy quietly stays in-app only. Demo workspaces never send email.

**Steps:**
1. In Resend, verify the sending domain you want to use and create an API key.
2. Set `RESEND_API_KEY` and `MESSAGING_EMAIL_FROM` (for example `Acme <hello@acme.com>`) in the deployment environment (Vercel project settings, then redeploy). Also make sure `NEXT_PUBLIC_APP_URL` is your public app URL so the email's "Open in Caption Fox" button links correctly.
3. In a **non-demo** workspace, request approval on a Positioning framework and assign it to another user. Expect one in-app notification and one email. Check the Resend dashboard for the send.
4. Turn off "Approval requests" email for that user in Account Settings, then request approval again. Expect the in-app notification only.

**If nothing arrives:** check the Resend dashboard for a rejected send (unverified domain is the usual cause). Strategy logs `[strategy] approval email rejected` with the HTTP status only, never the address or key.

---

## 2. Connect HubSpot before using "Sync CRM" (per workspace, 10 minutes)

**Status:** built and unit-tested with a mocked HubSpot. It has not been run against a real HubSpot account because that needs your token. **Salesforce is not built.**

**Steps (workspace owner or admin):**
1. In HubSpot: Settings, Integrations, Private Apps, create an app with the **`crm.lists.read`** scope, then copy its access token (it starts with `pat-`).
2. Strategy, Audiences, More actions, "Connect HubSpot", paste the token. Caption Fox verifies it, checks the scope, encrypts it and shows only its last characters.
3. More actions, "Sync CRM". Expect your HubSpot contact lists to appear as audiences (source: CRM) with their sizes; only list names and sizes are read, never contacts.
4. Run it again after adding a contact to a list in HubSpot: the existing audience updates rather than duplicating.
5. Try "Disconnect": synced audiences are kept.

**Requires** `ADVERTISING_ENCRYPTION_KEY` (the shared credential-encryption key) to be set on the deployment; otherwise the connect step says it cannot store the token safely.

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

---

## 8. Run the physical-phone check (30 minutes, one iPhone and one Android)

**Why:** every mobile check so far used Chrome DevTools device emulation (390x844, touch, DPR 2). It catches layout, touch-target and overflow problems but not real-device behaviour: the iOS keyboard, Safari toolbar height, safe areas and true touch handling.

**Setup:** sign in as a manager on the Brand demo workspace at your deployed URL. Install to the home screen (Share, Add to Home Screen) to test the PWA as well as the browser.

**For each of Overview, Objectives, Audiences, Research, Positioning, Plans, Forecasts, check:**
1. The page scrolls only vertically (no sideways wobble) and nothing is cut off at the right edge.
2. The section tabs collapse to the dropdown and the view switcher (Cards / Table and so on) is reachable.
3. Every tappable control is comfortable to hit with a thumb (no mis-taps on neighbours).
4. The bottom of the page is not hidden by the browser bar or the home indicator.

**Then these specific flows:**
- **Create:** New objective, type in each field. The on-screen keyboard must not cover the field you are typing in or the Save button, and Save must stay reachable.
- **Fox AI:** More actions, "Ask Fox AI about this page". The dialog fits the screen, the text box is not hidden by the keyboard, and answer links open the record.
- **Plans:** the Gantt scrolls sideways inside its own box only. Dragging a bar with a finger should move it and save; if a bar is hard to grab, note the phone model.
- **Forecasts:** the scenario cards and table do not overlap their badges.
- **Rotate** to landscape on Plans and Forecasts; nothing should break.

**Report back:** phone model, OS and browser version, page, and a screenshot of anything that looks wrong. Anything found becomes a fix in this section.
