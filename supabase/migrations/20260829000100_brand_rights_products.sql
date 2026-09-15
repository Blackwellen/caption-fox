-- ============================================================================
-- Brand & Assets — Rights / Licensing and Product Library
--
-- Depends on 20260829000000_brand_assets.sql (is_workspace_member, asset extension).
-- ============================================================================

-- ============================================================================
-- REFERENCE DATA: territories and channels
-- Seeded globally (workspace_id null) and extendable per workspace.
-- ============================================================================
create table if not exists public.rights_territories (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  region text,
  iso_codes text[] default '{}',
  created_at timestamptz not null default now()
);
alter table public.rights_territories enable row level security;
drop policy if exists "rights_territories_read" on public.rights_territories;
create policy "rights_territories_read" on public.rights_territories for select
  using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists "rights_territories_write" on public.rights_territories;
create policy "rights_territories_write" on public.rights_territories for all
  using (workspace_id is not null and public.is_workspace_member(workspace_id));
create unique index if not exists idx_territories_code on public.rights_territories(coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

create table if not exists public.rights_channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.rights_channels enable row level security;
drop policy if exists "rights_channels_read" on public.rights_channels;
create policy "rights_channels_read" on public.rights_channels for select
  using (workspace_id is null or public.is_workspace_member(workspace_id));
drop policy if exists "rights_channels_write" on public.rights_channels;
create policy "rights_channels_write" on public.rights_channels for all
  using (workspace_id is not null and public.is_workspace_member(workspace_id));
create unique index if not exists idx_channels_code on public.rights_channels(coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

-- ============================================================================
-- LICENCES
-- ============================================================================
create table if not exists public.rights_licenses (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  asset_id uuid references public.media_assets(id) on delete cascade,
  product_id uuid,                          -- FK added after products exists
  name text not null,
  reference text,
  license_type text not null default 'standard'
    check (license_type in ('exclusive','standard','non_exclusive','campaign','royalty_free','design','trademark','video','image','music','other')),
  licensor text,
  licensee text,
  status text not null default 'draft'
    check (status in ('draft','pending','active','expiring_soon','expired','restricted','suspended','renewal_pending','cancelled')),
  starts_on date,
  expires_on date,
  renewal_due_on date,
  usage_scope text,
  exclusivity boolean not null default false,
  modification_allowed boolean not null default true,
  distribution_limit text,
  risk_level text default 'low' check (risk_level in ('low','medium','high')),
  owner_id uuid references public.profiles(id),
  notes text,
  reminder_days integer[] default '{90,30,7}',
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint rights_licenses_date_order check (expires_on is null or starts_on is null or expires_on >= starts_on)
);
alter table public.rights_licenses enable row level security;
drop policy if exists "rights_licenses_workspace" on public.rights_licenses;
create policy "rights_licenses_workspace" on public.rights_licenses for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_licenses_ws_status on public.rights_licenses(workspace_id, status);
create index if not exists idx_licenses_expiry on public.rights_licenses(workspace_id, expires_on);
create index if not exists idx_licenses_asset on public.rights_licenses(asset_id);
create index if not exists idx_licenses_brand on public.rights_licenses(brand_id);
create index if not exists idx_licenses_renewal on public.rights_licenses(workspace_id, renewal_due_on) where renewal_due_on is not null;

-- Licence <-> territory (many-to-many)
create table if not exists public.rights_license_territories (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  license_id uuid not null references public.rights_licenses(id) on delete cascade,
  territory_id uuid not null references public.rights_territories(id) on delete cascade,
  is_excluded boolean not null default false,
  unique(license_id, territory_id)
);
alter table public.rights_license_territories enable row level security;
drop policy if exists "license_territories_workspace" on public.rights_license_territories;
create policy "license_territories_workspace" on public.rights_license_territories for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_lic_terr_license on public.rights_license_territories(license_id);

-- Licence <-> channel (many-to-many)
create table if not exists public.rights_license_channels (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  license_id uuid not null references public.rights_licenses(id) on delete cascade,
  channel_id uuid not null references public.rights_channels(id) on delete cascade,
  is_excluded boolean not null default false,
  unique(license_id, channel_id)
);
alter table public.rights_license_channels enable row level security;
drop policy if exists "license_channels_workspace" on public.rights_license_channels;
create policy "license_channels_workspace" on public.rights_license_channels for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_lic_chan_license on public.rights_license_channels(license_id);

-- Signed agreements backing a licence
create table if not exists public.rights_agreements (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  license_id uuid not null references public.rights_licenses(id) on delete cascade,
  title text not null,
  asset_id uuid references public.media_assets(id) on delete set null,
  signed_on date,
  expires_on date,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.rights_agreements enable row level security;
drop policy if exists "rights_agreements_workspace" on public.rights_agreements;
create policy "rights_agreements_workspace" on public.rights_agreements for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_agreements_license on public.rights_agreements(license_id);

-- Renewal workflow
create table if not exists public.rights_renewals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  license_id uuid not null references public.rights_licenses(id) on delete cascade,
  due_on date not null,
  status text not null default 'pending'
    check (status in ('pending','in_progress','approved','completed','declined','cancelled')),
  assigned_to uuid references public.profiles(id),
  new_terms text,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rights_renewals enable row level security;
drop policy if exists "rights_renewals_workspace" on public.rights_renewals;
create policy "rights_renewals_workspace" on public.rights_renewals for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_renewals_ws_due on public.rights_renewals(workspace_id, due_on);

-- Detected rights conflicts (written by the conflict scanner, surfaced as High-Risk Assets)
create table if not exists public.rights_conflicts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid references public.media_assets(id) on delete cascade,
  license_id uuid references public.rights_licenses(id) on delete cascade,
  product_id uuid,
  conflict_type text not null
    check (conflict_type in ('outside_territory','unauthorised_channel','expired_licence','no_licence',
                            'incompatible_product','campaign_outside_period','modification_prohibited',
                            'exclusivity_clash','missing_agreement','expired_agreement','scope_exceeded')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  detail text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  detected_at timestamptz not null default now()
);
alter table public.rights_conflicts enable row level security;
drop policy if exists "rights_conflicts_workspace" on public.rights_conflicts;
create policy "rights_conflicts_workspace" on public.rights_conflicts for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_conflicts_ws_open on public.rights_conflicts(workspace_id, severity) where resolved_at is null;

-- ============================================================================
-- PRODUCT LIBRARY
-- ============================================================================
create table if not exists public.product_categories (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(workspace_id, slug)
);
alter table public.product_categories enable row level security;
drop policy if exists "product_categories_workspace" on public.product_categories;
create policy "product_categories_workspace" on public.product_categories for all
  using (public.is_workspace_member(workspace_id));

create table if not exists public.product_collections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(workspace_id, slug)
);
alter table public.product_collections enable row level security;
drop policy if exists "product_collections_workspace" on public.product_collections;
create policy "product_collections_workspace" on public.product_collections for all
  using (public.is_workspace_member(workspace_id));

create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  collection_id uuid references public.product_collections(id) on delete set null,
  name text not null,
  sku text not null,
  description text,
  product_line text,
  status text not null default 'draft'
    check (status in ('draft','review','active','inactive','archived','discontinued')),
  primary_asset_id uuid references public.media_assets(id) on delete set null,
  readiness_score numeric(5,2) not null default 0,
  readiness_state text not null default 'not_ready'
    check (readiness_state in ('ready','review','not_ready')),
  owner_id uuid references public.profiles(id),
  is_favourite boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(workspace_id, sku)
);
alter table public.products enable row level security;
drop policy if exists "products_workspace" on public.products;
create policy "products_workspace" on public.products for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_products_ws_status on public.products(workspace_id, status);
create index if not exists idx_products_ws_updated on public.products(workspace_id, updated_at desc);
create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_readiness on public.products(workspace_id, readiness_state);

-- Now that products exists, wire the deferred licence/conflict FKs.
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'rights_licenses_product_fk') then
    alter table public.rights_licenses add constraint rights_licenses_product_fk
      foreign key (product_id) references public.products(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rights_conflicts_product_fk') then
    alter table public.rights_conflicts add constraint rights_conflicts_product_fk
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end
$fk$;

-- Variants / SKUs
create table if not exists public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  name text not null,
  attributes jsonb not null default '{}',
  status text not null default 'active'
    check (status in ('draft','active','inactive','discontinued')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, sku)
);
alter table public.product_variants enable row level security;
drop policy if exists "product_variants_workspace" on public.product_variants;
create policy "product_variants_workspace" on public.product_variants for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_variants_product on public.product_variants(product_id);

