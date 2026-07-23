# Caption Fox — Unified Product, Information Architecture & Modularisation Plan

**Version:** 2.0 · **Updated:** 2026-07-23 · **Status:** authoritative delivery plan

This supersedes the prior 56-step technical plan. It combines the build-grade audit, the enterprise sidebar audit, the current supplier/marketplace work, and the full marketing-operating-system roadmap. It is a product plan, not a claim that every item below has been shipped.

## 1. Product model and delivery rules

Caption Fox is a multi-workspace marketing operating system. It manages the complete chain:

`Business objective → marketing strategy → campaign → channel plan → deliverable → publication → conversion → revenue`

### Status key

| Status | Meaning | Navigation treatment |
|---|---|---|
| **Shipped** | Implemented, routed and usable in the current build | Show normally |
| **Partial** | Route/UI exists, but integration, persistence or workflow is incomplete | Label beta; do not over-promise |
| **Demo** | Seedable demonstration data/UI only | Keep clearly labelled demo |
| **Planned** | Defined requirement; not yet built | Do not expose in production nav |
| **Gate** | Requires security, payments, provider approval or data foundation | Hide behind entitlement/feature flag |

### Non-negotiable platform gates

| Gate | Why it comes before expansion | Current status |
|---|---|---|
| Tenant isolation and active-workspace context | Every query, file, job and permission must be workspace-scoped | **Partial** |
| Auth, roles, RLS and audit log coverage | Marketplace, finance, collaboration and admin are unsafe without them | **Partial** |
| Billing, entitlements and usage metering | Required before plan-gated AI, automations and add-ons | **Partial** |
| Real provider connections and publish state | Scheduled/published must never be simulated as live publishing | **Partial** |
| Marketplace identity, contracts, payments and dispute policy | Required before escrow, payouts or “protected booking” claims | **Gate** |
| Notifications, command search and error boundaries | Required operating-system behaviour | **Partial** |

## 2. Workspace catalogue

All campaign-manager workspace types share the same shell and data model; their plan, role and enabled modules determine what appears. This prevents duplicate products for creators, brands and agencies.

| Workspace type | Primary users | Enabled at launch | Later entitlements |
|---|---|---|---|
| **Creator** | Independent creators and small teams | Studio, Calendar, Campaigns, Social, Link in Bio, Marketplace, basic Analytics | Brand kits, creator CRM, partnerships, paid media |
| **Business** | Local and online businesses | Creator set + Strategy, Inbox, Email, Leads, Finance basics | SEO, web conversion, loyalty, local listings |
| **Brand** | In-house marketing teams | Business set + UGC, Creators, approvals, paid advertising, multi-brand governance | PR, community, internationalisation, enterprise controls |
| **Agency** | Agencies serving multiple clients | Brand set + client workspaces, client portal, supplier procurement, white-label reports | SSO, advanced permissions, margin/rebilling |
| **Campaign Manager** | Canonical route/shell for the four types above | `/campaign-manager` entry alias; `/app` remains compatibility route during migration | Full modular workspace below |
| **Supplier** | Agencies, freelancers, creators and marketing vendors | Separate `/supplier` workspace and marketplace shopfront | Contracts, availability, fulfilment SLAs, verified payouts |
| **Platform Admin** | Caption Fox operations only | Separate `/admin` shell; never a normal workspace | Support, compliance, platform observability |

## 3. Campaign Manager workspace: target side menu

### 3.1 Current navigation audit (what the code does today)

| Surface | Current structure | Strength | Gap that must be planned out |
|---|---|---|---|
| Desktop Campaign Manager sidebar | **Home**; **Create:** Studio, Calendar; **Promote:** Campaigns, UGC, Link in Bio, Marketplace; **Engage:** Inbox; **Measure:** Analytics, Listening; **Manage:** Affiliates, Settings; Admin for platform admins | Group headers are a material improvement over a flat rail; Marketplace is now discoverable | It is still a mixture of destination types. UGC and Affiliates are collaboration programmes, not ordinary promotion tools; Listening is disconnected from Analytics/Social; all visible items have equal visual weight despite uneven maturity |
| Mobile bottom navigation | Home, Studio, Calendar, Inbox, More. **More:** Campaigns, UGC, Link in Bio, Marketplace, Analytics, Listening, Settings | Correctly limits the bottom bar to five actions | **Affiliates is missing**, group labels disappear, and More is an unstructured grid. A user cannot predict where a desktop destination appears on mobile |
| Workspace switcher | Workspace list, then a separately rendered supplier shortcut, then “Create workspace” | Persists workspace selection and exposes the supplier route | It does not identify the active **mode** (Campaign Manager vs Supplier), distinguish personal/client/agency workspaces, offer workspace settings, or show role/plan context |
| Top bar | Workspace switcher; Cmd/Ctrl+K; Create; notifications; help; avatar | Global search and a single Create entry are the right patterns | Quick Create hard-codes query-string tabs (`?tab=`/`?action=`), has no Supplier or Marketplace request actions, and needs a typed action registry with permission/feature checks |
| Supplier sidebar | Dashboard, Listings, Orders, Disputes, Profile, Payouts; public Marketplace link in footer | Separate seller experience is correct | It lacks fulfilment/deliveries, messages, availability, reviews, analytics and settings; Profile should be a Shopfront/Business group rather than a single unstructured item |
| Admin sidebar | Admin Home, Workspaces, Users plus unbuilt plans, AI, social, UGC, compliance, settings, analytics and audit destinations | Separates platform operations from normal users | Unbuilt destinations are currently advertised. Admin needs grouped operations, active-state treatment, detail drill-downs and a build-or-hide registry |
| Public landing navigation | Features, Marketplace, Pricing, Use Cases, Resources; Sign in and Start free trial. It is currently implemented inside the home page component | Marketplace is visible in the public top navigation | It is not a shared public layout; Use Cases and Resources currently point to page anchors rather than durable routes; no public supplier search or solution hierarchy exists |

### 3.2 Navigation model: five levels with strict rules

| Level | Name | Correct use | Incorrect use |
|---|---|---|---|
| L0 | **Mode switcher** | Change between Campaign Manager workspace, Supplier workspace and Platform Admin (if authorised) | Mixing a supplier shortcut in a generic workspace list without mode context |
| L1 | **Primary side navigation** | Stable product areas used frequently by the current workspace type | A status, view, filter, or one-off action |
| L2 | **Section sub-navigation** | Distinct, persistent workflows within one product area | Month/Week, Draft/Published or other transient state |
| L3 | **Detail navigation** | Different durable aspects of one entity, such as a campaign’s Brief, Budget and Audit | Duplicating a separate top-level module or hiding creation steps |
| L4 | **View/filter/action controls** | View switchers, search, status chips, saved views, export and Create | Horizontal tab bars masquerading as product structure |

**Decision rule:** if changing a control does not change the object or workflow being managed, it is a filter, view or action at L4, never a sidebar item or L2 tab. If a page needs more than seven L2/L3 tabs, group it or move configuration to a left sub-navigation.

### 3.3 Deprecated expanded-rail proposal (not approved; do not implement)

This is the final information architecture. A small-plan user sees the entries marked **Core**; entitled modules appear progressively under the same group, never as a different navigation design. “More” on mobile mirrors these exact groups and order.

| Group | L1 side-menu item | Visibility | L2 sub-tabs (inside the main page) | L4 views, filters and global actions | Route family |
|---|---|---|---|---|---|
| Command | **Home** | Core | Overview; Approvals; Ideas | Dashboard date range; widget configuration; saved dashboard; “View activity” action | `/campaign-manager/home` |
| Plan | **Strategy** | Plan/Agency | Objectives; Audiences; Research; Positioning; Plans; Forecasts | Owner/status/timeframe; scenario selector; compare plans; New strategy | `/campaign-manager/strategy/*` |
| Plan | **Campaigns** | Core | All campaigns; Giveaways; Competitions; Templates | Board/List/Table/Timeline; type/status/owner/brand filters; saved views; New campaign | `/campaign-manager/campaigns` |
| Plan | **Calendar** | Core | Calendar; Publishing Queue | Month/Week/List/Timeline; channel/status/assignee filters; unscheduled drawer; Schedule item | `/campaign-manager/calendar` |
| Create | **Studio** | Core | Compose; AI Generate; Ideas; Templates; Hashtags; Media Library | Grid/List; format/brand/right/status filters; Import; Upload; Create content | `/campaign-manager/studio/*` |
| Create | **Brand & Assets** | Brand/Agency | Brand Kits; Asset Library; Rights; Product Library | Folder/grid/list; licence/expiry/usage filters; upload/import; New brand kit | `/campaign-manager/brand/*` |
| Promote | **Social** | Core | Publishing; Engagement; Listening; Channel Connections | Channel/account/date/sentiment filters; saved searches; Connect channel | `/campaign-manager/social/*` |
| Promote | **Advertising** | Add-on | Accounts; Campaigns; Creatives; Audiences; Reports | Provider/account/date/status filters; Import data; Create draft campaign | `/campaign-manager/advertising/*` |
| Promote | **Messaging** | Add-on | Email; SMS; WhatsApp; RCS; Push; Journeys; Templates | Channel/segment/status/date filters; test send; New message/journey | `/campaign-manager/messaging/*` |
| Promote | **Web & Conversion** | Add-on | Landing Pages; Forms; Funnels; Experiments; Tracking | Published/draft; domain; conversion/date filters; New page/form/test | `/campaign-manager/web/*` |
| Promote | **SEO & Discovery** | Add-on | Keywords; Content Briefs; Rankings; Local; AI Search; Backlinks | Locale/search engine/device/competitor filters; New brief; Connect source | `/campaign-manager/seo/*` |
| Promote | **Link in Bio** | Core | Pages; Links; Themes; Analytics | Published/draft; date range; preview; New link page | `/campaign-manager/links/*` |
| Collaborate | **Creators & UGC** | Brand/Agency | Creators; Briefs; Submissions; Rights; Payments | Creator/campaign/status/platform filters; Import; New brief; Invite creator | `/campaign-manager/creators/*` |
| Collaborate | **Marketplace** | Core | Discover; Categories; Saved Suppliers; Requests; Orders | Search, category, location, budget, delivery, availability, verification filters; New request | `/marketplace` plus `/campaign-manager/marketplace/*` |
| Collaborate | **Partnerships** | Add-on | Affiliates; Referrals; Ambassadors; Loyalty; Resellers; Co-marketing | Programme/status/channel filters; New programme; export | `/campaign-manager/partnerships/*` |
| Collaborate | **PR & Reputation** | Add-on | Media Lists; Pitches; Press Room; Coverage; Reviews; Crisis | Status/sentiment/date filters; New release/incident | `/campaign-manager/reputation/*` |
| Collaborate | **Community** | Add-on | Communities; Calendar; Moderation; Members; Advocacy | Channel/health/moderation filters; New community | `/campaign-manager/community/*` |
| Collaborate | **Events** | Add-on | Events; Webinars; Podcasts; Sponsorships; Follow-up | Event status/date/type filters; New event | `/campaign-manager/events/*` |
| Engage | **Inbox** | Core | Unified Inbox; Assignments; Saved Views | Folder rail: comments, mentions, DMs, reviews, escalations, done; source/assignee/SLA filters; compose/reply | `/campaign-manager/inbox` |
| Engage | **Leads & Audiences** | Add-on | Contacts; Segments; Consent; Scoring; Imports | Lifecycle/source/consent/score filters; Import; New segment | `/campaign-manager/audiences/*` |
| Measure | **Analytics** | Core | Overview; Content; Audience; Competitors; Reports; Attribution | Date/compare/channel/campaign filters; export/share/schedule report | `/campaign-manager/analytics/*` |
| Measure | **Finance** | Plan/Agency | Budgets; Purchase Orders; Costs; Invoices; Commissions; Profitability | Period/campaign/vendor/status filters; New budget/PO; export | `/campaign-manager/finance/*` |
| Operate | **Automations** | Add-on | Workflows; Recipes; Runs; Connections; Logs | Status/trigger/owner filters; test run; New workflow | `/campaign-manager/automations/*` |
| Manage | **Settings** | Core | See dedicated settings left sub-navigation in 3.6 | No horizontal 11-tab bar; account/workspace selector and search only | `/campaign-manager/settings/*` |

