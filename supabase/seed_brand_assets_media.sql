-- ============================================================================
-- Brand & Assets — demo media + team seed (run AFTER seed_brand_assets.sql)
--
-- 1. Demo teammates (auth.users + profiles + workspace_members) so kits,
--    assets, licences and products have real, distinct owners with portraits.
-- 2. Points every demo asset / product / avatar at its object in the private
--    Cloudflare R2 bucket. Stored paths are `r2:brand-assets/{workspace}/…` (see src/lib/storage/r2.ts); the bytes are uploaded
--    by scripts/seed-brand-media-r2.mjs from supabase/seed-media/brand-assets.
-- 3. Replaces the random / hardcoded values of the first seed with
--    deterministic ones, and storage used is summed from real file sizes.
--
-- Idempotent: fixed UUIDs, upserts and keyed updates. Demo rows only.
--
-- To remove the demo teammates (records they own fall back to no owner):
--   update public.brand_kits      set owner_id = null where owner_id::text like '0b7e1a00-%';
--   update public.media_assets    set owner_id = null where owner_id::text like '0b7e1a00-%';
--   update public.rights_licenses set owner_id = null where owner_id::text like '0b7e1a00-%';
--   update public.products        set owner_id = null where owner_id::text like '0b7e1a00-%';
--   update public.brand_activity  set actor_id = null where actor_id::text like '0b7e1a00-%';
--   delete from public.workspace_members where user_id::text like '0b7e1a00-%';
--   delete from auth.users where id::text like '0b7e1a00-%' and email like '%@demo.captionfox.invalid';
-- ============================================================================

do $seed$
declare
  v_ws    uuid;
  v_owner uuid;
  r       record;
