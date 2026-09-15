# Caption Fox — Individual Page Creation Architecture

**Version:** 2.0  
**Date:** 2026-07-24  
**Scope:** Caption Fox only  
**Purpose:** Convert the existing site and route architecture into a page-by-page production register for design, development, data wiring, permissions and browser testing.

---

# 0. Document Rules

## 0.1 Permanent numbering

Each page receives a permanent number:

- `1.x` Platform Admin
- `2.x` Workspace Settings
- `3.x` Account Settings
- `4.x` Billing
- `5.x` Shared Campaign Manager modules
- `6.x` Creator workspace
- `7.x` Business workspace
- `8.x` Brand workspace
- `9.x` Agency workspace
- `10.x` Supplier workspace
- `11.x` Portals
- `12.x` Public website and marketplace
- `13.x` Authentication and onboarding
- `14.x` Shared production requirements

Numbers must not be reused after a page is deprecated.

## 0.2 Required hierarchy for every side-navigation section

1. Section landing page.
2. Sub-pages or stable sub-tabs.
3. Collection views.
4. Record/profile/detail pages.
5. Detail-page tabs.
6. Creation and action wizards.
7. Loading, empty, no-results, restricted, upgrade, archived, unavailable and error states.

## 0.3 Required definition for every page

Every page must define:

- Number
- Page name
- Canonical route
- Parent section
- Page type
- Commercial purpose
- Primary users
- Records displayed
- Main functions
- Primary action
- Secondary actions
- Required components
- Supported views
- Search, filters and sorting
- Permission requirements
- Related detail pages
- Related wizards
- Audit requirements
- Responsive behaviour
- Acceptance criteria

## 0.4 Standard component vocabulary

| Component | Required behaviour |
|---|---|
| Application shell | Responsive top bar, grouped side rail, workspace switcher, notifications and avatar menu |
| Page header | Breadcrumb, title, description, status, primary action and secondary menu |
| KPI strip | Live metrics, comparison period, loading skeleton and drill-down |
| Filter bar | Search, filters, sort, saved views, reset and active-filter chips |
| Data table | Sorting, columns, selection, bulk actions, pagination and keyboard support |
| Card grid | Responsive cards, status, owner, dates, thumbnail and quick actions |
| Board | Permission-aware drag-and-drop, rollback and status restrictions |
| Calendar | Month, week, day and agenda views with timezone handling |
| Timeline/Gantt | Milestones, dependencies, zoom and ownership |
| Chart area | Accessible chart, source label, comparison, tooltip and export |
| Right summary rail | Status, owner, next action, warnings, related records and activity |
| Activity feed | Actor, action, time, source and deep link |
| Audit drawer | Immutable event, reason, actor, scope and before/after context |
| Approval panel | Approvers, deadline, comments, version and decision controls |
| Integration card | Provider, scope, health, last sync, reconnect and logs |
| Wizard shell | Stepper, autosave, validation, review, confirmation, success and recovery |
| Restricted state | Permission-safe explanation with no leaked record data |
| Upgrade state | Entitlement explanation and upgrade path without pretending the feature is live |

## 0.5 Completion rule

A route shell is not a completed feature. A page passes only when it uses real authorised data, all actions work, server-side permissions are enforced, all states exist, responsive layouts pass, material actions are audited and browser testing is complete.

---

# 1. Platform Admin Dashboard

**Base route:** `/admin`  
**Users:** explicitly elevated Caption Fox platform administrators.  
**Purpose:** operate tenants, users, marketplace trust, billing, providers, support, compliance, releases and platform reliability.

## 1.1 Main admin pages

| No. | Page | Route | Function | Required components |
|---:|---|---|---|---|
| 1.01 | Admin dashboard | `/admin` | Platform health, queues, incidents, usage and urgent operational actions | KPI strip, incident queue, provider health, job queue, activity feed |
| 1.02 | Workspaces | `/admin/workspaces` | Search and manage tenant lifecycle, plan, usage and support context | Filter bar, table, saved views, status chips, bulk actions |
| 1.03 | Users | `/admin/users` | Manage user security, memberships and support history | User table, security flags, membership drawer, audit |
| 1.04 | Marketplace operations | `/admin/marketplace` | Verification, listings, orders, payouts and disputes | Queue tabs, evidence viewer, risk chips, order timeline |
| 1.05 | Plans and billing | `/admin/billing` | Plans, subscriptions, entitlements, invoices, credits and dunning | Subscription table, dunning queue, entitlement matrix |
| 1.06 | Content, AI and safety | `/admin/ai-safety` | AI usage, moderation, policy flags and cost controls | Usage charts, moderation queue, policy filters, model health |
| 1.07 | Connections and webhooks | `/admin/connections` | Provider health, scopes, webhook events and retries | Provider cards, event table, retry queue, payload inspector |
| 1.08 | Automation operations | `/admin/automations` | Runs, failures, queues, replay and worker health | Run table, queue charts, worker status, error groups |
| 1.09 | Support and disputes | `/admin/support` | Tickets, escalations and marketplace resolution | Case queue, SLA chips, conversation, evidence, resolution panel |
| 1.10 | Compliance and data | `/admin/compliance` | Privacy requests, exports, retention and legal holds | Request queue, identity checklist, scope builder, retention dashboard |
| 1.11 | Flags and releases | `/admin/flags` | Feature flags, cohorts, experiments and rollback | Flag table, cohort builder, release timeline, safeguards |
| 1.12 | Platform analytics | `/admin/platform-analytics` | Acquisition, activation, retention, revenue and reliability | KPI strip, cohort charts, funnels, segmentation |
| 1.13 | Audit and system | `/admin/audit` | Immutable audit, system jobs and controlled configuration | Audit table, advanced filters, job table, configuration panel |

## 1.2 Admin detail pages

| No. | Detail page | Route | Tabs | Main actions |
|---:|---|---|---|---|
| 1.14 | Workspace detail | `/admin/workspaces/:workspaceId` | Overview, Members, Plan, Usage, Connections, Billing, Audit, Support | Suspend, reactivate, entitlement override, archive, controlled support access |
| 1.15 | User detail | `/admin/users/:userId` | Profile, Memberships, Security, Usage, Support, Audit | Revoke session, restrict account, require reset, manage admin role |
| 1.16 | Supplier detail | `/admin/marketplace/suppliers/:supplierId` | Identity, Shopfront, Verification, Risk, Listings, Orders, Payments, Audit | Verify, reject, request evidence, suspend, hold payouts |
| 1.17 | Listing moderation detail | `/admin/marketplace/listings/:listingId` | Overview, Scope, Pricing, Media, Policy, Evidence, Orders, Audit | Approve, reject, request changes, unpublish |
| 1.18 | Dispute detail | `/admin/support/disputes/:caseId` | Timeline, Evidence, Messages, Order, Payment, Resolution, Audit | Request evidence, hold, propose outcome, resolve, reopen |
| 1.19 | Provider connection detail | `/admin/connections/:connectionId` | Overview, Scopes, Health, Events, Retries, Incidents, Audit | Disable, reconnect, replay verified event |
| 1.20 | Automation run detail | `/admin/automations/runs/:runId` | Summary, Inputs, Steps, Outputs, Logs, Cost, Audit | Cancel, replay safe checkpoint, quarantine workflow |
| 1.21 | Feature flag detail | `/admin/flags/:flagId` | Overview, Cohorts, Rules, Exposure, Metrics, Changes, Audit | Edit, pause, change rollout, rollback, archive |

## 1.3 Admin wizards

| No. | Wizard | Route | Steps | Result |
|---:|---|---|---|---|
| 1.22 | Provision workspace | `/admin/workspaces/new` | Workspace, owner, type, plan, entitlements, settings, review | New workspace and owner membership |
| 1.23 | Supplier verification review | `/admin/marketplace/suppliers/:id/verify` | Identity, evidence, payout readiness, policy, risk, decision, notification | Verification decision |
| 1.24 | Create feature flag | `/admin/flags/new` | Key, description, default, cohort, rules, safeguards, metrics, review | Staged feature flag |
| 1.25 | Create data request | `/admin/compliance/requests/new` | Requester, identity, type, scope, approver, execution, review | Compliance case |
| 1.26 | Create plan | `/admin/billing/plans/new` | Identity, limits, features, pricing reference, visibility, migration impact, review | Draft plan configuration |

---

# 2. Workspace Settings

**Base route:** `/{type}/settings`  
**Users:** owners, administrators and delegated managers.

## 2.1 Workspace pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 2.01 | Settings overview | `/{type}/settings` | Configuration summary, warnings and quick actions | Setup checklist, warning cards, recent changes |
| 2.02 | Workspace overview | `/{type}/settings/workspace` | Identity, type, owner, plan and lifecycle | Identity card, configuration cards, audit preview |
| 2.03 | General | `/{type}/settings/workspace/general` | Name, locale, date, week and default view settings | Validated forms, save bar |
| 2.04 | Workspace profile | `/{type}/settings/workspace/profile` | Public or professional organisation information | Image upload, profile preview, visibility labels |
| 2.05 | Regional | `/{type}/settings/workspace/regional` | Timezone, currency, language and regional formats | Selectors, timezone preview, warnings |
| 2.06 | Lifecycle | `/{type}/settings/workspace/lifecycle` | Transfer ownership, archive, restore and closure | Danger zone, impact summary, typed confirmation |
| 2.07 | Brand kits | `/{type}/settings/branding/brand-kits` | Manage reusable brand definitions | Cards, preview, default status, filters |
| 2.08 | White label | `/{type}/settings/branding/white-label` | Eligible portal and report branding | Live preview, token editor, asset picker |
| 2.09 | Custom domains | `/{type}/settings/branding/domains` | Add, verify and remove domains | Domain table, DNS checklist, verification state |
| 2.10 | Brand defaults | `/{type}/settings/branding/defaults` | Default kit, tone, disclaimers and channel rules | Rule table, selectors, conflict warnings |
| 2.11 | Members | `/{type}/settings/people/members` | Manage workspace members | Member table, filters, roles, bulk actions |
| 2.12 | Invitations | `/{type}/settings/people/invitations` | Pending, accepted, expired and revoked invitations | Invitation table, status filters, actions |
| 2.13 | Roles and permissions | `/{type}/settings/people/roles` | System and custom roles | Permission matrix, role cards, impact count |
| 2.14 | Teams | `/{type}/settings/people/teams` | Member groups, leads and workload ownership | Team cards, member picker, workload summary |
| 2.15 | Portal access | `/{type}/settings/people/portal-access` | External grants to named records | Grant table, scope chips, expiry and audit |
| 2.16 | Notification channels | `/{type}/settings/notifications/channels` | Email, in-app, webhook and fallback defaults | Channel cards, test delivery |
| 2.17 | Digests | `/{type}/settings/notifications/digests` | Scheduled workspace summaries | Digest table, schedule and preview |
| 2.18 | Approval alerts | `/{type}/settings/notifications/approvals` | Reminder and escalation rules | Rule forms, timeline preview |
| 2.19 | Operational alerts | `/{type}/settings/notifications/alerts` | Failure, limit, provider and security alerts | Rule table, severity and test |
| 2.20 | Integrations overview | `/{type}/settings/integrations` | Connected providers, health and missing setup | Integration cards, health summary |
| 2.21 | Social integrations | `/{type}/settings/integrations/social` | Social account connections and scopes | Connection table, scope chips, health |
| 2.22 | Advertising integrations | `/{type}/settings/integrations/advertising` | Ad account connections and mapping | Account cards, scope viewer, warnings |
| 2.23 | Messaging integrations | `/{type}/settings/integrations/messaging` | Email, SMS, WhatsApp, RCS and push providers | Provider cards, sender verification, test |
| 2.24 | Webhooks | `/{type}/settings/integrations/webhooks` | Outbound endpoints and delivery logs | Webhook table, event selector, secret controls |
| 2.25 | API keys | `/{type}/settings/integrations/api-keys` | Scoped API credentials | Key table, scope matrix, one-time secret flow |
| 2.26 | AI usage | `/{type}/settings/ai/usage` | AI use, limits and cost attribution | KPI strip, charts, member table |
| 2.27 | AI policies | `/{type}/settings/ai/policies` | Models, data handling and approval rules | Policy matrix, risk descriptions |
| 2.28 | Fox tool permissions | `/{type}/settings/ai/tools` | Read, draft and execute permissions by role | Tool table, permission matrix, simulation |
| 2.29 | Automation governance | `/{type}/settings/ai/automations` | Workflow creators, approvers, limits and emergency pause | Governance form, limits, role selectors |
| 2.30 | Storage | `/{type}/settings/data/storage` | Storage use, categories and limits | Usage chart, file table, entitlement gate |
| 2.31 | Data exports | `/{type}/settings/data/exports` | Request and monitor workspace exports | Export table, scope, progress and download |
| 2.32 | Retention | `/{type}/settings/data/retention` | Retention policies by record type | Policy table, impact estimator, hold warning |
| 2.33 | Workspace audit | `/{type}/settings/data/audit` | Search and export audit events | Audit table, filters, event drawer |
| 2.34 | Security overview | `/{type}/settings/security` | MFA coverage, sessions, integrations and events | Security score, warnings, event feed |
| 2.35 | Authentication policy | `/{type}/settings/security/authentication` | MFA, methods, sessions and re-authentication | Policy form, member impact preview |
| 2.36 | Consent and legal | `/{type}/settings/security/consent` | Consent text, policy versions and assignment | Version table, editor, assignment matrix |
| 2.37 | Legal holds | `/{type}/settings/security/legal-holds` | Create, review and release preservation holds | Hold table, scope builder, approval |