### 3.3A Approved current-shell navigation (the implementation requirement)

The current grouped Campaign Manager shell is the approved and permanent L1 navigation. Do **not** add Strategy, Social, Advertising, Messaging, Web, SEO, Creators, Partnerships, PR, Community, Events, Leads, Finance or Automations as sidebar items. They are capabilities inside the fixed sections below.

| Group | Fixed L1 item | Required L2 tabs within that page | Capability ownership (not new sidebar items) | L4 views/actions |
|---|---|---|---|---|
| Command | **Home** | Overview; Approvals; Ideas | Command centre, activity and health widgets | Date range; widget setup; saved dashboard |
| Create | **Studio** | Compose; AI Generate; Ideas; Brand Voice; Templates; Hashtags; Media Library; Brand Assets | Drag/drop canvas, DAM, rights, product assets and localisation | Grid/list; brand/right/status filters; Upload; Import; Create |
| Create | **Calendar** | Calendar; Publishing Queue | Cross-channel plan, campaign milestones, event/webinar promotion and offline placement dates | Month/Week/List/Timeline; status/channel/assignee filters; Schedule |
| Promote | **Campaigns** | All Campaigns; Strategy & Plans; Channel Plans; Giveaways; Competitions; Paid Ads; Messaging; Web & Conversion; SEO & Discovery; Events & Offline | Objectives/research, ads, email/SMS/WhatsApp/RCS/push, landing pages/forms, SEO/local/AI discovery, PR, events and offline marketing | Board/List/Table/Timeline; type/status/owner/brand/channel filters; New campaign |
| Promote | **UGC** | Briefs; Creators; Submissions; Rights; Payments | Influencer management, creator CRM, contracts and commissioned video | Creator/campaign/status/platform filters; Invite creator; New brief |
| Promote | **Link in Bio** | Pages; Links; Themes; Analytics | Public creator/offer pages and lightweight conversion links | Published/draft; preview; New page |
| Promote | **Marketplace** | Discover; Categories; Saved Suppliers; Requests; Orders | Supplier procurement, agencies/freelancers/creators and offline production suppliers | Search/filter; shortlist; New request |
| Engage | **Inbox** | Unified Inbox; Assignments; Saved Views; Inbox Settings | Social engagement, review response, two-way messaging and crisis escalation | Folder rail; source/assignee/SLA/sentiment filters; Reply; Escalate |
| Measure | **Analytics** | Overview; Content; Audience; Competitors; Reports; Attribution; Listening | Listening, reputation, ad/email/web/SEO/event performance and profitability metrics | Date/compare/channel/campaign filters; Export; Share; Schedule |
| Manage | **Affiliates** | Affiliate Programmes; Referrals; Ambassadors; Loyalty; Resellers; Co-marketing | Partnerships and advocacy, codes, commissions, rewards and fraud review | Programme/status filters; New programme; Export |
| Manage | **Settings** | Workspace; Branding; Channels; Integrations; People; Billing; Account; Data; Automations | Channel/ad/messaging/SEO integrations, consent, automation connections and finance controls | Left sub-nav; scoped actions |

### 3.4 Detail-page hierarchy for the primary campaign workflows

| Parent detail page | L3 detail tabs | Tabs intentionally excluded and where they belong | Persistent right rail |
|---|---|---|---|
| **Campaign** | Overview; Brief; Content; Tasks; Budget; Assets; Results; Audit | Calendar is a Calendar view filtered to the campaign. UGC is a Creators & UGC filtered view. | Status; owner; dates; spend vs budget; approvals; next milestone |
| **Content item** | Editor/Canvas; Variants; Approvals; Schedule; Performance; Versions; Rights | Hashtags/templates are Studio resources, not content-detail tabs. | Channel fit; brand check; approval state; publication status |
| **Calendar publication** | Content; Channel variants; Approval; Delivery log; History | Calendar grid/list is a parent view, not a detail tab. | Scheduled time; connection health; assigned owner; retry action |
| **Creator profile** | Profile; Campaigns; Content; Performance; Agreements; Payments | Discovery/search lives in Creators list; UGC brief is a separate entity. | Rate range; verified channels; availability; rights status |
| **UGC brief** | Overview; Requirements; Creators; Submissions; Approvals; Rights; Payments; Audit | Scripts are an AI tool in Requirements; Samples live with submissions/rights. | Brief status; budget; deadline; owner |
| **Supplier shopfront** | Overview; Services; Portfolio; Reviews; Policies | Orders are private authenticated rooms, never public shopfront tabs. | Verification, response rate, location, availability |
| **Marketplace order room** | Scope; Messages; Milestones; Deliveries; Rights; Payment; Dispute; Audit | Supplier listing detail stays linked, not embedded as a mutable order tab. | Order status, SLA, hold/release state, next action |
| **Automation workflow** | Canvas; Trigger; Actions; Versions; Test; Runs; Logs; Settings | Recipes are collection-level templates, not workflow tabs. | Active/paused, owner, last run, failure count |
| **Ad campaign** | Overview; Targeting; Creatives; Budget; Placements; Results; Change log | Provider account connection remains under Advertising Accounts. | Spend cap, approval state, provider health |
| **Journey** | Canvas; Audience; Content; Goals; Runs; Conversions; Settings; Audit | Templates are Messaging collection resources. | Entry count, active contacts, suppression/error rate |

### 3.5 Creation entry points and standard wizard contract

Every “Create” action must open a dedicated wizard/drawer or direct editor with a saved draft. Query-string-only actions are replaced by typed action identifiers so they can enforce role, plan and prerequisite checks.

| Create action | Availability check | Required steps | Completion state |
|---|---|---|---|
| New campaign | Campaign entitlement; active brand; creator/marketer role | Goal -> audience -> channels -> deliverables -> dates -> budget -> owners/approvals -> review | Draft campaign plus linked task/content skeleton |
| New content | Studio entitlement; optional brand/campaign | Format -> brief -> create/import -> editor/canvas -> brand/rights -> approval -> save/schedule | Versioned content draft |
| Schedule publication | Connected channel; approved content; publish role | Channel/profile -> variant -> date/time -> compliance -> preview -> approval -> queue | Queued job with retry-safe ID |
| New supplier request | Buyer membership; no unresolved account restriction | Need -> budget/timing -> category -> supplier shortlist -> brief/files -> submit | Request visible only to invited/matched suppliers |
| New listing/package | Supplier profile complete; category policy pass | Category -> service -> scope -> price -> delivery/revisions -> media -> policies -> review -> publish | Moderation-ready listing |
| New automation | Automation entitlement; action permissions | Trigger -> conditions -> actions -> approvers -> test -> activate | Versioned inactive/active workflow and test log |
| New journey | Messaging provider and consent basis | Goal -> entry audience -> branches -> content -> frequency/suppression -> test -> activate | Active/pending journey with audit trail |
| New landing page | Domain/brand permission | Goal -> template -> content -> form/CTA -> tracking/consent -> variants -> QA -> publish | Versioned published or draft page |
| New report | Analytics permission | Goal -> metrics -> dimensions -> filters -> visual layout -> sharing/schedule | Saved report with metric contract |

### 3.6 Settings is a left sub-navigation, not a tab bar

| Settings group | Pages | Detail / action pages |
|---|---|---|
| Workspace | General; branding; domains; defaults | Workspace profile; domain verification; archive workspace |
| Channels & integrations | Social channels; ad providers; messaging; webhooks; API keys | Connection detail: scopes, health, logs, reconnect/revoke |
| People & permissions | Members; roles; teams; portal access | Member profile; custom role; invite/resend/revoke |
| Billing & usage | Plan; add-ons; usage; invoices; payment methods | Invoice; subscription change; payment-failure recovery |
| Account | Personal profile; security; notifications; accessibility | MFA, sessions, export/delete request |
| Data & governance | Audit log; data export; retention; consent configuration; danger zone | Export request; retention policy; legal hold; deletion workflow |

### 3.7 Desktop, mobile and top-bar parity requirements

