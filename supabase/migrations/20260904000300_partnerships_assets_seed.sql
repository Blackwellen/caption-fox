-- ============================================================
-- Partnerships — deterministic demo seed for content/asset approvals.
-- Adds a small set of ambassador content submissions and co-marketing
-- asset approvals against the partners the main seed already created.
-- Idempotent: only inserts when the target workspace has no assets yet.
-- ============================================================

create or replace function public.seed_partnerships_assets_demo(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_row record;
begin
  if p_workspace_id is null then return; end if;

  select id into v_existing from public.partnership_assets where workspace_id = p_workspace_id limit 1;
  if v_existing is not null then return; end if;

  for v_row in
    select pp.id as partner_id, pp.programme_id, pp.name as partner_name, prog.programme_type
    from public.partnership_partners pp
    join public.partnership_programmes prog on prog.id = pp.programme_id
    where pp.workspace_id = p_workspace_id and prog.programme_type in ('ambassador', 'co_marketing')
  loop
    if v_row.programme_type = 'ambassador' then
      insert into public.partnership_assets (workspace_id, programme_id, partner_id, asset_type, title, platform, status, submitted_at)
      values
        (p_workspace_id, v_row.programme_id, v_row.partner_id, 'social_post', v_row.partner_name || ' — unboxing reel', 'instagram', 'submitted', now() - interval '2 days'),
        (p_workspace_id, v_row.programme_id, v_row.partner_id, 'content', v_row.partner_name || ' — product review', 'youtube', 'approved', now() - interval '9 days');
    else
      insert into public.partnership_assets (workspace_id, programme_id, partner_id, asset_type, title, platform, status, submitted_at)
      values
        (p_workspace_id, v_row.programme_id, v_row.partner_id, 'creative', v_row.partner_name || ' — co-branded banner set', 'web', 'submitted', now() - interval '3 days'),
        (p_workspace_id, v_row.programme_id, v_row.partner_id, 'document', v_row.partner_name || ' — joint webinar brief', null, 'approved', now() - interval '11 days');
    end if;
  end loop;
end;
$$;
