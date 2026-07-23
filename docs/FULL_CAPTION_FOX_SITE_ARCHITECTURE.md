# Caption Fox - Complete Site, Route and Feature Architecture

**Version:** 1.0  
**Date:** 2026-07-23  
**Scope:** Caption Fox only. The supplied master prompt also covers Gala Dock and Measure Deck; those platforms are deliberately out of scope for this document.  
**Authoritative companion:** `IMPLEMENTATION_PLAN.md` for phased delivery, commercial gates and data modularisation.  
**Status legend:** Implemented | Partially Implemented | Shell Exists | Shell Required | Planned | Requires Review | Deprecated/Duplicate.

This specification defines the canonical information architecture for Caption Fox. It distinguishes a full workspace (owned tenant data), a campaign membership (scoped access to one campaign), an external portal (permission grant to selected records), a marketplace profile (commercially public supplier/creator identity), and a public page (no private tenant data).

## 1. Platform Admin Dashboard

**Canonical base route:** `/admin`  
**Users:** platform administrators with explicit elevation.  
**Commercial purpose:** operates trust, billing, marketplace liquidity, safety and platform reliability without giving normal users unrestricted tenant access.  
**Common components:** grouped left rail, search, filters, tables, saved views, audit drawer, confirmation dialogs, export, loading/empty/error/restricted states.  
**Required states:** loading, no results, suspended tenant, permission denied, provider unavailable, irreversible-action confirmation.

### 1.1 Admin navigation register

| No. | Group | Section | Canonical route | Purpose and actions | Status |
|---:|---|---|---|---|---|
| 1 | Command | Dashboard | `/admin` | Health, queues, incidents and usage; acknowledge incident | Partially Implemented |
| 2 | Tenants | Workspaces | `/admin/workspaces` | Tenant lifecycle, plan, members, usage and support context | Implemented/Shell Exists |
| 3 | Tenants | Users | `/admin/users` | User security, memberships and support history | Implemented/Shell Exists |
| 4 | Marketplace | Suppliers & Operations | `/admin/marketplace` | Verification, listings, orders, payouts and disputes | Shell Exists |
| 5 | Commercial | Plans & Billing | `/admin/billing` | Entitlements, subscriptions, invoices, credits and dunning | Shell Exists |
| 6 | Product | Content, AI & Safety | `/admin/ai-safety` | AI usage, moderation, policy flags and cost controls | Shell Exists |
| 7 | Product | Connections & Webhooks | `/admin/connections` | Provider health, scopes, event logs and retries | Shell Exists |
| 8 | Operations | Automations | `/admin/automations` | Runs, failures, queues, replay and cancellation | Shell Exists |
| 9 | Operations | Support & Disputes | `/admin/support` | Tickets, cases, escalation and marketplace resolution | Partially Implemented |
| 10 | Governance | Compliance & Data | `/admin/compliance` | Consent, exports, retention, legal holds and reports | Shell Exists |
| 11 | Governance | Flags & Releases | `/admin/flags` | Cohorts, experiments, staged rollout and rollback | Shell Exists |
| 12 | Observe | Platform Analytics | `/admin/platform-analytics` | Growth, activation, revenue and reliability measures | Shell Exists |
| 13 | Observe | Audit & System | `/admin/audit` | Immutable audit trail, configuration and security jobs | Shell Exists |

### 1.2 Admin detail pages and wizards

| No. | Entity/page | Base route | Detail tabs | Main actions | Access/status |
|---:|---|---|---|---|---|
| 1 | Workspace | `/admin/workspaces/:workspaceId` | Overview, Members, Plan, Usage, Connections, Billing, Audit, Support | Suspend, entitlement override, support access, archive | Elevated admin; Shell Exists |
| 2 | User | `/admin/users/:userId` | Profile, Memberships, Security, Usage, Support, Audit | Revoke session, restrict account, change admin role | Elevated admin; Shell Exists |
| 3 | Supplier | `/admin/marketplace/suppliers/:supplierId` | Identity, Shopfront, Risk, Orders, Payments, Audit | Verify, reject, suspend, request evidence | Marketplace ops; Shell Exists |
| 4 | Listing | `/admin/marketplace/listings/:listingId` | Overview, Policy, Evidence, Orders, Audit | Approve, reject, unpublish | Marketplace moderator; Shell Exists |
| 5 | Dispute | `/admin/support/disputes/:caseId` | Timeline, Evidence, Messages, Resolution, Audit | Hold, resolve, refund/release proposal | Case owner; Shell Exists |
| 6 | Provider connection | `/admin/connections/:connectionId` | Scopes, Health, Logs, Retries, Audit | Disable, reconnect, replay verified webhook | Systems admin; Shell Exists |