| Element | Desktop behaviour | Mobile behaviour | Required correction |
|---|---|---|---|
| Primary destinations | Grouped side rail | Four core destinations plus More | More sheet must preserve group headings, exact ordering and include Partnerships/Affiliates when enabled |
| Current context | Workspace name in switcher | Same switcher in top bar | Show mode icon/name, workspace type, role and plan; Supplier is a mode, not an orphan list item |
| Create | Top-bar menu | Top-bar menu | One action registry drives both; each action checks feature flag, role and prerequisites |
| Search | Cmd/Ctrl+K button | Search entry in More/top bar | Search groups results by entity and never returns inaccessible records |
| Notifications | Bell opens real notification surface | Same bell/sheet | Every notification deep-link passes resource access check and has fallback context |
| Settings | Side rail destination | More -> Settings | Settings sections render left sub-nav at all breakpoints |
| Responsive detail tabs | Horizontal tabs where space permits | Overflow menu/segmented navigation with sticky summary | Do not wrap 8+ tabs into two rows; preserve current detail context |

### 3.8 Deprecated workspace-specific expanded rails (not approved; do not implement)

This is the definitive answer to “which items are in each side nav?” A workspace type uses one ordered rail; it does not show empty future modules. Entries in parentheses are feature-gated sub-items that are revealed only after the stated module is live for that workspace.

| Workspace type | Side-nav groups and ordered items | Mobile primary bar | Mobile More groups | Must not appear in this workspace |
|---|---|---|---|---|
| **Campaign Manager (generic / transitional)** | **Command:** Home. **Create:** Studio, Calendar. **Promote:** Campaigns, Social, Link in Bio, Marketplace. **Engage:** Inbox. **Measure:** Analytics. **Manage:** Settings. The onboarding must prompt the owner to select Creator, Business, Brand or Agency before enabling expansion modules. | Home, Studio, Calendar, Inbox, More | Promote: Campaigns, Social, Link in Bio, Marketplace. Measure: Analytics. Manage: Settings | Strategy, Finance, Ads, Messaging, Leads, supplier operations and Admin until a workspace type/entitlement is established |
| **Creator workspace** | **Command:** Home. **Create:** Studio, Calendar. **Promote:** Campaigns, Social, Link in Bio, Marketplace. **Engage:** Inbox. **Measure:** Analytics. **Manage:** Settings. *(Creators & UGC only when managing commissions; Partnerships only when enrolled in a programme.)* | Home, Studio, Calendar, Inbox, More | Promote: Campaigns, Social, Link in Bio, Marketplace. Measure: Analytics. Manage: Settings | Finance, Ads, CRM/Leads, team administration beyond personal/basic team controls, Supplier operations, Platform Admin |
| **Business workspace** | **Command:** Home. **Plan:** Strategy, Campaigns, Calendar. **Create:** Studio, Brand & Assets, Link in Bio. **Promote:** Social, Messaging, Web & Conversion, Marketplace. **Engage:** Inbox, Leads & Audiences. **Measure:** Analytics. **Manage:** Settings. *(Advertising, SEO & Discovery, Partnerships, Finance, Automations when entitled.)* | Home, Studio, Calendar, Inbox, More | Plan; Create; Promote; Engage; Measure; Manage in the exact desktop group order | Creator payout operations, multi-client Agency controls, Platform Admin |
| **Brand workspace** | **Command:** Home. **Plan:** Strategy, Campaigns, Calendar. **Create:** Studio, Brand & Assets. **Promote:** Social, Advertising, Messaging, Web & Conversion, SEO & Discovery, Link in Bio. **Collaborate:** Creators & UGC, Marketplace, Partnerships, PR & Reputation, Community, Events. **Engage:** Inbox, Leads & Audiences. **Measure:** Analytics, Finance. **Operate:** Automations. **Manage:** Settings. | Home, Studio, Calendar, Inbox, More | All remaining groups in exact desktop order, with a group heading and an entitlement badge where relevant | Agency client/workspace management, Supplier fulfilment rail, Platform Admin |
| **Agency workspace** | **Command:** Home; Clients. **Plan:** Strategy, Campaigns, Calendar. **Create:** Studio, Brand & Assets. **Promote:** Social, Advertising, Messaging, Web & Conversion, SEO & Discovery, Link in Bio. **Collaborate:** Creators & UGC, Marketplace, Partnerships, PR & Reputation, Community, Events. **Engage:** Inbox, Leads & Audiences. **Measure:** Analytics, Finance. **Operate:** Automations. **Manage:** Team & Roles, Client Access, White Label, Settings. | Home, Clients, Studio, Calendar, More | Plan; Create; Promote; Collaborate; Engage; Measure; Operate; Manage | Supplier payout/order operations (unless user switches mode), Platform Admin |
| **Supplier workspace** | **Command:** Dashboard. **Shop:** Shopfront, Listings & Packages. **Fulfil:** Orders, Deliveries. **Engage:** Messages. **Operate:** Availability. **Trust:** Reviews, Disputes. **Finance:** Earnings & Payouts. **Measure:** Analytics. **Manage:** Settings. | Dashboard, Orders, Listings, Messages, More | Shop; Fulfil; Operate; Trust; Finance; Measure; Manage | Buyer Campaign Manager data, client CRM, ad accounts, other supplier records, Platform Admin |
| **Platform Admin workspace** | **Command:** Dashboard. **Tenants:** Workspaces, Users. **Marketplace:** Suppliers & Marketplace Ops. **Product:** Plans/Billing/Entitlements, Content/AI/Safety, Connections/Webhooks. **Operations:** Automations Operations, Support & Disputes. **Governance:** Compliance & Data, Feature Flags & Releases. **Observe:** Platform Analytics, Audit & System. | No standard bottom navigation; responsive admin drawer only | Same groups as desktop with access-level controls | Normal client campaign data as a default view; supplier fulfilment; public marketplace management without admin audit context |

### 3.8A Approved side navigation by workspace type

| Workspace type | Approved L1 side navigation | Permitted differences | Explicitly prohibited |
|---|---|---|---|
| **Creator Campaign Manager** | **Home**. **Create:** Studio, Calendar. **Promote:** Campaigns, UGC, Link in Bio, Marketplace. **Engage:** Inbox. **Measure:** Analytics, Listening. **Manage:** Affiliates, Settings. | Tabs/actions are role and plan gated; creator-specific profile and commission views live within UGC/Affiliates/Settings. | A different Creator rail; extra L1 modules for Ads, CRM, Finance or Supplier operations. |
| **Business Campaign Manager** | Same fixed Campaign Manager shell and group order. | Business enables campaign sub-tabs such as Strategy & Plans, Messaging, Web & Conversion, SEO & Discovery, Leads and Finance only when entitled. | Adding Strategy, Messaging, Web, SEO, Leads or Finance to the rail. |
| **Brand Campaign Manager** | Same fixed Campaign Manager shell and group order. | Brand enables UGC, paid ads, brand assets, collaboration, reputation and automation tabs inside Studio, Campaigns, UGC, Inbox, Analytics and Settings. | Separate Brand/Assets, Social, Advertising, PR or Automations side-nav items. |
| **Agency Campaign Manager** | Same fixed Campaign Manager shell and group order. | Agency client selector is in the workspace context; clients/team/white-label settings live in Settings. Client portals open from campaign/client sharing actions. | Client, Team, White Label or portal entries in the primary rail. |
| **Supplier workspace** | **Dashboard**. **Shop:** Profile/Shopfront, Listings. **Fulfil:** Orders, Deliveries, Messages. **Operate:** Availability. **Trust:** Reviews, Disputes. **Finance:** Payouts. **Measure:** Analytics. **Manage:** Settings. | This is a distinct `/supplier` shell and can evolve independently. Current minimum routes stay visible while planned entries are hidden/flagged. | Campaign Manager buyer data or its L1 rail. |
| **Platform Admin** | Current visible shell: Admin Home, Workspaces, Users, Support. Add further grouped admin destinations only on completion. | Admin is a distinct `/admin` mode with audited elevation. | Campaign Manager or Supplier rail; unbuilt admin navigation. |

**Mobile rule:** Campaign Manager mobile remains `Home | Studio | Calendar | Inbox | More`. The More sheet must use the same current group headings and include **Affiliates** (currently missing). Supplier mobile has its own `Dashboard | Orders | Listings | Messages | More` pattern. Admin uses a secure drawer, not a customer bottom bar.

### 3.9 Workspace switcher and mode-switcher specification

The switcher becomes a controlled mode selector, not simply a list of names. It must never grant access; it only surfaces memberships/modes already authorised on the server.

| Switcher area | Contents | Behaviour |
|---|---|---|
| Current context button | Mode icon, workspace/supplier name, workspace type, user role; optional plan badge | Opens switcher; shows active check; has accessible label such as “Switch workspace, currently Acme Brand” |
| Campaign Manager workspaces | Grouped by **Personal**, **Client**, **Organisation**, **Agency clients**; each item shows role | Selecting writes a preference then server revalidates membership and redirects to that workspace’s last valid route/home |
| Supplier mode | A distinct **Supplier workspace** group, showing one or more supplier businesses the user controls | Selecting changes shell to `/supplier`; never changes the active buyer workspace data scope |
| Platform Admin mode | Separate restricted group only for platform admins | Opens `/admin`; require re-authentication/elevation for high-risk tasks |
| Create/add actions | Create workspace; join by invite; become a supplier | Each action is permission and plan-aware; “become supplier” launches supplier onboarding, not an empty supplier shell |
| Context controls | Workspace settings; manage memberships; leave workspace where permitted | Always presented as secondary actions, never in the selectable resource list |

The approved current shell in section 3.3A is permanent, not transitional. The detailed table below is a **capability inventory only**: its first column describes ownership and must never be read as permission to create a new L1 side-menu item. Every capability maps into one of the fixed current-shell sections above; Planned/Gate capabilities remain hidden until release readiness.

