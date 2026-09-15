-- ============================================================================
-- Brand & Assets — demo seed
--
-- Every row is flagged is_demo = true so demo content can be identified and
-- purged, and so the UI can badge it. Re-runnable: keyed on stable slugs/SKUs.
--
-- Targets the demo workspaces owned by the seeded account. Safe to run twice.
-- ============================================================================

do $seed$
declare
  v_ws        uuid;
  v_owner     uuid;
  v_family    uuid;
  v_brand     uuid;
  v_kit       uuid;
  v_asset     uuid;
  v_product   uuid;
  v_licence   uuid;
  v_folder    uuid;
  v_cat       uuid;
  r           record;
  i           int;
begin
  -- The `brand` workspace is the canonical demo surface for this module.
  select id, owner_id into v_ws, v_owner
  from public.workspaces where type = 'brand' order by created_at limit 1;

  if v_ws is null then
    raise notice 'no brand workspace found; skipping seed';
    return;
  end if;

  -- --------------------------------------------------------------------
  -- Brand family + brands
  -- --------------------------------------------------------------------
  insert into public.brand_families (workspace_id, name, slug, description, created_by)
  values (v_ws, 'Acme Global', 'acme-global', 'Master brand family covering all Acme divisions.', v_owner)
  on conflict (workspace_id, slug) do update set name = excluded.name
  returning id into v_family;

  if v_family is null then
    select id into v_family from public.brand_families where workspace_id = v_ws and slug = 'acme-global';
  end if;

  for r in
    select * from (values
      ('Acme',           'acme',           '#2563EB', 'Design Team',    'Inter / DM Sans'),
      ('Acme Sport',     'acme-sport',     '#16A34A', 'Marketing Team', 'Poppins / Inter'),
      ('Acme Care',      'acme-care',      '#EC4899', 'Brand Team',     'Manrope / Inter'),
      ('Acme Foods',     'acme-foods',     '#DC2626', 'Marketing Team', 'Lora / Inter'),
      ('Acme Tech',      'acme-tech',      '#1D4ED8', 'Brand Team',     'Space Grotesk / Inter'),
      ('Acme Finance',   'acme-finance',   '#059669', 'Finance Team',   'IBM Plex Sans / Inter'),
      ('Acme Education', 'acme-education', '#3B82F6', 'Education Team', 'Source Sans 3 / Inter')
    ) as t(name, slug, colour, team, fonts)
  loop
    insert into public.brands (workspace_id, name, slug, primary_color, status, owner_id, is_demo, family_id, industry)
    values (v_ws, r.name, r.slug, r.colour, 'active', v_owner, true, v_family, 'Consumer goods')
    on conflict (workspace_id, slug) do update
      set primary_color = excluded.primary_color, family_id = excluded.family_id,
          status = 'active', is_demo = true
    returning id into v_brand;

    if v_brand is null then
      select id into v_brand from public.brands where workspace_id = v_ws and slug = r.slug;
    end if;

    -- Brand kit per brand
    insert into public.brand_kits
      (workspace_id, brand_id, name, description, status, approval_status, team_name,
       consistency_score, current_version, published_version, owner_id, created_by, is_demo)
    values
      (v_ws, v_brand, r.name || ' Brand Kit',
       'Identity system, colour, typography and templates for ' || r.name || '.',
       case when r.slug = 'acme-finance' then 'review' else 'active' end,
       case when r.slug in ('acme-sport','acme-tech') then 'pending'
            when r.slug = 'acme-foods' then 'changes_requested'
            else 'approved' end,
       r.team, 88 + (random() * 10)::numeric(5,2), 3, 2, v_owner, v_owner, true)
    on conflict do nothing;

    select id into v_kit from public.brand_kits
    where workspace_id = v_ws and brand_id = v_brand limit 1;

    -- Colour palette (5 swatches, matching the reference cards)
    delete from public.brand_kit_colours where brand_kit_id = v_kit;
    insert into public.brand_kit_colours (workspace_id, brand_kit_id, name, hex, role, sort_order) values
      (v_ws, v_kit, 'Primary',  r.colour,   'primary',   0),
      (v_ws, v_kit, 'Navy',     '#0F172A',  'secondary', 1),
      (v_ws, v_kit, 'Slate',    '#475569',  'neutral',   2),
      (v_ws, v_kit, 'Cool Gray','#CBD5E1',  'neutral',   3),
      (v_ws, v_kit, 'White',    '#FFFFFF',  'surface',   4);

    -- Typography scale
    delete from public.brand_kit_typography where brand_kit_id = v_kit;
    insert into public.brand_kit_typography
      (workspace_id, brand_kit_id, style_name, font_family, font_weight, font_size_px, line_height_px, sort_order) values
      (v_ws, v_kit, 'Heading 1', split_part(r.fonts,' / ',1), 'Bold',        44, 52, 0),
      (v_ws, v_kit, 'Heading 2', split_part(r.fonts,' / ',1), 'Semi Bold',   32, 40, 1),
      (v_ws, v_kit, 'Body Large',split_part(r.fonts,' / ',2), 'Regular',     18, 28, 2),
      (v_ws, v_kit, 'Body',      split_part(r.fonts,' / ',2), 'Regular',     16, 24, 3),
      (v_ws, v_kit, 'Caption',   split_part(r.fonts,' / ',2), 'Regular',     12, 16, 4);

    -- Templates
    delete from public.brand_kit_templates where brand_kit_id = v_kit;
    insert into public.brand_kit_templates (workspace_id, brand_kit_id, name, template_type, dimensions, sort_order) values
      (v_ws, v_kit, 'Presentation', 'presentation', '16:9',      0),
      (v_ws, v_kit, 'Social Post',  'social',       '1080x1080', 1),
      (v_ws, v_kit, 'One Pager',    'one_pager',    'A4',        2),
      (v_ws, v_kit, 'Email Header', 'email_header', '600x200',   3);

    -- Tone of voice
    insert into public.brand_kit_tone (workspace_id, brand_kit_id, statement, traits, do_use, dont_use)
    values (v_ws, v_kit,
      'We are clear, confident and human. We cut through complexity with honest language and a helpful tone.',
      array['Clear','Confident','Helpful','Human','Straightforward'],
      array['Plain English','Active voice','Short sentences'],
      array['Jargon','Hype','Passive voice'])
    on conflict (brand_kit_id) do update set statement = excluded.statement;

    -- Guideline documents
    delete from public.brand_kit_documents where brand_kit_id = v_kit;
    insert into public.brand_kit_documents (workspace_id, brand_kit_id, title, doc_type, version_label, sort_order) values
      (v_ws, v_kit, 'Brand Guidelines',  'guidelines',        'v3.2', 0),
      (v_ws, v_kit, 'Logo Usage Rules',  'logo_usage',        'v1.4', 1),
      (v_ws, v_kit, 'Colour Standards',  'colour_standards',  'v2.0', 2),
      (v_ws, v_kit, 'Typography Guide',  'typography_guide',  'v1.1', 3);

    -- Kit version history
    insert into public.brand_kit_versions (workspace_id, brand_kit_id, version, change_summary, status, published_at, created_by)
    values
      (v_ws, v_kit, 1, 'Initial brand system.', 'archived', now() - interval '120 days', v_owner),
      (v_ws, v_kit, 2, 'Refreshed palette and typography scale.', 'published', now() - interval '30 days', v_owner),
      (v_ws, v_kit, 3, 'Added social and email templates.', 'draft', null, v_owner)
    on conflict (brand_kit_id, version) do nothing;
  end loop;

  -- --------------------------------------------------------------------
  -- Folders and collections
  -- --------------------------------------------------------------------
  for r in
    select * from (values
      ('Product Photography', 'product-photography'),
      ('Campaigns',           'campaigns'),
      ('Brand Guidelines',    'brand-guidelines'),
      ('Social Media',        'social-media'),
      ('Packaging',           'packaging')
    ) as t(name, path)
  loop
    insert into public.asset_folders (workspace_id, name, path, created_by)
    values (v_ws, r.name, r.path, v_owner)
    on conflict (workspace_id, path) do nothing;
  end loop;

  insert into public.asset_collections (workspace_id, name, description, is_shared, created_by)
  select v_ws, x.name, x.descr, true, v_owner
  from (values
    ('Spring 2026 Launch', 'Approved assets for the spring campaign.'),
    ('Evergreen Product',  'Always-on product photography.'),
    ('Press Kit',          'Assets cleared for external press use.')
  ) as x(name, descr)
  where not exists (select 1 from public.asset_collections c where c.workspace_id = v_ws and c.name = x.name);

  -- --------------------------------------------------------------------
  -- Assets
  -- --------------------------------------------------------------------
  select id into v_folder from public.asset_folders where workspace_id = v_ws and path = 'product-photography';

  i := 0;
  for r in
    select * from (values
      ('Acme Hydrate Serum.jpg','image','image/jpeg',4404019,'approved','licensed','All Media','acme-care'),
      ('Product Launch.mp4','video','video/mp4',54613606,'approved','all_media','All Media','acme-tech'),
      ('Acme_Brand_Guide.pdf','pdf','application/pdf',8808038,'approved','internal_use','Internal Use','acme'),
      ('Pitch_Deck_Template.pptx','presentation','application/vnd.openxmlformats-officedocument.presentationml.presentation',7025459,'approved','internal_use','Internal Use','acme'),
      ('Acme Package Box.psd','design','image/vnd.adobe.photoshop',16044134,'approved','all_media','All Media','acme-foods'),
      ('Acme_new_post.png','social','image/png',2202009,'approved','public_use','Public Use','acme-sport'),
      ('Acme Runner Pro.jpg','image','image/jpeg',3774873,'approved','all_media','All Media','acme-sport'),
      ('Cleanser Ad_30sec.mp4','video','video/mp4',3984588,'pending','all_media','All Media','acme-care'),
      ('Acme Campaign Brief.pdf','pdf','application/pdf',1992294,'approved','internal_use','Internal Use','acme'),
      ('Protein Bars_Group.jpg','image','image/jpeg',6606028,'expiring','licensed','Licensed','acme-foods'),
      ('Acme Summer Campaign.jpg','image','image/jpeg',5242880,'approved','licensed','Licensed','acme'),
      ('Behind the Scenes.mp4','video','video/mp4',41943040,'pending','internal_use','Internal Use','acme-tech'),
      ('Product Spec Sheet.pdf','pdf','application/pdf',1048576,'approved','internal_use','Internal Use','acme-foods'),
      ('Event Banner Template.pptx','template','application/vnd.openxmlformats-officedocument.presentationml.presentation',3145728,'approved','internal_use','Internal Use','acme'),
      ('Acme Packaging Mockup.psd','design','image/vnd.adobe.photoshop',20971520,'approved','all_media','All Media','acme-foods'),
      ('Old Logo (Black).png','image','image/png',524288,'archived','expired','Expired','acme'),
      ('Expired License.mp4','video','video/mp4',31457280,'approved','expired','Expired','acme-tech'),
      ('Spring Campaign_v1.jpg','image','image/jpeg',4194304,'rejected','restricted','Restricted','acme'),
      ('Draft_Layout.psd','design','image/vnd.adobe.photoshop',15728640,'draft','unspecified','Unspecified','acme'),
      ('Event Post_old.png','social','image/png',1572864,'archived','expired','Expired','acme-sport')
    ) as t(fname, kind, mime, size, status, rights, scope, brand_slug)
  loop
    i := i + 1;
    select id into v_brand from public.brands where workspace_id = v_ws and slug = r.brand_slug;

    if not exists (select 1 from public.media_assets m where m.workspace_id = v_ws and m.file_name = r.fname) then
      insert into public.media_assets
        (workspace_id, brand_id, folder_id, owner_id, uploaded_by, file_name, file_path, file_url,
         file_type, file_size, mime_type, asset_kind, approval_status, rights_state, usage_scope,
         storage_bucket, tags, alt_text, is_demo, download_count, created_at, updated_at,
         expires_at, archived_at)
      values
        (v_ws, v_brand, v_folder, v_owner, v_owner, r.fname,
         'demo/' || v_ws || '/' || r.fname, 'demo://' || r.fname,
         r.kind, r.size, r.mime, r.kind,
         case when r.status in ('expiring') then 'approved' else r.status end,
         case when r.rights = 'expiring' then 'expiring_soon' else r.rights end,
         r.scope, 'brand-assets',
         array['demo', r.brand_slug], r.fname || ' (demo asset)', true,
         (random() * 40)::int,
         now() - (i || ' days')::interval, now() - (i || ' days')::interval,
         case when r.rights in ('licensed','expiring') then now() + ((10 + i) || ' days')::interval else null end,
         case when r.status = 'archived' then now() - interval '5 days' else null end);
    end if;
  end loop;

  -- Approval queue entries for the pending assets
  for r in select id, file_name from public.media_assets
           where workspace_id = v_ws and approval_status = 'pending' and is_demo
  loop
    insert into public.asset_approvals (workspace_id, asset_id, status, priority, requested_by, note)
    select v_ws, r.id, 'pending',
           (array['high','medium','low'])[1 + (random()*2)::int],
           v_owner, 'Requested review for ' || r.file_name
    where not exists (select 1 from public.asset_approvals a where a.asset_id = r.id);
  end loop;

  -- Usage requests
  for r in select id from public.media_assets where workspace_id = v_ws and is_demo limit 8
  loop
    insert into public.asset_usage_requests
      (workspace_id, asset_id, requested_by, status, purpose, channels, territories, starts_on, ends_on)
    select v_ws, r.id, v_owner, 'submitted',
           'Requested for upcoming campaign use.',
           array['social','web'], array['north_america'],
           current_date, current_date + 90
    where not exists (select 1 from public.asset_usage_requests u where u.asset_id = r.id);
  end loop;

  -- --------------------------------------------------------------------
  -- Product categories, products, variants, markets
  -- --------------------------------------------------------------------
  for r in
    select * from (values
      ('Skin Care','skin-care'), ('Footwear','footwear'), ('Nutrition','nutrition'),
      ('Beverages','beverages'), ('Tech Accessories','tech-accessories'), ('Lifestyle','lifestyle')
    ) as t(name, slug)
  loop
    insert into public.product_categories (workspace_id, name, slug)
    values (v_ws, r.name, r.slug)
    on conflict (workspace_id, slug) do nothing;
  end loop;

  for r in
    select * from (values
      ('Acme Hydrate Serum',    'ACM-1001', 'skin-care',        'acme-care',   'active',   100, 'ready',     '{US,CA,UK,AU}'),
      ('Acme Runner Pro',       'ACM-2005', 'footwear',         'acme-sport',  'active',    94, 'ready',     '{US,CA,MX}'),
      ('Acme Protein Bars',     'ACM-3002', 'nutrition',        'acme-foods',  'review',    78, 'review',    '{US,CA}'),
      ('Acme Sound+ Headphones','ACM-4007', 'tech-accessories', 'acme-tech',   'active',    78, 'review',    '{US,UK,EU}'),
      ('Acme Everyday Tote',    'ACM-5003', 'lifestyle',        'acme',        'draft',      9, 'not_ready', '{US}'),
      ('Acme House Blend Coffee','ACM-6001','beverages',        'acme-foods',  'review',    71, 'review',    '{US,CA,UK}'),
      ('Acme Energy Drink',     'ACM-9002', 'beverages',        'acme-foods',  'draft',     35, 'not_ready', '{US}'),
      ('Acme Sunblock SPF 50',  'ACM-1003', 'skin-care',        'acme-care',   'review',    62, 'review',    '{US,CA}'),
      ('Acme Wireless Charger', 'ACM-4009', 'tech-accessories', 'acme-tech',   'review',    58, 'review',    '{US,UK}'),
      ('Acme Hydrate Serum (EU)','ACM-1001-EU','skin-care',     'acme-care',   'draft',     44, 'not_ready', '{EU}'),
      ('Acme Trail Shoe',       'ACM-2011', 'footwear',         'acme-sport',  'active',    91, 'ready',     '{US,CA,UK}'),
      ('Acme Focus Tea',        'ACM-6004', 'beverages',        'acme-foods',  'active',    88, 'ready',     '{UK,EU}')
    ) as t(name, sku, cat_slug, brand_slug, status, score, readiness, markets)
  loop
    select id into v_brand from public.brands where workspace_id = v_ws and slug = r.brand_slug;
    select id into v_cat from public.product_categories where workspace_id = v_ws and slug = r.cat_slug;

    insert into public.products
      (workspace_id, brand_id, category_id, name, sku, description, status,
       readiness_score, readiness_state, owner_id, created_by, is_demo)
    values (v_ws, v_brand, v_cat, r.name, r.sku,
            r.name || ' — demo catalogue record.', r.status,
            r.score, r.readiness, v_owner, v_owner, true)
    on conflict (workspace_id, sku) do update
      set readiness_score = excluded.readiness_score,
          readiness_state = excluded.readiness_state,
          status = excluded.status
    returning id into v_product;

    if v_product is null then
      select id into v_product from public.products where workspace_id = v_ws and sku = r.sku;
    end if;

    -- Markets
    insert into public.product_markets (workspace_id, product_id, market_code, is_localised)
    select v_ws, v_product, m, (m <> 'US')
    from unnest(r.markets::text[]) as m
    on conflict (product_id, market_code) do nothing;

    -- One variant per product
    insert into public.product_variants (workspace_id, product_id, sku, name, status)
    values (v_ws, v_product, r.sku || '-STD', r.name || ' — Standard', 'active')
    on conflict (workspace_id, sku) do nothing;

    -- Readiness checks, consistent with the stored score
    delete from public.product_readiness_checks where product_id = v_product;
    insert into public.product_readiness_checks (workspace_id, product_id, check_key, passed, detail)
    select v_ws, v_product, k.key, (r.score >= k.threshold),
           case when (r.score >= k.threshold) then 'Present' else 'Not supplied' end
    from (values
      ('primary_image',10),('description',20),('required_metadata',30),('market_data',40),
      ('packshot',50),('approved_assets',60),('lifestyle_image',70),('rights_coverage',80),
      ('brand_compliance',85),('product_video',90),('localisation',95)
    ) as k(key, threshold);
  end loop;

  -- Link assets to products
  for r in select p.id as pid, m.id as mid
           from public.products p
           join public.media_assets m
             on m.workspace_id = p.workspace_id and m.brand_id = p.brand_id
           where p.workspace_id = v_ws and p.is_demo and m.is_demo
  loop
    insert into public.product_assets (workspace_id, product_id, asset_id, link_type, is_primary, linked_by)
    values (v_ws, r.pid, r.mid, 'primary_image', false, v_owner)
    on conflict do nothing;
  end loop;

  -- --------------------------------------------------------------------
  -- Licences
  -- --------------------------------------------------------------------
  i := 0;
  for r in
    select * from (values
      ('Acme Spring Campaign','IMG-2024-SPR','campaign',   'active',        12,  'acme',       'Marketing, Web, Social'),
      ('Acme Runner Pro',     'ACM-2005-L',  'standard',   'expiring_soon', 56,  'acme-sport', 'Web, E-commerce'),
      ('Acme Protein Bars',   'ACM-3002-L',  'non_exclusive','active',      420, 'acme-foods', 'Packaging, In-Store'),
      ('Acme Hydrate Serum',  'ACM-1001-L',  'exclusive',  'active',        345, 'acme-care',  'Marketing, Web, Social'),
      ('Product Launch Video','VID-PLC-2024','royalty_free','active',       876, 'acme-tech',  'Web, Ads, Social'),
      ('Acme Packaging Design','PKG-ACM-2024','design',    'expiring_soon', 87,  'acme-foods', 'Packaging Only'),
      ('Acme Logo (Global)',  'TM-ACM-GLB',  'trademark',  'active',        221, 'acme',       'All'),
      ('Acme Product Video',  'VID-ACM-EU',  'video',      'expiring_soon', 3,   'acme-tech',  'Web, Ads'),
      ('Acme Care Imagery',   'IMG-CARE-01', 'image',      'active',        180, 'acme-care',  'Digital, Social'),
      ('Acme Sport Footage',  'VID-SPT-02',  'standard',   'renewal_pending',45, 'acme-sport', 'Broadcast, Web'),
      ('Acme Finance Icons',  'DSN-FIN-01',  'design',     'active',        260, 'acme-finance','Internal, Web'),
      ('Acme Education Deck', 'DSN-EDU-01',  'standard',   'active',        300, 'acme-education','Internal'),
      ('Legacy Logo Usage',   'TM-ACM-OLD',  'trademark',  'expired',       -30, 'acme',       'None'),
      ('Third-party Stock',   'IMG-3P-01',   'royalty_free','expired',      -12, 'acme',       'Digital')
    ) as t(name, ref, ltype, status, days, brand_slug, scope)
  loop
    i := i + 1;
    select id into v_brand from public.brands where workspace_id = v_ws and slug = r.brand_slug;
    select id into v_asset from public.media_assets
      where workspace_id = v_ws and brand_id = v_brand and is_demo limit 1;

    if not exists (select 1 from public.rights_licenses l where l.workspace_id = v_ws and l.reference = r.ref) then
      insert into public.rights_licenses
        (workspace_id, brand_id, asset_id, name, reference, license_type, licensor, licensee,
         status, starts_on, expires_on, renewal_due_on, usage_scope, exclusivity,
         risk_level, owner_id, created_by, is_demo)
      values
        (v_ws, v_brand, v_asset, r.name, r.ref, r.ltype, 'Acme Holdings Ltd', 'Acme Global',
         r.status, current_date - 200, current_date + r.days,
         case when r.days > 0 then current_date + greatest(r.days - 30, 1) else null end,
         r.scope, (r.ltype = 'exclusive'),
         case when r.days < 0 then 'high' when r.days < 60 then 'medium' else 'low' end,
         v_owner, v_owner, true)
      returning id into v_licence;

      -- Territories + channels
      insert into public.rights_license_territories (workspace_id, license_id, territory_id)
      select v_ws, v_licence, t.id from public.rights_territories t
      where t.workspace_id is null
        and t.code = (array['worldwide','north_america','emea','apac','europe','uk','us'])[1 + (i % 7)]
      on conflict do nothing;

      insert into public.rights_license_channels (workspace_id, license_id, channel_id)
      select v_ws, v_licence, c.id from public.rights_channels c
      where c.workspace_id is null
        and c.code in ('digital','social','web')
      on conflict do nothing;

      -- Renewal task for those approaching expiry
      if r.days between 1 and 90 then
        insert into public.rights_renewals (workspace_id, license_id, due_on, status, assigned_to)
        values (v_ws, v_licence, current_date + r.days, 'pending', v_owner);
      end if;

      -- Agreement document
      insert into public.rights_agreements (workspace_id, license_id, title, signed_on, uploaded_by)
      values (v_ws, v_licence, r.name || ' — Agreement', current_date - 200, v_owner);
    end if;
  end loop;

  -- Conflicts (drive High-Risk Assets and the compliance score)
  for r in select l.id as lid, l.asset_id as aid from public.rights_licenses l
           where l.workspace_id = v_ws and l.status = 'expired' and l.is_demo
  loop
    insert into public.rights_conflicts (workspace_id, asset_id, license_id, conflict_type, severity, detail)
    select v_ws, r.aid, r.lid, 'expired_licence', 'high', 'Licence expired but asset is still linked to live product records.'
    where not exists (select 1 from public.rights_conflicts c where c.license_id = r.lid);
  end loop;

  insert into public.rights_conflicts (workspace_id, asset_id, conflict_type, severity, detail)
  select v_ws, m.id, 'no_licence', 'high', 'Asset is in use with no active licence on record.'
  from public.media_assets m
  where m.workspace_id = v_ws and m.file_name = 'Old Logo (Black).png'
    and not exists (select 1 from public.rights_conflicts c where c.asset_id = m.id);

  insert into public.rights_conflicts (workspace_id, asset_id, conflict_type, severity, detail)
  select v_ws, m.id, 'outside_territory', 'medium', 'Used in EMEA but licence covers North America only.'
  from public.media_assets m
  where m.workspace_id = v_ws and m.file_name = 'Spring Campaign_v1.jpg'
    and not exists (select 1 from public.rights_conflicts c where c.asset_id = m.id);

  -- --------------------------------------------------------------------
  -- Activity, alerts, storage
  -- --------------------------------------------------------------------
  if not exists (select 1 from public.brand_activity where workspace_id = v_ws) then
    insert into public.brand_activity (workspace_id, actor_id, entity_type, action, summary, created_at) values
      (v_ws, v_owner, 'asset',     'approved', 'Approved Acme Spring Campaign',        now() - interval '2 minutes'),
      (v_ws, v_owner, 'asset',     'uploaded', 'Uploaded Product Launch.mp4',          now() - interval '15 minutes'),
      (v_ws, v_owner, 'brand_kit', 'updated',  'Updated Acme Care Brand Kit',          now() - interval '1 hour'),
      (v_ws, v_owner, 'usage_request','requested','Requested usage of Acme Logo (Global)', now() - interval '2 hours'),
      (v_ws, v_owner, 'asset',     'linked',   'Added 3 assets to Acme Foods',         now() - interval '3 hours'),
      (v_ws, v_owner, 'license',   'renewed',  'Renewed Acme Hydrate Serum licence',   now() - interval '5 hours'),
      (v_ws, v_owner, 'product',   'updated',  'Updated Acme Runner Pro',              now() - interval '2 hours'),
      (v_ws, v_owner, 'product',   'linked',   'Linked 16 assets to Acme Protein Bars',now() - interval '5 hours'),
      (v_ws, v_owner, 'license',   'uploaded', 'Uploaded Influencer Usage Agreement',  now() - interval '3 hours');
  end if;

  if not exists (select 1 from public.brand_alerts where workspace_id = v_ws) then
    insert into public.brand_alerts (workspace_id, alert_type, severity, title, body) values
      (v_ws, 'rights_expiring',       'critical','Rights expiring soon',   'Review and renew to avoid disruption.'),
      (v_ws, 'pending_approvals',     'warning', 'Pending approvals',      'Requests awaiting your review.'),
      (v_ws, 'guideline_update',      'info',    'Guideline update',       'Acme Global Brand Guidelines v3.2 updated.'),
      (v_ws, 'compliance_change',     'info',    'Compliance score',       'Your score improved by 4 points this month.'),
      (v_ws, 'missing_product_assets','warning', 'Products missing assets','Several products are not campaign ready.');
  end if;

  insert into public.workspace_storage (workspace_id, bytes_used, bytes_quota, asset_count, recalculated_at)
  select v_ws,
         coalesce((select sum(file_size) from public.media_assets where workspace_id = v_ws), 0) + 1407374883553,
         2199023255552,
         (select count(*) from public.media_assets where workspace_id = v_ws),
         now()
  on conflict (workspace_id) do update
    set bytes_used = excluded.bytes_used,
        asset_count = excluded.asset_count,
        recalculated_at = now();

  raise notice 'brand assets demo seed complete for workspace %', v_ws;
end
$seed$;
