-- Positioning frameworks carry the market they position for, so the Positioning
-- filter bar can narrow by market (design 5). Nullable: existing frameworks stay
-- valid and "not set" is a real answer until a team fills it in.
alter table public.strategy_positioning_frameworks
  add column if not exists market text;

alter table public.strategy_positioning_frameworks
  drop constraint if exists strategy_frameworks_market_check;

alter table public.strategy_positioning_frameworks
  add constraint strategy_frameworks_market_check
  check (market is null or market in (
    'uk','ireland','europe','north_america','apac','middle_east','latam','africa','global'
  ));

create index if not exists idx_strategy_frameworks_market
  on public.strategy_positioning_frameworks(workspace_id, market)
  where market is not null;

-- Demo workspaces only: give the seeded frameworks a market so the Positioning
-- market filter has realistic data to match. Real customer rows stay untouched.
with ranked as (
  select f.id, row_number() over (partition by f.workspace_id order by f.created_at, f.id) as seq
  from public.strategy_positioning_frameworks f
  join public.workspaces w on w.id = f.workspace_id
  where f.market is null and w.slug like '%-demo'
)
update public.strategy_positioning_frameworks f
set market = case ranked.seq % 4
  when 1 then 'uk' when 2 then 'europe' when 3 then 'north_america' else 'global' end
from ranked
where ranked.id = f.id;
