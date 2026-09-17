-- Events demo: no registrations in the future.
--
-- The v2 seed stamped registrations as "day + fixed hour", so when it runs
-- before that hour, today's rows land later than now(). The follow-up list
-- then showed every recent registrant as "Registered just now".
--
-- Moves any future-dated demo registration to a deterministic point within the
-- previous ~10 hours (never before today's midnight, so the daily registration
-- trend keeps the same buckets). Safe to re-run: it only touches future rows.

update public.event_registrations r
set registered_at = greatest(
      date_trunc('day', now()),
      now() - make_interval(mins => 5 + (abs(hashtext(r.id::text)) % 595))
    ),
    checked_in_at = case
      when r.checked_in_at is not null and r.checked_in_at > now()
        then least(now(), greatest(date_trunc('day', now()), now() - make_interval(mins => 5 + (abs(hashtext(r.id::text)) % 595))) + interval '2 hours')
      else r.checked_in_at
    end
where r.is_demo = true
  and r.registered_at > now();