**Admin wizards:** 1.2.1 Provision workspace (`/admin/workspaces/new`: workspace, owner, entitlement, review); 1.2.2 Verification review (`/admin/marketplace/suppliers/:id/verify`: evidence, decision, notification); 1.2.3 Flag rollout (`/admin/flags/new`: flag, cohort, safeguards, review); 1.2.4 Data request (`/admin/compliance/requests/new`: identity, scope, approver, execution). Every wizard requires stepper, validation, draft, confirmation, audit reason and error recovery.

## 2. Workspace Settings

**Canonical route:** `/{workspaceType}/settings`; legacy `/app/settings` is compatibility-only.  
**Users:** owners, admins and delegated managers.  
**Commercial purpose:** enables safe self-service configuration, lowering support cost while protecting brand, integrations, data and billing controls.

| No. | Settings group | Route | Tabs/pages | Actions | Status |
|---:|---|---|---|---|---|
| 2.1 | Workspace | `/{type}/settings/workspace` | Overview, General, Profile, Regional | Edit name, timezone, currency, language, archive | Shell Exists |
| 2.2 | Branding | `/{type}/settings/branding` | Brand kits, white label, domains, defaults | Upload logo, set rules, verify domain | Shell Exists |
| 2.3 | People | `/{type}/settings/people` | Members, invitations, roles, teams, portal access | Invite, change role, revoke, create grant | Partially Implemented |
| 2.4 | Notifications | `/{type}/settings/notifications` | Channel, digest, approvals, alerts | Configure alerts and quiet hours | Shell Required |
| 2.5 | Integrations | `/{type}/settings/integrations` | Social, ads, messaging, webhooks, API keys | Connect, reconnect, revoke, test | Shell Exists |
| 2.6 | AI & automations | `/{type}/settings/ai` | Usage, policies, tools, automations | Limit usage, approve tools, disable workflow | Shell Exists |
| 2.7 | Storage & data | `/{type}/settings/data` | Storage, exports, retention, audit | Export, set retention, request deletion | Shell Exists |
| 2.8 | Compliance & security | `/{type}/settings/security` | Consent, legal, security, audit | Manage policy, MFA requirement, legal hold | Shell Exists |

**Settings detail pages:** member (`.../people/:memberId`: profile, role, access, activity, audit); integration (`.../integrations/:id`: scopes, health, logs, reconnect); API key (`.../api-keys/:id`: scopes, last use, rotate, revoke). **Wizards:** invite member; connect provider; configure webhook; create custom role; export workspace data. All require role checks and a confirmation before destructive/revocation actions.

## 3. Account Settings

**Canonical route:** `/account`; accessible from avatar menu, not a workspace rail.  
**Users:** every authenticated user.  
**Purpose:** gives the individual control of identity, security, privacy and availability across every workspace without allowing them to alter organisation data.

| No. | Section | Route | Functions | Status |
|---:|---|---|---|---|
| 3.1 | Account overview | `/account` | Profile completion, memberships, security notices | Shell Required |
| 3.2 | Profile | `/account/profile` | Name, avatar, title, bio, professional/creator profile | Partially Implemented |
| 3.3 | Security | `/account/security` | Password, login methods, MFA, sessions/devices, activity | Partially Implemented |
| 3.4 | Notifications | `/account/notifications` | Personal channel preferences and quiet hours | Shell Required |
| 3.5 | Connected accounts | `/account/connections` | Connected identity/social accounts and revocation | Shell Required |
| 3.6 | Privacy & data | `/account/data` | Export, deletion, privacy requests | Shell Required |
| 3.7 | Availability | `/account/availability` | Working hours and calendar availability for assignments | Shell Exists |

## 4. Billing Settings

**Canonical route:** `/{workspaceType}/settings/billing`; legacy `/app/settings/billing` is compatibility-only.  
**Users:** owner/billing administrator.  
**Purpose:** subscription retention, self-service upgrades and transparent usage controls; it is separate from general settings.

| No. | Page | Route | Functions and records | Status |
|---:|---|---|---|---|
| 4.1 | Billing overview | `/{type}/settings/billing` | Current plan, renewal, payment health, usage alerts | Partially Implemented |
| 4.2 | Subscription | `.../subscription` | Plan comparison, upgrade/downgrade, cancellation, trial | Shell Exists |
| 4.3 | Add-ons & seats | `.../add-ons` | Modules, seats, AI credits, storage | Shell Exists |
| 4.4 | Usage | `.../usage` | AI, automations, sends, storage and limits | Shell Exists |
| 4.5 | Payment methods | `.../payment-methods` | Provider-hosted payment method lifecycle | Shell Required |
| 4.6 | Invoices & credits | `.../invoices` | Invoice, credit, discount and tax document detail | Partially Implemented |
| 4.7 | Marketplace fees | `.../marketplace-fees` | Commission schedules, payout/settlement visibility | Shell Exists |

