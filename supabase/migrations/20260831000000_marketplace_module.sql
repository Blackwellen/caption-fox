-- Caption Fox shared Marketplace module.
--
-- Extends the original supplier marketplace (20260630010000_marketplace.sql) into the
-- full buyer-side module: discovery taxonomy and search metrics, saved items, saved
-- searches, shortlists/comparisons, discovery requests + RFQs with proposals, and the
-- order -> milestone -> escrow -> dispute operational chain.
--
-- Buyer-side records are workspace-scoped. Seller public profiles stay user-owned and
-- publicly readable while active, exactly as the original migration modelled them.
--
-- Apply with: node scripts/apply-migration.mjs supabase/migrations/20260831000000_marketplace_module.sql

-- ---------------------------------------------------------------------------
-- 1. Supplier / creator profile enrichment used by every discovery surface
-- ---------------------------------------------------------------------------
alter table public.marketplace_suppliers
  add column if not exists tagline text,
  add column if not exists region text,
  add column if not exists country text,
  add column if not exists languages text[] default '{}',
  add column if not exists platforms text[] default '{}',
  add column if not exists tags text[] default '{}',
  add column if not exists badges text[] default '{}',
  add column if not exists starting_price_cents integer,
  add column if not exists price_unit text default 'project',
  add column if not exists min_order_cents integer,
  add column if not exists currency text not null default 'GBP',
  add column if not exists turnaround_hours integer,
  add column if not exists response_time_minutes integer,
  add column if not exists on_time_delivery_pct numeric(5,2),
  add column if not exists job_success_pct numeric(5,2),
  add column if not exists projects_count integer default 0,
  add column if not exists available_now boolean default true,
  add column if not exists audience_size integer,
  add column if not exists audience_summary text,
  add column if not exists engagement_rate numeric(5,2),
  add column if not exists follower_counts jsonb default '{}'::jsonb,
  add column if not exists portfolio_urls text[] default '{}',
  add column if not exists is_demo boolean not null default false;

create index if not exists marketplace_suppliers_type_idx on public.marketplace_suppliers (type) where status = 'active';
create index if not exists marketplace_suppliers_available_idx on public.marketplace_suppliers (available_now) where status = 'active';
create index if not exists marketplace_suppliers_tags_idx on public.marketplace_suppliers using gin (tags);
create index if not exists marketplace_suppliers_platforms_idx on public.marketplace_suppliers using gin (platforms);
create index if not exists marketplace_suppliers_search_idx on public.marketplace_suppliers
  using gin (to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(headline, '') || ' ' || coalesce(tagline, '') || ' ' || coalesce(bio, '')));

-- ---------------------------------------------------------------------------
-- 2. Category taxonomy
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.marketplace_categories (id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  accent text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_categories_parent_idx on public.marketplace_categories (parent_id, sort_order);

create table if not exists public.marketplace_supplier_categories (
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete cascade,
  category_id uuid not null references public.marketplace_categories (id) on delete cascade,
  primary key (supplier_id, category_id)
);
create index if not exists marketplace_supplier_categories_cat_idx on public.marketplace_supplier_categories (category_id);

-- ---------------------------------------------------------------------------
-- 3. Saved items, saved searches, shortlists and comparisons (workspace-scoped)
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_saved_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null check (item_type in ('supplier', 'creator', 'service')),
  supplier_id uuid references public.marketplace_suppliers (id) on delete cascade,
  listing_id uuid references public.marketplace_listings (id) on delete cascade,
  note text,
  tags text[] default '{}',
  collection text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_saved_items_target check (supplier_id is not null or listing_id is not null)
);
create unique index if not exists marketplace_saved_items_supplier_uq
  on public.marketplace_saved_items (workspace_id, user_id, supplier_id) where supplier_id is not null;
create unique index if not exists marketplace_saved_items_listing_uq
  on public.marketplace_saved_items (workspace_id, user_id, listing_id) where listing_id is not null;
create index if not exists marketplace_saved_items_ws_idx on public.marketplace_saved_items (workspace_id, item_type, created_at desc);

create table if not exists public.marketplace_saved_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  mode text not null default 'discover',
  params jsonb not null default '{}'::jsonb,
  result_count integer,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_saved_searches_ws_idx on public.marketplace_saved_searches (workspace_id, updated_at desc);

