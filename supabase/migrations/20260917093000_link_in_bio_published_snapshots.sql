-- ============================================================================
-- Caption Fox — Link in Bio: published snapshots
--
-- Editing a page changes its working rows (link_pages / link_page_items). The
-- public page never reads those: it renders the page's single published
-- version snapshot, so edits stay private until "Publish changes".
--
-- The snapshot pins the theme tokens at publish time. Publishing a theme does
-- not silently restyle live pages; they adopt it on their next publish.
-- ============================================================================

create unique index if not exists idx_link_page_versions_one_published
  on public.link_page_versions(page_id) where published = true;

create or replace function public.link_page_build_snapshot(p_page_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'title', p.title, 'description', p.description, 'page_kind', p.page_kind,
      'legal', p.legal, 'consent', p.consent, 'show_caption_fox_branding', p.show_caption_fox_branding,
      'seo_title', p.seo_title, 'seo_description', p.seo_description, 'og_image', p.og_image,
      'favicon_url', p.favicon_url, 'index_in_search', p.index_in_search
    ),
    'tokens', coalesce(t.tokens, '{}'::jsonb),
    'theme_id', p.theme_id,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'parent_id', i.parent_id, 'item_type', i.item_type, 'title', i.title,
        'description', i.description, 'url', i.url, 'icon', i.icon, 'config', i.config,
        'is_active', i.is_active, 'sort_order', i.sort_order, 'reusable_link_id', i.reusable_link_id,
        'schedule_start', i.schedule_start, 'schedule_end', i.schedule_end
      ) order by i.parent_id nulls first, i.sort_order)
      from public.link_page_items i where i.page_id = p.id
    ), '[]'::jsonb)
  )
  from public.link_pages p
  left join public.link_themes t on t.id = p.theme_id
  where p.id = p_page_id
$$;
grant execute on function public.link_page_build_snapshot(uuid) to authenticated;

drop view if exists public.link_page_live_versions;
create view public.link_page_live_versions as
select v.page_id, p.slug, p.domain_id, v.version, v.snapshot, v.published_at
from public.link_page_versions v
join public.link_pages_public p on p.id = v.page_id
where v.published = true;
grant select on public.link_page_live_versions to anon, authenticated;

-- Public custom-domain lookup: verified hostnames only.
drop view if exists public.link_domains_public;
create view public.link_domains_public as
select id, lower(hostname) as hostname from public.link_domains where status = 'verified';
grant select on public.link_domains_public to anon, authenticated;

-- Backfill: every currently published page gets a real snapshot on its latest
-- published version (or a new version 1 when none exists).
do $$
declare r record;
begin
  for r in select p.id, p.workspace_id, p.current_version, p.owner_id from public.link_pages p
           where p.status in ('published','scheduled') and p.archived_at is null loop
    if exists (select 1 from public.link_page_versions where page_id = r.id and published = true) then
      update public.link_page_versions set snapshot = public.link_page_build_snapshot(r.id)
        where page_id = r.id and published = true;
    else
      insert into public.link_page_versions (page_id, workspace_id, version, snapshot, published, status, change_summary, created_by, published_at)
      values (r.id, r.workspace_id, coalesce(r.current_version, 1) + 0, public.link_page_build_snapshot(r.id), true, 'published', 'Published', r.owner_id, now())
      on conflict (page_id, version) do update set snapshot = excluded.snapshot, published = true, status = 'published';
    end if;
  end loop;
end $$;