begin
  select id, owner_id into v_ws, v_owner
  from public.workspaces where type = 'brand' order by created_at limit 1;
  if v_ws is null then raise notice 'no brand workspace; skipping'; return; end if;

  -- ------------------------------------------------------------------
  -- 1. Demo teammates. Emails use the reserved .invalid TLD so nothing can
  --    ever be delivered to them; they have no password and cannot sign in.
  -- ------------------------------------------------------------------
  for r in select * from (values
    ('0b7e1a00-0000-4000-8000-000000000001'::uuid, 'Emily Johnson',  'emily-johnson',  'manager', 'Design Team'),
    ('0b7e1a00-0000-4000-8000-000000000002'::uuid, 'Michael Chen',   'michael-chen',   'manager', 'Marketing Team'),
    ('0b7e1a00-0000-4000-8000-000000000003'::uuid, 'Sarah Williams', 'sarah-williams', 'member',  'Brand Team'),
    ('0b7e1a00-0000-4000-8000-000000000004'::uuid, 'David Martinez', 'david-martinez', 'member',  'Marketing Team'),
    ('0b7e1a00-0000-4000-8000-000000000005'::uuid, 'Jason Ranti',    'jason-ranti',    'admin',   'Brand Team'),
    ('0b7e1a00-0000-4000-8000-000000000006'::uuid, 'Priya Shah',     'priya-shah',     'member',  'Finance Team'),
    ('0b7e1a00-0000-4000-8000-000000000007'::uuid, 'Grace Kim',      'grace-kim',      'viewer',  'Education Team')
  ) as t(id, name, slug, role, team)
  loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data,
                            email_confirmed_at, created_at, updated_at, is_sso_user)
    values (r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            r.slug || '@demo.captionfox.invalid',
            jsonb_build_object('full_name', r.name, 'demo', true),
            jsonb_build_object('provider', 'demo', 'providers', array['demo']),
            now(), now(), now(), false)
    on conflict (id) do nothing;

    insert into public.profiles (id, email, full_name, avatar_url, onboarding_completed)
    values (r.id, r.slug || '@demo.captionfox.invalid', r.name,
            'r2:brand-assets/' || v_ws || '/avatars/' || r.slug || '.jpg', true)
    on conflict (id) do update
      set full_name = excluded.full_name, avatar_url = excluded.avatar_url;

    -- workspace_members carries a handle_updated_at trigger but no updated_at
    -- column, so an upsert-update fails. Insert, then update only on a real change.
    insert into public.workspace_members (workspace_id, user_id, role, joined_at)
    values (v_ws, r.id, r.role, now())
    on conflict (workspace_id, user_id) do nothing;
    if exists (select 1 from public.workspace_members where workspace_id = v_ws and user_id = r.id and role is distinct from r.role) then
      raise notice 'demo member % has a different role; leaving it unchanged', r.slug;
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- 2. Owners — deterministic, matching each brand's team
  -- ------------------------------------------------------------------
  update public.brand_kits k set owner_id = o.pid, team_name = o.team,
         consistency_score = o.score
  from (values
    ('acme',           '0b7e1a00-0000-4000-8000-000000000001'::uuid, 'Design Team',    96),
    ('acme-sport',     '0b7e1a00-0000-4000-8000-000000000002'::uuid, 'Marketing Team', 94),
    ('acme-care',      '0b7e1a00-0000-4000-8000-000000000003'::uuid, 'Brand Team',     95),
    ('acme-foods',     '0b7e1a00-0000-4000-8000-000000000004'::uuid, 'Marketing Team', 91),
    ('acme-tech',      '0b7e1a00-0000-4000-8000-000000000005'::uuid, 'Brand Team',     97),
    ('acme-finance',   '0b7e1a00-0000-4000-8000-000000000006'::uuid, 'Finance Team',   89),
    ('acme-education', '0b7e1a00-0000-4000-8000-000000000007'::uuid, 'Education Team', 93)
  ) as o(slug, pid, team, score), public.brands b
  where b.id = k.brand_id and b.slug = o.slug and k.workspace_id = v_ws and k.is_demo;

  -- Assets, licences and products take their brand kit's owner.
  update public.media_assets m set owner_id = k.owner_id
  from public.brand_kits k
  where k.brand_id = m.brand_id and m.workspace_id = v_ws and m.is_demo;

  update public.rights_licenses l set owner_id = k.owner_id
  from public.brand_kits k
  where k.brand_id = l.brand_id and l.workspace_id = v_ws and l.is_demo;

  update public.products p set owner_id = k.owner_id
  from public.brand_kits k
  where k.brand_id = p.brand_id and p.workspace_id = v_ws and p.is_demo;

  -- Deterministic approval priorities (the first seed used random()).
  update public.asset_approvals a
  set priority = case when m.asset_kind = 'video' then 'high' when m.asset_kind = 'image' then 'medium' else 'low' end,
      requested_by = m.owner_id
  from public.media_assets m
  where m.id = a.asset_id and a.workspace_id = v_ws;

  -- Activity actors spread across the team, deterministic by summary.
  update public.brand_activity a
  set actor_id = ('0b7e1a00-0000-4000-8000-00000000000' || (1 + abs(hashtext(a.summary)) % 5))::uuid
  where a.workspace_id = v_ws;

  -- ------------------------------------------------------------------
  -- 3. R2 object keys. thumbnail_path / file_path hold keys, never URLs; the
  --    app signs them per request. Originals exist only for jpg/png/pdf demo
  --    files — video/pptx/psd demo rows carry a thumbnail but no original,
  --    and the download handler reports that honestly.
  -- ------------------------------------------------------------------
  update public.media_assets m
  set storage_bucket = 'r2',
      thumbnail_path = 'r2:brand-assets/' || v_ws || '/assets/' || m.id || '/thumb.jpg',
      file_path = 'r2:brand-assets/' || v_ws || '/assets/' || m.id || '/' ||
                  regexp_replace(m.file_name, '[^A-Za-z0-9._-]+', '-', 'g'),
      file_url = 'r2://' || m.file_name,
      processing_state = 'ready', scan_state = 'clean'
  where m.workspace_id = v_ws and m.is_demo and m.file_name not like '% Packshot.jpg';

  -- Product primary image: a dedicated product asset per SKU.
  for r in select p.id, p.sku, p.name, p.brand_id, p.owner_id from public.products p
           where p.workspace_id = v_ws and p.is_demo
  loop
    insert into public.media_assets
      (workspace_id, brand_id, owner_id, uploaded_by, file_name, file_path, file_url,
       file_type, file_size, mime_type, asset_kind, approval_status, rights_state, usage_scope,
       storage_bucket, tags, alt_text, is_demo)
    select v_ws, r.brand_id, r.owner_id, r.owner_id, r.sku || ' Packshot.jpg',
           'r2:brand-assets/' || v_ws || '/products/' || r.sku || '/packshot.jpg', 'r2://' || r.sku || ' Packshot.jpg',
           'jpg', 0, 'image/jpeg', 'image', 'approved', 'all_media', 'All Media',
           'r2', array['demo','packshot'], r.name || ' packshot', true
    where not exists (select 1 from public.media_assets m
                      where m.workspace_id = v_ws and m.file_name = r.sku || ' Packshot.jpg');

    update public.media_assets set thumbnail_path = 'r2:brand-assets/' || v_ws || '/products/' || r.sku || '/thumb.jpg'
    where workspace_id = v_ws and file_name = r.sku || ' Packshot.jpg';

    update public.products p set primary_asset_id = m.id
    from public.media_assets m
    where p.id = r.id and m.workspace_id = v_ws and m.file_name = r.sku || ' Packshot.jpg';

    insert into public.product_assets (workspace_id, product_id, asset_id, link_type, is_primary, linked_by)
    select v_ws, r.id, m.id, 'packshot', true, r.owner_id
    from public.media_assets m where m.workspace_id = v_ws and m.file_name = r.sku || ' Packshot.jpg'
    on conflict do nothing;
  end loop;

  -- Brand kit logos: typographic lockups rendered by the app from the kit,
  -- recorded as lockup rows so the Logo Lockups panel reads real data.
  insert into public.brand_kit_logos (workspace_id, brand_kit_id, label, lockup_type, background, sort_order)
  select v_ws, k.id, x.label, x.kind, x.bg, x.ord
  from public.brand_kits k
  cross join (values ('Primary Lockup','primary','light',0), ('Secondary Lockup','secondary','light',1),
                     ('Icon Mark','icon_mark','light',2), ('Monogram','monogram','dark',3)) as x(label, kind, bg, ord)
  where k.workspace_id = v_ws and k.is_demo
    and not exists (select 1 from public.brand_kit_logos l where l.brand_kit_id = k.id and l.lockup_type = x.kind);

  -- File every demo asset into the folder that matches its kind.
  update public.media_assets m set folder_id = f.id
  from public.asset_folders f
  where f.workspace_id = v_ws and m.workspace_id = v_ws and m.is_demo
    and f.path = case
      when m.file_name like '% Packshot.jpg' or m.asset_kind = 'image' then 'product-photography'
      when m.asset_kind = 'pdf' then 'brand-guidelines'
      when m.asset_kind = 'social' then 'social-media'
      when m.asset_kind in ('design', 'packaging') then 'packaging'
      else 'campaigns' end;

  -- Download audit trail: teammates pulling approved assets over the last month.
  -- Deterministic (hash-based spacing), so re-runs never add duplicates.
  if not exists (select 1 from public.asset_downloads d join public.media_assets m on m.id = d.asset_id where d.workspace_id = v_ws and m.is_demo) then
    insert into public.asset_downloads (workspace_id, asset_id, user_id, version_no, purpose, created_at)
    select v_ws, m.id, m.owner_id, m.version_no, 'Campaign use',
           now() - ((abs(hashtext(m.file_name || g::text)) % 720) || ' hours')::interval
    from public.media_assets m
    cross join generate_series(1, 3) as g
    where m.workspace_id = v_ws and m.is_demo and m.approval_status = 'approved' and m.archived_at is null
      and (abs(hashtext(m.file_name)) % 3) >= g - 1;

    update public.media_assets m set download_count = d.n
    from (select asset_id, count(*) n from public.asset_downloads where workspace_id = v_ws group by asset_id) d
    where d.asset_id = m.id;
  end if;

  -- Brand kit update history (entity-linked, with a detail line for the rail).
  insert into public.brand_activity (workspace_id, brand_id, actor_id, entity_type, entity_id, action, summary, href, metadata, created_at)
  select v_ws, k.brand_id, k.owner_id, 'brand_kit', k.id, 'updated', x.summary,
         '/brand/brand/kits/' || k.id, jsonb_build_object('detail', x.detail), now() - x.ago
  from public.brand_kits k join public.brands b on b.id = k.brand_id
  join (values
    ('acme-care',    'Acme Care brand kit updated',     'Color palette and new templates added', interval '2 hours'),
    ('acme-sport',   'Acme Sport logo lockup updated',  'Primary lockup and icon set refreshed',  interval '5 hours'),
    ('acme-tech',    'Acme Tech typography refined',    'Updated heading and body styles',        interval '1 day'),
    ('acme-foods',   'Acme Foods packaging guidelines', 'Added snack bar packaging rules',        interval '1 day 2 hours'),
    ('acme-finance', 'Acme Finance tone of voice',      'Messaging framework updated',            interval '2 days')
  ) as x(slug, summary, detail, ago) on x.slug = b.slug
  where k.workspace_id = v_ws
    and not exists (select 1 from public.brand_activity a where a.workspace_id = v_ws and a.summary = x.summary);

  -- Icon style per kit — drives the Icon Style glyphs on each kit card.
  insert into public.brand_kit_icons (workspace_id, brand_kit_id, style_name, stroke_width, corner_style, fill_style, sort_order)
  select v_ws, k.id, x.style, x.stroke, x.corner, x.fill, 0
  from public.brand_kits k join public.brands b on b.id = k.brand_id
  join (values
    ('acme',           'Outline 1.5px', 1.5, 'rounded', 'outline'),
    ('acme-sport',     'Bold outline',  2.25,'rounded', 'outline'),
    ('acme-care',      'Soft outline',  1.75,'rounded', 'outline'),
    ('acme-foods',     'Filled',        2.0, 'rounded', 'filled'),
    ('acme-tech',      'Duotone',       1.75,'square',  'duotone'),
    ('acme-finance',   'Outline 1.5px', 1.5, 'square',  'outline'),
    ('acme-education', 'Outline 2px',   2.0, 'rounded', 'outline')
  ) as x(slug, style, stroke, corner, fill) on x.slug = b.slug
  where k.workspace_id = v_ws
    and not exists (select 1 from public.brand_kit_icons i where i.brand_kit_id = k.id);

  -- Team comments on the lead kits.
  insert into public.brand_kit_comments (workspace_id, brand_kit_id, author_id, body, created_at)
  select v_ws, k.id, c.author, c.body, now() - c.ago
  from public.brand_kits k join public.brands b on b.id = k.brand_id
  join (values
    ('acme-sport', '0b7e1a00-0000-4000-8000-000000000002'::uuid, 'Great updates on the Sport kit! The new icons are much stronger.', interval '1 hour'),
    ('acme-sport', '0b7e1a00-0000-4000-8000-000000000001'::uuid, 'Can we add an example of the vertical logo lockup?', interval '2 hours'),
    ('acme',       '0b7e1a00-0000-4000-8000-000000000005'::uuid, 'Colour standards v2.0 approved — rolling out to templates this week.', interval '1 day')
  ) as c(slug, author, body, ago) on c.slug = b.slug
  where k.workspace_id = v_ws
    and not exists (select 1 from public.brand_kit_comments x where x.brand_kit_id = k.id and x.body = c.body);

  -- Every asset belongs to its brand's kit, so kit cards count real linked assets.
  update public.media_assets m set brand_kit_id = k.id
  from public.brand_kits k
  where k.brand_id = m.brand_id and m.workspace_id = v_ws and m.is_demo and m.brand_kit_id is null;

  -- Packshots are catalogue imagery added long before the recent campaign
  -- uploads; backdate them so "Recent Assets" reflects the uploads themselves.
  update public.media_assets set created_at = now() - interval '75 days', updated_at = now() - interval '75 days'
  where workspace_id = v_ws and is_demo and file_name like '% Packshot.jpg';

  -- Brand logos (rendered wordmarks in R2, signed per request like thumbnails).
  update public.brands b set logo_url = 'r2:brand-assets/' || v_ws || '/brands/' || b.slug || '/logo.png'
  where b.workspace_id = v_ws and b.is_demo;

  -- ------------------------------------------------------------------
  -- 4. Storage used — summed from real rows only (the first seed padded it
  --    with a hardcoded 1.28 TB). The uploader re-runs this after writing
  --    the true byte sizes back to media_assets.
  -- ------------------------------------------------------------------
  insert into public.workspace_storage (workspace_id, bytes_used, bytes_quota, asset_count, recalculated_at)
  select v_ws, coalesce(sum(file_size), 0), 2199023255552, count(*), now()
  from public.media_assets where workspace_id = v_ws and archived_at is null
  on conflict (workspace_id) do update
    set bytes_used = excluded.bytes_used, asset_count = excluded.asset_count, recalculated_at = now();

  -- ------------------------------------------------------------------
  -- 5. Product recency — the base seed stamps every product with one
  --    timestamp, so "Recently Updated" order was arbitrary. Stagger it so
  --    the library opens on the flagship lines, as in the reference.
  -- ------------------------------------------------------------------
  update public.products p
     set updated_at = timestamptz '2026-09-14 09:00:00+00' - (o.n * interval '7 minutes')
    from (values ('ACM-1001',1),('ACM-2005',2),('ACM-3002',3),('ACM-4007',4),('ACM-5003',5),('ACM-6001',6),
                 ('ACM-1003',7),('ACM-4009',8),('ACM-1001-EU',9),('ACM-2011',10),('ACM-6004',11),('ACM-9002',12)) as o(sku, n)
   where p.sku = o.sku and p.workspace_id = v_ws;

  raise notice 'brand media seed complete for workspace %', v_ws;
end
$seed$;
