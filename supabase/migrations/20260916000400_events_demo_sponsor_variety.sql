-- ============================================================
-- Events module — demo seed, sponsor variety.
--
-- The v2 seeder cycled a 10-name company list against a 4-word suffix list,
-- which produced duplicates ("Redwood Labs Labs") and, because the tier and
-- value arrays cycled on different periods, left most sponsors on the same
-- tier and value. The portfolio read as obviously generated.
--
-- This gives every demo sponsor a distinct fictional name, a tier-appropriate
-- value, and spreads renewal dates so the renewal KPI is non-zero.
-- Idempotent: only touches demo rows, and re-running is harmless.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_ids uuid[];
  v_names text[] := array[
    'Northwind Cloud','Halcyon Data','Beacon CRM','Lumen Analytics','Kestrel Software',
    'Arbour Health','Tidewater Logistics','Vantage Retail','Marlow Financial','Redwood Labs',
    'Aldgate Partners','Brightwater Media','Copperleaf Systems','Dunmore Digital','Elmgrove Studios',
    'Fenwick Interactive','Granary Payments','Harbourline Group','Ironbridge Tech','Juniper Works',
    'Kingsway Mobility','Larkfield Energy','Meridian Robotics','Norbury Foods','Oakhurst Insurance',
    'Pinegate Travel','Quarry Lane Books','Ravenswood AI','Stonebridge Legal','Thornbury Fitness',
    'Uplands Property','Vellum Publishing','Westmere Telecom','Yarrow Biotech','Zephyr Aviation',
    'Ashcombe Ceramics','Bellhaven Coffee','Cairnwell Outdoors','Drayton Textiles','Eastcote Optics',
    'Fairhaven Marine','Glenmoor Whisky','Hollybank Toys','Inverness Cycles'];
  v_tier text;
  i int;
begin
  select id into v_ws from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  select array_agg(id order by created_at) into v_ids
  from public.sponsors where workspace_id = v_ws and is_demo = true;
  if v_ids is null then return; end if;

  for i in 1..array_length(v_ids, 1) loop
    update public.sponsors
    set name = v_names[1 + ((i - 1) % array_length(v_names, 1))],
        company_name = v_names[1 + ((i - 1) % array_length(v_names, 1))]
    where id = v_ids[i];

    -- tier drives value, the way a real rate card works
    v_tier := (array['premier','platinum','gold','silver','bronze'])[1 + ((i - 1) % 5)];
    update public.sponsorships
    set tier = v_tier,
        value = case v_tier
                  when 'premier'  then 100000 + (abs(hashtext(id::text)) % 5) * 5000
                  when 'platinum' then  75000 + (abs(hashtext(id::text)) % 5) * 4000
                  when 'gold'     then  50000 + (abs(hashtext(id::text)) % 5) * 3000
                  when 'silver'   then  25000 + (abs(hashtext(id::text)) % 5) * 2000
                  else                  12000 + (abs(hashtext(id::text)) % 5) * 1000
                end,
        renewal_due_at = now() + (((abs(hashtext(id::text)) % 80) + 5) || ' days')::interval
    where sponsor_id = v_ids[i];
  end loop;

  -- Vary the seeded activity feed: the same five lines repeated read as fake.
  delete from public.event_activity
  where workspace_id = v_ws and entity_type = 'sponsorship' and summary like '%committed%';

  insert into public.event_activity (workspace_id, event_id, entity_type, action, summary, actor_name, created_at)
  select v_ws, s.event_id, 'sponsorship', 'received',
         sp.name || ' committed ' || to_char(s.value, 'FM£999,999,999'),
         (array['Michael Chen','Sarah Johnson','Emily Carter','David Lee'])[1 + (row_number() over (order by s.created_at desc) % 4)],
         now() - ((row_number() over (order by s.created_at desc) * 47) || ' minutes')::interval
  from public.sponsorships s
  join public.sponsors sp on sp.id = s.sponsor_id
  where s.workspace_id = v_ws and s.stage in ('contracted','active','completed')
  order by s.created_at desc
  limit 6;
end $$;
