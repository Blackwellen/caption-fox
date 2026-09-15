-- ============================================================================
-- Caption Fox — Campaign Manager → Studio module
--
-- Serves:
--   /app/studio                     Overview
--   /app/studio/compose             Compose
--   /app/studio/ai-generate         AI Generate
--   /app/studio/ideas               Ideas
--   /app/studio/templates           Templates
--   /app/studio/hashtags            Hashtags & Keywords
--   /app/studio/media               Media
--   /app/studio/content             Content Library
--
-- Principles (same as the Events and Campaigns modules):
--   1. Extend, don't duplicate. Studio owns no second copy of content_posts,
--      content_templates, content_ideas, hashtag_sets, media_assets or
--      ai_generations — it adds the columns those surfaces need.
--   2. Every workspace-owned row carries workspace_id and is protected by RLS
--      through workspace_members.
--   3. Cross-product links (campaign_id, brand_id, converted_to_post_id) are
--      references, never data owners.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CONTENT POSTS — Compose + Content Library
-- ---------------------------------------------------------------------------
alter table public.content_posts add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.content_posts add column if not exists updated_by uuid references public.profiles(id) on delete set null;
alter table public.content_posts add column if not exists archived_at timestamptz;
alter table public.content_posts add column if not exists tags text[] not null default '{}';
alter table public.content_posts add column if not exists internal_title text;
alter table public.content_posts add column if not exists cta_label text;
alter table public.content_posts add column if not exists cta_url text;
alter table public.content_posts add column if not exists utm_enabled boolean not null default false;
alter table public.content_posts add column if not exists utm_params jsonb not null default '{}';
alter table public.content_posts add column if not exists tone text;
alter table public.content_posts add column if not exists quality_score integer;
alter table public.content_posts add column if not exists quality_checks jsonb not null default '{}';
alter table public.content_posts add column if not exists source text not null default 'manual';
alter table public.content_posts add column if not exists template_id uuid references public.content_templates(id) on delete set null;
alter table public.content_posts add column if not exists idea_id uuid references public.content_ideas(id) on delete set null;
alter table public.content_posts add column if not exists repurposed_from uuid references public.content_posts(id) on delete set null;
alter table public.content_posts add column if not exists engagement jsonb not null default '{}';
alter table public.content_posts add column if not exists is_demo boolean not null default false;
alter table public.content_posts add column if not exists metadata jsonb not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_posts_source_check') then
    alter table public.content_posts add constraint content_posts_source_check
      check (source in ('manual','ai','template','idea','repurpose','import'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_posts_quality_range') then
    alter table public.content_posts add constraint content_posts_quality_range
      check (quality_score is null or (quality_score >= 0 and quality_score <= 100));
  end if;
end $$;

-- Back-fill owner from the creator so existing rows are never ownerless.
update public.content_posts set owner_id = created_by where owner_id is null and created_by is not null;

create index if not exists idx_content_posts_workspace_status on public.content_posts(workspace_id, status);
create index if not exists idx_content_posts_workspace_updated on public.content_posts(workspace_id, updated_at desc);
create index if not exists idx_content_posts_workspace_scheduled on public.content_posts(workspace_id, scheduled_at desc);
create index if not exists idx_content_posts_owner on public.content_posts(workspace_id, owner_id);
create index if not exists idx_content_posts_template on public.content_posts(template_id);
create index if not exists idx_content_posts_idea on public.content_posts(idea_id);
create index if not exists idx_content_posts_active on public.content_posts(workspace_id) where archived_at is null;

-- ---------------------------------------------------------------------------
-- 2. CONTENT IDEAS — Ideas board / list / cards
-- ---------------------------------------------------------------------------
create table if not exists public.studio_idea_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  colour text not null default 'blue' check (colour in ('blue','green','amber','violet','red','slate')),
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table public.content_ideas add column if not exists collection_id uuid references public.studio_idea_collections(id) on delete set null;
alter table public.content_ideas add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.content_ideas add column if not exists stage text not null default 'backlog';
alter table public.content_ideas add column if not exists score integer;
alter table public.content_ideas add column if not exists tags text[] not null default '{}';
alter table public.content_ideas add column if not exists why_it_works text[] not null default '{}';
alter table public.content_ideas add column if not exists next_step text;
alter table public.content_ideas add column if not exists featured boolean not null default false;
alter table public.content_ideas add column if not exists updated_at timestamptz not null default now();
alter table public.content_ideas add column if not exists archived_at timestamptz;
alter table public.content_ideas add column if not exists is_demo boolean not null default false;
alter table public.content_ideas add column if not exists metadata jsonb not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_ideas_stage_check') then
    alter table public.content_ideas add constraint content_ideas_stage_check
      check (stage in ('backlog','in_research','prioritised','ready_to_draft','approved','converted','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_ideas_score_range') then
    alter table public.content_ideas add constraint content_ideas_score_range
      check (score is null or (score >= 0 and score <= 100));
  end if;
end $$;

update public.content_ideas set owner_id = created_by where owner_id is null and created_by is not null;
update public.content_ideas set stage = 'converted' where status = 'converted' and stage = 'backlog';

create index if not exists idx_content_ideas_workspace_stage on public.content_ideas(workspace_id, stage);
create index if not exists idx_content_ideas_workspace_score on public.content_ideas(workspace_id, score desc nulls last);
create index if not exists idx_content_ideas_workspace_created on public.content_ideas(workspace_id, created_at desc);
create index if not exists idx_content_ideas_collection on public.content_ideas(collection_id);
create index if not exists idx_studio_idea_collections_workspace on public.studio_idea_collections(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. CONTENT TEMPLATES — Templates
-- ---------------------------------------------------------------------------
alter table public.content_templates add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.content_templates add column if not exists status text not null default 'draft';
alter table public.content_templates add column if not exists category text;
alter table public.content_templates add column if not exists channel text;
alter table public.content_templates add column if not exists cover_url text;
alter table public.content_templates add column if not exists usage_count integer not null default 0;
alter table public.content_templates add column if not exists brand_approved boolean not null default false;
alter table public.content_templates add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.content_templates add column if not exists approved_at timestamptz;
alter table public.content_templates add column if not exists review_note text;
alter table public.content_templates add column if not exists tags text[] not null default '{}';
alter table public.content_templates add column if not exists variables jsonb not null default '[]';
alter table public.content_templates add column if not exists updated_at timestamptz not null default now();
alter table public.content_templates add column if not exists archived_at timestamptz;
alter table public.content_templates add column if not exists is_demo boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'content_templates_status_check') then
    alter table public.content_templates add constraint content_templates_status_check
      check (status in ('draft','in_review','changes_requested','approved','published','archived'));
  end if;
end $$;

update public.content_templates set owner_id = created_by where owner_id is null and created_by is not null;

create table if not exists public.studio_template_favourites (
  template_id uuid not null references public.content_templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);

create table if not exists public.studio_template_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id uuid not null references public.content_templates(id) on delete cascade,
  content_id uuid references public.content_posts(id) on delete set null,
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_templates_workspace_status on public.content_templates(workspace_id, status);
create index if not exists idx_content_templates_workspace_usage on public.content_templates(workspace_id, usage_count desc);
create index if not exists idx_content_templates_workspace_updated on public.content_templates(workspace_id, updated_at desc);
create index if not exists idx_studio_template_usage_template on public.studio_template_usage(template_id, created_at desc);
create index if not exists idx_studio_template_usage_workspace on public.studio_template_usage(workspace_id, created_at desc);
create index if not exists idx_studio_template_favourites_ws on public.studio_template_favourites(workspace_id, user_id);

-- ---------------------------------------------------------------------------
-- 4. HASHTAGS & KEYWORDS
-- ---------------------------------------------------------------------------
alter table public.hashtag_sets add column if not exists kind text not null default 'set';
alter table public.hashtag_sets add column if not exists status text not null default 'active';
alter table public.hashtag_sets add column if not exists topic text;
alter table public.hashtag_sets add column if not exists language text not null default 'en-GB';
alter table public.hashtag_sets add column if not exists region text;
alter table public.hashtag_sets add column if not exists icon text;
alter table public.hashtag_sets add column if not exists description text;
alter table public.hashtag_sets add column if not exists relevance_score integer;
alter table public.hashtag_sets add column if not exists avg_volume integer;
alter table public.hashtag_sets add column if not exists competition numeric(4,2);
alter table public.hashtag_sets add column if not exists growth_30d numeric(6,2);
alter table public.hashtag_sets add column if not exists favourite boolean not null default false;
alter table public.hashtag_sets add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.hashtag_sets add column if not exists updated_at timestamptz not null default now();
alter table public.hashtag_sets add column if not exists archived_at timestamptz;
alter table public.hashtag_sets add column if not exists is_demo boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hashtag_sets_kind_check') then
    alter table public.hashtag_sets add constraint hashtag_sets_kind_check check (kind in ('cluster','set'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hashtag_sets_status_check') then
    alter table public.hashtag_sets add constraint hashtag_sets_status_check check (status in ('active','draft','archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'hashtag_sets_competition_range') then
    alter table public.hashtag_sets add constraint hashtag_sets_competition_range
      check (competition is null or (competition >= 0 and competition <= 1));
  end if;
end $$;

update public.hashtag_sets set owner_id = created_by where owner_id is null and created_by is not null;

create table if not exists public.studio_keyword_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  set_id uuid not null references public.hashtag_sets(id) on delete cascade,
  term text not null,
  kind text not null default 'keyword' check (kind in ('keyword','hashtag')),
  avg_volume integer,
  competition numeric(4,2) check (competition is null or (competition >= 0 and competition <= 1)),
  growth_30d numeric(6,2),
  relevance integer check (relevance is null or (relevance >= 0 and relevance <= 100)),
  source text not null default 'manual' check (source in ('manual','ai','import','recommendation')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (set_id, term)
);

create table if not exists public.studio_blocked_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  term text not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, term)
);

create index if not exists idx_hashtag_sets_workspace_kind on public.hashtag_sets(workspace_id, kind);
create index if not exists idx_hashtag_sets_workspace_updated on public.hashtag_sets(workspace_id, updated_at desc);
create index if not exists idx_hashtag_sets_workspace_relevance on public.hashtag_sets(workspace_id, relevance_score desc nulls last);
create index if not exists idx_studio_keyword_terms_set on public.studio_keyword_terms(set_id, avg_volume desc nulls last);
create index if not exists idx_studio_keyword_terms_workspace on public.studio_keyword_terms(workspace_id);
create index if not exists idx_studio_blocked_terms_workspace on public.studio_blocked_terms(workspace_id);

-- ---------------------------------------------------------------------------
-- 5. MEDIA
-- ---------------------------------------------------------------------------
create table if not exists public.studio_media_collections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'custom' check (kind in ('campaign','brand','social','team','custom')),
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

alter table public.media_assets add column if not exists collection_id uuid references public.studio_media_collections(id) on delete set null;
alter table public.media_assets add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.media_assets add column if not exists status text not null default 'ready';
alter table public.media_assets add column if not exists description text;
alter table public.media_assets add column if not exists usage_count integer not null default 0;
alter table public.media_assets add column if not exists colour_profile text;
alter table public.media_assets add column if not exists checksum text;
alter table public.media_assets add column if not exists review_note text;
alter table public.media_assets add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.media_assets add column if not exists approved_at timestamptz;
alter table public.media_assets add column if not exists version integer not null default 1;
alter table public.media_assets add column if not exists updated_at timestamptz not null default now();
alter table public.media_assets add column if not exists archived_at timestamptz;
alter table public.media_assets add column if not exists is_demo boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'media_assets_status_check') then
    alter table public.media_assets add constraint media_assets_status_check
      check (status in ('uploaded','needs_review','ready','changes_requested','archived'));
  end if;
end $$;

update public.media_assets set owner_id = uploaded_by where owner_id is null and uploaded_by is not null;

create table if not exists public.studio_asset_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  version integer not null,
  file_path text not null,
  file_url text not null,
  file_size integer,
  replaced_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create table if not exists public.studio_content_assets (
  content_id uuid not null references public.content_posts(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (content_id, asset_id)
);

create index if not exists idx_media_assets_workspace_status on public.media_assets(workspace_id, status);
create index if not exists idx_media_assets_workspace_created on public.media_assets(workspace_id, created_at desc);
create index if not exists idx_media_assets_collection on public.media_assets(collection_id);
create index if not exists idx_media_assets_type on public.media_assets(workspace_id, file_type);
create index if not exists idx_studio_media_collections_ws on public.studio_media_collections(workspace_id);
create index if not exists idx_studio_asset_versions_asset on public.studio_asset_versions(asset_id, version desc);
create index if not exists idx_studio_content_assets_content on public.studio_content_assets(content_id, position);
create index if not exists idx_studio_content_assets_asset on public.studio_content_assets(asset_id);

-- ---------------------------------------------------------------------------
-- 6. AI GENERATE
-- ---------------------------------------------------------------------------
alter table public.ai_generations add column if not exists prompt text;
alter table public.ai_generations add column if not exists channel text;
alter table public.ai_generations add column if not exists objective text;
alter table public.ai_generations add column if not exists audience text;
alter table public.ai_generations add column if not exists model text;
alter table public.ai_generations add column if not exists word_count integer;
alter table public.ai_generations add column if not exists match_score integer check (match_score is null or (match_score >= 0 and match_score <= 100));
alter table public.ai_generations add column if not exists bookmarked boolean not null default false;
alter table public.ai_generations add column if not exists used_content_id uuid references public.content_posts(id) on delete set null;
alter table public.ai_generations add column if not exists batch_id uuid;
alter table public.ai_generations add column if not exists archived_at timestamptz;

create table if not exists public.studio_prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  prompt text not null,
  channel text,
  tone text,
  objective text,
  audience text,
  saved boolean not null default true,
  usage_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists idx_ai_generations_workspace_created on public.ai_generations(workspace_id, created_at desc);
create index if not exists idx_ai_generations_batch on public.ai_generations(batch_id);
create index if not exists idx_studio_prompts_workspace on public.studio_prompts(workspace_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 7. STUDIO ACTIVITY — the human-readable feed shown on every Studio surface
-- ---------------------------------------------------------------------------
create table if not exists public.studio_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null,
  link text,
  surface text not null default 'studio',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_studio_activity_workspace on public.studio_activity(workspace_id, created_at desc);
create index if not exists idx_studio_activity_entity on public.studio_activity(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- Every Studio-owned table is reachable only through workspace_members.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'studio_idea_collections','studio_template_usage','studio_keyword_terms',
    'studio_blocked_terms','studio_media_collections','studio_asset_versions',
    'studio_content_assets','studio_prompts','studio_activity'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_workspace', t);
    execute format($f$
      create policy %I on public.%I for all
        using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
        with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
    $f$, t || '_workspace', t);
  end loop;
end $$;

-- Favourites are per-user inside a workspace the user belongs to.
alter table public.studio_template_favourites enable row level security;
drop policy if exists studio_template_favourites_self on public.studio_template_favourites;
create policy studio_template_favourites_self on public.studio_template_favourites for all
  using (user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (user_id = auth.uid() and workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.studio_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'studio_idea_collections','studio_media_collections','studio_prompts',
    'content_ideas','content_templates','hashtag_sets','media_assets'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_studio_updated', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.studio_touch_updated_at()',
      'trg_' || t || '_studio_updated', t
    );
  end loop;
end $$;
