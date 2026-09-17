-- ============================================================
-- Events module — demo seed, prior comparison window.
--
-- Every KPI on the Events routes compares the selected window against the one
-- before it. With registrations only in the last 30 days the previous window
-- was almost empty, so the deltas rendered as nonsense (+11,720%).
--
-- This seeds the preceding 30 days at ~84% of current volume and a slightly
-- lower attendance rate, so "vs last 30 days" is a real, believable comparison
-- computed from rows rather than a hard-coded figure.
--
-- Idempotent: guarded on the marker email prefix it writes.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_big_events uuid[];
  i int;
  v_day int;
  v_first_names text[] := array['Emily','Michael','Sophia','James','Olivia','Daniel','Grace','Thomas','Hannah','Ryan',
                               'Chloe','Adam','Isla','Nathan','Freya','Owen','Amelia','Lucas','Ruby','Ethan',
                               'Maya','Joseph','Erin','Caleb','Nina','Aaron','Leah','Oscar','Zara','Felix'];
  v_last_names text[] := array['Carter','Chen','Martinez','Wilson','Brown','Hughes','Patel','Okafor','Novak','Ellis',
                               'Foster','Reid','Murray','Bennett','Shah','Doyle','Barnes','Ward','Fleming','Price'];
  v_companies  text[] := array['Northwind Cloud','Halcyon Data','Beacon CRM','Lumen Analytics','Kestrel Software',
                               'Arbour Health','Tidewater Logistics','Vantage Retail','Marlow Financial','Redwood Labs'];
begin
  select id into v_ws from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  if exists (select 1 from public.event_registrations
             where workspace_id = v_ws and email like 'demo.prior%') then
    return; -- already seeded
  end if;

  select array_agg(id) into v_big_events from (
    select id from public.events
    where workspace_id = v_ws and is_demo = true and status <> 'cancelled'
    order by created_at limit 10
  ) t;
  if v_big_events is null then return; end if;

  for i in 1..6970 loop
    -- days 30..59 back, same rising shape as the current window
    v_day := 30 + floor(29 * power(i::numeric / 6970, 0.78))::int;
    insert into public.event_registrations (
      workspace_id, event_id, full_name, email, company, job_title,
      status, source, registered_at, attended, checked_in_at, watch_seconds,
      consent_marketing, follow_up_status, is_demo, created_at
    ) values (
      v_ws, v_big_events[1 + (i % array_length(v_big_events, 1))],
      v_first_names[1 + (i % 30)] || ' ' || v_last_names[1 + ((i / 7) % 20)],
      'demo.prior' || i || '@example.com',
      v_companies[1 + (i % 10)],
      (array['Marketing Manager','Head of Growth','Founder','CMO','Content Lead','Demand Gen Manager'])[1 + (i % 6)],
      -- short cycles so each day carries the same mix (a long cycle put whole
      -- days either side of the boundary and made the trend line saw-tooth)
      case when (i % 21) < 12 then 'attended'
           when (i % 53) = 0 then 'cancelled'
           when (i % 29) = 0 then 'no_show'
           when (i % 5) = 0 then 'confirmed'
           else 'registered' end,
      (array['form','campaign','manual','import','portal'])[1 + (i % 5)],
      now() - ((59 - (v_day - 30)) || ' days')::interval + ((i % 1200) || ' minutes')::interval,
      (i % 21) < 12,
      case when (i % 21) < 12 then now() - ((59 - (v_day - 30)) || ' days')::interval else null end,
      case when (i % 21) < 12 then 900 + (i % 2400) else null end,
      (i % 3) <> 0,
      'completed',
      true,
      now() - ((59 - (v_day - 30)) || ' days')::interval
    ) on conflict (event_id, email) do nothing;
  end loop;
end $$;