## 2.2 Settings details

| No. | Detail | Route | Tabs |
|---:|---|---|---|
| 2.38 | Member detail | `/{type}/settings/people/members/:memberId` | Profile, Role, Teams, Access, Activity, Sessions, Audit |
| 2.39 | Role detail | `/{type}/settings/people/roles/:roleId` | Overview, Permissions, Members, Change History |
| 2.40 | Portal grant detail | `/{type}/settings/people/portal-access/:grantId` | Recipient, Scope, Permissions, Activity, Expiry, Audit |
| 2.41 | Integration detail | `/{type}/settings/integrations/:connectionId` | Overview, Accounts, Scopes, Health, Logs, Webhooks, Audit |
| 2.42 | Webhook detail | `/{type}/settings/integrations/webhooks/:webhookId` | Endpoint, Events, Secret, Deliveries, Retries, Audit |
| 2.43 | API key detail | `/{type}/settings/integrations/api-keys/:keyId` | Overview, Scopes, Usage, Audit |

## 2.3 Settings wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 2.44 | Invite member | `/{type}/settings/people/invite` | Recipients, role, teams, message, expiry, review |
| 2.45 | Create custom role | `/{type}/settings/people/roles/new` | Name, base role, permissions, restrictions, impact, review |
| 2.46 | Create portal grant | `/{type}/settings/people/portal-invite` | Recipient, portal type, records, permissions, expiry, message, review |
| 2.47 | Connect provider | `/{type}/settings/integrations/connect/:provider` | Provider, authentication, accounts, scopes, mapping, test, review |
| 2.48 | Create webhook | `/{type}/settings/integrations/webhooks/new` | Endpoint, events, signing, retry policy, test, review |
| 2.49 | Create API key | `/{type}/settings/integrations/api-keys/new` | Name, scopes, restrictions, expiry, review, secret display |
| 2.50 | Export workspace data | `/{type}/settings/data/exports/new` | Type, dates, records, format, security, review |

---

# 3. Account Settings

**Base route:** `/account`

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 3.01 | Account overview | `/account` | Profile completion, memberships, security and alerts | Profile card, security summary, memberships, activity |
| 3.02 | Profile | `/account/profile` | Name, avatar, title, bio and professional visibility | Form, avatar upload, preview |
| 3.03 | Security overview | `/account/security` | Login safety and security actions | Security score, warnings, quick actions |
| 3.04 | Login methods | `/account/security/login-methods` | Password and linked identity providers | Method cards, re-authentication |
| 3.05 | MFA | `/account/security/mfa` | Authenticator, passkey and recovery setup | Setup stepper, recovery codes |
| 3.06 | Sessions and devices | `/account/security/sessions` | Review and revoke sessions | Session table, current marker |
| 3.07 | Account activity | `/account/security/activity` | Authentication and account events | Activity table, filters, event drawer |
| 3.08 | Notifications | `/account/notifications` | Personal channels, digests and quiet hours | Toggles, schedules, preview |
| 3.09 | Connected accounts | `/account/connections` | Personal social and identity connections | Connection cards, scopes, revoke |
| 3.10 | Privacy and data | `/account/data` | Export, correction and deletion requests | Request cards, history table |
| 3.11 | Availability | `/account/availability` | Working hours, capacity and exceptions | Weekly scheduler, exceptions, timezone |
| 3.12 | Memberships | `/account/memberships` | All workspace and portal relationships | Membership table, roles, leave action |

### Account wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 3.13 | Personal data export | `/account/data/export` | Identity, scope, format, review |
| 3.14 | Account deletion | `/account/data/delete` | Impact, ownership blockers, export, reason, re-authentication, confirmation |
| 3.15 | Availability exception | `/account/availability/exceptions/new` | Date, status, hours, note, review |

---

# 4. Billing Settings

**Base route:** `/{type}/settings/billing`

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 4.01 | Billing overview | `/{type}/settings/billing` | Plan, renewal, payment health, usage and alerts | Plan card, renewal timeline, usage bars |
| 4.02 | Subscription | `/{type}/settings/billing/subscription` | Upgrade, downgrade, cancel, resume and trial | Plan comparison, entitlement matrix, proration |
| 4.03 | Add-ons and seats | `/{type}/settings/billing/add-ons` | Modules, seats, AI credits and storage | Add-on cards, quantities, price summary |
| 4.04 | Usage | `/{type}/settings/billing/usage` | AI, automations, sends, storage and seats | KPI strip, charts, limit bars |
| 4.05 | Payment methods | `/{type}/settings/billing/payment-methods` | Provider-hosted payment methods | Method cards, provider component |
| 4.06 | Invoices and credits | `/{type}/settings/billing/invoices` | Invoices, credits, discounts and tax documents | Filter bar, invoice table |
| 4.07 | Marketplace fees | `/{type}/settings/billing/marketplace-fees` | Commission, settlement and payout deductions | Fee summary, settlement table |
| 4.08 | Billing contacts and tax | `/{type}/settings/billing/details` | Legal billing identity, address and tax details | Validated form, contacts |

### Billing detail pages

| No. | Detail | Route | Tabs |
|---:|---|---|---|
| 4.09 | Invoice detail | `/{type}/settings/billing/invoices/:invoiceId` | Summary, Line Items, Payments, Credits, Tax Documents |
| 4.10 | Usage detail | `/{type}/settings/billing/usage/:dimension` | Overview, Members, Modules, Daily Usage, Events |
| 4.11 | Settlement detail | `/{type}/settings/billing/marketplace-fees/:settlementId` | Summary, Orders, Fees, Adjustments, Documents |

### Billing wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 4.12 | Change subscription | `/{type}/settings/billing/subscription/change` | Plan, period, add-ons, proration, payment, review |
| 4.13 | Cancel subscription | `/{type}/settings/billing/subscription/cancel` | Reason, alternatives, data impact, date, confirmation |
| 4.14 | Purchase add-on | `/{type}/settings/billing/add-ons/:addonId/purchase` | Quantity, period, price, payment, review |


---

# 5. Shared Campaign Manager Modules

The following modules are canonical and reused by Creator, Business, Brand and Agency workspaces. Entitlements determine visibility. Hidden modules must not appear as dead or empty navigation items.

## 5.0 Shared module page register

