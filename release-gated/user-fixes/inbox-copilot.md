# Inbox + Fox AI Copilot — Manual Steps Required

## 1. Log in and run a visual QA pass (blocking)
I could not authenticate against the local dev server (no password for the demo
account `jamahlthomas1996@gmail.com`, and I did not want to reset it myself).
Please:
1. `npm run dev` (or use your already-running instance on port 3004).
2. Log in and visit `/app/inbox/unified`, `/app/inbox/assignments`,
   `/app/inbox/saved-views`, `/app/inbox/unassigned`, and open the Fox AI
   Copilot bubble (all 8 tabs).
3. Compare against the 14 reference images in
   `designs/Inbox/ChatGPT Image Aug 29, 2026, *.png`.
4. Resize to 1440 / 1280 / 1024 / tablet / mobile — the Copilot panel and the
   three-pane Inbox layout have not been checked at narrow widths; the panel
   may need a stacked/full-screen treatment below ~900px that isn't built yet.

## 2. Configure the AI provider key (blocking for AI features)
`.env.local` has `ANTHROPIC_API_KEY` commented out. Every AI surface — Copilot
chat, Create, AI-drafted replies, Agent, and Media's prompt optimisation — will
return "AI is not configured on this environment" until this is set. Media
generation additionally needs `STABILITY_API_KEY` for actual images (without
it, Media only returns the optimised prompt text, which the UI already
handles gracefully but is not the full experience).

## 3. No `contacts` table exists yet
The Contacts tab currently derives a contact list by grouping `inbox_threads`
by sender name/handle — this is real data, not fabricated, but it means:
- No contact profile beyond name/handle/last channel/tags-seen-on-threads.
- No "Add contact" / "Import contacts" (the design shows these) since there's
  nowhere to persist a contact that hasn't messaged you yet.
- No cross-channel identity linking (one person messaging via both Instagram
  and email shows as two rows).

If you want the full Contacts experience from the design, a `contacts` +
`contact_channel_identities` schema needs to be designed and migrated — this
is a real scope decision (data model, merge rules, privacy boundaries) that
should be made deliberately rather than added ad hoc.

## 4. No SLA/routing/team/queue engine
`inbox_threads` has `sla_target_minutes`/`sla_state` columns and I surface
them (remaining time, breached/warning badges), but there is no backend job
that actually transitions `sla_state` over time, no configurable SLA policies
per priority/queue, no routing-rule engine, and no formal Teams/Queues model
(Assignments page shows per-member workload only). The master prompt's
sections on routing rules, SLA policies, and queues are not implemented —
building them is a substantial additional scope (a rules engine + a
scheduled job to recompute `sla_state`) that I did not attempt this session.

## 5. Agent tab was simplified
I originally built a fuller Agent tab (objective → AI plan → review → create
real `campaign_tasks`). During this session the file on disk was replaced
with a "coming soon" placeholder by something outside my control (possibly a
repo safety hook) — I did not revert it, per my instructions to treat
on-disk changes as deliberate. If you want the fuller Agent experience back,
tell me and I'll rebuild it; the version I designed never auto-executed
anything without your explicit approval per item.

## 6. Full spec is far larger than what shipped this session
The pasted master prompt (Sections 1–7 of the CLAUDE.md checklist, plus the
~50,000-character Inbox/Copilot spec) describes an enterprise build with
hundreds of individually-gated requirements per page (RLS negative-test
matrices, automation catalogues with 60+ node types, webhook signing,
platform-admin AI cost controls, prompt-injection test suites, etc.). This
session delivered a real, working core: four Inbox pages on corrected data,
a redesigned 8-tab Copilot wired to genuine reads/writes. It is not a
100/100 against the full checklist — treat this doc plus the evidence doc as
the honest current state, and tell me which specific gaps to close next.
