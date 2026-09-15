-- Caption Fox Marketplace — demo directory + demo buyer-side data.
--
-- Everything inserted here is flagged as demo (`marketplace_suppliers.is_demo = true`,
-- request/order references prefixed normally but owned by the seeded demo workspaces)
-- so it can be removed with the DELETE block at the bottom of this file.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_module.sql
-- Idempotent: safe to run repeatedly.

-- ---------------------------------------------------------------------------
-- 1. Enrich / insert the public supplier + creator directory
-- ---------------------------------------------------------------------------
insert into public.marketplace_suppliers
  (slug, display_name, type, headline, tagline, bio, location, region, country, rating, reviews_count,
   verified, status, tags, platforms, languages, badges, starting_price_cents, price_unit, min_order_cents,
   currency, turnaround_hours, response_time_minutes, on_time_delivery_pct, job_success_pct, projects_count,
   available_now, audience_size, audience_summary, engagement_rate, follower_counts, is_demo)
values
  ('motioncraft-studio', 'MotionCraft Studio', 'agency',
   'Motion Graphics & Animation Studio', 'Award-winning motion design for product and explainer video',
   'Award-winning studio specialising in motion graphics, animation and explainer videos for SaaS and consumer brands.',
   'New York, USA', 'North America', 'US', 4.9, 512, true, 'active',
   '{"Motion Graphics","2D Animation","Explainer Videos","Typography","Video Editing"}',
   '{"youtube","instagram","tiktok","linkedin"}', '{"English"}', '{"Top Rated","Verified Agency"}',
   120000, 'project', 50000, 'GBP', 60, 120, 97.0, 96.0, 512, true, null, null, null, '{}'::jsonb, true),

  ('pixel-perfect-designs', 'Pixel Perfect Designs', 'agency',
   'Creative Design & Branding Studio', 'World-class branding, logos and visual identity',
   'Premium design studio delivering world-class branding, logos and visual identities that elevate brands.',
   'London, UK', 'Europe', 'GB', 4.9, 398, true, 'active',
   '{"Logo Design","Brand Identity","Graphic Design","Packaging","Illustration"}',
   '{"instagram","linkedin"}', '{"English","French"}', '{"Pro Partner","Featured Agency"}',
   65000, 'project', 25000, 'GBP', 36, 60, 96.0, 97.0, 338, true, null, null, null, '{}'::jsonb, true),

  ('voicepro-studios', 'VoicePro Studios', 'freelancer',
   'Professional Voice Over Artist', 'Broadcast-quality voice over, fast turnaround',
   'Professional voice over artist with broadcast-quality studio. Fast delivery, multiple styles and languages.',
   'Toronto, Canada', 'North America', 'CA', 4.8, 276, true, 'active',
   '{"Voice Over","Narration","IVR","Commercials","E-Learning"}',
   '{"youtube","podcast"}', '{"English","French"}', '{"Fast Turnaround","Verified Freelancer"}',
   15000, 'project', 15000, 'GBP', 18, 30, 96.0, 98.0, 276, true, null, null, null, '{}'::jsonb, true),

  ('creative-writers-hub', 'Creative Writers Hub', 'agency',
   'Content Writing Agency', 'Long-form content and SEO copy at scale',
   'Content writing agency producing blog, SEO and conversion copy for growth teams.',
   'Austin, USA', 'North America', 'US', 4.7, 402, true, 'active',
   '{"Blog Writing","SEO Content","Copywriting"}',
   '{"linkedin"}', '{"English"}', '{"Available Now"}',
   10, 'word', 20000, 'GBP', 48, 60, 95.0, 94.0, 402, true, null, null, null, '{}'::jsonb, true),

  ('ugc-pros', 'UGC Pros', 'ugc_creator',
   'UGC Creator Agency', 'Scroll-stopping UGC for paid social',
   'Collective of vetted UGC creators producing TikTok, Reels and product review content for DTC brands.',
   'Los Angeles, USA', 'North America', 'US', 4.9, 189, true, 'active',
   '{"UGC Videos","TikTok","Product Reviews"}',
   '{"tiktok","instagram","youtube"}', '{"English","Spanish"}', '{"Top Rated"}',
   20000, 'video', 20000, 'GBP', 48, 120, 98.0, 96.0, 189, true, null, null, null, '{}'::jsonb, true),

  ('design-fusion', 'Design Fusion', 'agency',
   'UI/UX Design Studio', 'Product design for web and mobile',
   'UI/UX studio designing conversion-focused websites, apps and design systems.',
   'San Francisco, USA', 'North America', 'US', 4.8, 267, true, 'active',
   '{"UI Design","UX Design","Web Design"}',
   '{"linkedin"}', '{"English"}', '{"Pro Partner"}',
   50000, 'project', 30000, 'GBP', 72, 120, 95.0, 93.0, 267, true, null, null, null, '{}'::jsonb, true),

  ('seo-content-pros', 'SEO Content Pros', 'agency',
   'SEO Content Agency', 'Rank-first content built on keyword research',
   'SEO agency combining technical audits, keyword strategy and content production.',
   'Chicago, USA', 'North America', 'US', 4.9, 312, true, 'active',
   '{"SEO Writing","Keyword Research","Link Building"}',
   '{"linkedin"}', '{"English"}', '{"Fast Turnaround"}',
   8, 'word', 25000, 'GBP', 72, 180, 94.0, 92.0, 312, true, null, null, null, '{}'::jsonb, true),

  ('audiowave-studios', 'AudioWave Studios', 'freelancer',
   'Audio Production Studio', 'Podcast editing, sound design and mixing',
   'Audio production studio handling podcast editing, sound design and full mix/master.',
   'Nashville, USA', 'North America', 'US', 4.8, 156, true, 'active',
   '{"Podcast Editing","Sound Design","Mixing"}',
   '{"podcast","youtube"}', '{"English"}', '{"Available Now"}',
   10000, 'project', 10000, 'GBP', 48, 60, 96.0, 95.0, 156, true, null, null, null, '{}'::jsonb, true),

  ('logo-design-co', 'Logo Design Co.', 'freelancer',
   'Logo & Identity Designer', 'Distinctive marks for ambitious brands',
   'Independent identity designer creating distinctive logo systems and brand marks.',
   'Manchester, UK', 'Europe', 'GB', 4.7, 148, true, 'active',
   '{"Logo Design","Brand Identity"}', '{"instagram"}', '{"English"}', '{"Verified Freelancer"}',
   85000, 'project', 40000, 'GBP', 96, 180, 93.0, 92.0, 148, true, null, null, null, '{}'::jsonb, true),

  ('linkedin-growth', 'LinkedIn Growth', 'ads_manager',
   'B2B Social Growth', 'LinkedIn-first demand generation',
   'B2B social specialists running LinkedIn organic and paid programmes for SaaS teams.',
   'Dublin, Ireland', 'Europe', 'IE', 4.6, 96, true, 'active',
   '{"Social Media","LinkedIn Ads","Demand Gen"}', '{"linkedin"}', '{"English"}', '{}',
   45000, 'month', 45000, 'GBP', 120, 240, 91.0, 90.0, 96, true, null, null, null, '{}'::jsonb, true),

  ('video-editors-pro', 'Video Editors Pro', 'freelancer',
   'Short-form Video Editor', 'Retention-first edits for Reels and Shorts',
   'Short-form editing team focused on retention, captions and hook testing.',
   'Warsaw, Poland', 'Europe', 'PL', 4.7, 210, true, 'active',
   '{"Video Editing","Short Form","Captions"}', '{"tiktok","instagram","youtube"}', '{"English","Polish"}', '{}',
   18000, 'video', 18000, 'GBP', 36, 90, 94.0, 93.0, 210, true, null, null, null, '{}'::jsonb, true),

  ('elite-video-studio', 'Elite Video Studio', 'agency',
   'Full-service Video Production', 'Concept to delivery video production',
   'Full-service production company covering concept, shoot, edit and distribution.',
   'Leeds, UK', 'Europe', 'GB', 4.8, 134, true, 'active',
   '{"Video Production","Video Editing","Post Production"}', '{"youtube","instagram"}', '{"English"}', '{"Top Rated"}',
   180000, 'project', 90000, 'GBP', 168, 180, 95.0, 94.0, 134, false, null, null, null, '{}'::jsonb, true),

  -- Influencers (audience metrics populated)
  ('sarah-fitlife', 'Sarah FitLife', 'influencer',
   'Fitness & Wellness Creator', 'Strength training and healthy living',
   'Fitness creator posting strength training, nutrition and healthy-living content.',
   'Los Angeles, USA', 'North America', 'US', 4.9, 214, true, 'active',
   '{"Fitness","Wellness","Healthy Living"}', '{"instagram","tiktok","youtube"}', '{"English"}', '{"Top Performer"}',
   350000, 'post', 350000, 'GBP', 120, 90, 94.0, 95.0, 118, true,
   1064000, '92% Female, 18-34', 4.7, '{"instagram":624000,"tiktok":312000,"youtube":128000}'::jsonb, true),

  ('mike-moves', 'Mike Moves', 'influencer',
   'Motivation & Lifestyle Creator', 'Daily motivation and lifestyle',
   'Lifestyle and motivation creator with a highly engaged male audience.',
   'Austin, USA', 'North America', 'US', 4.8, 167, true, 'active',
   '{"Motivation","Lifestyle"}', '{"instagram","tiktok","youtube"}', '{"English"}', '{"Rising Star"}',
   200000, 'post', 200000, 'GBP', 96, 120, 93.0, 94.0, 96, true,
   792000, '88% Male, 18-34', 5.2, '{"instagram":487000,"tiktok":216000,"youtube":89000}'::jsonb, true),

  ('glow-with-allie', 'Glow With Allie', 'influencer',
   'Beauty & Skincare Creator', 'Skincare routines and product reviews',
   'Beauty creator specialising in skincare education, routines and honest product reviews.',
   'Miami, USA', 'North America', 'US', 4.9, 289, true, 'active',
   '{"Beauty","Skincare","Self Care"}', '{"instagram","tiktok","youtube"}', '{"English","Spanish"}', '{"Top Performer"}',
   400000, 'post', 400000, 'GBP', 120, 60, 97.0, 96.0, 142, true,
   1394000, '95% Female, 18-30', 4.9, '{"instagram":815000,"tiktok":423000,"youtube":156000}'::jsonb, true),

  ('tech-with-tony', 'Tech With Tony', 'influencer',
   'Technology Reviewer', 'Gadget reviews and buying guides',
   'Technology reviewer covering gadgets, buying guides and long-form comparisons.',
   'Seattle, USA', 'North America', 'US', 4.7, 121, true, 'active',
   '{"Technology","Gadgets","Reviews"}', '{"instagram","tiktok","youtube"}', '{"English"}', '{"Tech Expert"}',
   250000, 'post', 250000, 'GBP', 144, 150, 92.0, 91.0, 78, true,
   638000, '82% Male, 18-34', 3.8, '{"instagram":352000,"tiktok":189000,"youtube":97000}'::jsonb, true),

  ('wander-with-jen', 'Wander With Jen', 'influencer',
   'Travel & Adventure Creator', 'Adventure travel and photography',
   'Travel creator producing adventure films, destination guides and photography.',
   'Lisbon, Portugal', 'Europe', 'PT', 4.8, 176, true, 'active',
   '{"Travel","Adventure","Photography"}', '{"instagram","tiktok","youtube"}', '{"English","Portuguese"}', '{"Travel Creator"}',
   220000, 'post', 220000, 'GBP', 168, 180, 93.0, 92.0, 88, true,
   490000, '79% Female, 25-40', 4.3, '{"instagram":271000,"tiktok":156000,"youtube":63000}'::jsonb, true),

  ('chef-marley', 'Chef Marley', 'influencer',
   'Food & Recipes Creator', 'Everyday cooking and recipe films',
   'Food creator producing approachable recipe films and cooking tutorials.',
   'London, UK', 'Europe', 'GB', 4.7, 143, true, 'active',
   '{"Food","Cooking","Recipes"}', '{"instagram","tiktok","youtube"}', '{"English"}', '{"Food Creator"}',
   180000, 'post', 180000, 'GBP', 120, 150, 91.0, 90.0, 71, true,
   399000, '76% Mixed, 18-35', 4.1, '{"instagram":198000,"tiktok":143000,"youtube":58000}'::jsonb, true),

  -- UGC creators
  ('taylor-morgan', 'Taylor Morgan', 'ugc_creator',
   'Lifestyle UGC Creator', 'Skincare, beauty and wellness UGC',
   'UGC creator producing skincare, beauty and wellness content with a warm lifestyle aesthetic.',
   'Los Angeles, USA', 'North America', 'US', 4.9, 248, true, 'active',
   '{"Skincare","Beauty","Wellness","Unboxing"}', '{"tiktok","instagram","youtube"}', '{"English"}', '{"Top Rated"}',
   15000, 'video', 15000, 'GBP', 36, 90, 95.0, 96.0, 248, true,
   120000, null, 4.8, '{}'::jsonb, true),

  ('chris-bennett', 'Chris Bennett', 'ugc_creator',
   'Tech UGC Creator', 'Product demos and unboxing',
   'UGC creator focused on tech unboxing, demos and men''s grooming content.',
   'Toronto, Canada', 'North America', 'CA', 4.8, 193, true, 'active',
   '{"Tech","SaaS","Reviews","Men''s Grooming"}', '{"tiktok","instagram"}', '{"English"}', '{"Top Rated"}',
   17500, 'video', 17500, 'GBP', 36, 120, 97.0, 95.0, 193, true,
   210000, null, 6.1, '{}'::jsonb, true),

  ('sofia-ramirez', 'Sofia Ramirez', 'ugc_creator',
   'Beauty UGC Creator', 'Skincare and self-care UGC',
   'Bilingual UGC creator producing skincare, beauty and self-care content.',
   'Miami, USA', 'North America', 'US', 4.9, 315, true, 'active',
   '{"Skincare","Beauty","Self Care"}', '{"tiktok","instagram","youtube"}', '{"English","Spanish"}', '{"Top Rated"}',
   20000, 'video', 20000, 'GBP', 72, 60, 92.0, 94.0, 315, true,
   180000, null, 5.7, '{}'::jsonb, true),

  ('sophia-lee', 'Sophia Lee', 'ugc_creator',
   'Lifestyle UGC Creator', 'Unboxing and product demo specialist',
   'Lifestyle UGC creator specialising in unboxing and product demonstration.',
   'Los Angeles, USA', 'North America', 'US', 4.9, 136, true, 'active',
   '{"Lifestyle","Unboxing","Product Demo"}', '{"tiktok","instagram"}', '{"English","Korean"}', '{"UGC Creator"}',
   14000, 'video', 14000, 'GBP', 48, 90, 94.0, 95.0, 136, true,
   96000, null, 5.1, '{}'::jsonb, true),

  ('marcus-brown', 'Marcus Brown', 'ugc_creator',
   'Tech UGC Creator', 'SaaS walkthroughs and reviews',
   'UGC creator producing SaaS walkthroughs, tech reviews and explainer content.',
   'New York, USA', 'North America', 'US', 4.8, 102, true, 'active',
   '{"Tech","SaaS","Reviews"}', '{"tiktok","youtube"}', '{"English"}', '{"UGC Creator"}',
   16000, 'video', 16000, 'GBP', 48, 120, 93.0, 92.0, 102, true,
   74000, null, 4.4, '{}'::jsonb, true),

  ('lena-rodriguez', 'Lena Rodriguez', 'ugc_creator',
   'Fitness UGC Creator', 'High-energy fitness and apparel content',
   'Fitness UGC creator producing high-energy workout, wellness and apparel content.',
   'Miami, USA', 'North America', 'US', 4.9, 98, true, 'active',
   '{"Fitness","Wellness","Apparel"}', '{"tiktok","instagram"}', '{"English","Spanish"}', '{"UGC Creator"}',
   18000, 'video', 18000, 'GBP', 48, 90, 95.0, 94.0, 98, true,
   88000, null, 5.4, '{}'::jsonb, true),

  ('ethan-park', 'Ethan Park', 'ugc_creator',
   'Gaming UGC Creator', 'Gaming and livestream content',
   'Gaming UGC creator producing gameplay, tech and livestream content.',
   'Seattle, USA', 'North America', 'US', 4.7, 88, true, 'active',
   '{"Gaming","Tech","Livestream"}', '{"youtube","tiktok"}', '{"English"}', '{"UGC Creator"}',
   15000, 'video', 15000, 'GBP', 72, 150, 90.0, 91.0, 88, true,
   112000, null, 4.2, '{}'::jsonb, true),

  ('animax-studio', 'Animax Studio', 'agency',
   'Animation Studio', '2D and 3D animation for brands',
   'Animation studio producing 2D/3D brand films, explainers and title sequences.',
   'Barcelona, Spain', 'Europe', 'ES', 4.9, 189, true, 'active',
   '{"Animation","3D","Explainer Videos"}', '{"youtube","instagram"}', '{"English","Spanish"}', '{"Pro Partner"}',
   100000, 'project', 60000, 'GBP', 120, 180, 94.0, 93.0, 189, true, null, null, null, '{}'::jsonb, true),

  ('audio-masters', 'Audio Masters', 'freelancer',
   'Audio Production', 'Mixing, mastering and audio branding',
   'Audio production specialists covering mixing, mastering and sonic branding.',
   'Berlin, Germany', 'Europe', 'DE', 4.6, 74, true, 'active',
   '{"Audio Production","Mixing","Sound Design"}', '{"podcast"}', '{"English","German"}', '{}',
   9500, 'project', 9500, 'GBP', 72, 180, 92.0, 90.0, 74, true, null, null, null, '{}'::jsonb, true)
