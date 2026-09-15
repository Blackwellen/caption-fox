-- ============================================================================
-- Caption Fox — Link in Bio: public view for the /r/[slug] short-link redirect
--
-- reusable_links only has a workspace-scoped RLS policy (correct — the
-- destination URL, UTM config, and click count are workspace-private editing
-- data). The /r/[slug] redirect route is anonymous, so it reads through this
-- security-definer view instead, which exposes only what a redirect needs
-- for active links with a vanity slug.
-- ============================================================================

create or replace view public.reusable_links_public as
select id, workspace_id, vanity_slug, destination_url, utm, status
from public.reusable_links
where status = 'active' and vanity_slug is not null;

grant select on public.reusable_links_public to anon, authenticated;

-- Re-point the analytics INSERT policy at this view now that it exists —
-- the original policy (in the base migration) referenced reusable_links
-- directly, which anon cannot SELECT through its own RLS, silently
-- disabling the reusable-link half of that check for anonymous visitors.
drop policy if exists "link_analytics_events_public_insert" on public.link_analytics_events;
create policy "link_analytics_events_public_insert" on public.link_analytics_events for insert
with check (
  event_type in ('page_view','link_click','qr_visit')
  and (
    (page_id is not null and page_id in (select id from public.link_pages_public))
    or (reusable_link_id is not null and reusable_link_id in (select id from public.reusable_links_public))
  )
);
