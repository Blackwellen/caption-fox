-- ============================================================
-- Align the Social module's legacy demo conversations with the Inbox SLA
-- model introduced in 20260917120000. Demo rows only (is_demo = true).
--
-- The Social seed recorded replies (inbox_messages) and an sla_state label but
-- never set first_response_at / closed_at, so every seeded conversation read as
-- breached once due times were derived. This derives the missing timestamps
-- from the seeded messages and labels. Idempotent.
-- ============================================================

-- Replied conversations: first response = first team message.
update public.inbox_threads t
   set first_response_at = m.first_reply
  from (select thread_id, min(sent_at) first_reply from public.inbox_messages
         where sender_type = 'internal' and not is_internal_note group by thread_id) m
 where m.thread_id = t.id and t.is_demo and t.first_response_at is null;

-- Resolved conversations: closed when last updated.
update public.inbox_threads
   set closed_at = coalesce(resolved_at, updated_at), resolved_at = coalesce(resolved_at, updated_at)
 where is_demo and status in ('resolved', 'done') and closed_at is null;

-- Open demo conversations keep the SLA label the seed intended.
update public.inbox_threads
   set resolution_due_at = greatest(resolution_due_at, now() + interval '2 days')
 where is_demo and status in ('open', 'assigned') and sla_state in ('met', 'on_track')
   and (external_thread_id is null or external_thread_id not like 'inbox-demo:%');

update public.inbox_threads
   set first_response_due_at = greatest(first_response_due_at, now() + interval '3 hours')
 where is_demo and status in ('open', 'assigned') and sla_state = 'on_track' and first_response_at is null
   and (external_thread_id is null or external_thread_id not like 'inbox-demo:%');

update public.inbox_threads
   set first_response_due_at = now() + interval '20 minutes'
 where is_demo and status in ('open', 'assigned') and sla_state = 'warning' and first_response_at is null
   and first_response_due_at < now()
   and (external_thread_id is null or external_thread_id not like 'inbox-demo:%');