| Group | Main side-menu section | Status | Main-section sub-tabs | Primary detail / item / profile pages | Detail sub-tabs | Creation wizard |
|---|---|---:|---|---|---|---|
| Command | **Home** | Partial | Overview; Approvals; Ideas | Notification/activity centre; saved dashboard | Activity; notification preferences | Dashboard/widget setup |
| Plan | **Strategy** | Planned | Objectives; Audiences; Research; Positioning; Plans; Forecasts | Objective; persona/ICP; competitor; strategy; channel plan | Overview; assumptions; messages; budget; risks; linked campaigns; audit | Objective → audience → insight → positioning → channels → budget → approval |
| Plan | **Campaigns** | Partial | All campaigns; Giveaways; Competitions; Templates | Campaign; campaign template | Overview; Brief; Content; Tasks; Budget; Assets; Results; Audit | Goal → audience → channels → deliverables → budget → owners → review → launch |
| Plan | **Calendar** | Partial | Calendar; Publishing Queue | Month; Week; List; Timeline/swimlane views; status filters/saved views | Publication / scheduled item | Content; approvals; channel variants; delivery log | Create publication → channels → date/time → compliance → approval → schedule |
| Create | **Content Studio** | Partial | Compose; AI Generate; Ideas; Brand Voice; Templates; Hashtags; Media Library | Content item; template; brand voice; asset | Draft; variants; approvals; performance; version history; rights | Brief → format → generate/import → edit/canvas → brand/compliance → approval → schedule/export |
| Create | **Brand & Assets** | Partial | Brand kits; DAM; Rights; Templates; Product library | Brand profile; asset; licence/release; product | Identity; rules; assets; versions; permissions; usage | Brand identity → voice → visual rules → assets → permissions → publish |
| Promote | **Social** | Partial | Publishing; Engagement; Listening | Channel connection; conversation; mention; competitor watch | Overview; posts; audience; permissions / thread / sentiment / actions | Connect channel → authenticate → select profile → permissions → test → enable |
| Promote | **Advertising** | Planned | Accounts; Campaigns; Creatives; Audiences; Reporting | Ad account; ad campaign; ad set/group; creative | Overview; targeting; creative; budget; results; change log | Objective → account → audience → creative → placement → budget → review → publish |
| Promote | **Email & Messaging** | Planned | Email; SMS; WhatsApp; RCS; Push; Journeys; Templates | Message campaign; journey; subscriber segment; template | Content; audience; flow; conversions; deliverability; audit | Channel → audience/consent → message → personalisation → schedule/trigger → test → approval → activate |
| Promote | **Web & Conversion** | Planned | Landing pages; Forms; Funnels; Experiments; Pixels | Page; form; funnel; experiment | Builder; variants; leads; analytics; settings | Goal → template → content → form/CTA → tracking → variants → QA → publish |
| Promote | **SEO & Discovery** | Planned | Keywords; Content briefs; Rankings; Local; AI Search; Backlinks | Keyword cluster; SEO brief; location/listing; audit | Overview; opportunities; tasks; rankings; competitors | Market/location → keywords → intent → cluster → brief → assign → measure |
| Promote | **Link in Bio** | Partial | Pages; Links; Themes; Analytics | Link page | Design; links; products; pixels; analytics | Identity → theme → links → tracking → preview → publish |
| Promote | **Marketplace** | Partial | Discover; Categories; Saved suppliers; Requests; Orders | Supplier shopfront; listing/package; request; order room | Overview; services; portfolio; reviews; policies / scope; messages; delivery; payment; dispute | Search → shortlist → brief → quote → contract → payment hold → fulfilment → accept → review |
| Collaborate | **Creators** | Partial | Creator CRM; UGC Briefs; Submissions; Rights; Payments | Creator profile; brief; submission; rights agreement | Profile; campaigns; content; performance / brief; submissions; approvals; rights; payments | Brief → creator shortlist → terms/rights → deliverables → invite → approval → commission |
| Collaborate | **Partnerships & Advocacy** | Partial | Affiliates; Referrals; Ambassadors; Loyalty; Resellers; Co-marketing | Partner profile; programme; referral/reward; promo code | Overview; terms; links/codes; conversions; commissions; fraud/audit | Programme type → terms → rewards → attribution → invite → compliance → launch |
| Collaborate | **PR & Reputation** | Planned | Media lists; Pitches; Press room; Coverage; Reviews; Crisis | Journalist; press release; coverage item; review; incident | Details; assets; approvals; distribution; mentions; timeline | Objective → narrative → media list → assets → approvals → distribute → monitor |
| Collaborate | **Community** | Planned | Communities; Calendar; Moderation; Members; Advocacy | Community; member; discussion/challenge | Overview; content; moderation; health; permissions | Community type → channels → rules → roles → onboarding → launch |
| Collaborate | **Events & Sponsorships** | Planned | Events; Webinars; Podcasts; Sponsorships; Follow-up | Event/webinar; speaker; sponsor; registration | Overview; promotion; registrations; run-of-show; sponsors; attribution | Format → dates → audience → speakers/sponsors → registration → promotion → follow-up |
| Engage | **Inbox** | Partial | Unified inbox; Assignments; saved views | Thread; contact; review | Conversation; contact; activity; tasks; internal notes | Connect channel → routing → saved replies → escalation rules → enable |
| Engage | **Leads & Audiences** | Planned | Contacts; Segments; Consent; Scoring; Imports | Contact; segment; consent record | Profile; activity; memberships; consent; score; journeys | Source/import → mapping → consent → dedupe → segment → score → activate |
| Measure | **Analytics** | Partial | Overview; Content; Audience; Competitors; Reports | Report; metric definition; attribution view | Dashboard; sources; methodology; exports; schedule | Report goal → metrics → dimensions → filters → visualise → share/schedule |
| Measure | **Finance** | Planned | Budgets; Purchase orders; Costs; Invoices; Commissions; Profitability | Budget; PO; invoice; commission statement | Overview; lines; approvals; documents; audit | Budget → line items → approval → PO/contract → actuals → reconcile → close |
| Operate | **Automations** | Planned | Recipes; Workflows; Runs; Connections; Logs | Workflow; automation run; connector | Canvas; triggers; actions; branches; versions; run history; errors | Trigger → conditions → actions → test data → approvals → activate → monitor |
| Manage | **Settings** | Partial | Workspace; Branding; Channels; Integrations; People; Billing; Account; Data | Member; role; integration; API key; plan/invoice | Permissions; connection scopes; usage; audit; export/danger zone | Workspace setup → brand → channels → roles → integrations → billing → confirm |

### Navigation rules

- Keep no more than eight frequently used primary destinations visible for a small plan. Less-used modules sit in **More** or are activated from the relevant campaign.
- Listening is an Analytics/Social sub-area until ingestion is reliable; it should not be promoted as a mature standalone product.
- Calendar statuses are filters and saved views, never a seven-tab status bar.
- Inbox sources are folders/filters; Saved Replies belongs in Inbox settings.
- Templates, hashtags, brand voices and media are Studio/Brand sub-routes, not duplicate top-level destinations.
- Route migration: canonical new routes use `/campaign-manager/...`; `/app/...` remains a redirect-compatible alias until analytics and links have migrated.

## 4. Supplier workspace: target side menu

### 4.1 Supplier navigation taxonomy

Current supplier navigation is Dashboard, Listings, Orders, Disputes, Profile and Payouts. This is a good minimum shell, but Profile must become the public shopfront management area and fulfilment must not be hidden inside Orders.

| Group | L1 side-menu item | L2 sub-tabs | L4 collection controls | Detail page tabs | Required route family |
|---|---|---|---|---|---|
| Command | **Dashboard** | Overview; Tasks; Performance | Period; listing/order filter; customise dashboard | Saved dashboard: metrics, tasks, alerts | `/supplier` |
| Shop | **Shopfront** | Public Profile; Portfolio; Policies; Verification; Team | Preview public profile; completeness checklist; submit verification | Supplier profile: overview, services, portfolio, reviews, policies, credentials | `/supplier/shopfront/*` |
| Shop | **Listings & Packages** | Services; Packages; Add-ons; Drafts; Archived | Category/status/price/delivery filters; duplicate; new listing | Listing: description, scope, pricing, delivery, media, FAQs, revisions, performance, audit | `/supplier/listings/*` |
| Fulfil | **Orders** | Requests; Quotes; Active; Delivered; Completed; Cancelled | Client/status/date/SLA filters; saved views | Order: scope, messages, milestones, deliveries, rights, payment, dispute, audit | `/supplier/orders/*` |
| Fulfil | **Deliveries** | In Progress; Awaiting Approval; Revisions; Accepted; Archive | Due-date/status/order filters; upload delivery | Deliverable: files, revisions, rights, acceptance, activity | `/supplier/deliveries/*` |
| Engage | **Messages** | All; Unread; Requests; Order Threads; Saved Replies | Client/order/unread filters; compose | Conversation: thread, order context, attachments, internal notes | `/supplier/messages/*` |
| Operate | **Availability** | Calendar; Capacity; Blackout Dates; Service SLAs | Date/service/capacity filters; set availability | Rule: schedule, service capacity, lead time, booking rules | `/supplier/availability/*` |
| Trust | **Reviews** | Reviews; Responses; Appeals | Rating/date/listing filters; reply/appeal | Review: content, response, evidence, moderation history | `/supplier/reviews/*` |
| Trust | **Disputes** | Open; Evidence Requested; Resolution; Closed | Deadline/status/order filters; open case | Case: timeline, evidence, messages, outcome, audit | `/supplier/disputes/*` |
| Finance | **Earnings & Payouts** | Balance; Statements; Payouts; Tax | Date/status/currency filters; download statement | Payout: line items, fees, status, documents, audit | `/supplier/payouts/*` |
| Measure | **Analytics** | Shopfront; Listings; Enquiries; Orders; Conversion | Period/source/listing filters; export report | Listing/order analytics: traffic, enquiry, conversion, review trends | `/supplier/analytics/*` |
| Manage | **Settings** | Business; Team; Notifications; Integrations; Security | Left sub-navigation and settings search | Team member, integration, security session | `/supplier/settings/*` |

**Supplier side-menu release rule:** only Dashboard, Listings, Orders, Disputes, Shopfront/Profile and Payouts may be visible now. Deliveries, Messages, Availability, Reviews, Analytics and Settings appear only with usable routes and data. Until then, orders should own the relevant delivery/message state rather than create a dead navigation destination.

The table below defines the complete professional supplier workspace. Payments/escrow must remain unavailable until the payment gate is complete.