| No. | Section | Base route | Individual pages/sub-tabs | Record/detail pages | Required detail tabs | Creation/action wizards | Function | Core components |
|---:|---|---|---|---|---|---|---|---|
| 5.01 | Home | /{type}/home | Overview; Approvals; Ideas; Activity | Approval item; Idea | Approval: Preview, Context, Comments, Version History, Audit. Idea: Overview, Notes, References, Related Work, Activity. | Dashboard setup; Create idea | Command centre for priorities, current work, risks, approvals and next actions. | KPI strip, priority cards, approval queue, idea cards, activity feed, quick create. |
| 5.02 | Strategy | /{type}/strategy | Overview; Objectives; Audiences; Research; Positioning; Plans; Forecasts | Objective; Audience profile; Research record; Positioning framework; Strategy plan; Forecast | Plan: Overview, Objectives, Audiences, Messages, Channels, Budget, Risks, Campaigns, Forecast, Audit. Other records require Overview, Evidence/Rules, Relations, Versions and Audit. | Create strategy plan; Create audience profile; Add research; Create positioning; Create forecast | Turn goals and evidence into approved strategy, budgets and accountable plans. | KPI strip, objective cards, persona cards, research library, comparison matrix, plan table, forecast charts. |
| 5.03 | Campaigns | /{type}/campaigns | Overview; All; Giveaways; Competitions; Templates; Board; Timeline | Campaign; Campaign template; Giveaway; Competition | Campaign: Overview, Brief, Audience, Channels, Content, Tasks, Calendar, Budget, Assets, Approvals, Results, Risks, Audit. | Create campaign; Create giveaway; Create competition; Create template; Duplicate campaign | Operate the complete campaign lifecycle from brief to results. | KPI strip, filters, table/cards, board, timeline, status pipeline, budget summary, activity. |
| 5.04 | Calendar | /{type}/calendar | Calendar; Publishing Queue; Agenda; Conflicts | Publication; Calendar item; Conflict | Publication: Content, Variants, Approval, Schedule, Delivery Log, History. Calendar item: Overview, Related Record, Owners, Dependencies, Activity. | Schedule publication; Bulk schedule; Add calendar item; Resolve conflict | Provide the authoritative schedule for content, campaigns, messages and events. | Month/week/day/agenda calendar, queue table, timezone indicator, conflict panel, provider health. |
| 5.05 | Studio | /{type}/studio | Overview; Compose; AI Generate; Ideas; Templates; Hashtags and Keywords; Media; Content Library | Content; Content variant; Template; Media asset; Studio idea | Content: Editor, Variants, Brand, Approvals, Schedule, Performance, Versions, Rights, Activity. Asset: Preview, Metadata, Versions, Rights, Usage, Audit. | Create content; AI generation; Create template; Upload media; Create idea | Create, edit, version, approve and prepare governed content. | Editor, channel previews, asset picker, brand panel, AI comparison, content table/cards, version selector. |
| 5.06 | Brand and Assets | /{type}/brand | Overview; Brand Kits; Assets; Rights; Product Library | Brand kit; Brand asset; Rights record; Product | Brand kit: Overview, Visual Identity, Voice, Messaging, Channel Rules, Assets, Usage, Versions. Rights: Overview, Parties, Scope, Territory, Term, Linked Assets, Evidence, Audit. | Create brand kit; Upload asset; Create rights record; Create product | Govern brand identity, reusable assets, usage rights and product information. | Brand previews, token editor, asset grid, rights table, expiry alerts, product cards. |
| 5.07 | Social | /{type}/social | Overview; Publishing; Engagement; Listening; Connections; Analytics | Social connection; Social post; Listening query | Connection: Overview, Accounts, Scopes, Health, Posts, Audience, Logs, Audit. Post: Content, Variants, Approval, Schedule, Delivery, Engagement, Performance, History. | Connect channel; Create social post; Create listening query | Operate organic publishing, engagement, monitoring and channel health. | Channel cards, publishing table, engagement feed, listening charts, connection health, post previews. |
| 5.08 | Advertising | /{type}/advertising | Overview; Accounts; Campaigns; Creatives; Audiences; Reports | Ad account; Ad campaign; Ad creative; Paid audience | Ad campaign: Overview, Objective, Targeting, Creatives, Budget, Placements, Delivery, Results, Change Log. | Connect ad account; Create ad campaign; Create creative; Create paid audience | Plan and govern paid media without bypassing spend or approval controls. | Spend KPIs, account health, campaign table, creative grid, audience estimates, budget and approval panels. |
| 5.09 | Messaging | /{type}/messaging | Overview; Email; SMS; WhatsApp; RCS; Push; Journeys; Templates | Message; Journey; Messaging template | Message: Content, Audience, Consent, Approval, Schedule, Delivery, Performance, Versions. Journey: Canvas, Trigger, Audience, Content, Goals, Runs, Conversions, Versions, Settings, Audit. | Create message; Create journey; Create template; Test send | Operate consent-aware lifecycle messaging across supported channels. | Channel cards, composer, audience picker, consent panel, journey canvas, delivery timeline, provider health. |
| 5.10 | Web and Conversion | /{type}/web | Overview; Pages; Forms; Funnels; Experiments; Tracking | Landing page; Form; Funnel; Experiment; Tracking event | Page: Builder, Variants, Forms, SEO, Tracking, Analytics, Settings, Versions. Form: Builder, Fields, Consent, Destinations, Submissions, Analytics, Settings, Versions. | Create page; Create form; Create funnel; Create experiment; Create tracking event | Build measurable pages, forms, funnels and controlled experiments. | Page builder, responsive preview, form builder, funnel canvas, experiment comparison, event tester. |
| 5.11 | SEO and Discovery | /{type}/seo | Overview; Keywords; Briefs; Rankings; Local; AI Search; Backlinks | Keyword cluster; SEO brief; Local location; Backlink opportunity | Cluster: Overview, Keywords, Intent, Content Map, Rankings, Competitors, Tasks. Brief: Overview, Keywords, Intent, Outline, Competitors, Requirements, Content, Approval, Versions. | Create SEO brief; Import keywords; Add local location; Create backlink opportunity | Plan and measure organic, local and AI-assisted discovery. | Visibility KPIs, keyword table, cluster tree, ranking charts, brief editor, local health, backlink table. |
| 5.12 | Link in Bio | /{type}/links | Pages; Link Library; Themes; Analytics | Link page; Reusable link; Theme | Link page: Design, Links, Products, Forms, Pixels, Analytics, Settings, Versions. | Create link page; Create reusable link; Create theme | Create governed lightweight public conversion pages. | Mobile preview, block builder, link table, theme editor, click analytics. |
| 5.13 | Creators and UGC | /{type}/creators | Overview; Creators; Briefs; Submissions; Rights; Payments | Creator; UGC brief; Submission; Agreement | Creator: Profile, Audience, Services, Campaigns, Content, Performance, Agreements, Payments, Notes, Activity. Brief: Overview, Requirements, Creators, Invitations, Submissions, Approvals, Rights, Payments, Audit. | Add creator; Create UGC brief; Invite creators; Create agreement; Create payment request | Source, brief, license, manage and measure creators and UGC. | Creator CRM, compare tray, brief table, submission gallery, approval panel, rights and payment alerts. |
| 5.14 | Marketplace | /{type}/marketplace | Overview; Discover; Categories; Saved; Requests; Orders | Supplier; Listing; Buyer request; Quote; Order | Supplier: Overview, Services, Portfolio, Reviews, Policies. Request: Overview, Brief, Suppliers, Quotes, Messages, Files, Activity, Audit. Order: Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit. | Create request; Request quote; Compare quotes; Open dispute | Discover services and manage buyer-side marketplace work. | Search and filters, result cards/list, compare tray, request table, quote comparison, order timeline. |
| 5.15 | Partnerships | /{type}/partnerships | Overview; Affiliates; Referrals; Ambassadors; Loyalty; Resellers; Co-marketing | Programme; Partner; Commission; Tracking link/code | Programme: Overview, Terms, Partners, Assets, Links and Codes, Conversions, Commissions, Payouts, Settings, Audit. Partner: Profile, Programmes, Links, Assets, Conversions, Commissions, Agreements, Activity. | Create programme; Invite partner; Create link/code; Create agreement | Manage performance and strategic partner programmes. | Programme cards, partner table, rule builder, conversion charts, commission table, terms viewer. |
| 5.16 | PR and Reputation | /{type}/reputation | Overview; Media Lists; Pitches; Press Room; Coverage; Reviews; Crisis | Media contact; Pitch; Press release; Crisis incident | Pitch: Overview, Recipients, Content, Assets, Approval, Delivery, Responses, Activity. Incident: Overview, Timeline, Stakeholders, Evidence, Statements, Approvals, Tasks, Activity, Audit. | Create media list; Create pitch; Create release; Log coverage; Create incident | Manage media relations, coverage, reviews and crisis response. | Media CRM, pitch editor, release preview, coverage table, review feed, incident timeline. |
| 5.17 | Community | /{type}/community | Overview; Communities; Calendar; Moderation; Members; Advocacy | Community; Community member; Moderation case; Advocacy programme | Community: Overview, Content, Calendar, Members, Moderation, Health, Permissions, Activity. Moderation case: Context, Content, Member, Policy, Evidence, Decision, Audit. | Create community; Create moderation rule; Create advocacy programme | Operate branded communities, moderation and advocacy. | Community cards, calendar, moderation queue, member table, health charts, programme cards. |
| 5.18 | Events | /{type}/events | Overview; Events; Webinars; Podcasts; Sponsorships; Follow-up | Event; Registration; Sponsorship; Podcast episode | Event: Overview, Brief, Promotion, Content, Registrations, Run-of-show, Speakers, Sponsors, Tasks, Budget, Follow-up, Attribution, Files, Audit. | Create event; Create webinar; Create podcast episode; Create sponsorship | Plan marketing events and connect promotion, registrations and attribution. | Event table/cards, calendar, registration charts, run-of-show timeline, sponsor and budget panels. |
| 5.19 | Inbox | /{type}/inbox | Unified; Assignments; Saved Views; Unassigned | Conversation thread; Inbox contact; Routing rule | Thread: Conversation, Contact, Related Records, Activity, Tasks, Notes, Audit. | Create routing rule; Create saved view; Create task from thread | Provide a unified, permission-aware conversation workspace. | Three-pane inbox, filters, conversation timeline, composer, contact context, assignment and SLA controls. |
| 5.20 | Leads and Audiences | /{type}/audiences | Overview; Contacts; Segments; Consent; Scoring; Imports | Contact; Segment; Consent record; Scoring model; Import | Contact: Profile, Activity, Memberships, Consent, Score, Campaigns, Journeys, Conversations, Notes, Audit. Segment: Overview, Rules, Members, Usage, Performance, Refresh History, Audit. | Create contact; Create segment; Import contacts; Create scoring model | Manage consent-aware contacts, segmentation and audience activation. | Contact table, consent chips, segment builder, live size preview, scoring simulation, import mapping. |
| 5.21 | Analytics | /{type}/analytics | Overview; Content; Audience; Competitors; Reports; Attribution; Data Sources | Report; Metric; Data source | Report: Dashboard, Filters, Sources, Methodology, Exports, Schedule, Sharing, Versions. Source: Overview, Coverage, Freshness, Fields, Health, Logs, Audit. | Create report; Schedule report; Add competitor; Connect data source | Measure outcomes with transparent sources and methodology. | KPI strip, charts, filters, dashboard builder, source health, attribution paths, exports. |
| 5.22 | Finance | /{type}/finance | Overview; Budgets; Purchase Orders; Costs; Invoices; Commissions; Profitability | Budget; Purchase order; Cost; Invoice; Commission | Budget: Overview, Lines, Allocations, Commitments, Actuals, Forecast, Approvals, Documents, Audit. PO: Overview, Lines, Supplier, Approvals, Receipts/Invoices, Documents, Activity, Audit. | Create budget; Create purchase order; Record cost; Add invoice; Approve commission | Control marketing spend, commitments and profitability. | Finance KPIs, line-item tables, variance charts, approval panels, documents, profitability breakdown. |
| 5.23 | Automations | /{type}/automations | Overview; Workflows; Recipes; Runs; Connections; Logs | Workflow; Run; Recipe | Workflow: Canvas, Trigger, Conditions, Actions, Variables, Approvals, Versions, Test, Runs, Logs, Settings, Audit. Run: Summary, Trigger, Inputs, Steps, Outputs, Logs, Cost, Audit. | Create workflow; Use recipe; Test workflow; Replay safe run | Create and operate workflows with permission, cost and approval controls. | Node canvas, trigger/action library, inspector, validation, simulation, run timeline, logs. |
| 5.24 | Settings | /{type}/settings | Overview; Workspace; Branding; People; Notifications; Integrations; AI; Data; Security; Billing | Member; Role; Portal grant; Integration; Webhook; API key; Invoice | Use Sections 2, 3 and 4. | Invite member; Create role; Create portal grant; Connect provider; Create webhook/API key; Export data | Configure the workspace safely. | Settings navigation, setup checklist, warning cards and the components in Sections 2–4. |

## 5.25 Shared collection-page rules

Each sub-page named above is an individual page and requires:

- A stable route or stable route state.
- A section-specific page title and description.
- Search, filters, sorting and saved views where records are listed.
- A view switcher where table, cards, board, calendar, timeline, chart or map creates genuine value.
- Primary create action.
- Item click-through to the canonical detail page.
- Quick actions and permission-aware bulk actions.
- Import/export only where commercially and legally appropriate.
- Loading, empty, no-results, restricted, upgrade, archived, integration-unavailable and error states.

## 5.26 Shared detail-page rules

Every detail page above requires:

- Breadcrumb and parent return path.
- Record title, type, status, owner and key dates.
- Deep-linkable tabs.
- Primary next action and secondary menu.
- Right summary rail on desktop and drawer/accordion on smaller screens.
- Related records.
- Activity feed.
- Material audit trail.
- Read-only archived state.
- Not-found, restricted and error states.

## 5.27 Shared wizard rules

Every wizard above requires:

- Permission and entitlement check before step one.
- Stepper and autosave.
- Required/optional labels.
- Inline validation and duplicate/conflict detection.
- Back, next, save draft, cancel and close.
- Review page and explicit final action.
- Success page with record link and next actions.
- Recoverable partial-failure state.
- Audit reason for destructive or elevated actions.


## 5.28 Normalised individual page numbering register

Every row below is a separate page implementation and test target. `Overview` uses the section base route; the remaining pages use the child route shown.

