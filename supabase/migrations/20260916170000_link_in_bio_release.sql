-- ============================================================================
-- Caption Fox — Link in Bio: release increment
--
-- Moves the module onto the canonical /{type}/links routes and fills the gaps
-- the core increment deferred:
--   * page lifecycle (review / scheduled / unpublished), conversion pages,
--     campaign association, scheduling, legal + consent settings
--   * block model: typed blocks with child link rows (parent_id) and per-block
--     schedules; broken-link check state
--   * reusable links: routing rules, redirect type, open behaviour, versions
--   * themes: description, tags, usage rules, brand kit, approval, versions
--   * activity log, custom domains, pixels, saved views
--   * analytics: richer event vocabulary, source bucket, daily-salted visitor
--     hash for unique counts (never an IP or a raw user-agent), conversion value
--
-- Extends link_pages / link_page_items / reusable_links / link_themes in place
-- (no second model). Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LINK_PAGES
-- ---------------------------------------------------------------------------
alter table public.link_pages add column if not exists page_kind text not null default 'link_page';
alter table public.link_pages add column if not exists goal text;
alter table public.link_pages add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.link_pages add column if not exists domain_id uuid;
alter table public.link_pages add column if not exists approval_status text not null default 'none';
alter table public.link_pages add column if not exists scheduled_publish_at timestamptz;
alter table public.link_pages add column if not exists scheduled_unpublish_at timestamptz;
alter table public.link_pages add column if not exists publish_timezone text not null default 'Europe/London';
alter table public.link_pages add column if not exists index_in_search boolean not null default true;
alter table public.link_pages add column if not exists utm_tracking boolean not null default true;
alter table public.link_pages add column if not exists favicon_url text;
alter table public.link_pages add column if not exists legal jsonb not null default '{}';
alter table public.link_pages add column if not exists consent jsonb not null default '{"banner": true}';
alter table public.link_pages add column if not exists published_version integer;
alter table public.link_pages add column if not exists archived_at timestamptz;

alter table public.link_pages drop constraint if exists link_pages_status_check;
alter table public.link_pages add constraint link_pages_status_check
  check (status in ('draft','in_review','scheduled','published','unpublished','archived'));
alter table public.link_pages drop constraint if exists link_pages_page_kind_check;
alter table public.link_pages add constraint link_pages_page_kind_check
  check (page_kind in ('link_page','conversion_page'));
alter table public.link_pages drop constraint if exists link_pages_approval_check;
alter table public.link_pages add constraint link_pages_approval_check
  check (approval_status in ('none','pending','approved','changes_requested'));
alter table public.link_pages drop constraint if exists link_pages_goal_check;
alter table public.link_pages add constraint link_pages_goal_check
  check (goal is null or goal in ('clicks','sales','leads','registrations','waitlist','downloads','rsvp'));

create index if not exists idx_link_pages_kind on public.link_pages(workspace_id, page_kind);
create index if not exists idx_link_pages_campaign on public.link_pages(campaign_id);
create index if not exists idx_link_pages_schedule on public.link_pages(status, scheduled_publish_at)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- 2. LINK_PAGE_ITEMS — typed blocks + child links
-- ---------------------------------------------------------------------------
alter table public.link_page_items add column if not exists parent_id uuid references public.link_page_items(id) on delete cascade;
alter table public.link_page_items add column if not exists description text;
alter table public.link_page_items add column if not exists schedule_start timestamptz;
alter table public.link_page_items add column if not exists schedule_end timestamptz;
alter table public.link_page_items add column if not exists check_status text not null default 'unknown';
alter table public.link_page_items add column if not exists checked_at timestamptz;

alter table public.link_page_items drop constraint if exists link_page_items_item_type_check;
alter table public.link_page_items add constraint link_page_items_item_type_check check (item_type in (
  'hero','links','link','button_stack','product','product_grid','form','social_proof','social_feed',
  'countdown','faq','pricing','video','image','text','header','divider','social','footer'
));
alter table public.link_page_items drop constraint if exists link_page_items_check_status_check;
alter table public.link_page_items add constraint link_page_items_check_status_check
  check (check_status in ('unknown','healthy','redirected','broken','timeout','blocked'));

create index if not exists idx_link_page_items_parent on public.link_page_items(parent_id, sort_order);
create index if not exists idx_link_page_items_check on public.link_page_items(check_status, checked_at) where url is not null;