## 5. Workspace Types

### 5.1 Workspace classification

| No. | Workspace type | Canonical route | Main user | Marketplace relationship | Status |
|---:|---|---|---|---|---|
| 5.1.1 | Solo Marketing Professional / Creator | `/creator` | Individual creator | May own public creator profile and buy supplier services | Shell Exists |
| 5.1.2 | Brand or Business | `/business` or `/brand` | Business/brand marketing team | Buys services; commissions creators | Shell Exists |
| 5.1.3 | Campaign Management Team | `/brand` | Internal multi-user marketing team | Brand subtype, not a separate data model | Shell Exists |
| 5.1.4 | Marketing Agency | `/agency` | Multi-client agency | May buy and sell services; client portal owner | Shell Exists |
| 5.1.5 | Creative Agency | `/agency` | Creative/production agency | Agency subtype; differentiated by marketplace profile/category | Shell Exists |
| 5.1.6 | Influencer / UGC Creator | `/creator` plus `/creator-portal` | Creator | Public profile and campaign portal, not separate tenant architecture | Shell Exists |
| 5.1.7 | Creative/Marketing Supplier | `/supplier` | Service provider | Supplier workspace and public shopfront | Partially Implemented |
| 5.1.8 | Affiliate / Ambassador | `/affiliate-portal` | Performance partner | Portal by default; full workspace only if operating programmes | Shell Exists |
| 5.1.9 | Publisher / Media Partner | `/publisher-portal` | Publisher/media owner | Portal by default; marketplace profile when selling inventory | Shell Exists |
| 5.1.10 | Platform Admin | `/admin` | Caption Fox operations | Operates, never owns normal tenant records | Partially Implemented |

### 5.2 Shared Campaign Manager section contract

Every Campaign Manager workspace uses the same component shell, state model, top bar and responsive conventions. Its unique navigation is an entitlement-filtered subset; hidden functionality must not appear as an empty menu item.