| No. | Category | Individual page | Canonical route | Page function | Required components |
|---:|---|---|---|---|---|
| 5.01.01 | Home | Overview | `/{type}/home` | Primary Home landing page for daily command centre, summaries and next actions. | Page header, KPI strip, priority cards, queues, activity feed, filter/state controls and activity where relevant |
| 5.01.02 | Home | Approvals | `/{type}/home/approvals` | Manage the Approvals work area within Home, including its records, actions and status. | Page header, KPI strip, priority cards, queues, activity feed, filter/state controls and activity where relevant |
| 5.01.03 | Home | Ideas | `/{type}/home/ideas` | Manage the Ideas work area within Home, including its records, actions and status. | Page header, KPI strip, priority cards, queues, activity feed, filter/state controls and activity where relevant |
| 5.01.04 | Home | Activity | `/{type}/home/activity` | Manage the Activity work area within Home, including its records, actions and status. | Page header, KPI strip, priority cards, queues, activity feed, filter/state controls and activity where relevant |
| 5.02.01 | Strategy | Overview | `/{type}/strategy` | Primary Strategy landing page for strategic planning and governance, summaries and next actions. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.02 | Strategy | Objectives | `/{type}/strategy/objectives` | Manage the Objectives work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.03 | Strategy | Audiences | `/{type}/strategy/audiences` | Manage the Audiences work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.04 | Strategy | Research | `/{type}/strategy/research` | Manage the Research work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.05 | Strategy | Positioning | `/{type}/strategy/positioning` | Manage the Positioning work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.06 | Strategy | Plans | `/{type}/strategy/plans` | Manage the Plans work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.02.07 | Strategy | Forecasts | `/{type}/strategy/forecasts` | Manage the Forecasts work area within Strategy, including its records, actions and status. | Page header, KPI strip, cards, tables, research library, charts, filter/state controls and activity where relevant |
| 5.03.01 | Campaigns | Overview | `/{type}/campaigns` | Primary Campaigns landing page for campaign lifecycle management, summaries and next actions. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.02 | Campaigns | All | `/{type}/campaigns/all` | Search, filter, sort and manage the authorised all records in Campaigns. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.03 | Campaigns | Giveaways | `/{type}/campaigns/giveaways` | Manage the Giveaways work area within Campaigns, including its records, actions and status. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.04 | Campaigns | Competitions | `/{type}/campaigns/competitions` | Manage the Competitions work area within Campaigns, including its records, actions and status. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.05 | Campaigns | Templates | `/{type}/campaigns/templates` | Manage reusable templates for the Campaigns section. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.06 | Campaigns | Board | `/{type}/campaigns/board` | Alternative operational view of campaigns records for planning and delivery. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.03.07 | Campaigns | Timeline | `/{type}/campaigns/timeline` | Alternative operational view of campaigns records for planning and delivery. | Page header, KPI strip, filters, table/cards, board, timeline, filter/state controls and activity where relevant |
| 5.04.01 | Calendar | Calendar | `/{type}/calendar` | Primary Calendar landing page for authoritative schedule and delivery queue, summaries and next actions. | Page header, Calendar, agenda, queue table, conflict panel, filter/state controls and activity where relevant |
| 5.04.02 | Calendar | Publishing Queue | `/{type}/calendar/publishing-queue` | Manage the Publishing Queue work area within Calendar, including its records, actions and status. | Page header, Calendar, agenda, queue table, conflict panel, filter/state controls and activity where relevant |
| 5.04.03 | Calendar | Agenda | `/{type}/calendar/agenda` | Alternative operational view of calendar records for planning and delivery. | Page header, Calendar, agenda, queue table, conflict panel, filter/state controls and activity where relevant |
| 5.04.04 | Calendar | Conflicts | `/{type}/calendar/conflicts` | Manage the Conflicts work area within Calendar, including its records, actions and status. | Page header, Calendar, agenda, queue table, conflict panel, filter/state controls and activity where relevant |
| 5.05.01 | Studio | Overview | `/{type}/studio` | Primary Studio landing page for content creation and asset preparation, summaries and next actions. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.02 | Studio | Compose | `/{type}/studio/compose` | Manage the Compose work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.03 | Studio | AI Generate | `/{type}/studio/ai-generate` | Manage the AI Generate work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.04 | Studio | Ideas | `/{type}/studio/ideas` | Manage the Ideas work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.05 | Studio | Templates | `/{type}/studio/templates` | Manage reusable templates for the Studio section. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.06 | Studio | Hashtags and Keywords | `/{type}/studio/hashtags` | Manage the Hashtags and Keywords work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.07 | Studio | Media | `/{type}/studio/media` | Manage the Media work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.05.08 | Studio | Content Library | `/{type}/studio/content` | Manage the Content Library work area within Studio, including its records, actions and status. | Page header, Editor, previews, asset picker, content table/cards, filter/state controls and activity where relevant |
| 5.06.01 | Brand and Assets | Overview | `/{type}/brand` | Primary Brand and Assets landing page for brand and rights governance, summaries and next actions. | Page header, Brand cards, asset grid, rights table, product cards, filter/state controls and activity where relevant |
| 5.06.02 | Brand and Assets | Brand Kits | `/{type}/brand/kits` | Manage the Brand Kits work area within Brand and Assets, including its records, actions and status. | Page header, Brand cards, asset grid, rights table, product cards, filter/state controls and activity where relevant |
| 5.06.03 | Brand and Assets | Assets | `/{type}/brand/assets` | Manage the Assets work area within Brand and Assets, including its records, actions and status. | Page header, Brand cards, asset grid, rights table, product cards, filter/state controls and activity where relevant |
| 5.06.04 | Brand and Assets | Rights | `/{type}/brand/rights` | Manage the Rights work area within Brand and Assets, including its records, actions and status. | Page header, Brand cards, asset grid, rights table, product cards, filter/state controls and activity where relevant |
| 5.06.05 | Brand and Assets | Product Library | `/{type}/brand/products` | Manage the Product Library work area within Brand and Assets, including its records, actions and status. | Page header, Brand cards, asset grid, rights table, product cards, filter/state controls and activity where relevant |
| 5.07.01 | Social | Overview | `/{type}/social` | Primary Social landing page for organic social operations, summaries and next actions. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.07.02 | Social | Publishing | `/{type}/social/publishing` | Manage the Publishing work area within Social, including its records, actions and status. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.07.03 | Social | Engagement | `/{type}/social/engagement` | Manage the Engagement work area within Social, including its records, actions and status. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.07.04 | Social | Listening | `/{type}/social/listening` | Manage the Listening work area within Social, including its records, actions and status. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.07.05 | Social | Connections | `/{type}/social/connections` | Manage connected sources, health, scopes and mappings used by Social. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.07.06 | Social | Analytics | `/{type}/social/analytics` | Measure and compare social performance with transparent sources and export. | Page header, Channel cards, content table, engagement feed, charts, filter/state controls and activity where relevant |
| 5.08.01 | Advertising | Overview | `/{type}/advertising` | Primary Advertising landing page for paid media operations, summaries and next actions. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.08.02 | Advertising | Accounts | `/{type}/advertising/accounts` | Manage connected sources, health, scopes and mappings used by Advertising. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.08.03 | Advertising | Campaigns | `/{type}/advertising/campaigns` | Search, filter, sort and manage the authorised campaigns records in Advertising. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.08.04 | Advertising | Creatives | `/{type}/advertising/creatives` | Manage the Creatives work area within Advertising, including its records, actions and status. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.08.05 | Advertising | Audiences | `/{type}/advertising/audiences` | Manage the Audiences work area within Advertising, including its records, actions and status. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.08.06 | Advertising | Reports | `/{type}/advertising/reports` | Measure and compare advertising performance with transparent sources and export. | Page header, Spend KPIs, account cards, campaign table, creative grid, filter/state controls and activity where relevant |
| 5.09.01 | Messaging | Overview | `/{type}/messaging` | Primary Messaging landing page for lifecycle messaging, summaries and next actions. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.02 | Messaging | Email | `/{type}/messaging/email` | Manage the Email work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.03 | Messaging | SMS | `/{type}/messaging/sms` | Manage the SMS work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.04 | Messaging | WhatsApp | `/{type}/messaging/whatsapp` | Manage the WhatsApp work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.05 | Messaging | RCS | `/{type}/messaging/rcs` | Manage the RCS work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.06 | Messaging | Push | `/{type}/messaging/push` | Manage the Push work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.07 | Messaging | Journeys | `/{type}/messaging/journeys` | Manage the Journeys work area within Messaging, including its records, actions and status. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.09.08 | Messaging | Templates | `/{type}/messaging/templates` | Manage reusable templates for the Messaging section. | Page header, Composer, audience picker, journey canvas, delivery status, filter/state controls and activity where relevant |
| 5.10.01 | Web and Conversion | Overview | `/{type}/web` | Primary Web and Conversion landing page for conversion experience management, summaries and next actions. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.10.02 | Web and Conversion | Pages | `/{type}/web/pages` | Primary Web and Conversion landing page for conversion experience management, summaries and next actions. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.10.03 | Web and Conversion | Forms | `/{type}/web/forms` | Manage the Forms work area within Web and Conversion, including its records, actions and status. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.10.04 | Web and Conversion | Funnels | `/{type}/web/funnels` | Manage the Funnels work area within Web and Conversion, including its records, actions and status. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.10.05 | Web and Conversion | Experiments | `/{type}/web/experiments` | Manage the Experiments work area within Web and Conversion, including its records, actions and status. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.10.06 | Web and Conversion | Tracking | `/{type}/web/tracking` | Manage the Tracking work area within Web and Conversion, including its records, actions and status. | Page header, Page/form builders, funnel canvas, experiment charts, filter/state controls and activity where relevant |
| 5.11.01 | SEO and Discovery | Overview | `/{type}/seo` | Primary SEO and Discovery landing page for organic discovery management, summaries and next actions. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.02 | SEO and Discovery | Keywords | `/{type}/seo/keywords` | Manage the Keywords work area within SEO and Discovery, including its records, actions and status. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.03 | SEO and Discovery | Briefs | `/{type}/seo/briefs` | Manage the Briefs work area within SEO and Discovery, including its records, actions and status. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.04 | SEO and Discovery | Rankings | `/{type}/seo/rankings` | Measure and compare seo and discovery performance with transparent sources and export. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.05 | SEO and Discovery | Local | `/{type}/seo/local` | Manage the Local work area within SEO and Discovery, including its records, actions and status. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.06 | SEO and Discovery | AI Search | `/{type}/seo/ai-search` | Manage the AI Search work area within SEO and Discovery, including its records, actions and status. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.11.07 | SEO and Discovery | Backlinks | `/{type}/seo/backlinks` | Manage the Backlinks work area within SEO and Discovery, including its records, actions and status. | Page header, Keyword table, briefs, ranking charts, opportunity tables, filter/state controls and activity where relevant |
| 5.12.01 | Link in Bio | Pages | `/{type}/links/pages` | Primary Link in Bio landing page for public micro-page conversion, summaries and next actions. | Page header, Mobile preview, block builder, link table, theme editor, filter/state controls and activity where relevant |
| 5.12.02 | Link in Bio | Link Library | `/{type}/links/library` | Manage the Link Library work area within Link in Bio, including its records, actions and status. | Page header, Mobile preview, block builder, link table, theme editor, filter/state controls and activity where relevant |
| 5.12.03 | Link in Bio | Themes | `/{type}/links/themes` | Manage reusable themes for the Link in Bio section. | Page header, Mobile preview, block builder, link table, theme editor, filter/state controls and activity where relevant |
| 5.12.04 | Link in Bio | Analytics | `/{type}/links/analytics` | Measure and compare link in bio performance with transparent sources and export. | Page header, Mobile preview, block builder, link table, theme editor, filter/state controls and activity where relevant |
| 5.13.01 | Creators and UGC | Overview | `/{type}/creators` | Primary Creators and UGC landing page for creator sourcing and delivery, summaries and next actions. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.13.02 | Creators and UGC | Creators | `/{type}/creators/creators` | Search, filter, sort and manage the authorised creators records in Creators and UGC. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.13.03 | Creators and UGC | Briefs | `/{type}/creators/briefs` | Manage the Briefs work area within Creators and UGC, including its records, actions and status. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.13.04 | Creators and UGC | Submissions | `/{type}/creators/submissions` | Manage the Submissions work area within Creators and UGC, including its records, actions and status. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.13.05 | Creators and UGC | Rights | `/{type}/creators/rights` | Manage the Rights work area within Creators and UGC, including its records, actions and status. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.13.06 | Creators and UGC | Payments | `/{type}/creators/payments` | Manage the Payments work area within Creators and UGC, including its records, actions and status. | Page header, Creator table, brief cards, submission gallery, rights/payment panels, filter/state controls and activity where relevant |
| 5.14.01 | Marketplace | Overview | `/{type}/marketplace` | Primary Marketplace landing page for supplier discovery and buyer orders, summaries and next actions. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.14.02 | Marketplace | Discover | `/{type}/marketplace/discover` | Manage the Discover work area within Marketplace, including its records, actions and status. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.14.03 | Marketplace | Categories | `/{type}/marketplace/categories` | Manage the Categories work area within Marketplace, including its records, actions and status. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.14.04 | Marketplace | Saved | `/{type}/marketplace/saved` | Manage the Saved work area within Marketplace, including its records, actions and status. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.14.05 | Marketplace | Requests | `/{type}/marketplace/requests` | Manage the Requests work area within Marketplace, including its records, actions and status. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.14.06 | Marketplace | Orders | `/{type}/marketplace/orders` | Search, filter, sort and manage the authorised orders records in Marketplace. | Page header, Search, filters, cards/list, compare, request/order tables, filter/state controls and activity where relevant |
| 5.15.01 | Partnerships | Overview | `/{type}/partnerships` | Primary Partnerships landing page for partner programme operations, summaries and next actions. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.02 | Partnerships | Affiliates | `/{type}/partnerships/affiliates` | Manage the Affiliates work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.03 | Partnerships | Referrals | `/{type}/partnerships/referrals` | Manage the Referrals work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.04 | Partnerships | Ambassadors | `/{type}/partnerships/ambassadors` | Manage the Ambassadors work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.05 | Partnerships | Loyalty | `/{type}/partnerships/loyalty` | Manage the Loyalty work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.06 | Partnerships | Resellers | `/{type}/partnerships/resellers` | Manage the Resellers work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.15.07 | Partnerships | Co-marketing | `/{type}/partnerships/co-marketing` | Manage the Co-marketing work area within Partnerships, including its records, actions and status. | Page header, Programme cards, partner tables, conversions and commissions, filter/state controls and activity where relevant |
| 5.16.01 | PR and Reputation | Overview | `/{type}/reputation` | Primary PR and Reputation landing page for reputation and media operations, summaries and next actions. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.02 | PR and Reputation | Media Lists | `/{type}/reputation/media-lists` | Manage the Media Lists work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.03 | PR and Reputation | Pitches | `/{type}/reputation/pitches` | Manage the Pitches work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.04 | PR and Reputation | Press Room | `/{type}/reputation/press-room` | Manage the Press Room work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.05 | PR and Reputation | Coverage | `/{type}/reputation/coverage` | Manage the Coverage work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.06 | PR and Reputation | Reviews | `/{type}/reputation/reviews` | Manage the Reviews work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.16.07 | PR and Reputation | Crisis | `/{type}/reputation/crisis` | Manage the Crisis work area within PR and Reputation, including its records, actions and status. | Page header, Media CRM, pitch editor, coverage table, incident timeline, filter/state controls and activity where relevant |
| 5.17.01 | Community | Overview | `/{type}/community` | Primary Community landing page for community and moderation operations, summaries and next actions. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.17.02 | Community | Communities | `/{type}/community/communities` | Search, filter, sort and manage the authorised communities records in Community. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.17.03 | Community | Calendar | `/{type}/community` | Primary Community landing page for community and moderation operations, summaries and next actions. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.17.04 | Community | Moderation | `/{type}/community/moderation` | Manage the Moderation work area within Community, including its records, actions and status. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.17.05 | Community | Members | `/{type}/community/members` | Manage the Members work area within Community, including its records, actions and status. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.17.06 | Community | Advocacy | `/{type}/community/advocacy` | Manage the Advocacy work area within Community, including its records, actions and status. | Page header, Community cards, moderation queue, member table, calendar, filter/state controls and activity where relevant |
| 5.18.01 | Events | Overview | `/{type}/events` | Primary Events landing page for event marketing operations, summaries and next actions. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.18.02 | Events | Events | `/{type}/events/events` | Search, filter, sort and manage the authorised events records in Events. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.18.03 | Events | Webinars | `/{type}/events/webinars` | Manage the Webinars work area within Events, including its records, actions and status. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.18.04 | Events | Podcasts | `/{type}/events/podcasts` | Manage the Podcasts work area within Events, including its records, actions and status. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.18.05 | Events | Sponsorships | `/{type}/events/sponsorships` | Manage the Sponsorships work area within Events, including its records, actions and status. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.18.06 | Events | Follow-up | `/{type}/events/follow-up` | Manage the Follow-up work area within Events, including its records, actions and status. | Page header, Event cards/table, registration charts, run-of-show, filter/state controls and activity where relevant |
| 5.19.01 | Inbox | Unified | `/{type}/inbox/unified` | Primary Inbox landing page for conversation and routing operations, summaries and next actions. | Page header, Three-pane inbox, filters, assignment and SLA controls, filter/state controls and activity where relevant |
| 5.19.02 | Inbox | Assignments | `/{type}/inbox/assignments` | Manage the Assignments work area within Inbox, including its records, actions and status. | Page header, Three-pane inbox, filters, assignment and SLA controls, filter/state controls and activity where relevant |
| 5.19.03 | Inbox | Saved Views | `/{type}/inbox/saved-views` | Manage the Saved Views work area within Inbox, including its records, actions and status. | Page header, Three-pane inbox, filters, assignment and SLA controls, filter/state controls and activity where relevant |
| 5.19.04 | Inbox | Unassigned | `/{type}/inbox/unassigned` | Manage the Unassigned work area within Inbox, including its records, actions and status. | Page header, Three-pane inbox, filters, assignment and SLA controls, filter/state controls and activity where relevant |
| 5.20.01 | Leads and Audiences | Overview | `/{type}/audiences` | Primary Leads and Audiences landing page for consent-aware audience management, summaries and next actions. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.20.02 | Leads and Audiences | Contacts | `/{type}/audiences/contacts` | Search, filter, sort and manage the authorised contacts records in Leads and Audiences. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.20.03 | Leads and Audiences | Segments | `/{type}/audiences/segments` | Manage the Segments work area within Leads and Audiences, including its records, actions and status. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.20.04 | Leads and Audiences | Consent | `/{type}/audiences/consent` | Manage the Consent work area within Leads and Audiences, including its records, actions and status. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.20.05 | Leads and Audiences | Scoring | `/{type}/audiences/scoring` | Manage the Scoring work area within Leads and Audiences, including its records, actions and status. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.20.06 | Leads and Audiences | Imports | `/{type}/audiences/imports` | Manage the Imports work area within Leads and Audiences, including its records, actions and status. | Page header, Contact table, segment builder, consent and import tools, filter/state controls and activity where relevant |
| 5.21.01 | Analytics | Overview | `/{type}/analytics` | Primary Analytics landing page for measurement and reporting, summaries and next actions. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.02 | Analytics | Content | `/{type}/analytics/content` | Manage the Content work area within Analytics, including its records, actions and status. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.03 | Analytics | Audience | `/{type}/analytics/audience` | Manage the Audience work area within Analytics, including its records, actions and status. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.04 | Analytics | Competitors | `/{type}/analytics/competitors` | Manage the Competitors work area within Analytics, including its records, actions and status. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.05 | Analytics | Reports | `/{type}/analytics/reports` | Measure and compare analytics performance with transparent sources and export. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.06 | Analytics | Attribution | `/{type}/analytics/attribution` | Measure and compare analytics performance with transparent sources and export. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.21.07 | Analytics | Data Sources | `/{type}/analytics/sources` | Manage connected sources, health, scopes and mappings used by Analytics. | Page header, KPI strip, charts, dashboard builder, source health, filter/state controls and activity where relevant |
| 5.22.01 | Finance | Overview | `/{type}/finance` | Primary Finance landing page for spend and profitability control, summaries and next actions. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.02 | Finance | Budgets | `/{type}/finance/budgets` | Manage the Budgets work area within Finance, including its records, actions and status. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.03 | Finance | Purchase Orders | `/{type}/finance/purchase-orders` | Manage the Purchase Orders work area within Finance, including its records, actions and status. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.04 | Finance | Costs | `/{type}/finance/costs` | Manage the Costs work area within Finance, including its records, actions and status. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.05 | Finance | Invoices | `/{type}/finance/invoices` | Manage the Invoices work area within Finance, including its records, actions and status. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.06 | Finance | Commissions | `/{type}/finance/commissions` | Manage the Commissions work area within Finance, including its records, actions and status. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.22.07 | Finance | Profitability | `/{type}/finance/profitability` | Measure and compare finance performance with transparent sources and export. | Page header, Finance KPIs, line tables, variance charts, approvals, filter/state controls and activity where relevant |
| 5.23.01 | Automations | Overview | `/{type}/automations` | Primary Automations landing page for workflow creation and operation, summaries and next actions. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.23.02 | Automations | Workflows | `/{type}/automations/workflows` | Search, filter, sort and manage the authorised workflows records in Automations. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.23.03 | Automations | Recipes | `/{type}/automations/recipes` | Manage reusable recipes for the Automations section. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.23.04 | Automations | Runs | `/{type}/automations/runs` | Manage the Runs work area within Automations, including its records, actions and status. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.23.05 | Automations | Connections | `/{type}/automations/connections` | Manage connected sources, health, scopes and mappings used by Automations. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.23.06 | Automations | Logs | `/{type}/automations/logs` | Manage the Logs work area within Automations, including its records, actions and status. | Page header, Node canvas, workflow/run tables, logs, validation, filter/state controls and activity where relevant |
| 5.24.01 | Settings | Overview | `/{type}/settings` | Primary Settings landing page for workspace configuration, summaries and next actions. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.02 | Settings | Workspace | `/{type}/settings/workspace` | Manage the Workspace work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.03 | Settings | Branding | `/{type}/settings/branding` | Manage the Branding work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.04 | Settings | People | `/{type}/settings/people` | Manage the People work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.05 | Settings | Notifications | `/{type}/settings/notifications` | Manage the Notifications work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.06 | Settings | Integrations | `/{type}/settings/integrations` | Manage the Integrations work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.07 | Settings | AI | `/{type}/settings/ai` | Manage the AI work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.08 | Settings | Data | `/{type}/settings/data` | Manage the Data work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.09 | Settings | Security | `/{type}/settings/security` | Manage the Security work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |
| 5.24.10 | Settings | Billing | `/{type}/settings/billing` | Manage the Billing work area within Settings, including its records, actions and status. | Page header, Settings navigation, setup checklist, forms and warning cards, filter/state controls and activity where relevant |

