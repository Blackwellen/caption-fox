-- ============================================================================
-- Brand & Assets — campaign readiness, computed in one place
--
-- brand_product_readiness(product) evaluates the weighted checks from real
-- linked records and writes product_readiness_checks + products.readiness_*.
-- The server action calls it after every link/unlink/create, and the nightly
-- rights sweep recalculates every product, so a score is never typed in.
--
-- Weights (sum 13): primary image 2, packshot 1.5, lifestyle 1, video/360 1,
-- description 1, metadata 1, market data 1, localisation 0.5,
-- approved assets 1.5, rights coverage 1.5, brand compliance 1.
-- Score = weighted share passed. >= 90 ready, >= 60 review, else not ready.
-- ============================================================================

create or replace function public.brand_product_readiness(p_product uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p        record;
  n_links  int;
  v_score  numeric;
begin
  select id, workspace_id, description, category_id, primary_asset_id into p from public.products where id = p_product;
  if p.id is null then return null; end if;

  -- Only a member of the product's workspace (or the scheduler) may recalculate it.
  if auth.uid() is not null and not public.is_workspace_member(p.workspace_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  select count(*) into n_links from public.product_assets where product_id = p.id;

  delete from public.product_readiness_checks where product_id = p.id;
  insert into public.product_readiness_checks (workspace_id, product_id, check_key, passed, weight, detail)
  select p.workspace_id, p.id, c.key, c.ok, c.w, case when c.ok then 'Passed' else 'Missing' end
  from (values
    ('primary_image', p.primary_asset_id is not null
        or exists (select 1 from public.product_assets pa where pa.product_id = p.id and pa.link_type = 'primary_image'), 2.0),
    ('packshot', exists (select 1 from public.product_assets pa where pa.product_id = p.id and pa.link_type = 'packshot'), 1.5),
    ('lifestyle_image', exists (select 1 from public.product_assets pa where pa.product_id = p.id and pa.link_type = 'lifestyle'), 1.0),
    ('product_video', exists (select 1 from public.product_assets pa where pa.product_id = p.id and pa.link_type in ('video', 'three_sixty')), 1.0),
    ('description', coalesce(length(p.description), 0) >= 20, 1.0),
    ('required_metadata', p.category_id is not null, 1.0),
    ('market_data', exists (select 1 from public.product_markets pm where pm.product_id = p.id), 1.0),
    ('localisation', not exists (select 1 from public.product_markets pm where pm.product_id = p.id and pm.market_code <> 'US' and not pm.is_localised), 0.5),
    ('approved_assets', n_links > 0 and not exists (
        select 1 from public.product_assets pa join public.media_assets m on m.id = pa.asset_id
         where pa.product_id = p.id and m.approval_status <> 'approved'), 1.5),
    ('rights_coverage', exists (select 1 from public.rights_licenses l where l.product_id = p.id and l.status in ('active', 'expiring_soon'))
        or (n_links > 0 and not exists (
        select 1 from public.product_assets pa join public.media_assets m on m.id = pa.asset_id
         where pa.product_id = p.id and m.rights_state in ('expired', 'restricted', 'unspecified'))), 1.5),
    ('brand_compliance', not exists (
        select 1 from public.product_assets pa join public.media_assets m on m.id = pa.asset_id
         where pa.product_id = p.id and m.rights_state = 'restricted'), 1.0)
  ) as c(key, ok, w);

  select round(100 * sum(case when passed then weight else 0 end) / nullif(sum(weight), 0))
    into v_score from public.product_readiness_checks where product_id = p.id;

  update public.products
     set readiness_score = coalesce(v_score, 0),
         readiness_state = case when v_score >= 90 then 'ready' when v_score >= 60 then 'review' else 'not_ready' end
   where id = p.id;
  return coalesce(v_score, 0);
end
$fn$;

revoke all on function public.brand_product_readiness(uuid) from public, anon;
grant execute on function public.brand_product_readiness(uuid) to authenticated;

-- Nightly: recalculate every product after the rights sweep (rights feed readiness).
create or replace function public.brand_readiness_sweep()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare r record; n int := 0;
begin
  for r in select id from public.products where archived_at is null loop
    perform public.brand_product_readiness(r.id); n := n + 1;
  end loop;
  return n;
end
$fn$;
revoke all on function public.brand_readiness_sweep() from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'brand-readiness-sweep';
    perform cron.schedule('brand-readiness-sweep', '30 2 * * *', 'select public.brand_readiness_sweep()');
  end if;
end
$cron$;

-- Replace typed-in demo scores with computed ones now.
select public.brand_readiness_sweep();
