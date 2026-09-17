-- ============================================================
-- Events module — demo seed, follow-up outreach volume.
--
-- The Follow-up route's Outreach Performance chart and four of its KPIs read
-- event_outreach_events. With only a handful of rows the page showed
-- "103 emails sent" and a +550% response delta.
--
-- Seeds two comparable 30-day windows so opens, replies, meetings and the
-- conversion rate are all computed from rows, and the period-on-period deltas
-- are believable. Idempotent: guarded on the volume it writes.
-- ============================================================

do $$
declare
  v_ws uuid;
  v_seq uuid;
  v_events uuid[];
  i int;
  d int;
  v_sent int;
begin
  select id into v_ws from public.workspaces
  where slug = 'jamahl-thomas-campaign-manager-demo' limit 1;
  if v_ws is null then return; end if;

  if (select count(*) from public.event_outreach_events where workspace_id = v_ws) > 500 then
    return;
  end if;

  select id into v_seq from public.event_followup_sequences
  where workspace_id = v_ws order by created_at limit 1;

  select array_agg(id) into v_events from (
    select id from public.events
    where workspace_id = v_ws and status in ('completed','live')
    order by start_at desc limit 8
  ) t;
  if v_events is null then return; end if;

  -- 60 days: the current window runs ~18% hotter than the previous one.
  for d in 0..59 loop
    v_sent := case when d < 30 then 118 + (abs(hashtext((d || 's')::text)) % 34)
                   else 98 + (abs(hashtext((d || 'p')::text)) % 28) end;

    for i in 1..v_sent loop
      insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
      values (v_ws, v_events[1 + ((d + i) % array_length(v_events, 1))], v_seq, 'email_sent',
              now() - (d || ' days')::interval + ((i % 540) || ' minutes')::interval);

      -- ~43% opened, ~5% replied, and a small share book or convert
      if (abs(hashtext((d || '-' || i || '-o')::text)) % 100) < 43 then
        insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
        values (v_ws, v_events[1 + ((d + i) % array_length(v_events, 1))], v_seq, 'email_opened',
                now() - (d || ' days')::interval + (((i % 540) + 35) || ' minutes')::interval);
      end if;

      if (abs(hashtext((d || '-' || i || '-r')::text)) % 100) < 5 then
        insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
        values (v_ws, v_events[1 + ((d + i) % array_length(v_events, 1))], v_seq, 'email_replied',
                now() - (d || ' days')::interval + (((i % 540) + 90) || ' minutes')::interval);
      end if;

      if (abs(hashtext((d || '-' || i || '-m')::text)) % 1000) < 11 then
        insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
        values (v_ws, v_events[1 + ((d + i) % array_length(v_events, 1))], v_seq, 'meeting_booked',
                now() - (d || ' days')::interval + (((i % 540) + 140) || ' minutes')::interval);
      end if;

      if (abs(hashtext((d || '-' || i || '-c')::text)) % 100) < 8 then
        insert into public.event_outreach_events (workspace_id, event_id, sequence_id, outreach_type, occurred_at)
        values (v_ws, v_events[1 + ((d + i) % array_length(v_events, 1))], v_seq, 'converted',
                now() - (d || ' days')::interval + (((i % 540) + 200) || ' minutes')::interval);
      end if;
    end loop;
  end loop;
end $$;