| Group | Main side-menu section | Status | Main-section sub-tabs | Detail / profile pages | Detail sub-tabs | Creation wizard |
|---|---|---:|---|---|---|---|
| Command | **Dashboard** | Partial | Overview; Tasks; Performance | Dashboard saved view | Metrics; tasks; alerts | Dashboard setup |
| Shop | **Shopfront & Profile** | Partial | Public profile; About; Portfolio; Policies; Verification | Public supplier shopfront; team member | Overview; services; work; reviews; policies; credentials | Business identity → categories → profile → portfolio → policies → verification submit |
| Shop | **Listings & Packages** | Partial | Services; Packages; Add-ons; Availability | Listing/package | Description; scope; pricing; media; FAQs; revisions; performance | Category → service → scope → pricing → delivery → media → policies → publish |
| Fulfil | **Orders** | Partial | New; Active; Delivered; Completed; Cancelled | Order room; quote/request | Scope; messages; milestones; files; approvals; payment; audit | Respond → clarify scope → quote → terms → customer approval → start |
| Fulfil | **Deliveries** | Planned | In progress; Awaiting approval; Revisions; Archive | Deliverable | Files; revisions; rights; acceptance; activity | Upload → rights declaration → submit → revision loop → acceptance |
| Engage | **Messages** | Planned | All; Unread; Requests; Order threads | Conversation | Thread; order context; internal notes; attachments | Routing/auto-reply setup |
| Operate | **Availability** | Planned | Calendar; Capacity; Blackout dates; SLA | Availability rule | Schedule; service capacity; booking rules | Hours → capacity → lead time → blackout → publish |
| Trust | **Reviews & Reputation** | Planned | Reviews; Responses; Appeals | Review | Review; response; evidence; moderation status | Review-response / appeal flow |
| Trust | **Disputes** | Partial | Open; Evidence requested; Resolution; Closed | Dispute case | Timeline; messages; evidence; proposed resolution; audit | Open case → evidence → response → mediation → resolution → review |
| Finance | **Earnings & Payouts** | Partial | Balance; Statements; Payouts; Tax | Payout; statement | Line items; fees; status; documents | Identity/KYC → bank account → tax → verification → payout preference |
| Measure | **Analytics** | Planned | Shopfront; Listings; Orders; Conversion | Listing analytics | Traffic; enquiries; conversion; reviews | Report setup |
| Manage | **Settings** | Planned | Team; Notifications; Integrations; Security | Team member/integration | Role; scopes; audit | Team invite → role → permissions → confirmation |

## 5. Portal catalogue

Portals are constrained experiences for external participants. They are not separate full workspaces and must inherit a campaign/order-specific permission envelope.

| Portal type | Main portal sections / tabs | Detail pages and nested tabs | Multistep wizard | Status |
|---|---|---|---|---:|
| **Client & Approver Portal** | Home; Approvals; Calendar; Deliverables; Reports; Files; Messages | Campaign: Overview, brief, content approvals, timeline, budget snapshot, results; approval item: preview, feedback, version history | Invite → choose campaigns → permission level → branding → send | Planned |
| **Creator / Influencer Portal** | Opportunities; Briefs; Deliverables; Rights; Payments; Profile | Brief: overview, requirements, submissions, feedback, rights, payment; creator profile: portfolio, rates, channels, tax | Profile → channel verification → rates → eligibility → submit deliverable → rights → payout | Planned |
| **Affiliate / Partner Portal** | Programme; Links & codes; Assets; Conversions; Commissions; Support | Programme: terms, assets, links, performance, payouts; conversion: attribution, status, adjustment | Apply → compliance/tax → accept terms → receive link/code → promote → payout | Partial |
| **Buyer Order Portal** | Requests; Quotes; Active orders; Deliveries; Payments; Disputes | Order room: scope, messages, milestones, files, approval, payment, dispute | Brief → shortlist → quote → contract → payment hold → delivery → accept → review | Planned |
| **Supplier Public Shopfront** | Overview; Services; Packages; Portfolio; Reviews; Policies | Listing: scope, pricing, samples, delivery, reviews, FAQs; supplier: credentials/team | Enquiry/booking request → scope → contact → submit | Partial |
| **Public Link / Campaign Microsite** | Landing content; links/offers; form; legal | Page: variants, analytics, conversion settings (owner-only) | Template → content → consent/tracking → preview → publish | Partial |

## 6. Platform Admin: target side menu

### 6.1 Admin navigation taxonomy and visibility policy

The current admin nav shows more destinations than are built. Until each row is ready, show only **Admin Home**, **Workspaces**, **Users** and **Support**. Every other row is admin-only feature-flagged and hidden rather than a 404/empty screen.

| Admin group | L1 menu item | L2 tabs | Detail-page tabs | High-risk actions requiring confirmation/audit |
|---|---|---|---|---|
| Command | Dashboard | Health; Queues; Incidents; Usage | Incident: timeline, tenants, mitigation, audit | Acknowledge/resolve incident; disable provider/job |
| Tenants | Workspaces | All; Trials; Suspended; Risk | Overview; members; plan; usage; connections; billing; audit; support | Suspend, archive, entitlement override, support access |
| Tenants | Users | All; Admins; Risk/Review | Profile; memberships; security; usage; support history; audit | Change admin role, revoke session, account restriction |
| Marketplace | Suppliers & Marketplace Ops | Suppliers; Listings; Orders; Verification; Payouts; Disputes | Identity; shopfront; risk; orders; payments; audit | Verify/reject/suspend, moderation decision, payout/dispute resolution |
| Product | Plans, Billing & Entitlements | Plans; Subscriptions; Invoices; Usage; Coupons | Features; limits; history; adjustment; audit | Change price/entitlement, issue credit/refund |
| Product | Content, AI & Safety | Generations; Moderation; Prompts; Usage; Flags | Input/output; policy; cost; actions; audit | Remove content, block prompt/tool, policy rollout |
| Product | Connections & Webhooks | Providers; Tenant Connections; Events; Health | Scopes; logs; retries; security; audit | Disable provider, replay webhook, revoke connection |
| Operations | Automations Operations | Runs; Failures; Queues; Recipes | Input; steps; errors; retry; audit | Replay/cancel job, disable workflow |
| Operations | Support & Disputes | Tickets; Marketplace Disputes; Incidents; Macros | Conversation; tenant context; evidence; actions; audit | Support elevation, case outcome, account restriction |
| Governance | Compliance & Data | Reports; Consent; Retention; Exports; Legal Holds | Evidence; timeline; approvals; audit | Approve export, legal hold, retention override |
| Governance | Feature Flags & Releases | Flags; Cohorts; Experiments; Releases | Rules; tenants; metrics; rollback; audit | Enable/rollback cohort or production flag |
| Observe | Platform Analytics | Growth; Revenue; Activation; Reliability | Definition; segments; source; schedule | Metric definition change, share/export sensitive report |
| Observe | Audit & System | Audit Log; Configuration; Jobs; Security | Event data; related records; immutable history | Controlled system setting change |

**Admin layout requirement:** group headings must be rendered in the sidebar, an active item must be visually clear, every detail page must have a breadcrumb back to its collection, and destructive/elevated actions must show target, consequence, reason field and immutable audit ID.

| Group | Admin side-menu section | Status | Main-section sub-tabs | Detail pages | Detail sub-tabs | Admin wizard |
|---|---|---:|---|---|---|---|
| Command | **Dashboard** | Partial | Health; queues; incidents; usage | Alert/incident | timeline; affected tenants; actions; audit | Incident triage → owner → mitigation → resolution |
| Tenants | **Workspaces** | Partial | All; trials; suspended; risk | Workspace | overview; members; plan; usage; connections; billing; audit; support | Provision/demo → plan → owner → entitlements → confirm |
| Tenants | **Users** | Partial | All; admins; risk/review | User | profile; memberships; security; usage; support history; audit | Invite admin → role → MFA requirement → send |
| Marketplace | **Suppliers & Marketplace Ops** | Planned | Suppliers; listings; orders; verification; payouts; disputes | Supplier; listing; order; dispute | identity; shopfront; risk; orders; payments; audit | Verification review → evidence → decision → notify |
| Product | **Plans, Billing & Entitlements** | Planned | Plans; subscriptions; invoices; usage; coupons | Plan; subscription; invoice | features; limits; history; adjustments; audit | Plan → entitlements → price → tax → publish |
| Product | **Content, AI & Safety** | Planned | Generation; moderation; prompts; usage; flags | Generation/flag | input; output; policy; cost; action; audit | Policy → rules → rollout → monitor |
| Product | **Connections & Webhooks** | Planned | Providers; tenant connections; webhook events; health | Connection; webhook event | scopes; logs; retries; security; audit | Provider → credentials → scopes → callback → test → enable |
| Operations | **Automations Operations** | Planned | Runs; failures; queues; recipes | Run/job | input; steps; errors; retry; audit | Replay → scope → confirm → run |
| Operations | **Support & Disputes** | Partial | Tickets; marketplace disputes; incidents; macros | Ticket/case | conversation; tenant context; evidence; actions; audit | Case intake → classification → owner → resolution → CSAT |
| Governance | **Compliance & Data** | Planned | Reports; consent; retention; exports; legal holds | Compliance case; export | evidence; timeline; approvals; audit | Request → validate → scope → approve → execute → retain proof |
| Governance | **Feature Flags & Releases** | Planned | Flags; cohorts; experiments; releases | Flag/release | rules; tenants; metrics; rollback; audit | Flag → audience → guardrails → staged rollout → observe → complete |
| Observe | **Platform Analytics** | Planned | Growth; revenue; activation; reliability | Metric/report | definition; segments; source; schedule | Report → metric contract → access → schedule |
| Observe | **Audit Logs & System Settings** | Planned | Audit; configuration; jobs; security | Audit record; system setting | event data; related entities; immutable history | Controlled setting change → approval → apply → verify |

## 7. Public product navigation and search

### 7.1 Public navigation hierarchy

Replace the current home-page-local navigation with a shared `PublicNav` and shared public layout. The top navigation must use real routes, not `#use-cases` and `#resources` anchors, so links work from every public page and can be indexed.

