-- ============================================================
-- SEO & Discovery — additive demo seed: brief target keywords + comments.
--
-- Demo briefs were created with target keywords ("keyword research tools",
-- "improve seo rankings", …) that were never added to seo_keywords, so
-- seo_content_briefs.keyword_id stayed null and the Briefs list showed
-- "Vol: 0" with no KD or CPC against every row.
--
-- This migration tracks those target keywords for real, relinks the briefs to
-- them, and gives every remaining demo brief a comment thread. Additive and
-- idempotent: guarded by `not exists`, scoped to demo sites only, everything
-- written carries is_demo = true.
-- ============================================================

do $$
declare
  v_site record;
  v_brief record;
  v_kw record;
  v_owner uuid;
begin
  for v_site in
    select s.id, s.workspace_id, s.owner_id, s.default_country
    from public.seo_sites s
    where s.is_demo = true
  loop
    v_owner := v_site.owner_id;

    -- ---------------- track each brief's target keyword ----------------
    for v_kw in
      select * from (values
        ('keyword research tools',  'informational', 14800, 45, 3.12, 6,    'winning',  '/blog/keyword-research-tools'),
        ('improve seo rankings',    'transactional',  9900, 38, 2.45, 3,    'winning',  '/blog/improve-seo-rankings'),
        ('technical seo checklist', 'informational',  6600, 52, 1.89, 8,    'stable',   '/blog/technical-seo-checklist'),
        ('content optimization',    'informational', 12100, 41, 3.01, 4,    'winning',  '/blog/content-optimization'),
        ('local seo strategy',      'transactional',  5400, 36, 2.15, 2,    'stable',   '/blog/local-seo-strategy'),
        ('eeat seo',                'informational', 13600, 48, 1.76, null, 'not_ranking', null),
        ('instagram caption ideas', 'informational',  8900, 34, 1.42, 11,   'rising',   '/blog/instagram-caption-ideas'),
        ('descript alternative',    'commercial',     4400, 57, 4.80, 14,   'rising',   '/compare/descript-alternative'),
        ('srt vs vtt',              'informational',  2900, 29, 0.94, 19,   'stable',   '/blog/srt-vs-vtt')
      ) as k(keyword, intent, search_volume, difficulty, cpc, current_rank, status, landing_page)
    loop
      insert into public.seo_keywords
        (workspace_id, site_id, keyword, intent, search_volume, difficulty, cpc, current_rank,
         previous_rank, rank_change, landing_page, status, country, device, search_engine,
         source, owner_id, created_by, is_demo)
      select v_site.workspace_id, v_site.id, v_kw.keyword, v_kw.intent, v_kw.search_volume,
             v_kw.difficulty, v_kw.cpc, v_kw.current_rank,
             case when v_kw.current_rank is null then null else v_kw.current_rank + 2 end,
             case when v_kw.current_rank is null then null else 2 end,
             v_kw.landing_page, v_kw.status, coalesce(v_site.default_country, 'gb'),
             'desktop', 'google', 'demo_seed', v_owner, v_owner, true
      where not exists (
        select 1 from public.seo_keywords k2
        where k2.site_id = v_site.id
          and lower(k2.keyword) = lower(v_kw.keyword)
          and k2.country = coalesce(v_site.default_country, 'gb')
          and k2.device = 'desktop'
          and k2.search_engine = 'google'
      );
    end loop;

    -- ---------------- relink briefs to their tracked keyword ----------------
    update public.seo_content_briefs b
    set keyword_id = k.id
    from public.seo_keywords k
    where b.site_id = v_site.id
      and k.site_id = v_site.id
      and b.keyword_id is null
      and lower(k.keyword) = lower(b.target_keyword);

    -- ---------------- comments for every remaining brief ----------------
    if v_owner is not null then
      for v_brief in
        select b.id
        from public.seo_content_briefs b
        where b.site_id = v_site.id
          and b.archived_at is null
          and not exists (select 1 from public.seo_brief_comments c where c.brief_id = b.id)
      loop
        insert into public.seo_brief_comments (workspace_id, brief_id, author_id, body, created_at, is_demo)
        values
          (v_site.workspace_id, v_brief.id, v_owner,
           'Checked this against the current SERP — the top three results all lead with a comparison table.',
           now() - interval '5 hours', true),
          (v_site.workspace_id, v_brief.id, v_owner,
           'Noted. I will add that section and move it above the fold before review.',
           now() - interval '2 hours', true);
      end loop;
    end if;
  end loop;
end $$;
