-- ============================================================================
-- Caption Fox — Link in Bio: SECURITY DEFINER counters for public tracking
--
-- Anonymous visitors cannot UPDATE link_pages/link_page_items/reusable_links
-- directly (workspace-scoped RLS blocks it, correctly). These functions let
-- the public renderer bump the denormalised view/click counters used by the
-- collection and detail pages, while independently re-validating that the
-- target is a genuinely published, public row before writing anything.
-- ============================================================================

create or replace function public.increment_link_page_view(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.link_pages
  set total_views = total_views + 1
  where id = p_page_id
    and status = 'published'
    and visibility = 'public';
end;
$$;

create or replace function public.increment_link_page_click(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.link_pages
  set total_clicks = total_clicks + 1
  where id = p_page_id
    and status = 'published'
    and visibility = 'public';
end;
$$;

create or replace function public.increment_link_item_click(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.link_page_items li
  set click_count = click_count + 1
  where li.id = p_item_id
    and li.is_active = true
    and exists (select 1 from public.link_pages_public lp where lp.id = li.page_id);
end;
$$;

create or replace function public.increment_reusable_link_click(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reusable_links
  set click_count = click_count + 1
  where id = p_link_id
    and status = 'active';
end;
$$;

grant execute on function public.increment_link_page_view(uuid) to anon, authenticated;
grant execute on function public.increment_link_page_click(uuid) to anon, authenticated;
grant execute on function public.increment_link_item_click(uuid) to anon, authenticated;
grant execute on function public.increment_reusable_link_click(uuid) to anon, authenticated;