| No. | Side-nav section | Base route | Sub-tabs | Clickable detail records and detail tabs | Wizard | Users/value |
|---:|---|---|---|---|---|---|
| 1 | Home | `/{type}/home` | Overview, Approvals, Ideas | Notification/activity: context, actions, audit | Dashboard setup | All; command centre and retention |
| 2 | Strategy | `/{type}/strategy` | Objectives, Audiences, Research, Positioning, Plans, Forecasts | Plan: Overview, Messages, Budget, Risks, Campaigns, Audit | Strategy plan | Business+; turns goals into accountable work |
| 3 | Campaigns | `/{type}/campaigns` | All, Giveaways, Competitions, Templates | Campaign: Overview, Brief, Content, Tasks, Budget, Assets, Results, Audit | Campaign | All; core commercial operating record |
| 4 | Calendar | `/{type}/calendar` | Calendar, Publishing Queue | Publication: Content, Variants, Approval, Delivery Log, History | Schedule publication | All; dependable delivery and capacity |
| 5 | Studio | `/{type}/studio` | Compose, AI Generate, Ideas, Templates, Hashtags, Media | Content: Editor, Variants, Approvals, Schedule, Performance, Versions, Rights | Content | All; content throughput/brand control |
| 6 | Brand & Assets | `/{type}/brand` | Brand Kits, Assets, Rights, Product Library | Asset: Versions, Usage, Licence, Audit | Brand kit/asset upload | Business+; prevents off-brand/risk |
| 7 | Social | `/{type}/social` | Publishing, Engagement, Listening, Connections | Connection: Overview, Posts, Audience, Scopes, Health, Logs | Connect channel | All; channel operations |
| 8 | Advertising | `/{type}/advertising` | Accounts, Campaigns, Creatives, Audiences, Reports | Ad campaign: Overview, Targeting, Creatives, Budget, Placements, Results, Change Log | Ad campaign | Brand/Agency; paid acquisition |
| 9 | Messaging | `/{type}/messaging` | Email, SMS, WhatsApp, RCS, Push, Journeys, Templates | Journey: Canvas, Audience, Content, Goals, Runs, Conversions, Settings, Audit | Message/journey | Business+; lifecycle retention |
| 10 | Web & Conversion | `/{type}/web` | Pages, Forms, Funnels, Experiments, Tracking | Page: Builder, Variants, Forms, Analytics, Settings | Landing page/form | Business+; measurable conversion |
| 11 | SEO & Discovery | `/{type}/seo` | Keywords, Briefs, Rankings, Local, AI Search, Backlinks | Keyword cluster: Overview, Opportunities, Tasks, Rankings, Competitors | SEO brief | Business+; organic demand |
| 12 | Link in Bio | `/{type}/links` | Pages, Links, Themes, Analytics | Link page: Design, Links, Products, Pixels, Analytics | Link page | All; conversion utility |
| 13 | Creators & UGC | `/{type}/creators` | Creators, Briefs, Submissions, Rights, Payments | Creator: Profile, Campaigns, Content, Performance, Agreements, Payments; Brief: Requirements, Submissions, Rights | UGC brief | Brand/Agency; creator ROI and rights |
| 14 | Marketplace | `/marketplace`; `/{type}/marketplace` | Discover, Categories, Saved, Requests, Orders | Supplier: Overview, Services, Portfolio, Reviews, Policies; Order: Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit | Request/quote | All; marketplace conversion |
| 15 | Partnerships | `/{type}/partnerships` | Affiliates, Referrals, Ambassadors, Loyalty, Resellers, Co-marketing | Programme: Terms, Assets, Links, Conversions, Commissions | Programme | Brand/Agency; performance growth |
| 16 | PR & Reputation | `/{type}/reputation` | Media Lists, Pitches, Press Room, Coverage, Reviews, Crisis | Release/incident: Details, Assets, Approvals, Distribution, Mentions, Timeline | Release/incident | Entitled teams; reputation risk |
| 17 | Community | `/{type}/community` | Communities, Calendar, Moderation, Members, Advocacy | Community: Overview, Content, Moderation, Health, Permissions | Community | Entitled teams; retention/advocacy |
| 18 | Events | `/{type}/events` | Events, Webinars, Podcasts, Sponsorships, Follow-up | Event: Overview, Promotion, Registrations, Run-of-show, Sponsors, Attribution | Event | Entitled teams; event demand generation |
| 19 | Inbox | `/{type}/inbox` | Unified, Assignments, Saved Views | Thread: Conversation, Contact, Activity, Tasks, Notes | Routing setup | All; response quality |
| 20 | Leads & Audiences | `/{type}/audiences` | Contacts, Segments, Consent, Scoring, Imports | Contact: Profile, Activity, Memberships, Consent, Score, Journeys | Import/segment | Business+; owned audience |
| 21 | Analytics | `/{type}/analytics` | Overview, Content, Audience, Competitors, Reports, Attribution | Report: Dashboard, Sources, Methodology, Exports, Schedule | Report | All; proves commercial value |
| 22 | Finance | `/{type}/finance` | Budgets, POs, Costs, Invoices, Commissions, Profitability | Budget/PO: Overview, Lines, Approval, Documents, Audit | Budget/PO | Business+; profitability control |
| 23 | Automations | `/{type}/automations` | Workflows, Recipes, Runs, Connections, Logs | Workflow: Canvas, Trigger, Actions, Versions, Test, Runs, Logs, Settings | Workflow | Entitled teams; scalable execution |
| 24 | Settings | `/{type}/settings` | Workspace, Branding, Channels, People, Billing, Account, Data | Member/connection/API key detail as Section 2 | Invite/connect/export | Appropriate managers |

**Shared section requirements:** page header, breadcrumbs where nested, KPI/summary appropriate to the record, search/filter/sort/saved views, relevant table/card/board/calendar/timeline/chart view selector, quick actions, bulk actions, export/import where commercially relevant, audit/activity, empty/loading/error/no-results/restricted/upgrade/archived/integration-unavailable states. Every Create wizard requires permission check, draft, validation, review, success and recovery.

### 5.3 Creator workspace navigation register

**Route:** `/creator`. **Side nav:** Home; Campaigns; Calendar; Studio; Link in Bio; Social; Marketplace; Inbox; Analytics; Settings.  
**Unique rules:** no business Finance/Ads/CRM by default; Creator Profile is available from Studio/Profile and public creator profile. **Commercial value:** supports independent production, creator growth and service discovery. **Permissions:** owner, collaborator, viewer; campaign grants are separate. **Status:** Shell Exists.

### 5.4 Business workspace navigation register

