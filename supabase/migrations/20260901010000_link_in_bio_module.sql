-- ============================================================================
-- Caption Fox — Link in Bio module (core production increment)
--
-- Serves:
--   /app/links/library            Pages + Link Library (collection)
--   /app/links/themes             Themes
--   /app/links/analytics          Analytics
--   /app/links/[id]               Link page detail (Design/Links/Analytics/
--                                  Settings/Versions; Products/Forms/Pixels
--                                  are honest "not connected" states)
--   /app/links/reusable-links/[id]  Reusable link detail
--   /app/links/themes/[id]/editor   Theme editor
--   /l/[slug]                     Public renderer (existing route)
--
-- Deferred (explicitly out of scope for this increment): custom domains,
-- pixel/forms provider integrations, redirect-rule engine hardening.
--
-- Principles (same as Studio/Creators/Events/Calendar modules):
--   1. Extend, don't duplicate. link_pages and link_page_items already exist
--      and already power a working editor — we extend them rather than
--      introduce a second, competing block model.
--   2. Every workspace-owned row carries workspace_id and is protected by RLS
--      through workspace_members.
--   3. Public rendering never queries workspace-scoped tables directly from
--      an anonymous session — it reads through security-definer views that
--      expose only safe, published, public columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. LINK_PAGES — extend for status/theme/SEO/visibility lifecycle
-- ---------------------------------------------------------------------------
alter table public.link_pages add column if not exists status text not null default 'draft';
alter table public.link_pages add column if not exists theme_id uuid;
alter table public.link_pages add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.link_pages add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.link_pages add column if not exists published_at timestamptz;
alter table public.link_pages add column if not exists current_version integer not null default 1;
alter table public.link_pages add column if not exists seo_title text;
alter table public.link_pages add column if not exists seo_description text;
alter table public.link_pages add column if not exists og_image text;
alter table public.link_pages add column if not exists visibility text not null default 'public';
alter table public.link_pages add column if not exists password_hash text;
alter table public.link_pages add column if not exists tags text[] not null default '{}';
alter table public.link_pages add column if not exists is_demo boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'link_pages_status_check') then
    alter table public.link_pages add constraint link_pages_status_check
      check (status in ('draft','published','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'link_pages_visibility_check') then
    alter table public.link_pages add constraint link_pages_visibility_check
      check (visibility in ('public','private','password'));
  end if;
end $$;

-- Backfill status/owner from the existing is_active flag so old rows behave
-- exactly as they did before (visible == published).
update public.link_pages set owner_id = created_by where owner_id is null and created_by is not null;
update public.link_pages set status = 'published', published_at = coalesce(published_at, created_at)
  where status = 'draft' and is_active = true;

create index if not exists idx_link_pages_workspace_status on public.link_pages(workspace_id, status);
create index if not exists idx_link_pages_workspace_updated on public.link_pages(workspace_id, updated_at desc);
create index if not exists idx_link_pages_slug on public.link_pages(slug);
create index if not exists idx_link_pages_theme on public.link_pages(theme_id);
create index if not exists idx_link_pages_owner on public.link_pages(workspace_id, owner_id);

-- ---------------------------------------------------------------------------
-- 2. LINK_PAGE_ITEMS — extend to act as the block model for the Design tab
-- ---------------------------------------------------------------------------
alter table public.link_page_items add column if not exists config jsonb not null default '{}';
alter table public.link_page_items add column if not exists reusable_link_id uuid;

create index if not exists idx_link_page_items_page on public.link_page_items(page_id, sort_order);
create index if not exists idx_link_page_items_workspace on public.link_page_items(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. LINK_PAGE_VERSIONS — publish history / rollback for the Versions tab
-- ---------------------------------------------------------------------------
create table if not exists public.link_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.link_pages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null default '{}',
  published boolean not null default false,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (page_id, version)
);

create index if not exists idx_link_page_versions_page on public.link_page_versions(page_id, version desc);
create index if not exists idx_link_page_versions_workspace on public.link_page_versions(workspace_id);

-- ---------------------------------------------------------------------------
-- 4. REUSABLE_LINKS — workspace-level link library, independent of pages
-- ---------------------------------------------------------------------------
create table if not exists public.reusable_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  destination_url text not null,
  vanity_slug text,
  short_url text,
  label text,
  icon text,
  utm jsonb not null default '{}',
  status text not null default 'active',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  tags text[] not null default '{}',
  click_count integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reusable_links_status_check') then
    alter table public.reusable_links add constraint reusable_links_status_check
      check (status in ('active','paused','archived'));
  end if;
end $$;

create unique index if not exists idx_reusable_links_workspace_slug on public.reusable_links(workspace_id, vanity_slug) where vanity_slug is not null;
create index if not exists idx_reusable_links_workspace on public.reusable_links(workspace_id, updated_at desc);
create index if not exists idx_reusable_links_owner on public.reusable_links(workspace_id, owner_id);

alter table public.link_page_items
  add constraint link_page_items_reusable_link_fkey
  foreign key (reusable_link_id) references public.reusable_links(id) on delete set null;

create index if not exists idx_link_page_items_reusable_link on public.link_page_items(reusable_link_id);

-- ---------------------------------------------------------------------------
-- 5. LINK_THEMES + LINK_THEME_VERSIONS — reusable theme library
-- ---------------------------------------------------------------------------
create table if not exists public.link_themes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  tokens jsonb not null default '{}',
  usage_count integer not null default 0,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'link_themes_status_check') then
    alter table public.link_themes add constraint link_themes_status_check
      check (status in ('draft','active','archived'));
  end if;
end $$;

create index if not exists idx_link_themes_workspace on public.link_themes(workspace_id, updated_at desc);
create index if not exists idx_link_themes_status on public.link_themes(workspace_id, status);

create table if not exists public.link_theme_versions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.link_themes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null,
  tokens jsonb not null default '{}',
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (theme_id, version)
);

