-- ============================================================
-- Events module — demo seed, webinar depth.
--
-- The Webinars route reads three things the earlier seeds did not provide:
--   * webinar_attendance_trend keys off each webinar's own start_at, so a
--     completed webinar outside the 30-day window contributes nothing and the
--     chart rendered its empty state;
--   * the Run of Show panel needs sessions on a webinar-type event;
--   * the questions panel and KPI need webinar_questions rows.
--
-- Idempotent: guarded on the questions it writes.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_owner uuid;
  v_ev uuid;
  v_upcoming uuid;
  v_ids uuid[];
  i int;
  j int;
begin
  select id, owner_id into v_ws, v_owner from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  -- Guard on this seeder's own volume, not on the v1 seed's three questions.
  if (select count(*) from public.webinar_questions where workspace_id = v_ws) > 100 then
    return;
  end if;

  -- 1. Pull completed webinars into the last 30 days so the attendance-rate
  --    trend has points to plot (the rate itself stays computed from rows).
  select array_agg(id) into v_ids from (
    select id from public.events
    where workspace_id = v_ws and event_type = 'webinar' and status = 'completed'
    order by start_at desc limit 8
  ) t;

  if v_ids is not null then
    for i in 1..array_length(v_ids, 1) loop
      update public.events
      set start_at = date_trunc('day', now() - ((i * 3 + 1) || ' days')::interval) + interval '10 hours',
          end_at   = date_trunc('day', now() - ((i * 3 + 1) || ' days')::interval) + interval '11 hours'
      where id = v_ids[i];
    end loop;
  end if;

  -- 2. Agenda for the next upcoming webinar (drives Run of Show / Agenda).
  select id into v_upcoming from public.events
  where workspace_id = v_ws and event_type = 'webinar' and status in ('upcoming','scheduled')
  order by start_at limit 1;

  if v_upcoming is not null then
    insert into public.event_sessions (
      workspace_id, event_id, title, session_type, start_at, end_at, position, room, status, is_public, created_by
    )
    select v_ws, v_upcoming, t.title, t.stype,
           date_trunc('day', now()) + interval '9 hours' + ((t.pos * 20) || ' minutes')::interval,
           date_trunc('day', now()) + interval '9 hours' + (((t.pos + 1) * 20) || ' minutes')::interval,
           t.pos, 'Main Channel',
           case when t.pos = 0 then 'completed' when t.pos = 1 then 'live' else 'upcoming' end,
           true, v_owner
    from (values
      ('Welcome & Opening Remarks','registration',0),
      ('Market Trends in 2026','keynote',1),
      ('Product Demo','demo',2),
      ('Customer Success Story','session',3),
      ('Q&A Session','qa',4),
      ('Closing Remarks','closing',5)
    ) as t(title, stype, pos);
  end if;

  -- 3. Audience questions across recent webinars.
  for i in 1..coalesce(array_length(v_ids, 1), 0) loop
    v_ev := v_ids[i];
    for j in 1..42 loop
      insert into public.webinar_questions (workspace_id, event_id, asked_by_name, question, status, created_at)
      values (
        v_ws, v_ev,
        (array['David Lee','Sarah Johnson','Priya Sharma','Michael Chen','Olivia Brown',
               'Tom Fleming','Grace Okafor'])[1 + ((i * j) % 7)],
        (array['Will the session be recorded and shared?',
               'Can you share more about the integration?',
               'How does pricing work for larger teams?',
               'Is there a migration path from our current tool?',
               'Which reports are available out of the box?',
               'Does this support multi-workspace reporting?'])[1 + ((i + j) % 6)],
        case when (i + j) % 3 = 0 then 'answered' else 'open' end,
        now() - ((i * 3) || ' days')::interval + ((j * 7) || ' minutes')::interval
      );
    end loop;
  end loop;
end $$;
