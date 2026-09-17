-- ============================================================
-- SEO & Discovery — additive demo seed: outreach lists.
--
-- Demo sites had link opportunities but no outreach list, so every
-- "Add to List" action on the Backlinks surface could only say
-- "Create a list first". This gives each demo site two realistic lists.
-- Additive and idempotent; demo sites only; rows flagged is_demo.
-- ============================================================

insert into public.seo_outreach_lists (workspace_id, site_id, name, description, owner_id, status, is_demo, created_by)
select s.workspace_id, s.id, l.name, l.description, s.owner_id, 'active', true, s.owner_id
from public.seo_sites s
cross join (values
  ('AI tools round-ups', 'Editors publishing "best AI video tools" style round-ups.'),
  ('Creator economy press', 'Publications covering creator tooling and short-form video.')
) as l(name, description)
where s.is_demo = true
  and not exists (
    select 1 from public.seo_outreach_lists o where o.site_id = s.id and o.name = l.name
  );