**Route:** `/business`. **Side nav:** Home; Strategy; Campaigns; Calendar; Studio; Brand & Assets; Link in Bio; Social; Messaging; Web & Conversion; Marketplace; Inbox; Leads & Audiences; Analytics; Settings.  
**Unique rules:** acquisition and lifecycle modules enabled; paid ads/SEO/finance become plan gates. **Commercial value:** turns marketing activity into contacts and measurable conversions. **Status:** Shell Exists.

### 5.5 Brand/Campaign Team workspace navigation register

**Route:** `/brand`. **Side nav:** all shared sections except Agency-only Clients/White Label, subject to plan and role.  
**Unique rules:** adds Creators & UGC, Advertising, Partnerships, Brand governance, Finance and Approvals. **Commercial value:** governed multi-channel campaigns and creator procurement. **Status:** Shell Exists.

### 5.6 Agency/Creative Agency workspace navigation register

**Route:** `/agency`. **Side nav:** Home; Clients; Strategy; Campaigns; Calendar; Studio; Brand & Assets; Shared Templates; Social; Advertising; Messaging; Web; SEO; Creators & UGC; Marketplace; Partnerships; Reputation; Community; Events; Inbox; Leads; Client Approvals; Analytics; Finance; Client Reports; Automations; Agency Operations; Settings.  
**Client detail tabs:** Overview, Campaigns, Approvals, Reports, Files, Access. **Wizards:** Client workspace; portal invite; report. **Commercial value:** multi-client retention, white-label reporting and margin control. **Status:** Shell Exists.

### 5.7 Supplier workspace navigation register

**Route:** `/supplier`. **Side nav:** Dashboard; Shopfront & Profile; Listings & Packages; Orders; Deliveries; Messages; Availability; Reviews & Reputation; Disputes; Earnings & Payouts; Analytics; Settings.  
**Detail pages:** Listing (Description, Scope, Pricing, Media, FAQs, Revisions, Performance); Order (Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit); Payout (Line items, Fees, Status, Documents). **Wizards:** supplier onboarding; listing; quote; delivery; dispute evidence; payout setup. **Permissions:** supplier owner/team only; buyer sees an explicit order grant only. **Status:** Dashboard/listings/orders/disputes/profile/payouts Partially Implemented; remaining sections Shell Exists.

## 6. Portal Types

**Portal policy:** portal users receive a signed, expiring grant to named records. They do not inherit a workspace, cannot enumerate tenant records and cannot change settings/billing unless separately made workspace members.

| No. | Portal | Route pattern | Owner / external user | Navigation sections | Visible records/actions | Status |
|---:|---|---|---|---|---|---|
| 6.1 | Client approval | `/client-portal/:grantId` | Agency/Brand / client approver | Home, Approvals, Calendar, Deliverables, Reports, Files, Messages, Settings | Shared campaigns, approve/request changes, comment, download | Shell Exists |
| 6.2 | Brand/campaign collaborator | `/collaborator-portal/:grantId` | Campaign / named collaborator | Home, Tasks, Content, Files, Messages, Settings | Assigned tasks/content; comment/submit | Shell Required |
| 6.3 | Creator/influencer/UGC | `/creator-portal/:grantId` | Brand/agency / creator | Home, Opportunities, Briefs, Deliverables, Rights, Payments, Profile | Briefs, own submissions, rights, payment status | Shell Exists |
| 6.4 | Supplier portal | `/supplier` or `/supplier-portal/:grantId` | Supplier tenant / supplier contributor | Dashboard, listings, order rooms, delivery, payout | Own services/orders only | Partially Implemented |
| 6.5 | Affiliate/ambassador | `/affiliate-portal/:grantId` | Programme owner / partner | Home, Programme, Links & Codes, Assets, Conversions, Commissions, Support, Profile | Own links, aggregated conversions, payout status | Shell Exists |
| 6.6 | Publisher/media partner | `/publisher-portal/:grantId` | Brand/agency / publisher | Home, Opportunities, Media Kit, Placements, Deliveries, Reports, Profile | Opportunities, proposal, placements and reports | Shell Exists |
| 6.7 | Buyer order | `/buyer-portal/:grantId` | Buyer workspace / buyer order contact | Home, Requests, Orders, Deliveries, Payments, Disputes, Messages, Settings | Own request/order room, accept/revise delivery, dispute | Shell Exists |
| 6.8 | Public campaign | `/c/:slug` | Campaign workspace / public visitor | Home, Offers, About, Contact | Opt-in form, offer click, consent | Shell Required |
| 6.9 | Public media kit | `/media-kit/:slug` | Creator/publisher / public visitor | Profile, Audience, Services, Portfolio, Contact | View verified public media kit/enquire | Shell Required |
| 6.10 | Public link-in-bio | `/l/:slug` | Workspace / public visitor | Public page only | Click approved links, submit consent-aware form | Partially Implemented |
| 6.11 | Public creator profile | `/creators/:slug` | Creator / public visitor | Profile, Portfolio, Services, Contact | View public content/enquire | Shell Required |

