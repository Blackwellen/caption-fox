-- Caption Fox Marketplace — demo profile media.
--
-- Attaches the rendered demo covers and avatars (public/demo/marketplace/,
-- produced by scripts/render-marketplace-seed-media.py from Unsplash-licensed
-- photography) to the demo supplier directory. Demo rows only: the filter on
-- is_demo keeps real seller-uploaded media untouched.
--
-- Apply with: node scripts/apply-migration.mjs supabase/seed_marketplace_media.sql
-- Idempotent: safe to run repeatedly.

update public.marketplace_suppliers as s set
  cover_url = v.cover, avatar_url = v.avatar
from (values
  ('animax-studio', '/demo/marketplace/covers/animax-studio.jpg', '/demo/marketplace/avatars/animax-studio.jpg'),
  ('audio-masters', '/demo/marketplace/covers/audio-masters.jpg', '/demo/marketplace/avatars/audio-masters.jpg'),
  ('audiowave-studios', '/demo/marketplace/covers/audiowave-studios.jpg', '/demo/marketplace/avatars/audiowave-studios.jpg'),
  ('chef-marley', '/demo/marketplace/covers/chef-marley.jpg', '/demo/marketplace/avatars/chef-marley.jpg'),
  ('chris-bennett', '/demo/marketplace/covers/chris-bennett.jpg', '/demo/marketplace/avatars/chris-bennett.jpg'),
  ('creative-writers-hub', '/demo/marketplace/covers/creative-writers-hub.jpg', '/demo/marketplace/avatars/creative-writers-hub.jpg'),
  ('design-fusion', '/demo/marketplace/covers/design-fusion.jpg', '/demo/marketplace/avatars/design-fusion.jpg'),
  ('elite-video-studio', '/demo/marketplace/covers/elite-video-studio.jpg', '/demo/marketplace/avatars/elite-video-studio.jpg'),
  ('ethan-park', '/demo/marketplace/covers/ethan-park.jpg', '/demo/marketplace/avatars/ethan-park.jpg'),
  ('glow-with-allie', '/demo/marketplace/covers/glow-with-allie.jpg', '/demo/marketplace/avatars/glow-with-allie.jpg'),
  ('growth-lab', '/demo/marketplace/covers/growth-lab.jpg', '/demo/marketplace/avatars/growth-lab.jpg'),
  ('jamahl-thomas-creative-studio', '/demo/marketplace/covers/jamahl-thomas-creative-studio.jpg', '/demo/marketplace/avatars/jamahl-thomas-creative-studio.jpg'),
  ('lena-rodriguez', '/demo/marketplace/covers/lena-rodriguez.jpg', '/demo/marketplace/avatars/lena-rodriguez.jpg'),
  ('linkedin-growth', '/demo/marketplace/covers/linkedin-growth.jpg', '/demo/marketplace/avatars/linkedin-growth.jpg'),
  ('logo-design-co', '/demo/marketplace/covers/logo-design-co.jpg', '/demo/marketplace/avatars/logo-design-co.jpg'),
  ('luna-creative-co-9b50fd', '/demo/marketplace/covers/luna-creative-co-9b50fd.jpg', '/demo/marketplace/avatars/luna-creative-co-9b50fd.jpg'),
  ('mara-lewis', '/demo/marketplace/covers/mara-lewis.jpg', '/demo/marketplace/avatars/mara-lewis.jpg'),
  ('marcus-brown', '/demo/marketplace/covers/marcus-brown.jpg', '/demo/marketplace/avatars/marcus-brown.jpg'),
  ('mike-moves', '/demo/marketplace/covers/mike-moves.jpg', '/demo/marketplace/avatars/mike-moves.jpg'),
  ('motioncraft-studio', '/demo/marketplace/covers/motioncraft-studio.jpg', '/demo/marketplace/avatars/motioncraft-studio.jpg'),
  ('northstar-agency', '/demo/marketplace/covers/northstar-agency.jpg', '/demo/marketplace/avatars/northstar-agency.jpg'),
  ('pixel-perfect-designs', '/demo/marketplace/covers/pixel-perfect-designs.jpg', '/demo/marketplace/avatars/pixel-perfect-designs.jpg'),
  ('pixelpilot', '/demo/marketplace/covers/pixelpilot.jpg', '/demo/marketplace/avatars/pixelpilot.jpg'),
  ('priya-k', '/demo/marketplace/covers/priya-k.jpg', '/demo/marketplace/avatars/priya-k.jpg'),
  ('sam-okafor', '/demo/marketplace/covers/sam-okafor.jpg', '/demo/marketplace/avatars/sam-okafor.jpg'),
  ('sarah-fitlife', '/demo/marketplace/covers/sarah-fitlife.jpg', '/demo/marketplace/avatars/sarah-fitlife.jpg'),
  ('seo-content-pros', '/demo/marketplace/covers/seo-content-pros.jpg', '/demo/marketplace/avatars/seo-content-pros.jpg'),
  ('sofia-ramirez', '/demo/marketplace/covers/sofia-ramirez.jpg', '/demo/marketplace/avatars/sofia-ramirez.jpg'),
  ('sophia-lee', '/demo/marketplace/covers/sophia-lee.jpg', '/demo/marketplace/avatars/sophia-lee.jpg'),
  ('studio-verde', '/demo/marketplace/covers/studio-verde.jpg', '/demo/marketplace/avatars/studio-verde.jpg'),
  ('taylor-morgan', '/demo/marketplace/covers/taylor-morgan.jpg', '/demo/marketplace/avatars/taylor-morgan.jpg'),
  ('tech-with-tony', '/demo/marketplace/covers/tech-with-tony.jpg', '/demo/marketplace/avatars/tech-with-tony.jpg'),
  ('theo-brandt', '/demo/marketplace/covers/theo-brandt.jpg', '/demo/marketplace/avatars/theo-brandt.jpg'),
  ('ugc-pros', '/demo/marketplace/covers/ugc-pros.jpg', '/demo/marketplace/avatars/ugc-pros.jpg'),
  ('video-editors-pro', '/demo/marketplace/covers/video-editors-pro.jpg', '/demo/marketplace/avatars/video-editors-pro.jpg'),
  ('voicepro-studios', '/demo/marketplace/covers/voicepro-studios.jpg', '/demo/marketplace/avatars/voicepro-studios.jpg'),
  ('wander-with-jen', '/demo/marketplace/covers/wander-with-jen.jpg', '/demo/marketplace/avatars/wander-with-jen.jpg')
) as v(slug, cover, avatar)
where s.slug = v.slug and s.is_demo;