on conflict (slug) do update set
  headline = excluded.headline, tagline = excluded.tagline, bio = excluded.bio,
  location = excluded.location, region = excluded.region, country = excluded.country,
  rating = excluded.rating, reviews_count = excluded.reviews_count, verified = excluded.verified,
  tags = excluded.tags, platforms = excluded.platforms, languages = excluded.languages,
  badges = excluded.badges, starting_price_cents = excluded.starting_price_cents,
  price_unit = excluded.price_unit, min_order_cents = excluded.min_order_cents,
  turnaround_hours = excluded.turnaround_hours, response_time_minutes = excluded.response_time_minutes,
  on_time_delivery_pct = excluded.on_time_delivery_pct, job_success_pct = excluded.job_success_pct,
  projects_count = excluded.projects_count, available_now = excluded.available_now,
  audience_size = excluded.audience_size, audience_summary = excluded.audience_summary,
  engagement_rate = excluded.engagement_rate, follower_counts = excluded.follower_counts,
  is_demo = true;

-- Backfill discovery metrics on the original eight seed suppliers so they are not
-- second-class citizens in search results.
update public.marketplace_suppliers set
  is_demo = true,
  region = coalesce(region, 'Europe'), country = coalesce(country, 'GB'),
  languages = case when languages = '{}' then '{"English"}' else languages end,
  starting_price_cents = coalesce(starting_price_cents, 25000),
  min_order_cents = coalesce(min_order_cents, 15000),
  turnaround_hours = coalesce(turnaround_hours, 72),
  response_time_minutes = coalesce(response_time_minutes, 120),
  on_time_delivery_pct = coalesce(on_time_delivery_pct, 93.0),
  job_success_pct = coalesce(job_success_pct, 92.0),
  projects_count = coalesce(nullif(projects_count, 0), reviews_count),
  available_now = coalesce(available_now, true)
