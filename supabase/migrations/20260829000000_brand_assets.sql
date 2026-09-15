-- ============================================================================
-- Brand & Assets module
-- Brand kits, digital asset governance, rights/licensing, product library.
--
-- Extends rather than duplicates: media_assets becomes the canonical DAM asset
-- table, brands gains family/status/ownership. No parallel asset table.
--
-- RLS follows the established project pattern:
--   workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
-- wrapped in is_workspace_member() so policies stay readable.
-- ============================================================================

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$fn$;

-- Role of the caller within a workspace (null when not a member).
create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid()
  limit 1;
$fn$;

-- ============================================================================
-- BRAND FAMILIES  (a workspace may group brands: house brands, client brands)
-- ============================================================================
create table if not exists public.brand_families (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(workspace_id, slug)
);
alter table public.brand_families enable row level security;
drop policy if exists "brand_families_workspace" on public.brand_families;
create policy "brand_families_workspace" on public.brand_families for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_brand_families_workspace on public.brand_families(workspace_id);

-- Brands gain family membership, governance status and an explicit owner.
alter table public.brands add column if not exists family_id uuid references public.brand_families(id) on delete set null;
alter table public.brands add column if not exists status text not null default 'active';
alter table public.brands add column if not exists owner_id uuid references public.profiles(id);
alter table public.brands add column if not exists archived_at timestamptz;
alter table public.brands add column if not exists is_demo boolean not null default false;
create index if not exists idx_brands_family on public.brands(family_id);

-- ============================================================================
-- BRAND KITS
-- ============================================================================
create table if not exists public.brand_kits (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','review','active','archived')),
  approval_status text not null default 'none'
    check (approval_status in ('none','pending','changes_requested','approved','rejected')),
  logo_asset_id uuid,
  team_name text,
  consistency_score numeric(5,2),
  published_version integer,
  current_version integer not null default 1,
  owner_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.brand_kits enable row level security;
drop policy if exists "brand_kits_workspace" on public.brand_kits;
create policy "brand_kits_workspace" on public.brand_kits for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_brand_kits_workspace on public.brand_kits(workspace_id, status);
create index if not exists idx_brand_kits_brand on public.brand_kits(brand_id);
create index if not exists idx_brand_kits_updated on public.brand_kits(workspace_id, updated_at desc);

create table if not exists public.brand_kit_versions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  version integer not null,
  change_summary text,
  snapshot jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(brand_kit_id, version)
);
alter table public.brand_kit_versions enable row level security;
drop policy if exists "brand_kit_versions_workspace" on public.brand_kit_versions;
create policy "brand_kit_versions_workspace" on public.brand_kit_versions for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_versions_kit on public.brand_kit_versions(brand_kit_id, version desc);

