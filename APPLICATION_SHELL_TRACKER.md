# Caption Fox Application Shell Tracker

**Scope:** Caption Fox only. This tracker implements the structural-shell phase from the master prompt. It deliberately uses deterministic local fixtures and temporary UI state; it does not change Supabase, production authentication, provider connections, payments, publishing, marketplace settlement, or AI execution.

**Demo gate:** the shell is available only in development, or when `NEXT_PUBLIC_CAPTION_FOX_SHELL_DEMO=true` is explicitly set. Workspace and portal shells use first-level typed routes (`/creator`, `/business`, `/brand`, `/agency`, `/affiliate-portal`, `/publisher-portal`, `/client-portal`, `/creator-portal`, `/buyer-portal`, `/link-page`); the `/shell` index remains a development directory only.

## Status legend

| Status | Meaning |
|---|---|
| Not Started | Named in `IMPLEMENTATION_PLAN.md`; no shell surface yet |
| Shell Created | Route and meaningful structural page exist |
| Navigation Connected | Reachable from its correct shell navigation |
| Responsive Checked | Checked against the shell responsive layout |
| Complete | Shell, navigation, states, detail/tabs/wizard representation and tracker evidence exist |

## Source inventory and implementation matrix

| Workspace / portal | Role context | Main areas represented | Route namespace | Detail / tabs represented | Wizard represented | Status | Source |
|---|---|---|---|---|---|---|---|
| Campaign Manager - Creator | Creator / solo marketer | Home, Studio, Calendar, Campaigns, Social, Link in Bio, Marketplace, Inbox, Analytics, Settings | `/creator/*` | Campaign, content, creator, supplier/order | Campaign, content, schedule, supplier request | Shell Created | Plan 2, 3.3-3.8, 3.5 |
| Campaign Manager - Business | Business owner / marketer | Creator areas plus Strategy, Brand & Assets, Messaging, Web & Conversion, Leads | `/business/*` | Strategy, audience, landing page, budget | Strategy, campaign, message, page | Shell Created | Plan 2, 3.3, 3.8 |
| Campaign Manager - Brand | Brand team | Business areas plus Creators & UGC, Partnerships, Reputation, Community, Events, Finance, Automations | `/brand/*` | UGC brief/submission, rights, campaign | UGC brief, partnership, automation | Shell Created | Plan 2, 3.3-3.5, 3.8 |
| Campaign Manager - Agency | Agency owner / client manager | Brand areas plus Clients, client approvals, client reports, white-label settings | `/agency/*` | Client, campaign, portal grant, report | Client workspace, portal invite, report | Shell Created | Plan 2, 3.8 |
| Supplier Workspace | Creative/marketing supplier | Dashboard, Shopfront, Listings, Orders, Deliveries, Messages, Availability, Reviews, Disputes, Earnings, Analytics, Settings | `/shell/supplier/*` | Listing, order room, delivery, payout/dispute | Supplier onboarding, listing, quote | Shell Created | Plan 2, 4, 16 |
| Affiliate / Ambassador portal | Partner | Programme, links/codes, assets, conversions, commissions, support | `/affiliate-portal/*` | Programme and conversion | Programme application | Shell Created | Plan 5 |
| Publisher / Media Partner portal | Media partner | Opportunities, media kit, placements, deliveries, reporting, profile | `/publisher-portal/*` | Opportunity and placement | Media partner profile / proposal | Shell Created | Plan 2, 5 |
| Client / Brand Approval portal | External client / approver | Home, approvals, calendar, deliverables, reports, files, messages | `/client-portal/*` | Campaign and approval item | Portal invitation | Shell Created | Plan 5 |
| Creator / Influencer portal | Invited creator | Opportunities, briefs, deliverables, rights, payments, profile | `/creator-portal/*` | Brief and submission | Creator profile / submission | Shell Created | Plan 5 |
| Buyer order portal | Marketplace buyer | Requests, quotes, active orders, deliveries, payments, disputes | `/buyer-portal/*` | Order room | Marketplace request | Shell Created | Plan 5, 16 |
| Public marketplace | Anonymous visitor | Discover, categories, supplier search, listings, public supplier profile | `/shell/public-marketplace/*` | Supplier shopfront and listing | Enquiry/request | Shell Created | Plan 7, 16 |
| Public link/campaign microsite | Anonymous visitor | Link page, offer, form and consent/tracking placeholders | `/shell/public-link/*` | Public campaign/link page | Landing-page publishing | Shell Created | Plan 5, 7 |
| Platform Admin | Platform operations | Tenants, suppliers/marketplace ops, plans, AI/safety, connections, operations, support, governance, observability | `/shell/admin/*` | Workspace, user, supplier, support case | Provision workspace, verification review, flag rollout | Shell Created | Plan 6 |

## Shared shell requirements

| Requirement | Status | Evidence / route |
|---|---|---|
| Config-driven workspace-specific side navigation | Shell Created | `src/lib/shell/caption-fox-shell.ts` |
| Desktop, tablet and mobile navigation | Shell Created | `src/components/shell/CaptionFoxShell.tsx` |
| Page header, breadcrumbs, tabs, collection/detail states | Shell Created | `src/components/shell/CaptionFoxShell.tsx` |
| Wizards with draft/review/submit state | Shell Created | `src/components/shell/CaptionFoxShell.tsx` |
| Permission, upgrade, archived, empty, loading and error states | Shell Created | `/shell/[surface]/[...path]` query-state controls |
| Deterministic mock workspace fixtures for Jamahl | Shell Created | `src/lib/shell/caption-fox-shell.ts` |
| Production-safe demo gate | Shell Created | `src/app/shell/[surface]/[[...path]]/page.tsx` |
| Route smoke validation | Not Started | Add after shell route/config creation |

## Outstanding structural follow-up

1. Move validated shell configurations into the authenticated `/campaign-manager`, `/supplier`, `/portal` and `/admin` route families in feature phases.
2. Replace shell fixture records with typed domain services only after their schema/RLS gates pass.
3. Add static route smoke validation for each configured workspace section, detail tab and wizard step.
4. Run browser checks at desktop, tablet and mobile breakpoints before marking Responsive Checked/Complete.