where slug in ('mara-lewis', 'growth-lab', 'theo-brandt', 'northstar-agency', 'priya-k', 'sam-okafor', 'pixelpilot', 'studio-verde');

-- ---------------------------------------------------------------------------
-- 2. Map suppliers onto the category taxonomy
-- ---------------------------------------------------------------------------
insert into public.marketplace_supplier_categories (supplier_id, category_id)
select s.id, c.id
from (values
  ('motioncraft-studio', 'animation'), ('motioncraft-studio', 'video-editing'),
  ('pixel-perfect-designs', 'graphic-design'), ('logo-design-co', 'graphic-design'),
  ('voicepro-studios', 'voice-over'), ('audiowave-studios', 'voice-over'), ('audio-masters', 'voice-over'),
  ('creative-writers-hub', 'copywriting'), ('seo-content-pros', 'seo'), ('seo-content-pros', 'copywriting'),
  ('ugc-pros', 'ugc-creators'), ('taylor-morgan', 'ugc-creators'), ('chris-bennett', 'ugc-creators'),
  ('sofia-ramirez', 'ugc-creators'), ('sophia-lee', 'ugc-creators'), ('marcus-brown', 'ugc-creators'),
  ('lena-rodriguez', 'ugc-creators'), ('ethan-park', 'ugc-creators'), ('mara-lewis', 'ugc-creators'),
  ('sam-okafor', 'ugc-creators'),
  ('sarah-fitlife', 'influencers'), ('mike-moves', 'influencers'), ('glow-with-allie', 'influencers'),
  ('tech-with-tony', 'influencers'), ('wander-with-jen', 'influencers'), ('chef-marley', 'influencers'),
  ('priya-k', 'influencers'),
  ('design-fusion', 'web-development'), ('design-fusion', 'graphic-design'),
  ('linkedin-growth', 'paid-media'), ('growth-lab', 'paid-media'), ('pixelpilot', 'paid-media'),
  ('video-editors-pro', 'video-editing'), ('elite-video-studio', 'video-editing'), ('animax-studio', 'animation'),
  ('northstar-agency', 'social-media-management'), ('studio-verde', 'graphic-design'), ('theo-brandt', 'graphic-design')
) as m(slug, category_slug)
join public.marketplace_suppliers s on s.slug = m.slug
join public.marketplace_categories c on c.slug = m.category_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Buyer-side demo data for every workspace owned by the demo account
-- ---------------------------------------------------------------------------
do $seed$
declare
  ws record;
  owner uuid;
  sup record;
  req_id uuid;
  ord_id uuid;
  ms_id uuid;
  i integer;
  n integer;
  amount integer;
  request_specs constant text[] := array[
    'rfq|Website Redesign Project|Web Design|150000|250000|8|5|awaiting_proposals|4',
    'discovery|Explainer Video Series|Video Production|200000|300000|10|7|open|7',
    'discovery|Social Media Content Pack|Graphics & Design|80000|120000|12|12|shortlisted|-2',
    'rfq|Podcast Intro & Outro|Audio Production|30000|60000|6|3|open|4',
    'rfq|Product Demo Video|Video Production|260000|260000|7|6|closed_won|-11',
    'discovery|Brand Identity Design|Graphic Design|100000|180000|9|4|open|9'
  ];
  order_specs constant text[] := array[
    'pixel-perfect-designs|Video Production|260000|in_escrow|in_progress|Review Round 1|-2|',
    'motioncraft-studio|Video Production|320000|in_escrow|pending_delivery|Final Delivery|0|',
    'voicepro-studios|Voice Over|115000|in_escrow|delivered|Completed|-6|',
    'creative-writers-hub|Content Writing|32000|released|delivered|Completed|-8|',
    'seo-content-pros|SEO Content|60000|released|delivered|Completed|-8|',
    'logo-design-co|Logo Design|85000|in_escrow|in_progress|Concept Review|3|',
    'linkedin-growth|Social Media|45000|in_escrow|pending_delivery|Final Delivery|4|',
    'video-editors-pro|Video Editing|180000|on_hold|in_progress|Review Round 2|7|under_review',
    'audio-masters|Audio Production|95000|released|delivered|Completed|-11|',
    'design-fusion|Graphic Design|50000|in_escrow|pending_review|Client Review|1|'
  ];
  s text[];