### 6.12 Portal detail and wizard requirements

Portal detail pages use the same record shell but omit private tabs. Approval item tabs are Preview, Feedback, Version History; Creator brief tabs are Overview, Requirements, Submissions, Feedback, Rights, Payment; Buyer order tabs are Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit. Wizards: portal invitation (recipient, records, role, expiry, review); submission (brief, files, rights declaration, submit); partner application (profile, tax/compliance, terms, review); buyer request (need, budget, shortlist, brief, submit). Every portal requires expiration, revoked-grant, permission-denied and no-longer-shared states.

## 7. Public Website and Marketplace

### 7.1 Public navigation register

| No. | Top navigation | Canonical route | Sub-navigation/detail pages | Commercial purpose | Status |
|---:|---|---|---|---|---|
| 1 | Product | `/features` | Feature and integration pages | Explain subscription value | Implemented/Partial |
| 2 | Solutions | `/solutions` | Creator, business, brand, agency, supplier, industry | Segment conversion | Shell Required |
| 3 | Marketplace | `/marketplace` | Discover, search, categories, how it works, become supplier; supplier/listing detail | Marketplace liquidity and commission | Partially Implemented |
| 4 | Pricing | `/pricing` | Plans, add-ons, enterprise, fee FAQ | Conversion and expansion | Partially Implemented |
| 5 | Resources | `/resources` | Blog, guides, templates, help, changelog, status | Acquisition/support deflection | Shell Required |
| 6 | Company | `/company` | About, contact, careers, trust, legal | Trust and enterprise conversion | Partial |
| 7 | Auth | `/login`, `/signup` | Login, reset, MFA, verify | Account conversion/security | Implemented |

### 7.2 Marketplace search and shopfront

**Search route:** `/marketplace/search`; filters category, service, location/service area, remote/on-site, budget, delivery time, availability, verified status, rating, language and accessibility. **Views:** result card/list, comparison and map only when location data is reliable. **Supplier detail:** `/marketplace/:supplierSlug` with Overview, Services, Portfolio, Reviews, Policies. **Listing detail:** `/marketplace/listings/:listingSlug` with Scope, Pricing, Samples, Delivery, Reviews, FAQs. **Actions:** save, compare, enquire, request quote; never expose order/payment/private data publicly. **States:** no results with filter relaxation, unverified, unpublished, suspended, unavailable. **Integrations:** search index, verification, payments/contracts only after marketplace safety gate.

## 8. Authentication and Onboarding

| No. | Route | Purpose/actions | Required states | Status |
|---:|---|---|---|---|
| 8.1 | `/signup` | Account creation, consent, verification | invalid, duplicate, verification pending | Implemented |
| 8.2 | `/login` | Login and redirect to entitled workspace/portal | invalid credentials, MFA, locked, provider unavailable | Implemented |
| 8.3 | `/forgot-password`, `/reset-password` | Recovery | expired link, success, retry | Implemented |
| 8.4 | `/mfa`, `/verify-email` | Security and verification | challenge, recovery, verified | Implemented |
| 8.5 | `/onboarding` | Workspace type, brand, goals, channels, team, billing | save/resume, missing integration, upgrade | Partially Implemented |
| 8.6 | Supplier onboarding | `/marketplace/sell` | Identity, category, shopfront, policies, verification | pending review, rejected, incomplete | Partially Implemented |

**Workspace switcher:** lists only server-authorised memberships; routes Creator to `/creator`, Business to `/business`, Brand to `/brand`, Agency to `/agency`, Supplier to `/supplier`, and Admin to `/admin`. It is a preference selector, never an authorisation mechanism.

## 9. Shared Cross-Platform Components

Caption Fox requires: responsive application shell; grouped desktop rail; mobile primary bar plus grouped More drawer; context/mode switcher; command search; notification centre; quick-create registry; page header; breadcrumbs; tabs; filters; saved views; card/table/board/calendar/timeline/chart switches; status/approval chips; activity/audit feed; file/asset picker; right summary rail; empty/loading/error/restricted/upgrade/archive screens; confirmation dialog; responsive wizard; access guard; integration health card; design-token primitives. Fox Copilot is a permissioned tool agent: retrieve workspace context, draft, preview, request approval, execute allowed tool, record citation/audit; it cannot bypass role, spend, publish or payment controls.

## 10. Route Register

