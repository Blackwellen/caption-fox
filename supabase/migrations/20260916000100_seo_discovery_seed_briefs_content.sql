-- ============================================================
-- SEO & Discovery — additive demo seed for the Briefs surface.
--
-- The original seed (20260831000100) gave every demo site ten briefs but only
-- one outline, two comments and no content-scope opportunities, so the Briefs
-- right rail ("Brief Outline Preview", "Opportunities to Brief Next") and the
-- Comments panel rendered their empty states on a fully seeded workspace.
--
-- This migration fills those three gaps. It is additive and idempotent: every
-- insert is guarded by a `not exists` check on a natural key, it only touches
-- rows on demo sites (seo_sites.is_demo), and everything it writes carries
-- is_demo = true. Re-running it is a no-op. Real customer sites are never
-- touched — they keep their genuine empty states.
-- ============================================================

do $$
declare
  v_site record;
  v_brief record;
  v_owner uuid;
  v_outline jsonb := jsonb_build_array(
    jsonb_build_array('h1', 'Introduction',        'true'),
    jsonb_build_array('h2', 'Why this matters',    'true'),
    jsonb_build_array('h2', 'Key considerations',  'true'),
    jsonb_build_array('h2', 'Step-by-step walkthrough', 'false'),
    jsonb_build_array('h2', 'Tools and templates', 'false'),
    jsonb_build_array('h2', 'Common mistakes',     'false'),
    jsonb_build_array('h2', 'Conclusion',          'false')
  );
  v_row jsonb;
  v_pos integer;
begin
  for v_site in
    select s.id, s.workspace_id, s.owner_id
    from public.seo_sites s
    where s.is_demo = true
  loop
    v_owner := v_site.owner_id;

    -- ---------------- content-scope opportunities ----------------
    -- "Opportunities to Brief Next" reads scope = 'content'; the original seed
    -- only produced organic/ranking/local/ai_search/backlink rows.
    insert into public.seo_opportunities
      (workspace_id, site_id, scope, category, title, description, search_volume, potential_traffic,
       potential_rank, priority, effort, impact, status, score, score_reason, is_demo)
    select v_site.workspace_id, v_site.id, 'content', c.category, c.title, c.description,
           c.search_volume, c.potential_traffic, c.potential_rank, c.priority, c.effort, c.impact,
           'open', c.score, c.score_reason, true
    from (values
      ('content_gap',     'long tail keywords',         'No page targets this cluster yet — 40+ related queries have impressions but no ranking URL.', 8100, 4300, 32, 'high',   'medium', 'high',   86.0, 'Impressions without a ranking URL, clustered around one topic.'),
      ('content_gap',     'free keyword research tools','Competitors rank on page one; we have no comparable page.',                                     6600, 3100, 41, 'high',   'medium', 'high',   82.0, 'Three tracked competitors rank top-10; our domain is absent.'),
      ('faq_opportunity', 'keyword research for seo',   'People Also Ask block present on every tracked SERP for this query.',                           4400, 2600, 37, 'medium', 'low',    'medium', 75.0, 'PAA feature present with no answer block on our landing page.'),
      ('content_gap',     'best seo tools 2024',        'Seasonal round-up query with rising volume and no current coverage.',                           3600, 2200, 43, 'medium', 'medium', 'medium', 70.0, 'Rising 90-day trend with zero tracked coverage.'),
      ('faq_opportunity', 'keyword difficulty explained','Definition query feeding the pillar page — currently unanswered.',                             2900, 1900, 29, 'low',    'low',    'medium', 61.0, 'Supporting query for an existing pillar page.')
    ) as c(category, title, description, search_volume, potential_traffic, potential_rank, priority, effort, impact, score, score_reason)
    where not exists (
      select 1 from public.seo_opportunities o
      where o.site_id = v_site.id and o.scope = 'content' and o.title = c.title
    );

    -- ---------------- outlines for the remaining briefs ----------------
    for v_brief in
      select b.id, b.title
      from public.seo_content_briefs b
      where b.site_id = v_site.id
        and b.archived_at is null
        and not exists (select 1 from public.seo_brief_sections x where x.brief_id = b.id)
      order by b.due_date nulls last
      limit 8
    loop
      v_pos := 0;
      for v_row in select * from jsonb_array_elements(v_outline)
      loop
        v_pos := v_pos + 1;
        insert into public.seo_brief_sections (workspace_id, brief_id, level, title, position, completed, is_demo)
        values (
          v_site.workspace_id,
          v_brief.id,
          v_row ->> 0,
          case when v_pos = 1 then v_brief.title else v_row ->> 1 end,
          v_pos,
          (v_row ->> 2) = 'true',
          true
        );
      end loop;
    end loop;

    -- ---------------- comments on the newest briefs ----------------
    if v_owner is not null then
      for v_brief in
        select b.id, b.title
        from public.seo_content_briefs b
        where b.site_id = v_site.id
          and b.archived_at is null
          and not exists (select 1 from public.seo_brief_comments c where c.brief_id = b.id)
        order by b.updated_at desc
        limit 4
      loop
        insert into public.seo_brief_comments (workspace_id, brief_id, author_id, body, created_at, is_demo)
        values
          (v_site.workspace_id, v_brief.id, v_owner,
           'Outline looks solid. Can we pull the comparison table above the fold?',
           now() - interval '3 hours', true),
          (v_site.workspace_id, v_brief.id, v_owner,
           'Agreed — I will restructure it and flag for review once the intro is rewritten.',
           now() - interval '90 minutes', true);
      end loop;
    end if;
  end loop;
end $$;
