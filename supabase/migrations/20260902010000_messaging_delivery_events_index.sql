-- ============================================================
-- Caption Fox — Messaging: index for webhook event attribution
-- The Resend (and future provider) webhook receiver looks up the original
-- "sent" delivery event by provider_message_id to attribute delivered/opened/
-- clicked/bounced events to the right message + contact. Safe to re-run.
-- ============================================================
create index if not exists idx_messaging_delivery_events_provider_message
  on public.messaging_delivery_events(provider_message_id, event_type);