-- ---------------------------------------------------------------------------
-- 3. LINK_PAGE_VERSIONS
-- ---------------------------------------------------------------------------
alter table public.link_page_versions add column if not exists change_summary text;
alter table public.link_page_versions add column if not exists status text not null default 'draft';
alter table public.link_page_versions add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.link_page_versions add column if not exists published_at timestamptz;
alter table public.link_page_versions drop constraint if exists link_page_versions_status_check;
alter table public.link_page_versions add constraint link_page_versions_status_check
  check (status in ('draft','approved','published','restored','superseded'));

-- ---------------------------------------------------------------------------
-- 4. REUSABLE_LINKS — routing rules + versions
-- ---------------------------------------------------------------------------
alter table public.reusable_links add column if not exists redirect_type integer not null default 302;
alter table public.reusable_links add column if not exists open_behaviour text not null default 'same_tab';
alter table public.reusable_links add column if not exists rules jsonb not null default '[]';
alter table public.reusable_links add column if not exists fallback_url text;
alter table public.reusable_links add column if not exists timezone text not null default 'Europe/London';
alter table public.reusable_links add column if not exists cache_seconds integer not null default 300;
alter table public.reusable_links add column if not exists cloaking boolean not null default false;
alter table public.reusable_links add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.reusable_links add column if not exists usable_in text[] not null default array['link_pages','content','email','ads','social','qr'];
alter table public.reusable_links add column if not exists last_used_at timestamptz;
alter table public.reusable_links add column if not exists check_status text not null default 'unknown';
alter table public.reusable_links add column if not exists checked_at timestamptz;
alter table public.reusable_links add column if not exists current_version integer not null default 1;
alter table public.reusable_links add column if not exists archived_at timestamptz;
alter table public.reusable_links add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.reusable_links drop constraint if exists reusable_links_status_check;
alter table public.reusable_links add constraint reusable_links_status_check
  check (status in ('draft','active','scheduled','paused','expired','archived'));
alter table public.reusable_links drop constraint if exists reusable_links_redirect_type_check;
alter table public.reusable_links add constraint reusable_links_redirect_type_check check (redirect_type in (301,302,307));
alter table public.reusable_links drop constraint if exists reusable_links_open_behaviour_check;
alter table public.reusable_links add constraint reusable_links_open_behaviour_check
  check (open_behaviour in ('same_tab','new_tab','in_app'));
alter table public.reusable_links drop constraint if exists reusable_links_check_status_check;
alter table public.reusable_links add constraint reusable_links_check_status_check
  check (check_status in ('unknown','healthy','redirected','broken','timeout','blocked'));
-- Vanity slugs resolve globally through /r/{slug}, so they must be globally unique.
drop index if exists public.idx_reusable_links_workspace_slug;
create unique index if not exists idx_reusable_links_slug_global on public.reusable_links(lower(vanity_slug)) where vanity_slug is not null;

create table if not exists public.reusable_link_versions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.reusable_links(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null default '{}',
  change_summary text,
  status text not null default 'published' check (status in ('draft','published','restored','superseded')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (link_id, version)
);
create index if not exists idx_reusable_link_versions_link on public.reusable_link_versions(link_id, version desc);

-- ---------------------------------------------------------------------------
-- 5. LINK_THEMES
-- ---------------------------------------------------------------------------
alter table public.link_themes add column if not exists description text;
alter table public.link_themes add column if not exists tags text[] not null default '{}';
alter table public.link_themes add column if not exists audience text not null default 'all';
alter table public.link_themes add column if not exists usage_rules jsonb not null default '{"link_pages": true, "conversion_pages": true, "popups": false, "embeds": false}';
alter table public.link_themes add column if not exists brand_kit_id uuid references public.brand_kits(id) on delete set null;
alter table public.link_themes add column if not exists visibility text not null default 'team';
alter table public.link_themes add column if not exists approval_status text not null default 'none';
alter table public.link_themes add column if not exists published_version integer;
alter table public.link_themes add column if not exists notes text;
alter table public.link_themes add column if not exists archived_at timestamptz;
alter table public.link_themes add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.link_themes drop constraint if exists link_themes_visibility_check;
alter table public.link_themes add constraint link_themes_visibility_check check (visibility in ('private','team'));
alter table public.link_themes drop constraint if exists link_themes_approval_check;
alter table public.link_themes add constraint link_themes_approval_check
  check (approval_status in ('none','pending','approved','changes_requested'));

alter table public.link_theme_versions add column if not exists change_summary text;
alter table public.link_theme_versions add column if not exists status text not null default 'published';
alter table public.link_theme_versions drop constraint if exists link_theme_versions_status_check;
alter table public.link_theme_versions add constraint link_theme_versions_status_check
  check (status in ('draft','published','restored','superseded'));

-- ---------------------------------------------------------------------------
-- 6. ACTIVITY
-- ---------------------------------------------------------------------------
create table if not exists public.link_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('page','reusable_link','theme','domain','pixel','export','system')),
  entity_id uuid,
  entity_name text,
  action text not null,
  summary text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_link_activity_workspace on public.link_activity(workspace_id, created_at desc);