| Workspace/portal | Route family | Page type | Parent | Detail/wizard pattern | Access | Status |
|---|---|---|---|---|---|---|
| Creator/Business/Brand/Agency | `/{type}/{section}` | Collection/dashboard | `/{type}` | `/{section}/:id`; `/{section}/new` | Membership + role | Shell Exists |
| Campaign | `/{type}/campaigns/:campaignId` | Detail | Campaigns | `/overview`, `/brief`, `/content`, `/tasks`, `/budget`, `/assets`, `/results`, `/audit` | Campaign role | Partially Implemented |
| Studio content | `/{type}/studio/content/:contentId` | Detail | Studio | `/editor`, `/variants`, `/approvals`, `/schedule`, `/performance`, `/versions`, `/rights` | Content role | Shell Exists |
| Supplier | `/supplier/{section}` | Workspace collection | Supplier | `/{section}/:id`; `/{section}/new` | Supplier membership | Partial/Shell Exists |
| Admin | `/admin/{section}` | Operations collection | Admin | `/{section}/:id`; controlled new/action flows | Elevated admin | Partial/Shell Exists |
| Portal | `/{portalType}/:grantId/{section}` | Restricted portal | Portal root | record detail only where grant permits | Signed grant + auth | Shell Exists |
| Marketplace | `/marketplace/*` | Public/optional buyer auth | Public | supplier/listing/order request | Public/buyer membership | Partial |
| Public link | `/l/:slug` | Public profile | Public | owner-only analytics/settings elsewhere | Public | Partially Implemented |
| Legacy | `/app/*` | Compatibility route | Legacy | Redirect/migrate to type-first route | Existing membership | Deprecated/Duplicate |

## 11. Wizard Register

| No. | Parent | Wizard route | Steps | Result | Permission | Status |
|---:|---|---|---|---|---|---|
| 1 | Strategy | `/{type}/strategy/new` | Objective, audience, insight, positioning, channels, budget, review | Strategy plan draft | Manager | Shell Exists |
| 2 | Campaigns | `/{type}/campaigns/new` | Goal, audience, channels, deliverables, dates, budget, owners, review | Campaign draft | Creator/manager | Shell Exists |
| 3 | Studio | `/{type}/studio/new` | Format, brief, create/import, edit, brand/rights, approval, save | Versioned content draft | Creator | Shell Exists |
| 4 | Calendar | `/{type}/calendar/new` | Channel, variant, schedule, compliance, preview, queue | Publication job | Publish role | Shell Exists |
| 5 | Creators & UGC | `/{type}/creators/briefs/new` | Brief, shortlist, rights, deliverables, invite, review | UGC brief | Brand/agency manager | Shell Exists |
| 6 | Marketplace | `/{type}/marketplace/requests/new` | Need, budget, shortlist, brief, review, submit | Supplier request | Buyer role | Shell Exists |
| 7 | Supplier listing | `/supplier/listings/new` | Category, service, scope, pricing, delivery, media, policy, publish | Listing pending moderation | Supplier owner | Shell Exists |
| 8 | Supplier quote | `/supplier/orders/:id/quote/new` | Scope, terms, milestones, review | Quote | Assigned supplier | Shell Exists |
| 9 | Messaging journey | `/{type}/messaging/journeys/new` | Channel, audience, content, branch, test, approval, activate | Journey | Messaging manager | Shell Exists |
| 10 | Web conversion | `/{type}/web/pages/new` | Goal, template, content, form/CTA, consent, QA, publish | Page draft/published version | Web manager | Shell Exists |
| 11 | Automation | `/{type}/automations/new` | Trigger, conditions, actions, approvers, test, activate | Workflow | Automation role | Shell Exists |
| 12 | Portal invite | `/{type}/settings/people/portal-invite` | Recipient, records, role, expiry, review | Portal grant | Admin/manager | Shell Exists |

## 12. Profile and Detail-Page Register

