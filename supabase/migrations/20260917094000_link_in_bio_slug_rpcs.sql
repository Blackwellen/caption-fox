-- ============================================================================
-- Caption Fox — Link in Bio: global slug availability checks
--
-- Page slugs (/l/{slug}) and short-link slugs (/r/{slug}) are global, but RLS
-- hides other workspaces' rows, so a member cannot see why a slug is taken.
-- These return a boolean only — never which workspace owns the slug.
-- ============================================================================

create or replace function public.link_slug_taken(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.link_pages where lower(slug) = lower(p_slug))
$$;

create or replace function public.link_short_slug_taken(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from public.reusable_links where lower(vanity_slug) = lower(p_slug))
$$;

revoke all on function public.link_slug_taken(text) from public, anon;
revoke all on function public.link_short_slug_taken(text) from public, anon;
grant execute on function public.link_slug_taken(text) to authenticated;
grant execute on function public.link_short_slug_taken(text) to authenticated;