create table if not exists public.marketplace_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete cascade,
  request_id uuid,
  note text,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, supplier_id)
);

create table if not exists public.marketplace_comparisons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  mode text not null default 'discover',
  supplier_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists marketplace_comparisons_ws_idx on public.marketplace_comparisons (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Discovery requests / RFQs and supplier proposals
-- ---------------------------------------------------------------------------
create sequence if not exists public.marketplace_request_seq start 1200;

create table if not exists public.marketplace_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  reference text not null default ('REQ-' || nextval('public.marketplace_request_seq')),
  kind text not null default 'discovery' check (kind in ('discovery', 'rfq')),
  title text not null,
  category text,
  description text,
  deliverables text[] default '{}',
  required_skills text[] default '{}',
  budget_min_cents integer,
  budget_max_cents integer,
  currency text not null default 'GBP',
  deadline date,
  location text,
  languages text[] default '{}',
  supplier_type text,
  proposals_requested integer default 5,
  confidential boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'open', 'awaiting_proposals', 'shortlisted', 'closed_won', 'closed_cancelled')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists marketplace_requests_reference_uq on public.marketplace_requests (reference);
create index if not exists marketplace_requests_ws_idx on public.marketplace_requests (workspace_id, status, created_at desc);
create index if not exists marketplace_requests_deadline_idx on public.marketplace_requests (workspace_id, deadline);

create table if not exists public.marketplace_request_invites (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests (id) on delete cascade,
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'viewed', 'responded', 'declined', 'expired')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (request_id, supplier_id)
);
create index if not exists marketplace_request_invites_req_idx on public.marketplace_request_invites (request_id);

create table if not exists public.marketplace_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.marketplace_requests (id) on delete cascade,
  supplier_id uuid not null references public.marketplace_suppliers (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'GBP',
  delivery_days integer,
  message text,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'shortlisted', 'clarification', 'rejected', 'accepted', 'withdrawn')),
  capability_score numeric(5,2),
  availability_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, supplier_id)
);
create index if not exists marketplace_proposals_req_idx on public.marketplace_proposals (request_id, status);

-- ---------------------------------------------------------------------------
-- 5. Orders: workspace scoping + operational lifecycle columns
-- ---------------------------------------------------------------------------
create sequence if not exists public.marketplace_order_seq start 19100;

alter table public.marketplace_orders
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists reference text not null default ('ORD-' || nextval('public.marketplace_order_seq')),
  add column if not exists request_id uuid references public.marketplace_requests (id) on delete set null,
  add column if not exists proposal_id uuid references public.marketplace_proposals (id) on delete set null,
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists escrow_status text not null default 'pending_funding',
  add column if not exists delivery_status text not null default 'not_started',
  add column if not exists current_milestone text,
  add column if not exists due_date date,
  add column if not exists dispute_state text,
  add column if not exists released_cents integer not null default 0,
  add column if not exists refunded_cents integer not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'marketplace_orders_escrow_status_check') then
    alter table public.marketplace_orders add constraint marketplace_orders_escrow_status_check
      check (escrow_status in ('pending_funding', 'funded', 'in_escrow', 'partially_released', 'released', 'on_hold', 'refund_pending', 'refunded', 'cancelled', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'marketplace_orders_delivery_status_check') then
    alter table public.marketplace_orders add constraint marketplace_orders_delivery_status_check
      check (delivery_status in ('not_started', 'in_progress', 'pending_delivery', 'pending_review', 'delivered', 'overdue', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'marketplace_orders_dispute_state_check') then
    alter table public.marketplace_orders add constraint marketplace_orders_dispute_state_check
      check (dispute_state is null or dispute_state in ('under_review', 'awaiting_buyer', 'awaiting_seller', 'mediation', 'resolved'));
  end if;
end $$;

create unique index if not exists marketplace_orders_reference_uq on public.marketplace_orders (reference);
create index if not exists marketplace_orders_ws_idx on public.marketplace_orders (workspace_id, created_at desc);
create index if not exists marketplace_orders_escrow_idx on public.marketplace_orders (workspace_id, escrow_status);
create index if not exists marketplace_orders_delivery_idx on public.marketplace_orders (workspace_id, delivery_status);

create table if not exists public.marketplace_order_milestones (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders (id) on delete cascade,
  position integer not null default 1,
  title text not null,
  description text,
  amount_cents integer not null default 0,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'submitted', 'pending_review', 'revision_requested', 'approved', 'released', 'overdue', 'cancelled')),
  submitted_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, position)
);
create index if not exists marketplace_order_milestones_order_idx on public.marketplace_order_milestones (order_id, position);