---

# 6. Creator Workspace

**Base route:** `/creator`  
**Users:** solo marketers, independent creators, influencers and UGC creators.  
**Default roles:** Owner, Collaborator, Viewer.

## 6.1 Side-navigation register

| No. | Section | Route | Page specification |
|---:|---|---|---|
| 6.01 | Home | `/creator/home` | 5.01 |
| 6.02 | Campaigns | `/creator/campaigns` | 5.03 |
| 6.03 | Calendar | `/creator/calendar` | 5.04 |
| 6.04 | Studio | `/creator/studio` | 5.05 |
| 6.05 | Link in Bio | `/creator/links` | 5.12 |
| 6.06 | Social | `/creator/social` | 5.07 |
| 6.07 | Marketplace | `/creator/marketplace` | 5.14 |
| 6.08 | Inbox | `/creator/inbox` | 5.19 |
| 6.09 | Analytics | `/creator/analytics` | 5.21 |
| 6.10 | Settings | `/creator/settings` | 2, 3, 4 and 5.24 |

## 6.2 Creator-specific pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 6.11 | Creator profile manager | `/creator/profile` | Manage professional identity, public profile, services, audience evidence and portfolio | Profile editor, public preview, service cards, portfolio grid, visibility controls |
| 6.12 | Opportunities | `/creator/opportunities` | View and apply to authorised campaign, UGC, affiliate and marketplace opportunities | Filters, opportunity cards/table, deadlines, fit indicators, application state |
| 6.13 | Deliverables | `/creator/deliverables` | Manage deliverables across campaign grants and buyer orders | Delivery table/grid, upload, feedback, version and status controls |
| 6.14 | Earnings | `/creator/earnings` | Show creator, affiliate and order earnings references where enabled | KPI strip, earnings table, source filters, status and payout notices |

## 6.3 Creator details and wizards

| No. | Type | Route | Tabs or steps |
|---:|---|---|---|
| 6.15 | Public profile detail | `/creator/profile/public` | Profile, Portfolio, Services, Media Kit, Contact, Visibility |
| 6.16 | Opportunity detail | `/creator/opportunities/:opportunityId` | Overview, Brief, Requirements, Rights, Compensation, Timeline, Messages |
| 6.17 | Deliverable detail | `/creator/deliverables/:deliverableId` | Preview, Requirements, Feedback, Versions, Rights, Payment, Activity |
| 6.18 | Publish profile wizard | `/creator/profile/publish` | Identity, Services, Portfolio, Audience, Availability, Contact, Visibility, Preview |
| 6.19 | Opportunity application wizard | `/creator/opportunities/:id/apply` | Eligibility, Pitch, Deliverables, Availability, Rights, Price if permitted, Review |
| 6.20 | Deliverable submission wizard | `/creator/deliverables/:id/submit` | Requirements, Files, Description, Rights Declaration, Preview, Submit |