| Top-level item | Dropdown / sub-navigation | Search/filter behaviour | Detail pages | Primary conversion |
|---|---|---|---|---|
| **Product** | Overview; Studio; Calendar; Campaigns; Social; Analytics; Automations; Integrations | No global search necessary at MVP | Feature page; integration detail | Start free trial |
| **Solutions** | Creators; Businesses; Brands; Agencies; Suppliers; Industries; Local marketing | Solution/industry filter later | Solution; customer story | Choose use case / book demo |
| **Marketplace** | Discover; Search suppliers; Categories; How it works; Become a supplier | Category, service, location, budget, delivery, availability, verified, rating | Category; supplier; listing/package | Submit request / become supplier |
| **Pricing** | Plans; Add-ons; Enterprise; Marketplace fees; FAQ | Plan comparison filters | Plan comparison; enterprise contact | Start trial / contact sales |
| **Resources** | Blog; Guides; Templates; Help Centre; Changelog; Status | Topic/product/role search | Article; template preview; help article | Read, download or sign up |
| **Company** | About; Contact; Careers; Trust & Security; Legal | None | Contact, terms, privacy, DPA | Contact / request demo |
| **Sign in** | Account login | None | Password/MFA/recovery | Authenticate |
| **Get started** | Signup/onboarding | Workspace-type choice | Signup; onboarding; invite | Create workspace |

### 7.2 Public marketplace search requirements

| Search element | Requirement |
|---|---|
| Result unit | A card always links to a public supplier shopfront or listing; no private order information is included. |
| Facets | Category, service, location/service area, remote/on-site, budget band, delivery time, availability, verified status, rating, language and accessibility needs. |
| Sort | Recommended, relevance, rating, response time, price, delivery time and newest. “Recommended” must disclose the basis and never silently prefer paid placement. |
| Trust signals | Verification label only with a documented state; review count; completed-order eligibility; response-time window; clear policy link. |
| Empty state | Explain loosened filters, offer saved search/brief request and provide a clear no-results path. |
| SEO | Index category/supplier/listing pages that are publish-approved; canonical tags, structured data and no indexing of filtered-result combinations that create thin duplicates. |

| Public top-nav item | Destination / sub-navigation | Public detail pages | Public wizard / conversion path | Status |
|---|---|---|---|---:|
| **Product** | Overview; Studio; Calendar; Campaigns; Social; Analytics; Automations | Feature page; integration page | Feature → use case → CTA → onboarding | Shipped/Partial |
| **Solutions** | Creator; Business; Brand; Agency; Supplier; industry/local use cases | Solution page; customer story | Solution → plan → signup | Planned |
| **Marketplace** | Discover; Categories; How it works; Become a supplier | Supplier shopfront; listing/package; category search | Search → supplier/listing → enquiry or booking request | Partial |
| **Supplier Search** | Search, category, service, location, budget, availability, verified filters | Supplier/listing comparison and saved list | Search → filters → shortlist → brief → request quotes | Planned |
| **Pricing** | Plans; add-ons; enterprise; marketplace fees | Plan comparison; billing FAQ | Select plan → account → workspace setup → checkout | Partial |
| **Resources** | Blog; guides; templates; help; status | Article; template preview; help article | Resource → signup/download | Planned |
| **Company** | About; contact; careers; trust/security | Legal; contact; status | Contact/demo request | Partial |
| **Sign in / Get started** | Login; registration; onboarding | Workspace chooser | Account → workspace type → brand → channels → invite → first campaign | Shipped/Partial |

## 8. Modularisation plan

### 8.1 Domain modules and ownership

| Module | Owns | Must not own | Key dependencies |
|---|---|---|---|
| Identity & Tenancy | profiles, memberships, roles, active workspace, entitlements | campaign/business data | Supabase Auth, RLS, audit |
| Strategy | objectives, ICPs, research, plans, channel strategy | publications or ad-provider state | Campaigns, Finance, Analytics |
| Campaigns | campaign hierarchy, briefs, tasks, deliverables, approvals | raw media files, payment settlement | Calendar, Studio, UGC, Finance |
| Studio & DAM | drafts, templates, brand kits, media, versions, licences | campaign strategy and ad accounts | Storage, Brand, AI |
| Social & Inbox | channel connections, publication jobs, conversations, mentions | customer master record | Provider adapters, Automations |
| Ads | ad account mappings, sync snapshots, creative/ad workflow | raw attribution truth | Provider adapters, Analytics, Finance |
| Messaging & Journeys | consent-aware sends, templates, segments, workflow runs | global contact identity source | Leads, provider adapters, Automations |
| Web & Conversion | pages/forms, experiment variants, conversion events | general site builder | Leads, Analytics, Consent |
| SEO & Discovery | keyword/workflow data, listings, rank snapshots | crawler infrastructure replacement | Search/local integrations, Marketplace |
| Creators & UGC | creator records, briefs, submissions, rights, payments requests | supplier settlement | Campaigns, Marketplace, Finance |
| Marketplace & Supplier | supplier identity, shopfront, listings, order workflow, reviews/disputes | payment processor ledger | Payments, contracts, messaging, verification |
| Partnerships | programmes, attribution links/codes, rewards/commissions | core billing | Leads, Finance, Analytics |
| PR, Community & Events | media, communities, events, sponsorship promotion | event operational delivery | Campaigns, Gala Dock connector, Analytics |
| Leads & Audiences | contacts, consent, segments, scores | Orbas CRM master record | Orbas connector, Messaging, Web |
| Finance & Attribution | budgets, costs, POs, invoices, commission records, attribution models | payment token storage | Payments, Ads, Analytics |
| Automations & Fox Copilot | triggers, actions, run history, tool permissions, approvals | direct bypass of module permissions | Every module's typed service API |
| Analytics & Reporting | metric contracts, aggregate marts, reports | source-of-truth operational mutation | Events, warehouses/providers |

### 8.2 Code and integration boundaries

| Boundary | Required implementation rule |
|---|---|
| Routes | Organise by domain under `src/app/campaign-manager`, `src/app/supplier`, `src/app/portal`, `src/app/admin` and `src/app/marketplace`; retain redirects from legacy `/app` paths during migration. |
| UI | Reusable primitives in `src/components/ui`; domain components in `src/components/<domain>`; shells own navigation only. Avoid page-local copies of cards, tabs, tables and status badges. |
| Services | Each domain exposes typed server-side service functions. Pages and agents call services, never issue unrestricted table writes. |
| Data | Every tenant table includes workspace ownership, timestamps and an audit relation. Cross-workspace sharing uses explicit grants, never guessed access. |
| Provider adapters | One adapter per provider (`publish`, `fetch`, `validate`, `webhook`) behind a shared interface; provider data is a synchronised snapshot with source timestamps. |
| Jobs | Long-running imports, publishing, reporting, AI and automations run in queue/edge workers with idempotency keys, retries and run logs. |
| Events | Emit typed events (`campaign.created`, `asset.approved`, `lead.converted`, `order.delivered`) to power notifications, automations and analytics. |
| Permissions | RBAC plus resource-level grants for client, creator, supplier and portal access. Copilot gets the caller's least privilege, never service-role authority. |
| Feature flags | Each new module has entitlement, rollout cohort and kill switch. Nav only renders a feature after its flag and release checklist pass. |

### 8.3 Fox Copilot / agent contract

Fox is an accountable campaign copilot, not a chat-only widget. It needs: context retrieval from the active workspace; explicit tool permissions; preview-before-write; approval gates for publishing, spend, external messages and contract/payment actions; run/audit history; citations to source records; cost/usage limits; and human escalation. Initial tools: create brief, generate campaign plan, create content variants, prepare calendar draft, summarise analytics, identify missing approvals and draft—not send—supplier/client messages.

## 9. Full progress tracker

| Workstream | Deliverable | Current state | Phase | Required before release |
|---|---|---:|---|---|
| Foundation | Active workspace, RLS review, role model, audit events | Partial | P0 | Security test suite and tenant-isolation audit |
| Foundation | Error boundaries, real notifications, command search | Partial | P0 | Functional route/control audit |
| Foundation | Entitlements, usage metering, billing lifecycle | Partial | P0 | Stripe/webhook reconciliation and support paths |
| Navigation | Grouped compact Campaign Manager sidebar | Shipped | P0 | Keep routes accurate; add feature gating |
| Navigation | `/campaign-manager` canonical migration | Partial | P0 | Redirect map, telemetry, link migration |
| Navigation | Workspace switcher incl. supplier | Partial | P0 | Persisted selection and real membership tests |
| Strategy | Objectives, research, ICPs, positioning, plans | Planned | P1 | Strategy schema and campaign relationships |
| Campaigns | Campaign detail consolidation and approvals | Partial | P1 | Real persistence, role checks and audit |
| Calendar | Views, filters, publishing queue, scheduling truth | Partial | P1 | Provider jobs and failure/retry state |
| Studio | Composer, AI, canvas/drag-drop, DAM, brand grounding | Partial | P1–P2 | Versioning, rights, AI safety, usability testing |
| Social | Connected publishing, engagement and listening | Partial | P1–P2 | Provider approval, scopes, ingestion, rate limits |
| Marketplace | Public discover/search, supplier profiles/listings | Partial | P1 | Search, verification policy and honest copy |
| Supplier | Dashboard, listings, orders, profile, payouts/disputes | Partial | P1 | Supplier RLS, fulfilment and KYC/payment gate |
| Marketplace | Quotes, contracts, escrow, payout, reviews/disputes | Gate | P2 | Stripe Connect/legal policy/KYC/webhooks/ops runbook |
| Creators | CRM, briefs, submissions, rights and creator portal | Partial | P2 | Rights contracts, payments, portal grants |
| Ads | Paid social/search/display/video management | Planned | P2 | Provider adapters, spend controls, approvals |
| Email/Messaging | Email, SMS, WhatsApp, RCS, push and deliverability | Planned | P2 | Consent/suppression, provider contracts and compliance |
| Leads | Contacts, segments, consent, scoring, Orbas connector | Planned | P2 | Source-of-truth agreement and data processing terms |
| Automations | Visual drag/drop canvas, recipes, runs, monitoring | Planned | P3 | Typed events, queue, idempotency, permission model |
| Fox Copilot | Tool-using agent with approval rails | Partial | P3 | Tool registry, audit, cost caps and evaluations |
| Web Conversion | Landing pages, forms, funnels, A/B tests | Planned | P3 | Consent, analytics event contract, secure publishing |
| SEO & Local | Keywords, briefs, listings, rankings, AI-search visibility | Planned | P4 | Integration-first MVP and data-quality policy |
| Partnerships | Affiliates, referrals, ambassadors, loyalty, resellers | Partial | P4 | Attribution, reward rules, fraud and tax controls |
| PR/Reputation | Press, media, reviews, crisis and coverage | Planned | P4 | Moderation/escalation policy and listening feeds |
| Community | Groups, moderation, health, advocacy | Planned | P4 | Community permissions and moderation workflow |
| Events | Webinars, sponsorships, launches, Gala Dock connector | Planned | P4 | Registration/attribution contract and connector |
| Offline | Print, OOH, radio, TV, field and QR campaigns | Planned | P4 | Supplier briefs, evidence capture and measurement model |
| Localisation | Markets, translations, regional approvals/compliance | Planned | P4 | Locale/currency/timezone and approval model |
| Finance | Budget, POs, invoice/commission and profitability | Planned | P4 | Accounting/payment integrations and approval policy |
| Analytics | Attribution, ROAS, ROMI, CAC/LTV, reports | Partial | P4 | Metric dictionary and source reconciliation |
| Enterprise | SSO, SCIM, advanced roles, retention, legal holds | Planned | P5 | Security review and enterprise support model |
| Admin | Build-or-hide admin destinations and drill-downs | Partial | P0–P5 | Each route has operational owner, actions and audit |
| Public | Product/Solutions/Marketplace/Search/Resources IA | Partial | P1 | SEO copy, no false claims and conversion measurement |