| Entity | Base route | Opened from | Required tabs | Main actions | Status |
|---|---|---|---|---|---|
| Campaign | `/{type}/campaigns/:id` | List, board, calendar, search, notification | Overview, Brief, Content, Tasks, Budget, Assets, Results, Audit | Edit, approve, duplicate, archive, export | Partial/Shell Exists |
| Content | `/{type}/studio/content/:id` | Studio, calendar, campaign, approval | Editor, Variants, Approvals, Schedule, Performance, Versions, Rights | Edit, submit, approve, schedule, export | Partial/Shell Exists |
| Strategy plan | `/{type}/strategy/plans/:id` | Strategy list, campaign relation | Overview, Messages, Budget, Risks, Campaigns, Audit | Edit, approve, link campaign | Shell Exists |
| Creator | `/{type}/creators/:id` | CRM, UGC brief, marketplace | Profile, Campaigns, Content, Performance, Agreements, Payments | Invite, assign, contract, pay request | Shell Exists |
| UGC brief | `/{type}/creators/briefs/:id` | Brief list, campaign | Overview, Requirements, Creators, Submissions, Approvals, Rights, Payments, Audit | Invite, approve, close | Partial/Shell Exists |
| Supplier | `/marketplace/:slug` | Search, category, saved | Overview, Services, Portfolio, Reviews, Policies | Save, enquire, request quote | Partial |
| Listing | `/marketplace/listings/:slug` | Supplier, search | Scope, Pricing, Samples, Delivery, Reviews, FAQs | Save, enquire | Shell Exists |
| Order | `/{type}/marketplace/orders/:id` or `/supplier/orders/:id` | Requests, portal, notification | Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit | Message, submit/accept delivery, dispute | Partial/Shell Exists |
| Automation | `/{type}/automations/:id` | Workflow list, run log | Canvas, Trigger, Actions, Versions, Test, Runs, Logs, Settings | Test, activate, pause, duplicate | Shell Exists |
| Report | `/{type}/analytics/reports/:id` | Reports, campaign, shared link | Dashboard, Sources, Methodology, Exports, Schedule | Edit, export, share, schedule | Partial/Shell Exists |

## 13. Coverage Audit

| Category | Required | Documented | Existing route | Shell exists | Detail pages | Wizards | Gaps |
|---|---:|---:|---:|---:|---:|---:|---|
| Platform Admin | Yes | Yes | Partial | Yes | Yes | Yes | Live marketplace/billing/provider operations |
| Workspace Settings | Yes | Yes | Partial | Yes | Yes | Yes | Full security/data implementation |
| Account Settings | Yes | Yes | Partial | Partial | Yes | No | Dedicated `/account` route |
| Billing | Yes | Yes | Partial | Yes | Yes | Partial | Stripe lifecycle and entitlements |
| Campaign Manager workspaces | Yes | Yes | Partial | Yes | Yes | Yes | Domain data/integrations behind shells |
| Supplier workspace | Yes | Yes | Partial | Yes | Yes | Yes | Delivery, messages, reviews, KYC/payout rails |
| Portals | Yes | Yes | Shell | Yes | Yes | Yes | Signed grants/RLS and notifications |
| Public website/marketplace | Yes | Yes | Partial | Yes | Yes | Yes | Search index, supplier verification, public resources |
| Auth/onboarding | Yes | Yes | Partial | Partial | n/a | Yes | Account-specific demo seed/auth record |

## 14. Conflicts, duplicate routes and implementation rules

1. **Type-first routes are definitive:** `/creator`, `/business`, `/brand`, `/agency`, `/supplier`; `/app/*` is a legacy compatibility namespace and must not receive net-new routes.
2. **Do not duplicate top-level Studio resources:** templates, hashtags, brand voice and media belong inside Studio/Brand, while legacy standalone routes redirect.
3. **Listening is a Social/Analytics sub-area:** do not give it standalone product weight until ingestion is reliable.
4. **Calendar status is a filter:** Scheduled, Draft and Failed are saved views/status chips, not permanent tabs.
5. **Supplier workspace is not a buyer portal:** it owns supplier records; buyer portal grants only expose the relevant order room.
6. **Escrow and verification claims remain gated:** no public wording or UI state may imply protected payment, verified provider or guaranteed payout without the legal/provider implementation.
7. **Shell Exists does not mean feature implemented:** route shells provide page, tabs, detail, wizard and state structure. Real persistence, RLS, jobs and provider integrations require their module completion gate.

## 15. Completion metrics

| Metric | Count |
|---|---:|
| Platforms documented | 1 (Caption Fox only, by request) |
| Workspace types documented | 10 |
| Portal types documented | 11 |
| Admin navigation sections | 13 |
| Campaign Manager side-navigation sections | 24 |
| Supplier side-navigation sections | 12 |
| Route families registered | 9 |
| Profile/detail entity types registered | 10 |
| Creation wizards registered | 12 |
| Undocumented Caption Fox requirements | 0 at architecture level |
| Known duplicate/conflicting route families | 5 (recorded in Section 14) |

**Largest remaining implementation gaps:** tenant/RLS and portal-grant enforcement; real social/ad/messaging provider adapters; marketplace contract/KYC/payment/dispute rails; consent/attribution data foundation; and production-grade automation/Fox tool controls. These are intentionally marked as gated work rather than described as shipped.