---

# 7. Business Workspace

**Base route:** `/business`  
**Users:** businesses operating their own marketing.

| No. | Section | Route | Specification |
|---:|---|---|---|
| 7.01 | Home | `/business/home` | 5.01 |
| 7.02 | Strategy | `/business/strategy` | 5.02 |
| 7.03 | Campaigns | `/business/campaigns` | 5.03 |
| 7.04 | Calendar | `/business/calendar` | 5.04 |
| 7.05 | Studio | `/business/studio` | 5.05 |
| 7.06 | Brand and Assets | `/business/brand` | 5.06 |
| 7.07 | Link in Bio | `/business/links` | 5.12 |
| 7.08 | Social | `/business/social` | 5.07 |
| 7.09 | Messaging | `/business/messaging` | 5.09 |
| 7.10 | Web and Conversion | `/business/web` | 5.10 |
| 7.11 | Marketplace | `/business/marketplace` | 5.14 |
| 7.12 | Inbox | `/business/inbox` | 5.19 |
| 7.13 | Leads and Audiences | `/business/audiences` | 5.20 |
| 7.14 | Analytics | `/business/analytics` | 5.21 |
| 7.15 | Settings | `/business/settings` | 2, 3, 4 and 5.24 |

Plan-gated extensions use the exact page specifications for Advertising 5.08, SEO 5.11, Partnerships 5.15, Events 5.18, Finance 5.22 and Automations 5.23.

---

# 8. Brand Workspace

**Base route:** `/brand`  
**Users:** internal marketing, campaign, content, media and growth teams.

| No. | Section | Route | Specification |
|---:|---|---|---|
| 8.01 | Home | `/brand/home` | 5.01 |
| 8.02 | Strategy | `/brand/strategy` | 5.02 |
| 8.03 | Campaigns | `/brand/campaigns` | 5.03 |
| 8.04 | Calendar | `/brand/calendar` | 5.04 |
| 8.05 | Studio | `/brand/studio` | 5.05 |
| 8.06 | Brand and Assets | `/brand/brand` | 5.06 |
| 8.07 | Social | `/brand/social` | 5.07 |
| 8.08 | Advertising | `/brand/advertising` | 5.08 |
| 8.09 | Messaging | `/brand/messaging` | 5.09 |
| 8.10 | Web and Conversion | `/brand/web` | 5.10 |
| 8.11 | SEO and Discovery | `/brand/seo` | 5.11 |
| 8.12 | Link in Bio | `/brand/links` | 5.12 |
| 8.13 | Creators and UGC | `/brand/creators` | 5.13 |
| 8.14 | Marketplace | `/brand/marketplace` | 5.14 |
| 8.15 | Partnerships | `/brand/partnerships` | 5.15 |
| 8.16 | PR and Reputation | `/brand/reputation` | 5.16 |
| 8.17 | Community | `/brand/community` | 5.17 |
| 8.18 | Events | `/brand/events` | 5.18 |
| 8.19 | Inbox | `/brand/inbox` | 5.19 |
| 8.20 | Leads and Audiences | `/brand/audiences` | 5.20 |
| 8.21 | Analytics | `/brand/analytics` | 5.21 |
| 8.22 | Finance | `/brand/finance` | 5.22 |
| 8.23 | Automations | `/brand/automations` | 5.23 |
| 8.24 | Settings | `/brand/settings` | 2, 3, 4 and 5.24 |

## 8.2 Brand-specific pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 8.25 | Approval centre | `/brand/approvals` | Consolidate content, campaign, spend, rights, advertising and messaging approvals | Approval queue, type filters, preview, decision panel, SLA and audit |
| 8.26 | Governance policies | `/brand/governance` | Manage approval paths, spend limits, publishing controls and rights rules | Policy cards, rule builder, role selectors, thresholds and history |
| 8.27 | Approval detail | `/brand/approvals/:approvalId` | Preview and decide one governed approval | Preview, Context, Comments, Policy Checks, Versions, Audit |
| 8.28 | Governance detail | `/brand/governance/:policyId` | Inspect one policy and its effect | Overview, Scope, Rules, Approvers, Exceptions, Usage, Versions |
| 8.29 | Governance wizard | `/brand/governance/new` | Create a controlled policy | Scope, Rule Type, Conditions, Approvers, Exceptions, Simulation, Review |

---

# 9. Agency Workspace

**Base route:** `/agency`  
**Users:** marketing agencies, creative agencies and multi-client production teams.

## 9.1 Side-navigation register

| No. | Section | Route | Specification |
|---:|---|---|---|
| 9.01 | Home | `/agency/home` | 5.01 |
| 9.02 | Clients | `/agency/clients` | Agency-specific below |
| 9.03 | Strategy | `/agency/strategy` | 5.02 |
| 9.04 | Campaigns | `/agency/campaigns` | 5.03 |
| 9.05 | Calendar | `/agency/calendar` | 5.04 |
| 9.06 | Studio | `/agency/studio` | 5.05 |
| 9.07 | Brand and Assets | `/agency/brand` | 5.06 |
| 9.08 | Shared Templates | `/agency/shared-templates` | Agency-specific below |
| 9.09 | Social | `/agency/social` | 5.07 |
| 9.10 | Advertising | `/agency/advertising` | 5.08 |
| 9.11 | Messaging | `/agency/messaging` | 5.09 |
| 9.12 | Web and Conversion | `/agency/web` | 5.10 |
| 9.13 | SEO and Discovery | `/agency/seo` | 5.11 |
| 9.14 | Creators and UGC | `/agency/creators` | 5.13 |
| 9.15 | Marketplace | `/agency/marketplace` | 5.14 |
| 9.16 | Partnerships | `/agency/partnerships` | 5.15 |
| 9.17 | PR and Reputation | `/agency/reputation` | 5.16 |
| 9.18 | Community | `/agency/community` | 5.17 |
| 9.19 | Events | `/agency/events` | 5.18 |
| 9.20 | Inbox | `/agency/inbox` | 5.19 |
| 9.21 | Leads and Audiences | `/agency/audiences` | 5.20 |
| 9.22 | Client Approvals | `/agency/client-approvals` | Agency-specific below |
| 9.23 | Analytics | `/agency/analytics` | 5.21 |
| 9.24 | Finance | `/agency/finance` | 5.22 |
| 9.25 | Client Reports | `/agency/client-reports` | Agency-specific below |
| 9.26 | Automations | `/agency/automations` | 5.23 |
| 9.27 | Agency Operations | `/agency/operations` | Agency-specific below |
| 9.28 | Settings | `/agency/settings` | 2, 3, 4 and 5.24 |

## 9.2 Agency-specific pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 9.29 | Clients overview | `/agency/clients` | Client health, campaigns, approvals, workload, revenue and margin | KPI strip, client table/cards, health, owner, revenue and risk |
| 9.30 | Active clients | `/agency/clients/active` | Manage current client records | Filters, table, saved views, bulk assignment |
| 9.31 | Prospective clients | `/agency/clients/prospects` | Manage prospects before conversion | Pipeline board/table, stage, value, owner, next action |
| 9.32 | Archived clients | `/agency/clients/archived` | Search historical client records | Archived table, read-only state, restore control |
| 9.33 | Shared templates | `/agency/shared-templates` | Agency-wide campaign, content, report and workflow templates | Template cards/table, client visibility, versions and usage |
| 9.34 | Client approvals | `/agency/client-approvals` | Items awaiting external client action | Client filters, approval queue, preview, reminder and SLA |
| 9.35 | Client reports | `/agency/client-reports` | White-label reports and delivery schedules | Report table/cards, branding preview, sharing and schedule |
| 9.36 | Agency operations | `/agency/operations` | Capacity, utilisation, deadlines, WIP and delivery risk | KPIs, workload chart, timeline, risk table |
| 9.37 | Capacity and workload | `/agency/operations/capacity` | Allocate work across people, clients and campaigns | Heatmap, timeline/Gantt, filters, assignment drawer |
| 9.38 | Services and rate cards | `/agency/operations/services` | Service catalogue, scope and internal/client rate references | Service cards/table, price fields, templates and usage |
| 9.39 | Delivery quality | `/agency/operations/quality` | Rework, deadlines, approval cycles and delivery quality | KPIs, charts, issue table, client/team breakdown |

## 9.3 Agency client detail

**Route:** `/agency/clients/:clientId`

| No. | Tab | Function | Components |
|---:|---|---|---|
| 9.40.01 | Overview | Health, commercial summary, contacts and next actions | Client header, KPI strip, contacts, activity |
| 9.40.02 | Strategy | Objectives, audiences and plans | Plan cards, objectives and approval status |
| 9.40.03 | Campaigns | Client campaign portfolio | Table/board, filters and status |
| 9.40.04 | Calendar | Client-specific schedule | Calendar, filters and timezone |
| 9.40.05 | Content | Client content records | Content table/cards, approval and schedule |
| 9.40.06 | Approvals | Internal and external approvals | Approval queue, preview and SLA |
| 9.40.07 | Reports | Shared and scheduled reports | Report table, schedule and sharing |
| 9.40.08 | Files | Authorised files and brand assets | Asset grid, folders and rights |
| 9.40.09 | Finance | Budget, costs, invoices and margin | KPIs, finance tables and margin chart |
| 9.40.10 | Access | Agency members and client grants | Member/grant table, roles and expiry |
| 9.40.11 | Activity and Audit | Operational and material events | Activity feed and audit table |

## 9.4 Agency wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 9.41 | Create client | `/agency/clients/new` | Identity, Contacts, Services, Team, Brand, Workspace/Grant Model, Billing Reference, Review |
| 9.42 | Convert prospect | `/agency/clients/prospects/:id/convert` | Identity, Services, Team, Brand, Migration, Portal, Review |
| 9.43 | Invite client approver | `/agency/clients/:id/invite` | Recipient, Records, Approval Role, Expiry, Branding, Message, Review |
| 9.44 | Create client report | `/agency/client-reports/new` | Client, Period, Sources, Widgets, Branding, Commentary, Sharing, Schedule, Review |
| 9.45 | Create agency service | `/agency/operations/services/new` | Name, Category, Scope, Deliverables, Rate Reference, Templates, Review |

---

# 10. Supplier Workspace

**Base route:** `/supplier`

## 10.1 Individual pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 10.01 | Dashboard | `/supplier` | Shopfront readiness, enquiries, quotes, orders, deadlines, reviews and earnings | KPI strip, setup checklist, queues, deadlines, earnings, activity |
| 10.02 | Shopfront and profile | `/supplier/profile` | Public supplier identity, services, portfolio, policies and availability | Profile editor, preview, completeness and verification |
| 10.03 | Listings and packages | `/supplier/listings` | Manage public service listings | Filters, listing table/cards, moderation and performance |
| 10.04 | Requests and opportunities | `/supplier/requests` | Buyer requests explicitly shared with the supplier | Request cards/table, eligibility, deadline and actions |
| 10.05 | Quotes | `/supplier/quotes` | Draft, send, revise and withdraw eligible quotes | Quote table, status, value, expiry and relations |
| 10.06 | Orders | `/supplier/orders` | Manage supplier-side marketplace orders | Order table, next action, deadline and status |
| 10.07 | Deliveries | `/supplier/deliveries` | Upload, submit, revise and track deliverables | Delivery grid/table, upload, feedback and versions |
| 10.08 | Messages | `/supplier/messages` | Marketplace conversations | Inbox layout, thread, attachments and order context |
| 10.09 | Availability | `/supplier/availability` | Capacity, lead time and unavailable dates | Scheduler, service selector and exceptions |
| 10.10 | Reviews and reputation | `/supplier/reviews` | Buyer feedback and public reputation | Rating summary, review feed and response controls |
| 10.11 | Disputes | `/supplier/disputes` | Supplier-side dispute cases | Case table, severity, timeline and evidence |
| 10.12 | Earnings and payouts | `/supplier/earnings` | Earnings, fees, balances and payout references | KPIs, charts, line table and status |
| 10.13 | Analytics | `/supplier/analytics` | Views, enquiries, quotes, delivery and reviews | KPIs, funnel, charts and listing comparison |
| 10.14 | Settings | `/supplier/settings` | Supplier workspace configuration | Sections 2–4 |

