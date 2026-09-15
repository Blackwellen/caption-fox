# PR & Reputation — manual actions required

Everything below is something Claude Code could not (or should not, without
explicit direction) complete automatically. See
`docs/CAPTION_FOX_PR_REPUTATION_IMPLEMENTATION_TRACKER.md` for the full
Phase 1 + Phase 2 record.

## 1. ~~Pre-existing, unrelated build failure~~ — resolved

`npx next build` previously failed while collecting page data for
`/api/advertising/oauth/[provider]/callback` (a `"use server"` export
error). As of the Phase 2 pass, `next build` completes with exit 0 and all
seven `/app/reputation/*` routes appear in the route manifest — this was
fixed elsewhere in the repo (not by this module) or resolved itself; no
action needed here anymore.

## 2. ~~Write flows are not built yet~~ — resolved in Phase 2

Create/edit forms and server actions now exist for every core entity:
media contacts, media lists (+ membership), pitches (draft → approve →
send), press releases (draft → review → publish), coverage mentions, review
responses (draft → publish) + escalation, and crisis incidents (+ timeline
notes + statement draft → legal review → approve → publish). See
`src/app/app/reputation/actions.ts` and the components under
`src/components/reputation/`.

**Still missing**: editing an existing record's core fields after creation
(e.g. changing a drafted pitch's subject/body, editing a media contact's
name/outlet). Only status transitions and net-new creation are wired. If you
want edit-in-place, follow the `updateMediaContactStage`-style pattern in
`actions.ts` and add the corresponding form to each page.

## 3. Pitch sending needs a real provider

Reuse the Messaging module's Resend integration
(`src/lib/messaging/providers/email.ts`, driven by the `RESEND_API_KEY` and
`MESSAGING_EMAIL_FROM` environment variables you already set up for
Messaging) rather than building a second email pipeline. If you want pitch
sending live, confirm those env vars are set in `.env.local` / your
deployment environment — Claude Code does not set third-party API keys for
you.

## 4. Review-source integrations

To pull in live reviews you need to connect real accounts — this is API-key/
OAuth credential entry the user must do themselves, per your standing
instruction that "the user sets up webhooks and integrations with their own
details." Nothing to do here until you're ready to connect Google Business
Profile, Trustpilot, or App Store/Play Store review APIs.

## 5. Chrome MCP visual QA

Not run in this pass. Once the write flows above exist, run Chrome MCP
against all 7 routes at 1440/1280/1024/tablet/mobile/PWA against the
reference images in `designs/PR & Reputation/` and log results back into the
tracker doc.

## 6. RLS test suite

The RLS policies on all eleven new tables follow the same
`workspace_id in (select workspace_id from workspace_members where user_id =
auth.uid())` pattern already used everywhere else in this codebase (e.g.
`partnership_programmes`), so they are consistent with the rest of the
product's security model. No dedicated automated positive/negative RLS test
suite was written for this module in Phase 1 — add one alongside whatever
suite (if any) exists for Partnerships/Events as a template.