-- Markets a product is sold into
create table if not exists public.product_markets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  market_code text not null,
  language text,
  is_localised boolean not null default false,
  launched_on date,
  unique(product_id, market_code)
);
alter table public.product_markets enable row level security;
drop policy if exists "product_markets_workspace" on public.product_markets;
create policy "product_markets_workspace" on public.product_markets for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_markets_product on public.product_markets(product_id);

-- Product <-> asset links, typed by role
create table if not exists public.product_assets (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  link_type text not null default 'other'
    check (link_type in ('primary_image','packshot','lifestyle','video','three_sixty','packaging','spec_sheet','social','presentation','localised','other')),
  is_primary boolean not null default false,
  market_code text,
  language text,
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  linked_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- Expression uniqueness must be an index, not a table constraint: one link per
-- (product, asset, role, market) with NULL market treated as a single slot.
create unique index if not exists idx_product_assets_unique
  on public.product_assets(product_id, asset_id, link_type, coalesce(market_code, ''));
alter table public.product_assets enable row level security;
drop policy if exists "product_assets_workspace" on public.product_assets;
create policy "product_assets_workspace" on public.product_assets for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_product_assets_product on public.product_assets(product_id);
create index if not exists idx_product_assets_asset on public.product_assets(asset_id);

-- Transparent readiness checks — never a random percentage.
create table if not exists public.product_readiness_checks (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  check_key text not null
    check (check_key in ('primary_image','lifestyle_image','packshot','product_video','description',
                        'localisation','brand_compliance','rights_coverage','required_metadata',
                        'approved_assets','market_data')),
  passed boolean not null default false,
  detail text,
  weight numeric(5,2) not null default 1,
  evaluated_at timestamptz not null default now(),
  unique(product_id, check_key)
);
alter table public.product_readiness_checks enable row level security;
drop policy if exists "product_readiness_workspace" on public.product_readiness_checks;
create policy "product_readiness_workspace" on public.product_readiness_checks for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_readiness_product on public.product_readiness_checks(product_id);

-- ============================================================================
-- MODULE ACTIVITY AND ALERTS
-- ============================================================================
create table if not exists public.brand_activity (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  actor_id uuid references public.profiles(id),
  entity_type text not null
    check (entity_type in ('brand','brand_kit','asset','folder','collection','license','agreement','product','usage_request','approval')),
  entity_id uuid,
  action text not null,
  summary text not null,
  href text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.brand_activity enable row level security;
drop policy if exists "brand_activity_workspace" on public.brand_activity;
create policy "brand_activity_workspace" on public.brand_activity for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_brand_activity_ws on public.brand_activity(workspace_id, created_at desc);
create index if not exists idx_brand_activity_entity on public.brand_activity(entity_type, entity_id);

create table if not exists public.brand_alerts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  alert_type text not null
    check (alert_type in ('rights_expiring','pending_approvals','guideline_update','compliance_change',
                          'missing_product_assets','storage_quota','licence_expired','agreement_missing')),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  body text,
  href text,
  entity_type text,
  entity_id uuid,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.brand_alerts enable row level security;
drop policy if exists "brand_alerts_workspace" on public.brand_alerts;
create policy "brand_alerts_workspace" on public.brand_alerts for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_brand_alerts_open on public.brand_alerts(workspace_id, severity, created_at desc) where resolved_at is null;

-- ============================================================================
-- STORAGE QUOTA per workspace (drives the Storage Overview panel)
-- ============================================================================
create table if not exists public.workspace_storage (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  bytes_used bigint not null default 0,
  bytes_quota bigint not null default 2199023255552,   -- 2 TB default
  asset_count integer not null default 0,
  recalculated_at timestamptz not null default now()
);
alter table public.workspace_storage enable row level security;
drop policy if exists "workspace_storage_workspace" on public.workspace_storage;
create policy "workspace_storage_workspace" on public.workspace_storage for all
  using (public.is_workspace_member(workspace_id));

-- ============================================================================
-- GLOBAL REFERENCE SEED — territories and channels
-- ============================================================================
insert into public.rights_territories (workspace_id, code, name, region, iso_codes) values
  (null, 'worldwide',     'Worldwide',      'Global',        '{}'),
  (null, 'north_america', 'North America',  'Americas',      '{US,CA,MX}'),
  (null, 'emea',          'EMEA',           'Europe',        '{GB,DE,FR,ES,IT,NL,SE,AE,ZA}'),
  (null, 'europe',        'Europe',         'Europe',        '{GB,DE,FR,ES,IT,NL,SE,PL,IE}'),
  (null, 'apac',          'Asia Pacific',   'Asia Pacific',  '{AU,NZ,JP,SG,KR,IN}'),
  (null, 'latam',         'Latin America',  'Americas',      '{BR,AR,CL,CO,MX}'),
  (null, 'uk',            'United Kingdom', 'Europe',        '{GB}'),
  (null, 'us',            'United States',  'Americas',      '{US}')
on conflict do nothing;

insert into public.rights_channels (workspace_id, code, name) values
  (null, 'all',           'All Channels'),
  (null, 'digital',       'Digital'),
  (null, 'social',        'Social'),
  (null, 'web',           'Web'),
  (null, 'ads',           'Paid Advertising'),
  (null, 'ecommerce',     'E-commerce'),
  (null, 'retail',        'Retail'),
  (null, 'packaging',     'Packaging'),
  (null, 'print',         'Print'),
  (null, 'ooh',           'Out of Home'),
  (null, 'broadcast',     'Broadcast'),
  (null, 'email',         'Email'),
  (null, 'internal',      'Internal Use')
on conflict do nothing;