create index if not exists idx_link_activity_entity on public.link_activity(entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. CUSTOM DOMAINS — ownership proven by a DNS TXT record
-- ---------------------------------------------------------------------------
create table if not exists public.link_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hostname text not null,
  status text not null default 'pending' check (status in ('pending','verified','failed')),
  verification_token text not null,
  verified_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_link_domains_hostname on public.link_domains(lower(hostname));
create index if not exists idx_link_domains_workspace on public.link_domains(workspace_id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'link_pages_domain_fkey') then
    alter table public.link_pages add constraint link_pages_domain_fkey
      foreign key (domain_id) references public.link_domains(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. PIXELS — public pixel IDs only (never provider secrets)
-- ---------------------------------------------------------------------------
create table if not exists public.link_page_pixels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id uuid not null references public.link_pages(id) on delete cascade,
  provider text not null check (provider in ('meta','google_analytics','google_ads','tiktok','linkedin')),
  pixel_id text not null check (pixel_id ~ '^[A-Za-z0-9_-]{4,40}$'),
  consent_category text not null default 'marketing' check (consent_category in ('analytics','marketing')),
  enabled boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved')),
  last_event_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, provider)
);
create index if not exists idx_link_page_pixels_page on public.link_page_pixels(page_id);

-- ---------------------------------------------------------------------------
-- 9. SAVED VIEWS
-- ---------------------------------------------------------------------------
create table if not exists public.link_saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('library','themes','analytics')),
  name text not null check (char_length(name) between 1 and 60),
  params jsonb not null default '{}',
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_link_saved_views_scope on public.link_saved_views(workspace_id, scope);

-- ---------------------------------------------------------------------------
-- 10. ANALYTICS EVENTS
-- ---------------------------------------------------------------------------
alter table public.link_analytics_events add column if not exists source text;
alter table public.link_analytics_events add column if not exists visitor_hash text;
alter table public.link_analytics_events add column if not exists value_pence integer;
alter table public.link_analytics_events add column if not exists campaign text;

alter table public.link_analytics_events drop constraint if exists link_analytics_events_type_check;
alter table public.link_analytics_events add constraint link_analytics_events_type_check check (event_type in (
  'page_view','link_click','qr_visit','product_click','form_view','form_submit','conversion'
));
alter table public.link_analytics_events drop constraint if exists link_analytics_events_source_check;
alter table public.link_analytics_events add constraint link_analytics_events_source_check
  check (source is null or source in ('social','direct','search','email','referral'));

create index if not exists idx_link_analytics_events_ws_type_created on public.link_analytics_events(workspace_id, event_type, created_at desc);

-- Public writes now go through validated server routes using the service
-- client; anonymous sessions no longer insert directly.
drop policy if exists "link_analytics_events_public_insert" on public.link_analytics_events;

-- ---------------------------------------------------------------------------
-- 11. PUBLIC VIEWS — a page is live when published, or scheduled and due,
--     and not past its unpublish time.
-- ---------------------------------------------------------------------------
drop view if exists public.link_page_items_public;
drop view if exists public.link_themes_public;
drop view if exists public.link_page_pixels_public;
drop view if exists public.link_pages_public;

create view public.link_pages_public as
select
  id, workspace_id, brand_id, theme_id, slug, title, description, avatar_url,
  background_type, background_value, primary_color, button_style, button_color,
  button_text_color, font_family, show_caption_fox_branding, seo_title,
  seo_description, og_image, favicon_url, page_kind, index_in_search, legal, consent,
  domain_id, status, visibility, published_at