-- Logos and lockups
create table if not exists public.brand_kit_logos (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  label text not null,
  lockup_type text not null default 'primary'
    check (lockup_type in ('primary','secondary','icon_mark','monogram','wordmark','horizontal','stacked')),
  asset_id uuid,
  background text default 'light' check (background in ('light','dark','colour')),
  min_size_px integer,
  clear_space text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_logos enable row level security;
drop policy if exists "brand_kit_logos_workspace" on public.brand_kit_logos;
create policy "brand_kit_logos_workspace" on public.brand_kit_logos for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_logos_kit on public.brand_kit_logos(brand_kit_id, sort_order);

-- Colour palette
create table if not exists public.brand_kit_colours (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  name text not null,
  hex text not null,
  role text default 'primary'
    check (role in ('primary','secondary','accent','neutral','surface','success','warning','danger')),
  usage_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_colours enable row level security;
drop policy if exists "brand_kit_colours_workspace" on public.brand_kit_colours;
create policy "brand_kit_colours_workspace" on public.brand_kit_colours for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_colours_kit on public.brand_kit_colours(brand_kit_id, sort_order);

-- Typography scale
create table if not exists public.brand_kit_typography (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  style_name text not null,
  font_family text not null,
  font_weight text,
  font_size_px numeric(6,2),
  line_height_px numeric(6,2),
  letter_spacing text,
  usage_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_typography enable row level security;
drop policy if exists "brand_kit_typography_workspace" on public.brand_kit_typography;
create policy "brand_kit_typography_workspace" on public.brand_kit_typography for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_type_kit on public.brand_kit_typography(brand_kit_id, sort_order);

-- Icon style / iconography rules
create table if not exists public.brand_kit_icons (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  style_name text not null,
  stroke_width numeric(4,2),
  corner_style text check (corner_style in ('rounded','square','mixed')),
  fill_style text check (fill_style in ('outline','filled','duotone')),
  sample_asset_id uuid,
  usage_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_icons enable row level security;
drop policy if exists "brand_kit_icons_workspace" on public.brand_kit_icons;
create policy "brand_kit_icons_workspace" on public.brand_kit_icons for all
  using (public.is_workspace_member(workspace_id));

-- Tone of voice
create table if not exists public.brand_kit_tone (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  statement text,
  traits text[] default '{}',
  do_use text[] default '{}',
  dont_use text[] default '{}',
  example_copy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(brand_kit_id)
);
alter table public.brand_kit_tone enable row level security;
drop policy if exists "brand_kit_tone_workspace" on public.brand_kit_tone;
create policy "brand_kit_tone_workspace" on public.brand_kit_tone for all
  using (public.is_workspace_member(workspace_id));

-- Templates belonging to a kit
create table if not exists public.brand_kit_templates (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  name text not null,
  template_type text not null default 'social'
    check (template_type in ('presentation','social','one_pager','email_header','print','ad','story','other')),
  dimensions text,
  asset_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_templates enable row level security;
drop policy if exists "brand_kit_templates_workspace" on public.brand_kit_templates;
create policy "brand_kit_templates_workspace" on public.brand_kit_templates for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_templates_kit on public.brand_kit_templates(brand_kit_id, sort_order);

-- Guideline documents attached to a kit
create table if not exists public.brand_kit_documents (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  title text not null,
  doc_type text default 'guidelines'
    check (doc_type in ('guidelines','logo_usage','colour_standards','typography_guide','tone_guide','legal','other')),
  asset_id uuid,
  version_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.brand_kit_documents enable row level security;
drop policy if exists "brand_kit_documents_workspace" on public.brand_kit_documents;
create policy "brand_kit_documents_workspace" on public.brand_kit_documents for all
  using (public.is_workspace_member(workspace_id));

-- Team comments on a kit
create table if not exists public.brand_kit_comments (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  parent_id uuid references public.brand_kit_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.brand_kit_comments enable row level security;
drop policy if exists "brand_kit_comments_workspace" on public.brand_kit_comments;
create policy "brand_kit_comments_workspace" on public.brand_kit_comments for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_kit_comments_kit on public.brand_kit_comments(brand_kit_id, created_at desc);

-- ============================================================================
-- ASSET ORGANISATION
-- Folders define storage structure; collections group without moving files.
-- ============================================================================
create table if not exists public.asset_folders (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  parent_id uuid references public.asset_folders(id) on delete cascade,
  name text not null,
  path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(workspace_id, path)
);
alter table public.asset_folders enable row level security;
drop policy if exists "asset_folders_workspace" on public.asset_folders;
create policy "asset_folders_workspace" on public.asset_folders for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_asset_folders_workspace on public.asset_folders(workspace_id, parent_id);

create table if not exists public.asset_collections (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  description text,
  is_shared boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.asset_collections enable row level security;
drop policy if exists "asset_collections_workspace" on public.asset_collections;
create policy "asset_collections_workspace" on public.asset_collections for all
  using (public.is_workspace_member(workspace_id));

create table if not exists public.asset_collection_items (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  collection_id uuid not null references public.asset_collections(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  sort_order integer not null default 0,
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  unique(collection_id, asset_id)
);
alter table public.asset_collection_items enable row level security;
drop policy if exists "asset_collection_items_workspace" on public.asset_collection_items;
create policy "asset_collection_items_workspace" on public.asset_collection_items for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_collection_items_asset on public.asset_collection_items(asset_id);

-- ============================================================================
-- MEDIA ASSETS — governance extension (this is the DAM asset record)
-- ============================================================================
alter table public.media_assets add column if not exists folder_id uuid references public.asset_folders(id) on delete set null;
alter table public.media_assets add column if not exists brand_kit_id uuid references public.brand_kits(id) on delete set null;
alter table public.media_assets add column if not exists owner_id uuid references public.profiles(id);
alter table public.media_assets add column if not exists asset_kind text not null default 'image';
alter table public.media_assets add column if not exists approval_status text not null default 'draft';
alter table public.media_assets add column if not exists rights_state text not null default 'unspecified';
alter table public.media_assets add column if not exists usage_scope text;
alter table public.media_assets add column if not exists storage_bucket text;
alter table public.media_assets add column if not exists thumbnail_path text;
alter table public.media_assets add column if not exists preview_path text;
alter table public.media_assets add column if not exists checksum text;
alter table public.media_assets add column if not exists version_no integer not null default 1;
alter table public.media_assets add column if not exists is_favourite boolean not null default false;
alter table public.media_assets add column if not exists processing_state text not null default 'ready';
alter table public.media_assets add column if not exists scan_state text not null default 'clean';
alter table public.media_assets add column if not exists expires_at timestamptz;
alter table public.media_assets add column if not exists download_count integer not null default 0;
alter table public.media_assets add column if not exists is_demo boolean not null default false;
alter table public.media_assets add column if not exists updated_at timestamptz not null default now();
alter table public.media_assets add column if not exists archived_at timestamptz;

do $mig$
begin
  if not exists (select 1 from pg_constraint where conname = 'media_assets_asset_kind_chk') then
    alter table public.media_assets add constraint media_assets_asset_kind_chk
      check (asset_kind in ('image','video','audio','pdf','presentation','document','design','social','packaging','template','archive','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'media_assets_approval_chk') then
    alter table public.media_assets add constraint media_assets_approval_chk
      check (approval_status in ('draft','pending','changes_requested','approved','rejected','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'media_assets_rights_chk') then
    alter table public.media_assets add constraint media_assets_rights_chk
      check (rights_state in ('unspecified','licensed','all_media','internal_use','public_use','restricted','expiring_soon','expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'media_assets_processing_chk') then
    alter table public.media_assets add constraint media_assets_processing_chk
      check (processing_state in ('uploading','processing','scanning','ready','failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'media_assets_scan_chk') then
    alter table public.media_assets add constraint media_assets_scan_chk
      check (scan_state in ('pending','clean','flagged','failed'));
  end if;
end
$mig$;

create index if not exists idx_media_assets_ws_status on public.media_assets(workspace_id, approval_status);
create index if not exists idx_media_assets_ws_kind on public.media_assets(workspace_id, asset_kind);
create index if not exists idx_media_assets_folder on public.media_assets(folder_id);
create index if not exists idx_media_assets_brand on public.media_assets(brand_id);
create index if not exists idx_media_assets_created on public.media_assets(workspace_id, created_at desc);
create index if not exists idx_media_assets_checksum on public.media_assets(workspace_id, checksum);
create index if not exists idx_media_assets_expires on public.media_assets(workspace_id, expires_at) where expires_at is not null;

-- Deferred FKs now that media_assets exists in its final shape.
do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'brand_kits_logo_asset_fk') then
    alter table public.brand_kits add constraint brand_kits_logo_asset_fk
      foreign key (logo_asset_id) references public.media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brand_kit_logos_asset_fk') then
    alter table public.brand_kit_logos add constraint brand_kit_logos_asset_fk
      foreign key (asset_id) references public.media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brand_kit_icons_asset_fk') then
    alter table public.brand_kit_icons add constraint brand_kit_icons_asset_fk
      foreign key (sample_asset_id) references public.media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brand_kit_templates_asset_fk') then
    alter table public.brand_kit_templates add constraint brand_kit_templates_asset_fk
      foreign key (asset_id) references public.media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brand_kit_documents_asset_fk') then
    alter table public.brand_kit_documents add constraint brand_kit_documents_asset_fk
      foreign key (asset_id) references public.media_assets(id) on delete set null;
  end if;
end
$fk$;

-- Asset version history
create table if not exists public.asset_versions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  version_no integer not null,
  file_path text not null,
  file_size integer,
  mime_type text,
  checksum text,
  change_summary text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(asset_id, version_no)
);
alter table public.asset_versions enable row level security;
drop policy if exists "asset_versions_workspace" on public.asset_versions;
create policy "asset_versions_workspace" on public.asset_versions for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_asset_versions_asset on public.asset_versions(asset_id, version_no desc);

-- Approvals on assets (separate from the post-centric public.approvals table)
create table if not exists public.asset_approvals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','changes_requested','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  requested_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.asset_approvals enable row level security;
drop policy if exists "asset_approvals_workspace" on public.asset_approvals;
create policy "asset_approvals_workspace" on public.asset_approvals for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_asset_approvals_ws on public.asset_approvals(workspace_id, status, created_at desc);

-- Usage requests (who may use an asset, where, when)
create table if not exists public.asset_usage_requests (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','approved','partially_approved','rejected','expired','cancelled')),
  purpose text,
  campaign_ref text,
  channels text[] default '{}',
  territories text[] default '{}',
  starts_on date,
  ends_on date,
  modification_requested boolean not null default false,
  distribution_scope text,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.asset_usage_requests enable row level security;
drop policy if exists "asset_usage_requests_workspace" on public.asset_usage_requests;
create policy "asset_usage_requests_workspace" on public.asset_usage_requests for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_usage_requests_ws on public.asset_usage_requests(workspace_id, status, created_at desc);

-- Download audit
create table if not exists public.asset_downloads (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  user_id uuid references public.profiles(id),
  version_no integer,
  purpose text,
  created_at timestamptz not null default now()
);
alter table public.asset_downloads enable row level security;
drop policy if exists "asset_downloads_workspace" on public.asset_downloads;
create policy "asset_downloads_workspace" on public.asset_downloads for all
  using (public.is_workspace_member(workspace_id));
create index if not exists idx_asset_downloads_asset on public.asset_downloads(asset_id, created_at desc);
