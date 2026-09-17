-- ============================================================
-- Strategy demo data: restore realistic "last updated" times and a
-- realistic mix of research methods on the headline items.
--
-- The first seed run issued follow-up UPDATEs that fired the updated_at
-- triggers, so every demo research item read "Updated today". This touches
-- is_demo rows only, with triggers paused for the duration.
-- Idempotent: values are derived from each row's position, not from now().
-- ============================================================

alter table public.strategy_research_items disable trigger trg_strategy_research_items_updated_at;

with ranked as (
  select id, row_number() over (partition by workspace_id order by created_at desc, id) as n
  from public.strategy_research_items where is_demo
)
update public.strategy_research_items r set
  updated_at = now() - (case ranked.n when 1 then 2 when 2 then 5 when 3 then 7 when 4 then 8 else ranked.n * 3 end) * interval '1 day',
  method = case ranked.n when 1 then 'interview' when 2 then 'report' when 3 then 'market_data' when 4 then 'survey' else r.method end
from ranked where ranked.id = r.id;

-- The seed inserted titles in reverse chronological order; make the four
-- headline studies the most recently updated so the library highlights them.
update public.strategy_research_items set updated_at = now() - interval '2 days', method = 'interview'
where is_demo and title like 'Gen Z Summer Trends%';
update public.strategy_research_items set updated_at = now() - interval '5 days', method = 'report'
where is_demo and title = 'Sustainable Packaging Study';
update public.strategy_research_items set updated_at = now() - interval '7 days', method = 'market_data'
where is_demo and title = 'Competitive Messaging Audit';
update public.strategy_research_items set updated_at = now() - interval '8 days', method = 'survey'
where is_demo and title like 'Brand Perception Survey%';

alter table public.strategy_research_items enable trigger trg_strategy_research_items_updated_at;