begin
  select id into owner from public.profiles where lower(email) = 'jamahlthomas1996@gmail.com' limit 1;
  if owner is null then
    raise notice 'Demo account not found - skipping buyer-side seed.';
    return;
  end if;

  for ws in select id, name from public.workspaces where owner_id = owner loop

    -- Saved items (suppliers, creators and services) -------------------------
    insert into public.marketplace_saved_items
      (workspace_id, user_id, item_type, supplier_id, note, tags, last_interaction_at)
    select ws.id, owner,
      case when sp.type in ('ugc_creator', 'influencer') then 'creator' else 'supplier' end,
      sp.id, m.note, m.tags, now() - (m.days || ' days')::interval
    from (values
      ('motioncraft-studio',    'Great quality and fast turnaround.',      '{"Video Editing","Post Production"}'::text[], 2),
      ('pixel-perfect-designs', 'Excellent design partner for campaigns.', '{"Branding","Web Design"}'::text[],           5),
      ('voicepro-studios',      'Clear, professional and reliable.',       '{"Voice Over","Narration"}'::text[],          5),
      ('creative-writers-hub',  'Strong SEO content and research.',        '{"Blog Writing","SEO"}'::text[],              7),
      ('sophia-lee',            'Great with lifestyle and beauty brands.', '{"Lifestyle","Unboxing"}'::text[],            2),
      ('marcus-brown',          'Clear communicator and on-brand.',        '{"Tech","SaaS"}'::text[],                     4),
      ('lena-rodriguez',        'High energy and engaging content.',       '{"Fitness","Wellness"}'::text[],              6),
      ('ethan-park',            'Great for gaming and tech content.',      '{"Gaming","Tech"}'::text[],                   7),
      ('taylor-morgan',         'Consistently strong skincare UGC.',       '{"Skincare","Beauty"}'::text[],               3),
      ('seo-content-pros',      'Reliable for keyword-led briefs.',        '{"SEO","Copywriting"}'::text[],               9),
      ('animax-studio',         'Best value for 2D explainer work.',       '{"Animation"}'::text[],                      12),
      ('design-fusion',         'Product design partner for the app.',     '{"UI Design","UX Design"}'::text[],          14)
    ) as m(slug, note, tags, days)
    join public.marketplace_suppliers sp on sp.slug = m.slug
    on conflict do nothing;

    -- Saved searches ---------------------------------------------------------
    insert into public.marketplace_saved_searches (workspace_id, user_id, name, mode, params, result_count, updated_at)
    select ws.id, owner, m.name, m.mode, m.params::jsonb, m.count, now() - (m.days || ' days')::interval
    from (values
      ('Video Editors in USA',  'discover',     '{"q":"video editing","country":"US"}',           23, 2),
      ('UGC Creators - Tech',   'ugc-creators', '{"q":"tech","tag":"Tech"}',                      18, 5),
      ('SEO Writers - Finance', 'services',     '{"q":"seo","category":"seo"}',                   31, 7),
      ('Voice Over - English',  'services',     '{"category":"voice-over","language":"English"}', 27, 7)
    ) as m(name, mode, params, count, days)
    where not exists (
      select 1 from public.marketplace_saved_searches x
      where x.workspace_id = ws.id and x.user_id = owner and x.name = m.name
    );

    -- Shortlist --------------------------------------------------------------
    insert into public.marketplace_shortlist_items (workspace_id, user_id, supplier_id, note)
    select ws.id, owner, sp.id, 'Shortlisted for the current brief.'
    from public.marketplace_suppliers sp
    where sp.slug in ('pixel-perfect-designs', 'motioncraft-studio', 'voicepro-studios', 'creative-writers-hub')
    on conflict do nothing;

    -- Requests, invites and proposals ---------------------------------------
    for i in 1 .. array_length(request_specs, 1) loop
      s := string_to_array(request_specs[i], '|');

      select id into req_id from public.marketplace_requests
      where workspace_id = ws.id and title = s[2] limit 1;

      if req_id is null then
        insert into public.marketplace_requests
          (workspace_id, created_by, kind, title, category, description,
           deliverables, budget_min_cents, budget_max_cents, deadline, status,
           proposals_requested, created_at, updated_at)
        values (ws.id, owner, s[1], s[2], s[3],
          'Demo brief seeded for ' || ws.name || '. Replace with your own project brief.',
          array['Concept', 'First draft', 'Final delivery'],
          s[4]::integer, s[5]::integer, current_date + s[9]::integer, s[8], s[6]::integer,
          now() - ((14 - i) || ' days')::interval, now() - (i || ' hours')::interval)
        returning id into req_id;

        insert into public.marketplace_request_invites (request_id, supplier_id, status)
        select req_id, x.id, 'invited'
        from (
          select sp.id from public.marketplace_suppliers sp
          where sp.status = 'active' and sp.is_demo
          order by sp.rating desc, sp.reviews_count desc
          limit s[6]::integer
        ) x
        on conflict do nothing;

        insert into public.marketplace_proposals
          (request_id, supplier_id, amount_cents, delivery_days, message, status,
           capability_score, availability_score, created_at)
        select req_id, x.supplier_id, s[4]::integer + (x.rn * 12000), 2 + x.rn,
          'Proposal submitted against the seeded demo brief.',
          case when x.rn = 1 then 'shortlisted' else 'submitted' end,
          82 + (x.rn * 3), 80 + (x.rn * 2),
          now() - ((10 - i) || ' days')::interval
        from (
          select inv.supplier_id, (row_number() over (order by inv.invited_at))::integer as rn
          from public.marketplace_request_invites inv
          where inv.request_id = req_id
        ) x
        where x.rn <= s[7]::integer
        on conflict do nothing;
      end if;
    end loop;

    -- Orders, milestones, escrow and disputes --------------------------------
    for i in 1 .. array_length(order_specs, 1) loop
      s := string_to_array(order_specs[i], '|');
      select * into sup from public.marketplace_suppliers where slug = s[1];
      continue when sup.id is null;

      amount := s[3]::integer;

      select o.id into ord_id from public.marketplace_orders o
      where o.workspace_id = ws.id and o.supplier_id = sup.id
        and o.title = (s[2] || ' - ' || sup.display_name)
      limit 1;

      if ord_id is null then
        insert into public.marketplace_orders
          (listing_id, supplier_id, buyer_id, workspace_id, title, category,
           amount_cents, currency, status, escrow_status, delivery_status,
           current_milestone, due_date, dispute_state, released_cents,
           created_at, updated_at)
        values (
          (select l.id from public.marketplace_listings l order by l.created_at limit 1),
          sup.id, owner, ws.id, s[2] || ' - ' || sup.display_name, s[2],
          amount, 'GBP',
          case when s[4] = 'released' then 'completed' else 'escrow_held' end,
          s[4], s[5], s[6], current_date + s[7]::integer, nullif(s[8], ''),
          case when s[4] = 'released' then amount else 0 end,
          now() - ((20 - i) || ' days')::interval, now() - (i || ' hours')::interval)
        returning id into ord_id;

        insert into public.marketplace_order_milestones (order_id, position, title, amount_cents, due_date, status)
        values
          (ord_id, 1, 'Kick-off and concept', round(amount * 0.3)::integer, current_date + s[7]::integer - 10,
            case when s[5] = 'delivered' then 'released' else 'approved' end),
          (ord_id, 2, 'First draft', round(amount * 0.4)::integer, current_date + s[7]::integer - 5,
            case when s[5] = 'delivered' then 'released'
                 when s[5] = 'pending_review' then 'pending_review' else 'in_progress' end),
          (ord_id, 3, 'Final delivery', round(amount * 0.3)::integer, current_date + s[7]::integer,
            case when s[5] = 'delivered' then 'released' else 'not_started' end)
        on conflict do nothing;

        insert into public.marketplace_escrow_transactions
          (order_id, workspace_id, kind, amount_cents, state, actor_id, note, idempotency_key)
        values (ord_id, ws.id, 'fund', amount, 'succeeded', owner,
          'Demo escrow funding record.', 'seed-fund-' || ord_id)
        on conflict do nothing;

        if s[4] = 'released' then
          insert into public.marketplace_escrow_transactions
            (order_id, workspace_id, kind, amount_cents, state, actor_id, note, idempotency_key)
          values (ord_id, ws.id, 'release', amount, 'succeeded', owner,
            'Demo escrow release on delivery approval.', 'seed-release-' || ord_id)
          on conflict do nothing;
        end if;

        if s[8] <> '' then
          select id into ms_id from public.marketplace_order_milestones where order_id = ord_id and position = 2;
          insert into public.marketplace_disputes
            (order_id, workspace_id, milestone_id, raised_by, stage, reason, severity, amount_cents, requested_resolution)
          values (ord_id, ws.id, ms_id, owner, 'evidence',
            'Delivery did not match the agreed scope.', 'high', amount,
            'Partial refund and one revision round.');
        end if;

        insert into public.marketplace_activity (workspace_id, actor_id, event, summary, entity_type, entity_id, href)
        values (ws.id, owner, 'order.created',
          'New order placed with ' || sup.display_name, 'order', ord_id, '/app/marketplace/orders');
      end if;
    end loop;

    -- A little non-order activity so the feed reads like a real workspace.
    insert into public.marketplace_activity (workspace_id, actor_id, event, summary, entity_type, href)
    select ws.id, owner, m.event, m.summary, m.entity_type, m.href
    from (values
      ('supplier.saved',    'Saved MotionCraft Studio to your partners', 'supplier', '/app/marketplace/saved'),
      ('search.saved',      'Created search preset "Video Editors in USA"', 'search', '/app/marketplace/saved'),
      ('request.created',   'New request submitted to 5 suppliers', 'request', '/app/marketplace/requests'),
      ('proposal.received', 'Pixel Perfect Designs responded to your request', 'proposal', '/app/marketplace/requests')
    ) as m(event, summary, entity_type, href)
    where not exists (
      select 1 from public.marketplace_activity a
      where a.workspace_id = ws.id and a.summary = m.summary
    );

  end loop;
end
$seed$;

-- ---------------------------------------------------------------------------
-- Removing the demo data
--   Seller directory:  delete from public.marketplace_suppliers where is_demo;
--   Buyer-side data:   deleting a demo workspace cascades to its marketplace
--                      requests, orders, saved items, searches and activity.
-- ---------------------------------------------------------------------------
