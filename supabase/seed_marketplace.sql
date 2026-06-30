-- Seed the marketplace with real suppliers + listings (idempotent).
-- Apply via the Supabase SQL editor or the Management API.

insert into public.marketplace_suppliers (slug, display_name, type, headline, location, rating, reviews_count, verified, status) values
  ('mara-lewis','Mara Lewis','ugc_creator','Authentic UGC that converts','Manchester, UK',4.9,128,true,'active'),
  ('growth-lab','Growth Lab','ads_manager','Full-funnel paid social','London, UK',4.8,64,true,'active'),
  ('theo-brandt','Theo Brandt','freelancer','Social content design','Bristol, UK',4.7,41,false,'active'),
  ('northstar-agency','Northstar Agency','agency','Full social media management','Leeds, UK',5.0,23,true,'active'),
  ('priya-k','Priya K','influencer','Beauty & lifestyle creator','Birmingham, UK',4.9,87,true,'active'),
  ('sam-okafor','Sam Okafor','ugc_creator','Unboxing & review UGC','Glasgow, UK',4.6,52,false,'active'),
  ('pixelpilot','PixelPilot','ads_manager','Google & YouTube ads','Remote',4.8,39,true,'active'),
  ('studio-verde','Studio Verde','agency','Brand & content','London, UK',4.9,31,true,'active')
on conflict (slug) do nothing;

insert into public.marketplace_listings (supplier_id, kind, title, summary, category, price_cents, currency, delivery_days, rating, reviews_count, status)
select s.id, v.kind, v.title, v.summary, v.category, v.price_cents, 'GBP', v.delivery_days, v.rating, v.reviews_count, 'active'
from (values
  ('mara-lewis','booking','Authentic UGC video for your product','3× 30s vertical videos, on-brand, ready for TikTok & Reels.','UGC Video',18000,5,4.9,128),
  ('growth-lab','service','Meta & TikTok ads management','Full-funnel paid social management with weekly reporting.','Paid Ads',90000,30,4.8,64),
  ('theo-brandt','product','Social content design — 12 posts','On-brand carousels and statics for a month of content.','Design',32000,7,4.7,41),
  ('northstar-agency','service','Full social media management','Strategy, content, scheduling and community management.','Management',150000,30,5.0,23),
  ('priya-k','booking','Sponsored Reel to 180k followers','Beauty & lifestyle audience, UK-based, high engagement.','Influencer',60000,10,4.9,87),
  ('sam-okafor','booking','Unboxing & review UGC bundle','5 product videos with hooks tailored to your offer.','UGC Video',25000,6,4.6,52),
  ('pixelpilot','service','Google & YouTube ads sprint','2-week sprint to launch and optimise paid search & video.','Paid Ads',70000,14,4.8,39),
  ('studio-verde','service','Brand & content refresh','Visual identity refresh plus a 30-day content kit.','Branding',120000,21,4.9,31)
) as v(slug, kind, title, summary, category, price_cents, delivery_days, rating, reviews_count)
join public.marketplace_suppliers s on s.slug = v.slug
where not exists (select 1 from public.marketplace_listings l where l.supplier_id = s.id and l.title = v.title);