## 10.2 Detail pages

| No. | Detail | Route | Tabs |
|---:|---|---|---|
| 10.15 | Supplier profile | `/supplier/profile` | Overview, Identity, Services, Portfolio, Policies, Availability, Verification, Public Preview, Audit |
| 10.16 | Listing | `/supplier/listings/:listingId` | Overview, Description, Scope, Packages, Pricing, Media, FAQs, Revisions, Policies, Orders, Performance, Moderation, Versions |
| 10.17 | Request | `/supplier/requests/:requestId` | Overview, Brief, Buyer Summary, Requirements, Files, Questions, Quote, Activity |
| 10.18 | Quote | `/supplier/quotes/:quoteId` | Summary, Scope, Pricing, Milestones, Terms, Messages, History, Audit |
| 10.19 | Order | `/supplier/orders/:orderId` | Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit |
| 10.20 | Delivery | `/supplier/deliveries/:deliveryId` | Preview, Requirements, Files, Feedback, Versions, Rights, Acceptance, Activity |
| 10.21 | Dispute | `/supplier/disputes/:caseId` | Timeline, Order, Evidence, Messages, Payment Hold, Resolution, Audit |
| 10.22 | Payout | `/supplier/earnings/payouts/:payoutId` | Summary, Line Items, Fees, Adjustments, Status, Documents, Audit |

## 10.3 Supplier wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 10.23 | Supplier onboarding | `/marketplace/sell` | Identity, Business, Categories, Profile, Services, Policies, Verification, Payout Setup, Review |
| 10.24 | Create listing | `/supplier/listings/new` | Category, Service, Scope, Packages, Pricing, Delivery, Revisions, Media, FAQs, Policies, Review |
| 10.25 | Create quote | `/supplier/requests/:requestId/quote/new` | Scope, Exclusions, Price, Milestones, Dates, Revisions, Rights, Terms, Review |
| 10.26 | Submit delivery | `/supplier/orders/:orderId/deliveries/new` | Milestone, Requirements, Files, Notes, Rights Declaration, Preview, Submit |
| 10.27 | Add dispute evidence | `/supplier/disputes/:caseId/evidence/new` | Evidence Type, Files, Description, Relation, Declaration, Review |
| 10.28 | Payout setup | `/supplier/settings/payouts/setup` | Identity, Provider, Tax Reference, Verification, Review |


---

# 11. Portal Types

## 11.0 Portal security policy

A portal user receives a signed, expiring grant to named records. A grant must not:

- Create broad workspace membership.
- Permit enumeration of other workspace records.
- Expose internal notes, unrelated files, billing or settings.
- Continue after expiry or revocation.
- Bypass record-specific permissions.

Every portal requires expired, revoked, permission-denied and no-longer-shared states.

## 11.1 Client approval portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.01 | Home | `/client-portal/:grantId` | Shared items, deadlines, campaigns and reports | Summary cards, approval queue, recent deliverables, messages |
| 11.02 | Approvals | `/client-portal/:grantId/approvals` | Preview, comment, approve or request changes | Approval list, preview, feedback and decisions |
| 11.03 | Calendar | `/client-portal/:grantId/calendar` | Shared campaign and content dates | Restricted calendar and record drawer |
| 11.04 | Deliverables | `/client-portal/:grantId/deliverables` | Review authorised deliverables and versions | Grid/table, preview, feedback, version history |
| 11.05 | Reports | `/client-portal/:grantId/reports` | View shared reports | Report cards, dashboard and export |
| 11.06 | Files | `/client-portal/:grantId/files` | View and download authorised files | File grid, preview and permission-aware upload |
| 11.07 | Messages | `/client-portal/:grantId/messages` | Scoped communication with the owner team | Conversation list, thread and attachments |

## 11.2 Collaborator portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.08 | Home | `/collaborator-portal/:grantId` | Assigned tasks, content, files and deadlines | Summary cards, task list, content list |
| 11.09 | Tasks | `/collaborator-portal/:grantId/tasks` | Update and submit assigned tasks | Table/board, status, comments and files |
| 11.10 | Content | `/collaborator-portal/:grantId/content` | Work on explicitly shared content | Restricted editor, preview, comments and submit |
| 11.11 | Files | `/collaborator-portal/:grantId/files` | Access granted files | File grid, upload/download controls |
| 11.12 | Messages | `/collaborator-portal/:grantId/messages` | Scoped collaboration messages | Thread list, conversation and context |

## 11.3 Creator/UGC portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.13 | Home | `/creator-portal/:grantId` | Opportunities, briefs, deliverables, rights and payments | Summary, brief cards, delivery queue and alerts |
| 11.14 | Opportunities | `/creator-portal/:grantId/opportunities` | Apply to shared opportunities | Cards/table, requirements, deadline and actions |
| 11.15 | Briefs | `/creator-portal/:grantId/briefs` | View assigned briefs | Brief cards/table, progress and submission state |
| 11.16 | Deliverables | `/creator-portal/:grantId/deliverables` | Upload, submit and revise own work | Grid/table, uploader, feedback and versions |
| 11.17 | Rights | `/creator-portal/:grantId/rights` | Review declarations and agreements | Rights table/cards, scope and documents |
| 11.18 | Payments | `/creator-portal/:grantId/payments` | View own compensation status | Payment table, status, amount and source |
| 11.19 | Profile | `/creator-portal/:grantId/profile` | Maintain permitted creator information | Profile form, portfolio and preview |

## 11.4 Affiliate/ambassador portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.20 | Home | `/affiliate-portal/:grantId` | Programme, links, conversions and commission summary | KPIs, programme card, links and earnings |
| 11.21 | Programme | `/affiliate-portal/:grantId/programme` | Terms, eligibility and attribution rules | Terms viewer, version and acknowledgement |
| 11.22 | Links and codes | `/affiliate-portal/:grantId/links` | Own tracking links and codes | Link table, copy, destination restrictions |
| 11.23 | Assets | `/affiliate-portal/:grantId/assets` | Approved promotional assets | Asset grid, preview and usage notice |
| 11.24 | Conversions | `/affiliate-portal/:grantId/conversions` | Permitted or aggregated conversion records | KPI strip, conversion table and filters |
| 11.25 | Commissions | `/affiliate-portal/:grantId/commissions` | Own commission status | Commission table, status and payout reference |
| 11.26 | Support | `/affiliate-portal/:grantId/support` | Programme-specific support | Cases, conversation and new case action |
| 11.27 | Profile | `/affiliate-portal/:grantId/profile` | Partner profile and payout readiness | Profile form, compliance status and documents |

## 11.5 Publisher/media portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.28 | Home | `/publisher-portal/:grantId` | Opportunities, placements, deliverables and reports | Summary cards, opportunity and placement lists |
| 11.29 | Opportunities | `/publisher-portal/:grantId/opportunities` | Submit proposals to shared opportunities | Cards/table, deadline and proposal action |
| 11.30 | Media kit | `/publisher-portal/:grantId/media-kit` | Manage permitted audience and inventory information | Editor, audience fields, inventory and preview |
| 11.31 | Placements | `/publisher-portal/:grantId/placements` | Manage agreed placements | Table, requirement checklist and proof status |
| 11.32 | Deliveries | `/publisher-portal/:grantId/deliveries` | Submit assets or placement proof | Uploader, preview, feedback and versions |
| 11.33 | Reports | `/publisher-portal/:grantId/reports` | View shared performance reports | Report cards and dashboards |
| 11.34 | Profile | `/publisher-portal/:grantId/profile` | Publisher identity and contact settings | Profile form and public preview |

## 11.6 Buyer order portal

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 11.35 | Home | `/buyer-portal/:grantId` | Requests, orders, deliveries, payments and disputes | Summary cards, order and delivery queues |
| 11.36 | Requests | `/buyer-portal/:grantId/requests` | Manage own requests | Request table, quote count and actions |
| 11.37 | Orders | `/buyer-portal/:grantId/orders` | Manage authorised orders | Order table, next action and deadline |
| 11.38 | Deliveries | `/buyer-portal/:grantId/deliveries` | Review and decide deliveries | Preview, feedback and decision controls |
| 11.39 | Payments | `/buyer-portal/:grantId/payments` | View own order payment status | Payment table, documents and order links |
| 11.40 | Disputes | `/buyer-portal/:grantId/disputes` | Manage own disputes | Case table, timeline, evidence and conversation |
| 11.41 | Messages | `/buyer-portal/:grantId/messages` | Buyer-supplier communication | Inbox layout and order context |
| 11.42 | Settings | `/buyer-portal/:grantId/settings` | Personal portal preferences only | Notifications and security-safe preferences |

## 11.7 Portal detail pages

| No. | Detail | Route | Tabs |
|---:|---|---|---|
| 11.43 | Approval item | `/client-portal/:grantId/approvals/:approvalId` | Preview, Feedback, Version History, Context |
| 11.44 | Creator brief | `/creator-portal/:grantId/briefs/:briefId` | Overview, Requirements, Submissions, Feedback, Rights, Payment |
| 11.45 | Creator deliverable | `/creator-portal/:grantId/deliverables/:deliverableId` | Preview, Requirements, Feedback, Versions, Rights, Payment |
| 11.46 | Affiliate commission | `/affiliate-portal/:grantId/commissions/:commissionId` | Summary, Conversion Reference, Rule, Status, Adjustment, Payout |
| 11.47 | Publisher placement | `/publisher-portal/:grantId/placements/:placementId` | Overview, Requirements, Assets, Proof, Approval, Reporting |
| 11.48 | Buyer order | `/buyer-portal/:grantId/orders/:orderId` | Scope, Messages, Milestones, Deliveries, Rights, Payment, Dispute, Audit Summary |
| 11.49 | Buyer dispute | `/buyer-portal/:grantId/disputes/:caseId` | Timeline, Order, Evidence, Messages, Payment Hold, Resolution |

## 11.8 Portal wizards

| No. | Wizard | Route | Steps |
|---:|---|---|---|
| 11.50 | Portal invitation | `/{type}/settings/people/portal-invite` | Recipient, Portal Type, Records, Role, Expiry, Message, Review |
| 11.51 | Creator submission | `/creator-portal/:grantId/briefs/:briefId/submit` | Requirements, Files, Description, Rights, Preview, Submit |
| 11.52 | Partner application | `/affiliate-portal/:grantId/apply` | Profile, Channels, Audience, Compliance, Terms, Review |
| 11.53 | Publisher proposal | `/publisher-portal/:grantId/opportunities/:id/propose` | Placement, Audience, Price, Dates, Deliverables, Terms, Review |
| 11.54 | Buyer request | `/buyer-portal/:grantId/requests/new` | Need, Category, Scope, Budget, Dates, Shortlist, Files, Review |
| 11.55 | Buyer dispute | `/buyer-portal/:grantId/orders/:id/disputes/new` | Issue, Milestone/Delivery, Evidence, Outcome, Review |

---

# 12. Public Website and Marketplace

**Public rule:** no private tenant, audience, contact, order, payment, grant or audit data may be embedded into public output or page source.