## 10. Release sequence

1. **P0 — Trust and navigation:** close tenant, permission, billing, notification, search and navigation truth gaps; hide unbuilt admin/modules.
2. **P1 — Campaign operating system and supplier beta:** Strategy, clean campaign/calendar/studio workflow, DAM basics, marketplace discovery, supplier shopfront/listings/orders, real demo provisioning.
3. **P2 — Acquisition and collaboration:** creators/UGC portal, safe marketplace transaction preparation, paid advertising, email/messaging, leads/audiences.
4. **P3 — Intelligent operation:** drag-and-drop content canvas, automation builder, workflow jobs, permissioned Fox agent, landing pages/forms.
5. **P4 — Full marketing coverage:** SEO/local/AI search, partnerships, PR, community, events, offline, localisation, finance and attribution.
6. **P5 — Enterprise scale:** SSO/SCIM, governance, regional controls, advanced observability and platform administration.

## 11. Definition of done for every module

A module only changes from Planned/Partial to Shipped when it has: a named owner; routes and responsive UI; schema and RLS tests; permission and feature-gate checks; empty/loading/error states; audit events; analytics events; accessibility checks; realistic demo data; documentation; provider/webhook retry behaviour where applicable; and marketing copy that reflects the real capability.

## 12. Canonical route contract and migration map

The product must have one canonical route per resource. This is important for deep links, notifications, Copilot citations, public sharing, analytics and access control. Existing `/app` URLs remain supported redirects until migration completes; they are not a second product.

| Domain | Canonical collection route | Canonical detail route | Nested routes / actions | Legacy compatibility |
|---|---|---|---|---|
| Campaign Manager shell | `/campaign-manager` | n/a | `/home`, `/settings`, `/notifications`, `/search` | `/app` redirects to `/campaign-manager`; `/app/home` remains supported |
| Strategy | `/campaign-manager/strategy/{objectives,audiences,research,plans}` | `/campaign-manager/strategy/plans/[planId]` | `/messages`, `/budget`, `/risks`, `/campaigns`, `/audit` | New |
| Campaigns | `/campaign-manager/campaigns` | `/campaign-manager/campaigns/[campaignId]` | `/brief`, `/content`, `/tasks`, `/budget`, `/assets`, `/results`, `/audit` | `/app/campaigns/**` |
| Calendar | `/campaign-manager/calendar` | `/campaign-manager/calendar/items/[publicationId]` | `/content`, `/approvals`, `/history`, `/delivery` | `/app/calendar/**` |
| Studio | `/campaign-manager/studio/{compose,generate,ideas,templates,hashtags,media}` | `/campaign-manager/studio/content/[contentId]` | `/variants`, `/canvas`, `/approvals`, `/versions`, `/rights` | `/app/studio/**`; no duplicate template/hashtag homes |
| Brand & assets | `/campaign-manager/brand/{kits,assets,rights}` | `/campaign-manager/brand/assets/[assetId]` | `/versions`, `/usage`, `/licence`, `/audit` | Existing brand detail can redirect |
| Social | `/campaign-manager/social/{publishing,engagement,listening}` | `/campaign-manager/social/connections/[connectionId]` | `/posts`, `/audience`, `/scopes`, `/health`, `/logs` | Existing publishing/listening routes redirect |
| Advertising | `/campaign-manager/advertising/{accounts,campaigns,creatives,audiences}` | `/campaign-manager/advertising/campaigns/[adCampaignId]` | `/targeting`, `/creative`, `/budget`, `/results`, `/changes` | New |
| Messaging | `/campaign-manager/messaging/{email,sms,whatsapp,rcs,push,journeys}` | `/campaign-manager/messaging/journeys/[journeyId]` | `/canvas`, `/audience`, `/runs`, `/conversions`, `/settings` | New |
| Web & conversion | `/campaign-manager/web/{pages,forms,funnels,experiments}` | `/campaign-manager/web/pages/[pageId]` | `/builder`, `/variants`, `/forms`, `/analytics`, `/settings` | New |
| Marketplace | `/marketplace` and `/marketplace/search` | `/marketplace/[supplierSlug]`; `/marketplace/listings/[listingSlug]` | `/services`, `/portfolio`, `/reviews`, `/policies`; authenticated request/order room | Current public marketplace routes retained |
| Supplier workspace | `/supplier` | `/supplier/orders/[orderId]`; `/supplier/listings/[listingId]` | `/scope`, `/messages`, `/deliveries`, `/payment`, `/dispute`, `/audit` | Current supplier paths retained |
| Portals | `/portal/[portalToken]` | `/portal/[portalToken]/campaigns/[campaignId]` | Content is scoped by signed grant, not a workspace cookie | New |
| Admin | `/admin/{workspaces,users,support}` | `/admin/workspaces/[workspaceId]`; `/admin/users/[userId]` | Other admin routes appear only after shipped | Current built routes retained |

### Route and link rules

1. A resource identifier is never inferred from its display name. Use an immutable ID internally and a unique public slug only where public discovery is intended.
2. Every redirect preserves the query string and provides a redirect telemetry event. Retire a legacy route only after its traffic is below an agreed threshold.
3. Detail pages must resolve the caller's workspace or portal grant on the server before loading data. A client-selected workspace cookie is a preference, not authorisation.
4. Public supplier and listing pages expose only publish-approved information. Payout status, buyer details, disputes, private files and internal notes never cross into public payloads.

## 13. Permission matrix and access model

### 13.1 Internal workspace roles

| Capability | Owner | Admin | Marketer | Creator | Analyst | Approver | Viewer |
|---|---:|---:|---:|---:|---:|---:|---:|
| Manage workspace, billing and roles | Yes | Yes | No | No | No | No | No |
| Create/edit strategy and campaigns | Yes | Yes | Yes | Limited assigned work | No | Comment only | No |
| Create/edit content and schedule drafts | Yes | Yes | Yes | Yes | No | Review only | No |
| Approve content or budget | Yes | Configurable | Configurable | No | No | Yes | No |
| Connect channels or ad accounts | Yes | Configurable | No | No | No | No | No |
| Publish/send/spend | Yes | Configurable | Configurable | No | No | No | No |
| View analytics and reports | Yes | Yes | Yes | Assigned only | Yes | Shared only | Shared only |
| View/edit finance | Yes | Configurable | Budget-limited | No | Read only | No | No |
| Use Fox write tools | Yes | Configurable | Configurable | Limited drafts | Read-only analysis | No | No |

### 13.2 External and operational roles

| Role | Minimum access envelope | Forbidden actions |
|---|---|---|
| Client portal user | Explicit campaigns, approval items, shared reports/files | Workspace members, other clients, raw billing, channel credentials |
| Creator/influencer | Invited brief, own submission, granted rights/payment data | Other creators, campaign budget, unpublished strategy |
| Supplier | Own shopfront, listings, assigned order rooms, own payouts | Buyer workspace data, other supplier records, payment holds not assigned to them |
| Affiliate/partner | Own programme assets, links, attributed conversions and commissions | Customer PII beyond permitted aggregation, programme configuration |
| Platform support | Time-bounded support case context with every action audited | Silent impersonation, unrestricted export, payment override |
| Platform admin | Just-in-time elevated operations with immutable audit | Routine day-to-day workspace use, unlogged service-role writes |

### 13.3 Approval policies

| Action | Default policy | Required evidence |
|---|---|---|
| Publish social post | Draft author plus approver where campaign requires it | Final asset/version, channel, scheduled time, approval record |
| Send marketing message | Consent check plus authorised sender | Audience count, suppression result, content version, test result |
| Launch/alter paid spend | Budget owner approval | Account, targeting, creative, budget cap, effective dates |
| Accept supplier delivery | Buyer/order owner | Delivered files, scope comparison, rights declaration, acceptance/revision decision |
| Release supplier funds | Payment policy + dispute/hold check | Payment provider event, accepted milestone, no open hold |
| Fox external action | Human approval by default | Tool preview, affected records, policy result, approver identity |

## 14. Core entities, lifecycles and data contracts

### 14.1 Entity ownership

| Entity | Owner module | Required relationships | Lifecycle states |
|---|---|---|---|
| Workspace / membership | Identity & Tenancy | owner profile, members, entitlement | active, suspended, archived |
| Brand kit | Brand & Assets | workspace, voice, asset library, rules | draft, active, archived |
| Objective / strategy plan | Strategy | workspace, audience, messages, channel plans, campaigns | draft, in-review, approved, active, closed |
| Campaign | Campaigns | strategy, budget, tasks, deliverables, channels, results | draft, planned, active, paused, completed, cancelled, archived |
| Content item | Studio | campaign optional, asset versions, approval, publication | idea, draft, in-review, approved, scheduled, published, failed, archived |
| Publication job | Social/Calendar | content version, connection, provider record, audit | queued, processing, published, failed, cancelled |
| Lead/contact | Leads | consent, source, segment, score, journey membership | prospect, marketing-qualified, customer, suppressed, deleted |
| Supplier/listing | Marketplace | verified supplier, package, availability, reviews | draft, review, published, paused, rejected, archived |
| Request/quote/order | Marketplace | buyer workspace, supplier, scope, milestones, payment references | requested, quoted, contracted, active, delivered, revision, accepted, disputed, closed, cancelled |
| Rights grant | Creators/Assets | creator/supplier, asset/deliverable, territory, duration, usage | proposed, pending, active, expired, revoked |
| Automation workflow/run | Automations | trigger, actions, workspace, version, actor | draft, testing, active, paused, archived / queued, running, succeeded, failed, cancelled |
| Attribution event | Analytics | source/UTM, campaign, contact anonymous ID, conversion | received, validated, attributed, reconciled, excluded |

