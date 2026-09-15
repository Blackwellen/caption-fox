# Partnerships — Manual actions required

Things Claude Code cannot complete for you, with exact steps.

## 1. Payment provider for real payouts

`partnership_payouts.provider` / `provider_reference` columns exist and the payout status workflow (`draft → pending_review → approved → processing → paid`) is real, but there is **no live payment integration** wired up — marking a payout "paid" is a manual status change, it does not move money.

To wire a real provider (Stripe Connect, GoCardless, etc.):
1. Connect the provider via its own settings page in Caption Fox (or add one) — this repo does not have a generic payout-provider settings screen for Partnerships specifically.
2. Extend `updatePayoutStatus` in `src/app/app/partnerships/actions.ts` to call the provider's payout/transfer API when transitioning to `processing`/`paid`, and store the returned reference in `provider_reference`.
3. Authorize the `stripe` MCP connector in this environment if you want Claude to help build that integration later — it is currently unauthenticated.

## 2. Tracking-link domain

Tracking links currently redirect through `/p/[slug]` on whatever domain this app is deployed to. If you want a branded short domain (e.g. `go.yourbrand.com`), that's a DNS + reverse-proxy/redirect setup on your end — Claude Code cannot provision domains or DNS records.

## 3. Webhooks / external integrations

Per your standing instruction, webhooks and third-party integrations are set up by you with your own credentials — nothing here calls out to Zapier/Make/CRM/accounting tools. If you want Partnerships events (new partner, conversion, payout paid) to trigger an outbound webhook, that infrastructure doesn't exist yet in this codebase and would need to be built (a `partnership_webhooks` table + delivery worker, mirroring the `automation_webhooks` pattern referenced in your CLAUDE.md notes) — tell me if you want that built.

## 4. Full visual QA against the 7 reference designs

I ran a live-browser pass (Chrome DevTools MCP) at 1440px and one mobile check, and fixed two real runtime bugs that only showed up there. I did not:
- Pixel-compare every one of the 7 pages against their exact reference PNGs in `designs/Partnerships/`
- Check tablet (1024px) or PWA-mode layouts
- Check the Referrals, programme-detail, or applications/payouts pages in-browser (only via type-check + code review)

If you want a full visual regression pass, ask for it explicitly (or re-run `/code-review` / a Chrome MCP pass) — it's straightforward to finish, just wasn't done exhaustively here given the scope of everything else built in this session.

## 5. `npm run build` verification

Done — `npm run build` now passes cleanly (exit 0) with all 12 Partnerships routes in the manifest. The first two attempts hit `.next` build-cache contention from another session's concurrent build in this same working directory; the third attempt, after that session finished, succeeded.

## 6. Negative RLS / cross-workspace test

I verified RLS is enabled with a workspace-scoped policy on all 16 new tables (via a `pg_class`/`pg_policies` query), matching the pattern every other module uses. I did not run a live test logged in as a second real user in a different workspace to confirm they can't see this data. If you have a second test account, I can run that check with you.

## 7. Automated tests

No unit/E2E test suite exists for Partnerships (none exists for Campaigns or the other sibling modules either, so there's no harness to extend without first deciding on one for the whole app). If you want test coverage, tell me which framework/pattern to use and I'll add it.