from public.link_pages
where archived_at is null
  and visibility = 'public'
  and (status = 'published' or (status = 'scheduled' and scheduled_publish_at <= now()))
  and (scheduled_unpublish_at is null or scheduled_unpublish_at > now());

create view public.link_page_items_public as
select i.id, i.page_id, i.parent_id, i.item_type, i.title, i.description, i.url, i.thumbnail_url,
  i.icon, i.sort_order, i.is_active, i.config, i.reusable_link_id
from public.link_page_items i
join public.link_pages_public p on p.id = i.page_id
where i.is_active = true
  and (i.schedule_start is null or i.schedule_start <= now())
  and (i.schedule_end is null or i.schedule_end > now());

create view public.link_themes_public as
select t.id, t.tokens
from public.link_themes t
where t.id in (select theme_id from public.link_pages_public where theme_id is not null);

create view public.link_page_pixels_public as
select x.page_id, x.provider, x.pixel_id, x.consent_category
from public.link_page_pixels x
join public.link_pages_public p on p.id = x.page_id
where x.enabled = true and x.approval_status = 'approved';

drop view if exists public.reusable_links_public;
create view public.reusable_links_public as
select id, workspace_id, vanity_slug, destination_url, utm, status, redirect_type,
  rules, fallback_url, scheduled_start, scheduled_end
from public.reusable_links
where vanity_slug is not null
  and archived_at is null
  and status in ('active','scheduled')
  and (scheduled_start is null or scheduled_start <= now())
  and (scheduled_end is null or scheduled_end > now());

grant select on public.link_pages_public to anon, authenticated;
grant select on public.link_page_items_public to anon, authenticated;
grant select on public.link_themes_public to anon, authenticated;
grant select on public.link_page_pixels_public to anon, authenticated;
grant select on public.reusable_links_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. RLS
-- ---------------------------------------------------------------------------
alter table public.reusable_link_versions enable row level security;
alter table public.link_activity enable row level security;
alter table public.link_domains enable row level security;
alter table public.link_page_pixels enable row level security;
alter table public.link_saved_views enable row level security;

drop policy if exists "reusable_link_versions_workspace" on public.reusable_link_versions;
create policy "reusable_link_versions_workspace" on public.reusable_link_versions for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- Activity is append-only for members: readable, insertable, never edited.
drop policy if exists "link_activity_read" on public.link_activity;
create policy "link_activity_read" on public.link_activity for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
drop policy if exists "link_activity_insert" on public.link_activity;
create policy "link_activity_insert" on public.link_activity for insert
  with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    and (actor_id is null or actor_id = auth.uid())
  );

drop policy if exists "link_domains_workspace" on public.link_domains;
create policy "link_domains_workspace" on public.link_domains for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- A pixel may only attach to a page in the same workspace.
drop policy if exists "link_page_pixels_workspace" on public.link_page_pixels;
create policy "link_page_pixels_workspace" on public.link_page_pixels for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    and page_id in (select id from public.link_pages p where p.workspace_id = link_page_pixels.workspace_id)
  );

-- Saved views: owner reads/writes own; members read views shared to the workspace.
drop policy if exists "link_saved_views_read" on public.link_saved_views;
create policy "link_saved_views_read" on public.link_saved_views for select
  using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    and (user_id = auth.uid() or shared = true)
  );
drop policy if exists "link_saved_views_write" on public.link_saved_views;
create policy "link_saved_views_write" on public.link_saved_views for all
  using (user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- link_page_items: child rows must stay inside their page's workspace.
drop policy if exists "link_page_items_workspace" on public.link_page_items;
create policy "link_page_items_workspace" on public.link_page_items for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    and page_id in (select id from public.link_pages p where p.workspace_id = link_page_items.workspace_id)
  );

drop policy if exists "link_pages_workspace" on public.link_pages;
create policy "link_pages_workspace" on public.link_pages for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['link_domains','link_page_pixels'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_link_updated', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.link_in_bio_touch_updated_at()',
      'trg_' || t || '_link_updated', t
    );
  end loop;
end $$;

-- The old demo seed rows are superseded by scripts/seed-link-in-bio-demo.mjs.
delete from public.link_pages where is_demo = true and slug = 'demo-creator-links';