### 14.2 Required audit event examples

| Domain | Event names that must be captured |
|---|---|
| Permission/security | `membership.invited`, `role.changed`, `portal.grant.created`, `portal.grant.revoked`, `connection.authorised` |
| Campaign/content | `campaign.created`, `brief.approved`, `content.submitted`, `content.approved`, `publication.requested`, `publication.failed` |
| Marketplace | `supplier.verified`, `listing.published`, `quote.accepted`, `order.delivered`, `delivery.accepted`, `dispute.opened`, `payout.released` |
| Messaging/ads | `audience.activated`, `message.sent`, `consent.withdrawn`, `ad.launch.requested`, `ad.budget.changed` |
| Automations/Fox | `workflow.activated`, `workflow.run.failed`, `copilot.tool.previewed`, `copilot.tool.approved`, `copilot.tool.executed` |
| Data/governance | `export.requested`, `export.completed`, `retention.applied`, `legal_hold.created`, `admin.elevation.used` |

## 15. Detailed delivery backlog by phase

### P0 - release integrity and information architecture

| ID | Build item | Exact output | Dependencies | Acceptance evidence |
|---|---|---|---|---|
| P0.1 | Workspace security audit | Inventory every table, API route, storage bucket and action against workspace/role policy | Schema and routes | Automated cross-tenant denial tests; documented exceptions = zero |
| P0.2 | Navigation truth pass | Hide/flag every unbuilt sidebar/admin item; build a route registry and redirects | Feature flags | No nav 404s; every visible link has loading/error/empty state |
| P0.3 | Canonical workspace migration | `/campaign-manager` shell, redirect map, active workspace resolver | P0.1 | Legacy links work; server authorisation ignores forged cookie |
| P0.4 | Operational UX | Notification centre, command search, page error boundaries, activity log | Event model | Keyboard search works; notification deep links resolve; errors are recoverable |
| P0.5 | Billing/usage baseline | Entitlements, rate limits, usage events, webhook reconciliation | Payments provider | Upgrade/downgrade and failed payment are safely handled |
| P0.6 | Demo provisioning | Idempotent demo workspace/supplier seed with explicit demo flag | Schema deployed, verified test user | Re-running never duplicates; demo data is isolated and removable |

### P1 - campaign system and supplier marketplace beta

| ID | Build item | Exact output | Dependencies | Acceptance evidence |
|---|---|---|---|---|
| P1.1 | Strategy module | Objectives, persona, research, positioning, channel-plan and risk records | P0.1 | A strategy can create/link campaigns and budget assumptions |
| P1.2 | Campaign detail redesign | Seven-tab detail surface with persistent campaign summary | P1.1 | Brief, tasks, assets, budget, approvals and audit are navigable without duplicate calendar/UGC tabs |
| P1.3 | Calendar and queue | Month/week/list/timeline views, saved filters and real job states | Provider adapter base | No fake published state; failed work explains retry path |
| P1.4 | Studio/DAM foundation | Content model, media library, brand kit grounding, version/approval history | Storage/RLS | Asset usage and rights visibility work from content/campaign context |
| P1.5 | Marketplace discovery | Category/service/location search, public supplier/listing/profile model, enquiry request | Marketplace schema/RLS | Public results contain only approved data and search filters are deterministic |
| P1.6 | Supplier beta workflow | Shopfront, package creation, quote/order room, delivery and basic dispute intake | P1.5 | Buyer and supplier see only their own shared order context |

### P2 - acquisition, collaboration and controlled transactions

| ID | Build item | Exact output | Dependencies | Acceptance evidence |
|---|---|---|---|---|
| P2.1 | Creator CRM and UGC | Creator profiles, briefs, submissions, rights and creator portal grants | P1.2/P1.4 | Submission version, feedback and rights trail is complete |
| P2.2 | Marketplace transaction rails | Contracts, milestones, payment hold/release, payouts, reviews and disputes | Legal, KYC, Stripe Connect | Webhooks are idempotent; disputes halt release; operations runbook tested |
| P2.3 | Paid advertising MVP | Read/report first; then guarded draft creation for selected providers | Provider approval, Finance | Spend cap, account role, approval and change log enforced |
| P2.4 | Email/messaging MVP | Email templates, consent segments, suppression, campaign send and reports | Consent model, provider | Test send, unsubscribe, bounce and complaint flows verified |
| P2.5 | Leads/audiences | Contact source, consent, segments, import/dedupe and basic scoring | P2.4 | Consent provenance visible; delete/export request path works |

### P3 - visual orchestration and agentic operation

| ID | Build item | Exact output | Dependencies | Acceptance evidence |
|---|---|---|---|---|
| P3.1 | Drag-and-drop creative canvas | Layered canvas, reusable blocks, media dropzone, resize/undo/version/export | P1.4 | Keyboard and mobile fallback; asset licensing shown before export |
| P3.2 | Automation builder | Trigger/condition/action canvas, templates, test mode, run log and retry | Typed events/jobs | A failed action is visible, retryable and never silently duplicates |
| P3.3 | Fox tool agent | Tool registry, workspace retrieval, source citations, preview/approval and cost controls | P0.1, P3.2 | Evaluation suite proves it cannot cross tenant/role/approval boundary |
| P3.4 | Conversion MVP | Landing pages, forms, tracking, experiment variants and lead handoff | Consent/analytics | Every conversion has source, consent and campaign linkage |

### P4/P5 - full marketing coverage and enterprise maturity

| ID | Build item | Exact output | Dependencies | Acceptance evidence |
|---|---|---|---|---|
| P4.1 | SEO/local/AI discovery | Workflow-first keyword, content brief, listing and visibility reporting | Provider integrations | Data source/time stated with every metric |
| P4.2 | Partnerships and reputation | Referrals/loyalty/ambassadors plus PR/reviews/crisis workflows | Attribution, moderation | Reward and disclosure audit trails are complete |
| P4.3 | Community/events/offline | Community moderation, event promotion/attribution and supplier-managed offline work | Portal/supplier/analytics | Campaign result joins digital and offline evidence |
| P4.4 | Finance and attribution | Forecast/actual, POs, commissions, ROAS/ROMI and reconciliation | Provider data, accounting decisions | Metric definitions prevent double-counting |
| P5.1 | Enterprise controls | SSO/SCIM, custom roles, retention, legal holds, regional controls | Security/compliance review | Enterprise tenant acceptance suite passes |

## 16. Marketplace safety and transaction operating model

### 16.1 Booking and fulfilment state machine

`draft request -> submitted -> supplier clarification -> quote issued -> buyer accepts -> contract accepted -> payment authorised/held -> active -> delivery submitted -> buyer accepts OR revision requested -> funds released -> closed -> review`

At any active stage a permitted party may open a dispute. `disputed` freezes the affected milestone; resolution can release, partially release, refund or cancel according to the signed policy. No UI copy may use **escrow**, **protected payment**, **guaranteed payout** or **verified** until the underlying policy and provider state are operational.

### 16.2 Required marketplace controls

| Control | Minimum implementation |
|---|---|
| Supplier verification | Clear status taxonomy: unverified, pending, verified, rejected, suspended; evidence and reviewer decision are auditable. |
| Listing moderation | Draft/review/published state, category policy checks, prohibited-service enforcement and revision path. |
| Contracting | Versioned scope, deliverables, revisions, rights, confidentiality, cancellation and tax responsibilities accepted by both sides. |
| Payments | Provider-owned tokenisation only; store provider IDs/statuses, never card data; webhook signature verification and idempotency required. |
| Disputes | Neutral evidence timeline, response deadlines, internal case owner, hold/release restrictions and outcome notice. |
| Reviews | Only completed eligible orders can review; appeal/moderation rules and rating recalculation are auditable. |
| Privacy | Buyer contact details are minimised until a legitimate order stage; public shopfront never exposes private documents. |

## 17. Test, observability and rollout plan

### Shell implementation comment (2026-07-23)

The workspace and portal structural-shell pass is now represented by the shared `CaptionFoxShell` configuration and tracker. Every configured workspace/portal navigation item has: a route-backed collection surface; its specified main-page tabs; collection/filter/action shell; fixture detail links and detail-page shell; detail-tab contract; a Create wizard with the item-specific step contract; and empty, loading, error, restricted, upgrade and archived states. The type-first demo routes are `/creator`, `/business`, `/brand`, `/agency`, `/affiliate-portal`, `/publisher-portal`, `/client-portal`, `/creator-portal`, `/buyer-portal` and `/link-page`; Supplier remains `/supplier` while its existing authenticated operational shell is migrated. These are structural shells and must not be described as live integrations, payment, publishing, provider or portal-grant workflows until their module gates pass.

| Test layer | Mandatory coverage |
|---|---|
| Unit | State machines, money calculations, consent suppression, permissions, route parsers, Copilot tool schemas |
| Integration | RLS tenant denial, provider webhook signature/idempotency, job retry, payment state transitions, storage access |
| End-to-end | Onboarding, workspace switch, campaign-to-publication, supplier request-to-delivery, approval, portal access, admin support case |
| Accessibility | Keyboard navigation, focus restoration in drawers/modals, labelled controls, contrast, mobile table alternatives |
| Performance | Dashboard/query budgets, pagination/search, media upload limits, background job throughput and failure alert thresholds |
| Security | OWASP route review, signed portal links, rate limiting, secrets scan, dependency updates, admin elevation audit |
| AI quality | Prompt/tool evaluation set, policy refusal tests, grounding/citation checks, cost and latency budgets, human feedback loop |

### Rollout rules

1. Build behind a feature flag, internal-test it, seed realistic demo data, then enable for a named pilot cohort.
2. Define a success metric and a rollback condition before enabling a production cohort.
3. Never migrate critical data without a reversible migration, backup/recovery procedure and a measured maintenance window.
4. A public marketing page may only claim the exact enabled capability; beta, provider limitations and manual-review steps must be visible where material.
