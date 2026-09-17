-- Studio daily metric history.
-- 1. Keyword / hashtag group volume per day, so growth sparklines plot real history.
-- 2. Post engagement per day, so "last 7 days" engagement is a real window sum
--    rather than a lifetime running total.

create table if not exists public.studio_keyword_metrics_daily (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  set_id uuid not null references public.hashtag_sets(id) on delete cascade,
  day date not null,
  avg_volume integer not null default 0 check (avg_volume >= 0),
  relevance integer check (relevance between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (set_id, day)
);
create index if not exists idx_studio_keyword_metrics_ws_day on public.studio_keyword_metrics_daily(workspace_id, day desc);

create table if not exists public.content_engagement_daily (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid not null references public.content_posts(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  shares integer not null default 0 check (shares >= 0),
  created_at timestamptz not null default now(),
  primary key (post_id, day)
);
create index if not exists idx_content_engagement_daily_ws_day on public.content_engagement_daily(workspace_id, day desc);

do $$
declare t text;
begin
  foreach t in array array['studio_keyword_metrics_daily', 'content_engagement_daily'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    -- Members read their workspace's history. Writes come only from trusted
    -- server jobs (service role), so no insert/update policy is granted.
    execute format($f$
      create policy %I on public.%I for select
        using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
    $f$, t || '_read', t);
  end loop;
end $$;