create table if not exists public.marketplace_escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders (id) on delete cascade,
  milestone_id uuid references public.marketplace_order_milestones (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  kind text not null check (kind in ('fund', 'release', 'partial_release', 'hold', 'refund', 'partial_refund', 'cancel')),
  amount_cents integer not null,
  currency text not null default 'GBP',
  provider text,
  provider_ref text,
  idempotency_key text unique,
  state text not null default 'pending' check (state in ('pending', 'succeeded', 'failed')),
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_escrow_order_idx on public.marketplace_escrow_transactions (order_id, created_at desc);

alter table public.marketplace_disputes
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists milestone_id uuid references public.marketplace_order_milestones (id) on delete set null,
  add column if not exists amount_cents integer,
  add column if not exists severity text default 'medium',
  add column if not exists requested_resolution text,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists marketplace_disputes_ws_idx on public.marketplace_disputes (workspace_id, stage, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Marketplace activity feed
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event text not null,
  summary text not null,
  entity_type text,
  entity_id uuid,
  href text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_activity_ws_idx on public.marketplace_activity (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------------
-- public.is_workspace_member(ws uuid) is defined by 20260829000000_brand_assets.sql
-- and reused verbatim here so tenancy checks stay in one place.

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_supplier_categories enable row level security;
alter table public.marketplace_saved_items enable row level security;
alter table public.marketplace_saved_searches enable row level security;
alter table public.marketplace_shortlist_items enable row level security;
alter table public.marketplace_comparisons enable row level security;
alter table public.marketplace_requests enable row level security;
alter table public.marketplace_request_invites enable row level security;
alter table public.marketplace_proposals enable row level security;
alter table public.marketplace_order_milestones enable row level security;
alter table public.marketplace_escrow_transactions enable row level security;
alter table public.marketplace_activity enable row level security;

drop policy if exists "mkt_categories_read" on public.marketplace_categories;
create policy "mkt_categories_read" on public.marketplace_categories for select using (active);
drop policy if exists "mkt_supplier_categories_read" on public.marketplace_supplier_categories;
create policy "mkt_supplier_categories_read" on public.marketplace_supplier_categories for select using (true);

drop policy if exists "mkt_saved_items_own" on public.marketplace_saved_items;
create policy "mkt_saved_items_own" on public.marketplace_saved_items for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "mkt_saved_searches_own" on public.marketplace_saved_searches;
create policy "mkt_saved_searches_own" on public.marketplace_saved_searches for all
  using (public.is_workspace_member(workspace_id) and (user_id = auth.uid() or shared))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "mkt_shortlist_own" on public.marketplace_shortlist_items;
create policy "mkt_shortlist_own" on public.marketplace_shortlist_items for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "mkt_comparisons_own" on public.marketplace_comparisons;
create policy "mkt_comparisons_own" on public.marketplace_comparisons for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "mkt_requests_workspace" on public.marketplace_requests;
create policy "mkt_requests_workspace" on public.marketplace_requests for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "mkt_requests_invited_supplier" on public.marketplace_requests;
create policy "mkt_requests_invited_supplier" on public.marketplace_requests for select using (
  status <> 'draft' and id in (
    select request_id from public.marketplace_request_invites
    where supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);

drop policy if exists "mkt_request_invites_party" on public.marketplace_request_invites;
create policy "mkt_request_invites_party" on public.marketplace_request_invites for select using (
  request_id in (select id from public.marketplace_requests where public.is_workspace_member(workspace_id))
  or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
);
drop policy if exists "mkt_request_invites_buyer_write" on public.marketplace_request_invites;
create policy "mkt_request_invites_buyer_write" on public.marketplace_request_invites for all
  using (request_id in (select id from public.marketplace_requests where public.is_workspace_member(workspace_id)))
  with check (request_id in (select id from public.marketplace_requests where public.is_workspace_member(workspace_id)));

drop policy if exists "mkt_proposals_buyer" on public.marketplace_proposals;
create policy "mkt_proposals_buyer" on public.marketplace_proposals for select using (
  request_id in (select id from public.marketplace_requests where public.is_workspace_member(workspace_id))
  or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
);
drop policy if exists "mkt_proposals_buyer_update" on public.marketplace_proposals;
create policy "mkt_proposals_buyer_update" on public.marketplace_proposals for update
  using (request_id in (select id from public.marketplace_requests where public.is_workspace_member(workspace_id)));
drop policy if exists "mkt_proposals_supplier_write" on public.marketplace_proposals;
create policy "mkt_proposals_supplier_write" on public.marketplace_proposals for insert
  with check (supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid()));

drop policy if exists "mkt_orders_workspace" on public.marketplace_orders;
create policy "mkt_orders_workspace" on public.marketplace_orders for select
  using (workspace_id is not null and public.is_workspace_member(workspace_id));
drop policy if exists "mkt_orders_workspace_update" on public.marketplace_orders;
create policy "mkt_orders_workspace_update" on public.marketplace_orders for update
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

drop policy if exists "mkt_milestones_party" on public.marketplace_order_milestones;
create policy "mkt_milestones_party" on public.marketplace_order_milestones for select using (
  order_id in (
    select id from public.marketplace_orders
    where (workspace_id is not null and public.is_workspace_member(workspace_id))
       or buyer_id = auth.uid()
       or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);
drop policy if exists "mkt_milestones_party_write" on public.marketplace_order_milestones;
create policy "mkt_milestones_party_write" on public.marketplace_order_milestones for update using (
  order_id in (
    select id from public.marketplace_orders
    where (workspace_id is not null and public.is_workspace_member(workspace_id))
       or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);

drop policy if exists "mkt_escrow_party" on public.marketplace_escrow_transactions;
create policy "mkt_escrow_party" on public.marketplace_escrow_transactions for select using (
  order_id in (
    select id from public.marketplace_orders
    where (workspace_id is not null and public.is_workspace_member(workspace_id))
       or buyer_id = auth.uid()
       or supplier_id in (select id from public.marketplace_suppliers where user_id = auth.uid())
  )
);

drop policy if exists "mkt_activity_workspace" on public.marketplace_activity;
create policy "mkt_activity_workspace" on public.marketplace_activity for select
  using (public.is_workspace_member(workspace_id));
drop policy if exists "mkt_activity_workspace_insert" on public.marketplace_activity;
create policy "mkt_activity_workspace_insert" on public.marketplace_activity for insert
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

drop policy if exists "mkt_disputes_workspace" on public.marketplace_disputes;
create policy "mkt_disputes_workspace" on public.marketplace_disputes for select using (
  order_id in (select id from public.marketplace_orders where workspace_id is not null and public.is_workspace_member(workspace_id))
);

-- ---------------------------------------------------------------------------
-- 8. Seed the category taxonomy (reference data, not demo content)
-- ---------------------------------------------------------------------------
insert into public.marketplace_categories (slug, name, description, icon, accent, sort_order) values
  ('influencers', 'Influencers', 'Connect with social media influencers across all platforms', 'megaphone', 'violet', 1),
  ('ugc-creators', 'UGC Creators', 'User-generated content creators for authentic brand content', 'users', 'blue', 2),
  ('video-editing', 'Video Editing', 'Professional video editing and post-production services', 'video', 'red', 3),
  ('graphic-design', 'Graphic Design', 'Logos, branding, illustrations and visual design', 'palette', 'emerald', 4),
  ('seo', 'SEO', 'Search engine optimisation and organic growth services', 'trending-up', 'amber', 5),
  ('paid-media', 'Paid Media', 'PPC, social ads and paid advertising campaigns', 'badge-dollar-sign', 'blue', 6),
  ('copywriting', 'Copywriting', 'Website copy, ad copy and content writing services', 'pen-line', 'violet', 7),
  ('web-development', 'Web Development', 'Websites, platforms and web applications', 'code', 'slate', 8),
  ('voice-over', 'Voice Over', 'Professional voice over and audio production', 'mic', 'red', 9),
  ('social-media-management', 'Social Media Management', 'End-to-end channel management and community', 'radio', 'emerald', 10),
  ('photography', 'Photography', 'Product, lifestyle and brand photography', 'camera', 'amber', 11),
  ('animation', 'Animation', 'Motion graphics, 2D and 3D animation', 'clapperboard', 'violet', 12)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  accent = excluded.accent,
  sort_order = excluded.sort_order;