create index if not exists idx_link_theme_versions_theme on public.link_theme_versions(theme_id, version desc);

alter table public.link_pages
  add constraint link_pages_theme_fkey
  foreign key (theme_id) references public.link_themes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 6. LINK_ANALYTICS_EVENTS — privacy-light event log
--    (no IP storage, no raw user-agent — coarse device_type only)
-- ---------------------------------------------------------------------------
create table if not exists public.link_analytics_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  page_id uuid references public.link_pages(id) on delete cascade,
  reusable_link_id uuid references public.reusable_links(id) on delete cascade,
  item_id uuid references public.link_page_items(id) on delete set null,
  event_type text not null,
  referrer text,
  device_type text,
  country text,
  created_at timestamptz not null default now(),
  constraint link_analytics_events_target_check check (page_id is not null or reusable_link_id is not null)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'link_analytics_events_type_check') then
    alter table public.link_analytics_events add constraint link_analytics_events_type_check
      check (event_type in ('page_view','link_click','qr_visit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'link_analytics_events_device_check') then
    alter table public.link_analytics_events add constraint link_analytics_events_device_check
      check (device_type is null or device_type in ('desktop','mobile','tablet','other'));
  end if;
end $$;

create index if not exists idx_link_analytics_events_workspace_created on public.link_analytics_events(workspace_id, created_at desc);
create index if not exists idx_link_analytics_events_page on public.link_analytics_events(page_id, created_at desc);
create index if not exists idx_link_analytics_events_reusable_link on public.link_analytics_events(reusable_link_id, created_at desc);
create index if not exists idx_link_analytics_events_type on public.link_analytics_events(workspace_id, event_type);

-- Daily rollups are computed on demand via a view rather than a materialised
-- table — event volume for this module does not yet justify the extra
-- maintenance of a rollup table/cron job. Revisit if a workspace's event
-- volume makes the raw-event query slow.
create or replace view public.link_analytics_daily_rollups as
select
  workspace_id,
  page_id,
  reusable_link_id,
  date_trunc('day', created_at) as day,
  count(*) filter (where event_type = 'page_view') as views,
  count(*) filter (where event_type = 'link_click') as clicks,
  count(*) filter (where event_type = 'qr_visit') as qr_visits
from public.link_analytics_events
group by workspace_id, page_id, reusable_link_id, date_trunc('day', created_at);

-- ---------------------------------------------------------------------------
-- 7. PUBLIC RENDERING VIEWS (security-definer semantics — views run as their
--    owner, so they can safely expose a filtered slice of an RLS-protected
--    table to anonymous visitors without a blanket public RLS policy).
-- ---------------------------------------------------------------------------
create or replace view public.link_pages_public as
select
  id, workspace_id, brand_id, theme_id, slug, title, description, avatar_url,
  background_type, background_value, primary_color, button_style, button_color,
  button_text_color, font_family, show_caption_fox_branding, seo_title,
  seo_description, og_image, status, visibility, published_at
from public.link_pages
where status = 'published' and visibility = 'public';

create or replace view public.link_page_items_public as
select i.id, i.page_id, i.item_type, i.title, i.url, i.thumbnail_url, i.icon,
  i.sort_order, i.is_active, i.config, i.reusable_link_id
from public.link_page_items i
join public.link_pages_public p on p.id = i.page_id
where i.is_active = true;

create or replace view public.link_themes_public as
select t.id, t.workspace_id, t.tokens
from public.link_themes t
where t.id in (select theme_id from public.link_pages_public where theme_id is not null);

grant select on public.link_pages_public to anon, authenticated;
grant select on public.link_page_items_public to anon, authenticated;
grant select on public.link_themes_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY — workspace-scoped, matching the repo convention
-- ---------------------------------------------------------------------------
alter table public.link_page_versions enable row level security;
alter table public.reusable_links enable row level security;
alter table public.link_themes enable row level security;
alter table public.link_theme_versions enable row level security;
alter table public.link_analytics_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'link_page_versions_workspace') then
    create policy "link_page_versions_workspace" on public.link_page_versions for all using (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    ) with check (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'reusable_links_workspace') then
    create policy "reusable_links_workspace" on public.reusable_links for all using (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    ) with check (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'link_themes_workspace') then
    create policy "link_themes_workspace" on public.link_themes for all using (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    ) with check (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'link_theme_versions_workspace') then
    create policy "link_theme_versions_workspace" on public.link_theme_versions for all using (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    ) with check (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    );
  end if;

  -- Workspace members can read/manage their own analytics. Anonymous public
  -- visitors get INSERT only, scoped to a page/reusable link that is
  -- genuinely published+public — never a blanket anon policy.
  if not exists (select 1 from pg_policies where policyname = 'link_analytics_events_workspace_rw') then
    create policy "link_analytics_events_workspace_rw" on public.link_analytics_events for all using (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    ) with check (
      workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
    );
  end if;

  if not exists (select 1 from pg_policies where policyname = 'link_analytics_events_public_insert') then
    -- Not role-restricted to anon: a logged-in workspace member browsing a
    -- public page (their own or someone else's) must be able to record a
    -- view/click too, so this checks the target is a genuinely published
    -- public page/link rather than restricting by role.
    create policy "link_analytics_events_public_insert" on public.link_analytics_events for insert
    with check (
      event_type in ('page_view','link_click','qr_visit')
      and (
        (page_id is not null and page_id in (select id from public.link_pages_public))
        or (reusable_link_id is not null and reusable_link_id in (
          select rl.id from public.reusable_links rl
          where rl.status = 'active'
            and rl.id in (select reusable_link_id from public.link_page_items_public where reusable_link_id is not null)
        ))
      )
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.link_in_bio_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['link_pages','link_page_items','reusable_links','link_themes'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_link_updated', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.link_in_bio_touch_updated_at()',
      'trg_' || t || '_link_updated', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. DEV-ONLY DEMO SEED — guarded, only inserts once per workspace, and
--     only against the first workspace found (keeps this safe to run on a
--     fresh project with zero workspaces).
-- ---------------------------------------------------------------------------
do $$
declare
  demo_workspace_id uuid;
  demo_owner_id uuid;
  demo_theme_id uuid;
  demo_page_id uuid;
begin
  select id into demo_workspace_id from public.workspaces order by created_at asc limit 1;
  if demo_workspace_id is null then return; end if;

  if exists (select 1 from public.link_themes where workspace_id = demo_workspace_id and is_demo = true) then
    return;
  end if;

  select owner_id into demo_owner_id from public.workspaces where id = demo_workspace_id;

  insert into public.link_themes (workspace_id, name, category, owner_id, status, tokens, usage_count, is_demo, created_by)
  values (
    demo_workspace_id, 'Midnight Studio', 'Dark & bold', demo_owner_id, 'active',
    jsonb_build_object(
      'palette', jsonb_build_object('background', '#0C1A2E', 'primary', '#2563EB', 'buttonBg', '#2563EB', 'buttonText', '#FFFFFF'),
      'typography', jsonb_build_object('fontFamily', 'inter', 'weight', 'semibold'),
      'buttons', jsonb_build_object('style', 'rounded', 'shadow', 'soft'),
      'radius', 'lg'
    ),
    1, true, demo_owner_id
  ) returning id into demo_theme_id;

  insert into public.link_theme_versions (theme_id, workspace_id, version, tokens, published, created_by)
  select demo_theme_id, demo_workspace_id, 1, tokens, true, demo_owner_id from public.link_themes where id = demo_theme_id;

  insert into public.link_themes (workspace_id, name, category, owner_id, status, tokens, usage_count, is_demo, created_by)
  values (
    demo_workspace_id, 'Sunrise Creator', 'Bright & friendly', demo_owner_id, 'active',
    jsonb_build_object(
      'palette', jsonb_build_object('background', 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', 'primary', '#FFFFFF', 'buttonBg', '#FFFFFF', 'buttonText', '#EA580C'),
      'typography', jsonb_build_object('fontFamily', 'poppins', 'weight', 'bold'),
      'buttons', jsonb_build_object('style', 'pill', 'shadow', 'soft'),
      'radius', 'full'
    ),
    0, true, demo_owner_id
  );

  insert into public.link_pages (
    workspace_id, slug, title, description, background_type, background_value,
    primary_color, button_style, button_color, button_text_color, font_family,
    show_caption_fox_branding, is_active, status, theme_id, owner_id, published_at,
    seo_title, seo_description, visibility, tags, is_demo, created_by
  ) values (
    demo_workspace_id, 'demo-creator-links', 'Jamahl — All Links', 'Everything in one place ✨',
    'color', '#0C1A2E', '#2563EB', 'rounded', '#2563EB', '#FFFFFF', 'inter',
    true, true, 'published', demo_theme_id, demo_owner_id, now(),
    'Jamahl — All Links', 'Shop, watch and follow — everything in one place.', 'public',
    array['creator','demo'], true, demo_owner_id
  ) returning id into demo_page_id;

  insert into public.link_page_items (page_id, workspace_id, item_type, title, url, sort_order, is_active, config)
  values
    (demo_page_id, demo_workspace_id, 'link', 'Latest YouTube Video', 'https://youtube.com/watch?v=demo', 0, true, '{}'),
    (demo_page_id, demo_workspace_id, 'link', 'Shop My Merch', 'https://shop.example.com/merch', 1, true, '{}'),
    (demo_page_id, demo_workspace_id, 'header', 'Follow Me', null, 2, true, '{}'),
    (demo_page_id, demo_workspace_id, 'link', 'Instagram', 'https://instagram.com/demo', 3, true, '{}'),
    (demo_page_id, demo_workspace_id, 'link', 'TikTok', 'https://tiktok.com/@demo', 4, true, '{}');

  insert into public.link_page_versions (page_id, workspace_id, version, snapshot, published, created_by)
  values (demo_page_id, demo_workspace_id, 1, jsonb_build_object('title', 'Jamahl — All Links', 'blocks', 5), true, demo_owner_id);

  insert into public.reusable_links (workspace_id, name, destination_url, vanity_slug, label, status, utm, owner_id, tags, click_count, is_demo, created_by)
  values
    (demo_workspace_id, 'Summer Sale Link', 'https://shop.example.com/summer-sale', 'summer-sale', 'Summer Sale', 'active',
      jsonb_build_object('source', 'instagram', 'medium', 'bio', 'campaign', 'summer_sale'), demo_owner_id, array['sale','demo'], 128, true, demo_owner_id),
    (demo_workspace_id, 'Podcast Episode 12', 'https://podcast.example.com/ep-12', 'ep-12', 'New Episode', 'active',
      jsonb_build_object('source', 'tiktok', 'medium', 'bio', 'campaign', 'podcast_launch'), demo_owner_id, array['podcast','demo'], 46, true, demo_owner_id);

  insert into public.link_analytics_events (workspace_id, page_id, event_type, device_type, country, created_at)
  select demo_workspace_id, demo_page_id, 'page_view',
    (array['mobile','desktop','tablet'])[1 + floor(random() * 3)::int],
    (array['GB','US','IE','AU'])[1 + floor(random() * 4)::int],
    now() - (n || ' hours')::interval
  from generate_series(1, 60) n;

  insert into public.link_analytics_events (workspace_id, page_id, event_type, device_type, country, created_at)
  select demo_workspace_id, demo_page_id, 'link_click',
    (array['mobile','desktop'])[1 + floor(random() * 2)::int],
    (array['GB','US'])[1 + floor(random() * 2)::int],
    now() - (n || ' hours')::interval
  from generate_series(1, 18) n;
end $$;