## 12.1 Marketing and company pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 12.01 | Home | `/` | Explain Caption Fox and convert visitors | Hero, proof, use cases, testimonials, CTA |
| 12.02 | Features | `/features` | Feature category overview | Feature cards, category navigation and CTA |
| 12.03 | Feature detail | `/features/:featureSlug` | Explain one workflow and its value | Hero, workflow, screenshots, integrations, FAQ |
| 12.04 | Solutions | `/solutions` | Segment visitors by use case | Segment cards and comparison |
| 12.05 | Solution detail | `/solutions/:solutionSlug` | Creator, business, brand, agency or supplier value | Segment hero, workflows, proof and CTA |
| 12.06 | Pricing | `/pricing` | Plans, add-ons, enterprise and fee FAQ | Plan cards, comparison, billing toggle and CTA |
| 12.07 | Company | `/company` | Company navigation and trust | Company cards and CTA |
| 12.08 | About | `/company/about` | Mission, product and approved team information | Story sections, values and CTA |
| 12.09 | Contact | `/company/contact` | Sales, partnership, press and support enquiries | Enquiry selector, validated form and success |
| 12.10 | Careers | `/company/careers` | Public roles and employer information | Role list, filters and detail links |
| 12.11 | Trust centre | `/company/trust` | Accurate security, privacy and compliance information | Trust topics, document request and status links |
| 12.12 | Legal index | `/legal` | Current legal documents and versions | Document list, effective dates and versions |
| 12.13 | Legal document | `/legal/:documentSlug` | Display one legal policy | Document layout, contents and version history |

## 12.2 Public marketplace

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 12.14 | Marketplace home | `/marketplace` | Search, categories, featured suppliers and process | Search hero, categories, supplier cards and trust copy |
| 12.15 | Search | `/marketplace/search` | Find suppliers and listings | Search, filters, sort, cards/list, compare and pagination |
| 12.16 | Category | `/marketplace/categories/:categorySlug` | Category-specific discovery | Category header, subcategories, filters and results |
| 12.17 | Supplier shopfront | `/marketplace/:supplierSlug` | Public supplier profile | Profile, verification state, services, portfolio, reviews, policies |
| 12.18 | Listing detail | `/marketplace/listings/:listingSlug` | Public service offer | Scope, packages, pricing, samples, delivery, revisions, reviews, FAQ |
| 12.19 | How marketplace works | `/marketplace/how-it-works` | Explain buyer and supplier process accurately | Process steps, safety limits, FAQ and CTA |
| 12.20 | Become a supplier | `/marketplace/sell` | Begin supplier onboarding | Benefits, requirements and onboarding CTA |

## 12.3 Resources and support

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 12.21 | Resources | `/resources` | Blog, guides, templates, help, changelog and status | Resource cards, search and categories |
| 12.22 | Blog index | `/resources/blog` | Browse articles | Article cards, search, category and pagination |
| 12.23 | Blog article | `/resources/blog/:slug` | Read one article | Article, contents, metadata, related resources |
| 12.24 | Guides | `/resources/guides` | Browse structured guides | Guide cards, search and category |
| 12.25 | Guide detail | `/resources/guides/:slug` | Read one guide | Step navigation, content and related links |
| 12.26 | Templates | `/resources/templates` | Public template previews and permitted downloads | Template cards, filters, preview and CTA |
| 12.27 | Template detail | `/resources/templates/:slug` | Explain and preview one template | Preview, use cases, fields and CTA |
| 12.28 | Help centre | `/help` | Search and browse support | Search hero, categories and article lists |
| 12.29 | Help article | `/help/:articleSlug` | One support article | Contents, steps, feedback and related links |
| 12.30 | Changelog | `/changelog` | Product updates | Release timeline, tags and detail |
| 12.31 | Status | `/status` | Current and historical service health | Component status, uptime and incidents |

## 12.4 Public campaign/profile pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 12.32 | Campaign page | `/c/:slug` | Approved public offer or opt-in | Hero, offer, form, consent and tracking notice |
| 12.33 | Media kit | `/media-kit/:slug` | Public creator/publisher evidence | Profile, audience, services, portfolio and enquiry |
| 12.34 | Link in bio | `/l/:slug` | Public micro-page | Mobile profile, blocks, links, products and forms |
| 12.35 | Creator profile | `/creators/:slug` | Public creator identity and services | Profile, portfolio, services, audience summary and contact |

---

# 13. Authentication and Onboarding

## 13.1 Authentication pages

| No. | Page | Route | Function | Components |
|---:|---|---|---|---|
| 13.01 | Sign up | `/signup` | Account creation, consent and verification | Auth form, validation and consent links |
| 13.02 | Login | `/login` | Authentication and authorised redirect | Login form, providers, MFA and errors |
| 13.03 | Forgot password | `/forgot-password` | Neutral recovery request | Form, neutral success and rate-limit state |
| 13.04 | Reset password | `/reset-password` | Set a password using a valid token | Password form, token and expiry states |
| 13.05 | MFA challenge | `/mfa` | Complete second-factor challenge | Challenge, method selector and recovery |
| 13.06 | Verify email | `/verify-email` | Confirm email ownership | Verification, resend and expired state |
| 13.07 | Invitation acceptance | `/invite/:token` | Accept workspace or portal invitation | Role/scope preview, identity gate and expiry state |

## 13.2 Onboarding pages

| No. | Page | Route | Function | Steps/components |
|---:|---|---|---|---|
| 13.08 | Onboarding start | `/onboarding` | Select or detect the correct workspace path | Workspace-type cards, invitation detection and progress |
| 13.09 | Creator onboarding | `/onboarding/creator` | Create creator workspace | Profile, focus, channels, goals, availability, public profile, review |
| 13.10 | Business onboarding | `/onboarding/business` | Create business workspace | Identity, brand, goals, audiences, channels, team, integrations, review |
| 13.11 | Brand onboarding | `/onboarding/brand` | Create governed team workspace | Brand, teams, approvals, channels, modules, integrations, review |
| 13.12 | Agency onboarding | `/onboarding/agency` | Create agency and first client | Agency, services, team, client model, branding, first client, review |
| 13.13 | Supplier onboarding | `/marketplace/sell` | Create supplier workspace and verification case | Identity, category, profile, listing, policies, verification, payout, review |
| 13.14 | Resume onboarding | `/onboarding/resume` | Resume the latest incomplete authorised onboarding | Progress summary, validation and safe continuation |

---

# 14. Shared Production Requirements

## 14.1 Collection page acceptance

Every collection page must include:

1. Page header and primary create action.
2. Search.
3. Relevant filters.
4. Sorting.
5. Saved views.
6. Correct table, cards, board, calendar, timeline, chart or map views.
7. Column management where tables are used.
8. Pagination or deliberate virtualisation.
9. Record click-through.
10. Permission-aware quick and bulk actions.
11. Import/export where commercially and legally appropriate.
12. Loading skeleton.
13. Empty state.
14. No-results state.
15. Restricted state.
16. Upgrade state.
17. Integration-unavailable state.
18. Archived state.
19. Recoverable error state.
20. Responsive mobile and tablet layouts.

## 14.2 Detail page acceptance

Every detail page must include:

1. Breadcrumb.
2. Record title, type, status, owner and key dates.
3. Primary next action.
4. Secondary action menu.
5. Deep-linkable tabs.
6. Right summary rail or responsive drawer.
7. Related records.
8. Activity feed.
9. Audit trail for material actions.
10. Files and versions where relevant.
11. Comments or messages where collaboration is relevant.
12. Permission-aware editing.
13. Read-only archived state.
14. Loading, not-found, restricted and error states.

## 14.3 Wizard acceptance

Every wizard must include:

1. Permission and entitlement check.
2. Stable route.
3. Stepper.
4. Required and optional labels.
5. Inline validation.
6. Autosave for multi-step flows.
7. Back, Next, Save Draft, Cancel and Close.
8. Unsaved-change confirmation.
9. Review step.
10. Explicit final action.
11. Duplicate and conflict detection.
12. Provider validation where required.
13. Success screen and record link.
14. Partial-failure recovery.
15. Audit reason for elevated/destructive actions.
16. Mobile and tablet usability.

## 14.4 Permission requirements

- Navigation visibility is not authorisation.
- Queries and mutations enforce membership, role, record scope and portal grant server-side.
- Admin elevation is explicit, time-bounded where appropriate and audited.
- Campaign membership may grant one campaign without workspace-wide access.
- Supplier and buyer order views expose only their permitted side.
- Search, notifications, activity and analytics apply the same permission rules as direct routes.
- Fox Copilot cannot bypass role, approval, spend, publish, payment or rights controls.

## 14.5 Material audit events

Audit at minimum:

- Membership, role, team and portal-grant changes.
- Provider, scope, API key and webhook changes.
- Subscription, entitlement and billing changes.
- Approval and rejection decisions.
- Publishing, sending, pausing and cancellation.
- Budget, purchase order, cost and commission approvals.
- Rights, consent, retention and legal holds.
- Supplier verification, moderation, payout hold and disputes.
- Automation activation, pause, replay and elevated execution.
- Data export and deletion.
- Admin support access and user restrictions.

## 14.6 Responsive test widths

Test at minimum:

- 1440px desktop
- 1280px laptop
- 1024px compact desktop/tablet landscape
- 834px tablet portrait
- 768px small tablet
- 430px large mobile
- 390px standard mobile
- 360px small mobile

No horizontal page overflow is permitted. Tables require responsive scroll or card alternatives. Side rails become drawers. Detail summary rails become drawers/accordions. Tabs become scrollable or dropdown navigation. Drag-and-drop requires touch and keyboard alternatives.

## 14.7 Build completion checklist

A page does not pass until:

- Direct route loading works.
- Navigation and breadcrumbs work.
- Real authorised data is used.
- Search, filters, sorting and views work.
- Create and secondary actions work.
- Record clicks open the canonical detail route.
- Detail tabs refresh and deep-link correctly.
- Server permissions are verified.
- All supporting states exist.
- Responsive layouts pass.
- Keyboard focus, labels and dialogs are accessible.
- Material audit events are created.
- Errors are recoverable.
- No dead, decorative or pretend buttons remain.
- No wording claims verification, escrow, guaranteed delivery or protected payout before the legal/provider implementation is live.

---

# 15. Recommended Creation Order

| Phase | Scope |
|---:|---|
| 1 | Shared shell, access guard, headers, tabs, tables, cards, filters, views, wizard shell and states |
| 2 | Account, workspace settings, people, roles, portal grants and billing foundations |
| 3 | Home, Campaigns, Calendar, Studio, Brand and Assets, Analytics |
| 4 | Social, Messaging, Web, SEO, Leads and Audiences |
| 5 | Creators and UGC, Marketplace, Supplier and portals |
| 6 | Advertising, Partnerships, PR, Community, Events and Finance |
| 7 | Automations and Fox Copilot execution |
| 8 | Platform Admin operational completion |
| 9 | Public website, resources, marketplace search and public profiles |
| 10 | Full browser QA across every route, detail tab, action and wizard |

# 16. Tracking Columns

| Field | Values |
|---|---|
| Architecture | Not Started / Draft / Approved |
| Route | Missing / Shell / Connected |
| UI | Missing / Partial / Complete |
| Data | Mock / Partial / Live |
| Permissions | Missing / Client Only / Server Enforced |
| Actions | Broken / Partial / Complete |
| States | Missing / Partial / Complete |
| Responsive | Failed / Partial / Passed |
| Accessibility | Failed / Partial / Passed |
| Audit | Missing / Partial / Complete |
| Unit tests | Missing / Partial / Passed |
| Integration tests | Missing / Partial / Passed |
| Browser QA | Missing / Partial / Passed |
| Production | Blocked / In Progress / Ready / Released |

# 17. Definitive Architecture Rules

1. `/creator`, `/business`, `/brand`, `/agency` and `/supplier` are canonical.
2. `/app/*` is compatibility-only and receives no new routes.
3. Shared modules use one record model and one page contract unless an explicit workspace override exists.
4. Studio owns content, templates, media and content ideas.
5. Brand and Assets owns brand kits, governed assets, rights and product records.
6. Social owns organic publishing, engagement, listening and social connections.
7. Analytics owns reports, attribution and source methodology.
8. Calendar status values are filters or saved views, not duplicate permanent tabs.
9. Supplier workspace and buyer portal are separate security contexts.
10. Portal users never inherit workspace-wide access from a grant.
11. Public pages never expose private operational data.
12. Shell Exists never means Feature Complete.
13. Every record has one canonical detail route.
14. Every creation flow has one canonical wizard route.
15. Duplicate routes redirect to the canonical route and are removed after migration.

**End of specification.**
