// Seeds the Campaign Manager → Studio demo data for the Brand demo workspace.
//
//   python scripts/render-studio-seed-media.py   # once, renders the media
//   node scripts/seed-studio-demo.mjs
//
// Development / demo only. Idempotent: every row this script owns is tagged
// (is_demo, metadata.seed = 'studio', mode = 'demo' or an `r2:studio/{ws}/demo/`
// path) and replaced on each run; nothing a real user created is touched.
// Media files are uploaded to the private R2 bucket under the workspace prefix.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const WS = process.argv[2] ?? 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const s3 = new S3Client({
  region: 'auto', endpoint: new URL(env.CLOUDFLARE_R2_S3_API).origin,
  credentials: { accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS },
})
const Bucket = env.CLOUDFLARE_S3_BUCKET
const MEDIA_ROOT = path.join('supabase', 'seed-media', 'studio')
const manifest = JSON.parse(fs.readFileSync(path.join(MEDIA_ROOT, 'manifest.json'), 'utf8'))

const NOW = Date.now()
const H = 3600_000
const D = 24 * H
const at = ms => new Date(NOW - ms).toISOString()
const future = ms => new Date(NOW + ms).toISOString()
const pick = (arr, i) => arr[i % arr.length]

function must({ error, data }, label) {
  if (error) { console.error(`FAILED ${label}:`, error.message); process.exit(1) }
  return data
}

// ── People ───────────────────────────────────────────────────────────────────
const members = must(await db.from('workspace_members')
  .select('user_id, role, profile:profiles!workspace_members_user_id_fkey(id, full_name)').eq('workspace_id', WS), 'members')
const byName = Object.fromEntries(members.map(m => [m.profile.full_name, m.user_id]))
const P = {
  jason: byName['Jason Ranti'], emily: byName['Emily Johnson'], michael: byName['Michael Chen'],
  sarah: byName['Sarah Williams'], david: byName['David Martinez'], priya: byName['Priya Shah'],
  emma: byName['Emma Davis'], liam: byName['Liam Chen'], sophia: byName['Sophia Patel'],
}
for (const [k, v] of Object.entries(P)) if (!v) { console.error('missing member', k); process.exit(1) }
const HERO_DRAFTS = ['Smarter content. Stronger impact.', 'Product Launch Announcement – Q2 2026']
const OWNER = members.find(m => m.role === 'owner')?.user_id ?? P.jason
const TEAM = [P.jason, P.emily, P.michael, P.sarah, P.david, P.priya, P.emma]

const campaigns = must(await db.from('campaigns').select('id, name').eq('workspace_id', WS).is('archived_at', null), 'campaigns')
const camp = name => campaigns.find(c => c.name === name)?.id ?? null

// ── Clean previous Studio seed ───────────────────────────────────────────────
const demoPrefix = `r2:studio/${WS}/demo/`
const oldPosts = must(await db.from('content_posts').select('id').eq('workspace_id', WS).eq('metadata->>seed', 'studio'), 'old posts')
const oldPostIds = oldPosts.map(p => p.id)
if (oldPostIds.length) {
  for (const table of ['studio_content_assets', 'post_versions', 'post_comments', 'studio_template_usage']) {
    must(await db.from(table).delete().eq('workspace_id', WS).in(table === 'studio_content_assets' || table === 'studio_template_usage' ? 'content_id' : 'post_id', oldPostIds), `clean ${table}`)
  }
}
must(await db.from('studio_template_usage').delete().eq('workspace_id', WS), 'clean usage')
must(await db.from('studio_template_favourites').delete().eq('workspace_id', WS), 'clean favourites')
must(await db.from('content_ideas').update({ converted_to_post_id: null }).eq('workspace_id', WS).eq('is_demo', true), 'unlink ideas')
must(await db.from('content_posts').delete().eq('workspace_id', WS).eq('metadata->>seed', 'studio'), 'clean posts')
must(await db.from('studio_idea_tasks').delete().eq('workspace_id', WS), 'clean idea tasks')
must(await db.from('content_ideas').delete().eq('workspace_id', WS).eq('is_demo', true), 'clean ideas')
must(await db.from('studio_idea_collections').delete().eq('workspace_id', WS), 'clean idea collections')
must(await db.from('content_templates').delete().eq('workspace_id', WS).eq('is_demo', true), 'clean templates')
const oldSets = must(await db.from('hashtag_sets').select('id').eq('workspace_id', WS).eq('is_demo', true), 'old sets')
if (oldSets.length) must(await db.from('studio_keyword_terms').delete().in('set_id', oldSets.map(s => s.id)), 'clean terms')
must(await db.from('hashtag_sets').delete().eq('workspace_id', WS).eq('is_demo', true), 'clean sets')
must(await db.from('studio_blocked_terms').delete().eq('workspace_id', WS), 'clean blocked')
must(await db.from('ai_generations').delete().eq('workspace_id', WS).eq('mode', 'demo'), 'clean ai')
must(await db.from('studio_prompts').delete().eq('workspace_id', WS), 'clean prompts')
must(await db.from('studio_activity').delete().eq('workspace_id', WS).eq('metadata->>seed', 'studio'), 'clean activity')
const oldAssets = must(await db.from('media_assets').select('id').eq('workspace_id', WS).like('file_path', `${demoPrefix}%`), 'old assets')
if (oldAssets.length) must(await db.from('studio_asset_versions').delete().in('asset_id', oldAssets.map(a => a.id)), 'clean versions')
must(await db.from('media_assets').delete().eq('workspace_id', WS).like('file_path', `${demoPrefix}%`), 'clean assets')
must(await db.from('studio_media_collections').delete().eq('workspace_id', WS), 'clean media collections')
console.log('cleaned previous Studio seed')

// ── Media collections + assets ───────────────────────────────────────────────
const mediaCollections = must(await db.from('studio_media_collections').insert([
  { workspace_id: WS, name: 'Campaign Spring 2026', kind: 'campaign', description: 'Spring campaign photography and edits', created_by: P.jason },
  { workspace_id: WS, name: 'Product Launch', kind: 'campaign', description: 'Launch films, stills and decks', created_by: P.michael },
  { workspace_id: WS, name: 'Social Media', kind: 'social', description: 'Ready-to-post social creatives', created_by: P.emily },
  { workspace_id: WS, name: 'Brand Assets', kind: 'brand', description: 'Logos, guidelines and brand marks', created_by: P.david },
  { workspace_id: WS, name: 'Training Videos', kind: 'team', description: 'Internal enablement and onboarding', created_by: P.sarah },
]).select('id, name'), 'media collections')
const mcol = name => mediaCollections.find(c => c.name === name).id

async function put(key, file, ContentType) {
  const Body = fs.readFileSync(path.join(MEDIA_ROOT, file))
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body, ContentType, CacheControl: 'private, max-age=86400' }))
  return Body.length
}

// name, manifest source, type, mime, display size (bytes, for non-image stand-ins), duration, collection, status, tags, owner, age, usage, description
const ASSETS = [
  ['Mountain Landscape.jpg', 'Mountain Landscape.jpg', 'image', null, null, 'Campaign Spring 2026', 'ready', ['nature', 'landscape', 'hero', 'outdoor', 'spring'], P.jason, 2 * H, 3, 'Scenic mountain landscape with lake and pine trees captured during the spring campaign shoot.'],
  ['Product Demo.mp4', 'Product Demo Still.jpg', 'video', 'video/mp4', 93_650_000, 'Product Launch', 'ready', ['product', 'demo', 'launch'], P.michael, 5 * H, 4, 'Two-minute product walkthrough cut for the launch landing page.', 165],
  ['Brand Guidelines.pdf', 'Brand Guidelines Cover.png', 'document', 'application/pdf', 2_202_000, 'Brand Assets', 'needs_review', ['brand', 'guidelines'], P.emily, 1 * D, 2, 'Current brand guidelines: logo usage, colour, type and tone of voice.'],
  ['Team Photo.jpg', 'Team Photo.jpg', 'image', null, null, 'Campaign Spring 2026', 'ready', ['team', 'people', 'culture'], P.sarah, 2 * D, 5, 'Whole-team photo from the spring offsite.'],
  ['Onboarding Guide.pptx', 'Onboarding Guide Cover.png', 'document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 5_662_000, 'Training Videos', 'changes_requested', ['onboarding', 'training'], P.david, 2 * D, 1, 'Customer onboarding deck used in kickoff calls.'],
  ['Customer Story.mov', 'Customer Story Still.jpg', 'video', 'video/quicktime', 126_700_000, 'Product Launch', 'ready', ['customer', 'testimonial', 'story'], P.jason, 3 * D, 2, 'Customer interview edit for the case-study series.', 199],
  ['Logo (White).png', 'Logo White.png', 'image', null, null, 'Brand Assets', 'ready', ['logo', 'brand'], P.emily, 3 * D, 11, 'Primary Caption Fox mark on brand blue.'],
  ['UI Kit.png', 'UI Kit.png', 'image', null, null, 'Brand Assets', 'needs_review', ['design', 'ui'], P.michael, 4 * D, 0, 'Interface kit preview for the design system refresh.'],
  ['Summit Hero.jpg', 'Summit Hero.jpg', 'image', null, null, 'Campaign Spring 2026', 'ready', ['nature', 'hero'], P.priya, 4 * D, 2, 'Wide summit hero image for banners.'],
  ['Workspace Desk.jpg', 'Workspace Desk.jpg', 'image', null, null, 'Social Media', 'ready', ['workspace', 'laptop', 'productivity'], P.emily, 5 * D, 6, 'Laptop on a clean desk for productivity posts.'],
  ['Remote Work Session.jpg', 'Remote Work Session.jpg', 'image', null, null, 'Social Media', 'ready', ['remote', 'people'], P.sarah, 5 * D, 3, 'Remote worker at home for the remote-work series.'],
  ['Blue Waves Background.png', 'Blue Waves Background.png', 'image', null, null, 'Brand Assets', 'ready', ['background', 'abstract'], P.david, 6 * D, 4, 'Abstract brand background for text overlays.'],
  ['Studio Chair.jpg', 'Studio Chair.jpg', 'image', null, null, 'Social Media', 'ready', ['minimal', 'still life'], P.priya, 6 * D, 1, 'Minimal still life for quote posts.'],
  ['Monstera Still Life.jpg', 'Monstera Still Life.jpg', 'image', null, null, 'Social Media', 'ready', ['plant', 'minimal'], P.emma, 7 * D, 1, 'Plant still life for wellbeing posts.'],
  ['Hydrating Serum.jpg', 'Hydrating Serum.jpg', 'image', null, null, 'Product Launch', 'ready', ['skincare', 'product', 'launch'], P.jason, 8 * D, 7, 'Hero packshot for the hydrating serum launch.'],
  ['Skincare Routine.jpg', 'Skincare Routine.jpg', 'image', null, null, 'Product Launch', 'ready', ['skincare', 'routine'], P.emily, 9 * D, 3, 'Cleanser flat lay for routine tips.'],
  ['Creator Portrait.jpg', 'Creator Portrait.jpg', 'image', null, null, 'Social Media', 'ready', ['creator', 'portrait'], P.michael, 10 * D, 2, 'Creator portrait for the UGC spotlight.'],
  ['Office Corridor.jpg', 'Office Corridor.jpg', 'image', null, null, 'Campaign Spring 2026', 'uploaded', ['office'], P.david, 11 * D, 0, 'Office interior for hiring posts.'],
  ['Analytics Dashboard.jpg', 'Analytics Dashboard.jpg', 'image', null, null, 'Social Media', 'ready', ['analytics', 'data'], P.sarah, 12 * D, 4, 'Dashboard close-up for reporting posts.'],
  ['Strategy Meeting.jpg', 'Strategy Meeting.jpg', 'image', null, null, 'Campaign Spring 2026', 'ready', ['team', 'meeting'], P.jason, 13 * D, 2, 'Strategy session for behind-the-scenes content.'],
  ['Planning Workshop.jpg', 'Planning Workshop.jpg', 'image', null, null, 'Training Videos', 'needs_review', ['workshop', 'planning'], P.priya, 14 * D, 0, 'Planning workshop still.'],
  ['Create Without Limits.png', 'Create Without Limits.png', 'image', null, null, 'Social Media', 'ready', ['launch', 'studio', 'creative'], P.jason, 15 * D, 9, 'Studio launch creative, 4:5.'],
  ['Future of Digital Marketing.png', 'Future of Digital Marketing.png', 'image', null, null, 'Social Media', 'ready', ['marketing', 'trends'], P.sarah, 16 * D, 3, 'LinkedIn trends carousel cover.'],
]

const assetRows = []
let uploads = 0
for (const [i, a] of ASSETS.entries()) {
  const [name, source, type, mime, stand, collection, status, tags, owner, age, usage, description, duration] = a
  const entry = manifest[source]
  const slug = source.toLowerCase().replace(/[^a-z0-9.]+/g, '-')
  const key = `studio/${WS}/demo/${randomUUID()}`
  const originalKey = `${key}/${slug.replace(/\.(jpg|png)$/, '')}.${entry.original.split('.').pop()}`
  const thumbKey = `${key}/thumb.jpg`
  const size = await put(originalKey, entry.original, entry.mime)
  await put(thumbKey, entry.thumb, 'image/jpeg')
  uploads += 2
  assetRows.push({
    workspace_id: WS, file_name: name, file_path: `r2:${originalKey}`, file_url: `r2:${originalKey}`,
    thumbnail_path: `r2:${thumbKey}`, storage_bucket: 'r2',
    file_type: type, asset_kind: type === 'document' ? (mime === 'application/pdf' ? 'pdf' : 'presentation') : type,
    mime_type: mime ?? entry.mime, file_size: stand ?? size,
    width: type === 'document' ? null : (type === 'video' ? 1920 : entry.width), height: type === 'document' ? null : (type === 'video' ? 1080 : entry.height),
    duration_seconds: duration ?? null, tags, description, alt_text: description.slice(0, 120),
    status, collection_id: mcol(collection), usage_count: usage, colour_profile: type === 'image' ? 'sRGB' : null,
    version: i === 0 ? 3 : 1, owner_id: owner, uploaded_by: owner, is_demo: true,
    approval_status: status === 'ready' ? 'approved' : status === 'changes_requested' ? 'changes_requested' : 'pending',
    processing_state: 'ready', scan_state: 'clean',
    created_at: at(age), updated_at: at(age),
  })
}
const assets = must(await db.from('media_assets').insert(assetRows).select('id, file_name, thumbnail_path'), 'assets')
const asset = name => assets.find(a => a.file_name === name)
const hero = asset('Mountain Landscape.jpg')
must(await db.from('studio_asset_versions').insert([
  { workspace_id: WS, asset_id: hero.id, version: 1, file_path: hero.thumbnail_path, file_url: hero.thumbnail_path, file_size: 3_900_000, replaced_by: P.jason, note: 'Original upload', created_at: at(6 * D) },
  { workspace_id: WS, asset_id: hero.id, version: 2, file_path: hero.thumbnail_path, file_url: hero.thumbnail_path, file_size: 4_100_000, replaced_by: P.emily, note: 'Colour-corrected', created_at: at(3 * D) },
]), 'asset versions')
console.log(`media: ${assets.length} assets, ${uploads} R2 objects`)

// ── Content ──────────────────────────────────────────────────────────────────
const eng = (views, likes, comments, shares) => ({ views, likes, comments, shares })
// title, channels, status, campaign, owner, updated age, scheduled offset (ms from now, +future), asset, tags, caption, engagement
const POSTS = [
  ['Product Launch Announcement – Q2 2026', ['instagram', 'linkedin', 'tiktok'], 'draft', 'Summer Launch 2024', P.jason, 20 * 60_000, null, 'Create Without Limits.png', ['#CaptionFox', '#ContentThatConnects', '#MarketingMadeSimple'],
    'Big news! 🚀 We’re thrilled to introduce Caption Fox Studio — your all-in-one workspace for creating, collaborating, and publishing content that connects.\n\nEverything you need to move faster, stay on brand, and drive real results.\n\n✅ AI-powered ideas & suggestions\n✅ Multi-channel previews\n✅ Seamless team collaboration\n✅ Smart analytics & insights\n\nBuilt for modern marketing teams who want to do more with less.\n\nReady to create without limits?', null],
  ['Smarter content. Stronger impact.', ['instagram', 'linkedin'], 'draft', 'Summer Launch 2024', P.jason, 1 * H, null, 'Mountain Landscape.jpg', ['#ContentStrategy', '#SocialMediaMarketing', '#GrowYourBrand'],
    'Unlock your brand’s full potential with smarter content.\n\nCaption Fox helps teams plan, create, and publish content that connects and converts.\n\nSave time. Stay consistent. Drive results. 🚀', null],
  ['Behind the scenes of our team', ['linkedin', 'tiktok'], 'pending_approval', 'Brand Awareness Q2', P.sarah, 3 * H, 2 * D, 'Team Photo.jpg', ['#Culture', '#BehindTheScenes'],
    'Meet the people behind the posts. A quick look at how our team turns one idea into a complete cross-channel campaign.', null],
  ['3 ways to boost engagement', ['instagram', 'linkedin', 'tiktok'], 'scheduled', 'Email Newsletter Boost', P.michael, 5 * H, 3 * D, 'Analytics Dashboard.jpg', ['#Engagement', '#Tips'],
    'Three practical ways to make your next campaign more memorable. Save this for your next planning session!', null],
  ['Client success story highlights', ['linkedin'], 'approved', 'Customer Stories', P.emily, 8 * H, 5 * D, 'Customer Story.mov', ['#CaseStudy', '#CustomerSuccess'],
    'How one retail team cut production time in half while doubling output. Read the full story →', null],
  ['Hydrating Serum Launch', ['instagram'], 'published', 'Spring Sale Push', P.jason, 2 * H, null, 'Hydrating Serum.jpg', ['#Skincare', '#Launch', '#Beauty', '#Hydration'],
    'Say hello to our new Hydrating Serum 💧 Formulated with hyaluronic acid and natural ingredients to keep your skin glowing all day long. Tap the link in bio to shop the launch edit.', eng(12400, 1200, 86, 230)],
  ['Digital Marketing Trends 2026', ['linkedin'], 'scheduled', 'Webinar Series Q2', P.sarah, 20 * H, 20 * H, 'Future of Digital Marketing.png', ['#Marketing', '#Trends', '#Insights'],
    'The five shifts every marketing team should plan for this year — from AI-assisted production to community-led growth.', eng(8700, 512, 45, 120)],
  ['3 Skincare Tips for Glowing Skin', ['tiktok'], 'published', 'Spring Sale Push', P.michael, 3 * D, null, 'Skincare Routine.jpg', ['#Skincare', '#Tips', '#Glow'],
    'Three steps, sixty seconds, glowing skin. Save this routine ✨', eng(45200, 6100, 234, 987)],
  ['Productivity Tips for Remote Teams', ['facebook'], 'pending_approval', 'Referral Boost', P.emily, 1 * D, null, 'Workspace Desk.jpg', ['#Productivity', '#RemoteWork'],
    'Working remotely? These five habits keep our distributed team focused, connected and shipping.', eng(3200, 210, 18, 65)],
  ['Welcome to Our New Office!', ['facebook'], 'published', 'Brand Awareness Q2', P.emily, 1 * D + 2 * H, -4 * D, 'Office Corridor.jpg', ['#NewOffice', '#Culture'],
    'We’ve moved! Come and say hello at our new home in Shoreditch.', eng(18300, 1800, 96, 140)],
  ['Q2 Product Roadmap Update', ['linkedin'], 'scheduled', 'Product Teaser', P.sarah, 2 * D, 6 * D, 'Strategy Meeting.jpg', ['#Roadmap', '#Product'],
    'What’s coming next quarter: smarter scheduling, richer analytics and new collaboration tools.', null],
  ['5 Productivity Hacks That Work', ['tiktok'], 'pending_approval', 'Creator Collab Drop', P.michael, 2 * D + 4 * H, null, 'Remote Work Session.jpg', ['#Productivity', '#Hacks'],
    'Hack #3 changed how our whole team plans the week. Which one are you trying first?', null],
  ["Mother's Day Special Offer", ['instagram'], 'published', 'Gift Guide 2024', P.jason, 4 * D, -4 * D, 'Monstera Still Life.jpg', ['#Gifting', '#Offer'],
    'Treat the woman who does it all 💐 20% off gift sets this weekend only.', eng(9600, 940, 61, 88)],
  ['Behind the Scenes: Team Day', ['facebook'], 'draft', 'Community Ambassadors', P.emily, 5 * D, null, 'Strategy Meeting.jpg', ['#TeamDay'],
    'A day of workshops, planning and a lot of coffee. Here’s what our team got up to.', null],
  ['Customer Success Story – Acme Co.', ['linkedin'], 'pending_approval', 'Customer Stories', P.priya, 2 * H + 10 * 60_000, null, 'Customer Story.mov', ['#CustomerSuccess'],
    'How Acme Co. scaled from 4 to 40 posts a week without adding headcount.', null],
  ['Product Tips – Advanced Analytics', ['tiktok'], 'draft', 'Product Teaser', P.jason, 1 * D + 5 * H, null, 'Analytics Dashboard.jpg', ['#ProductTips', '#Analytics'],
    'Three analytics views you probably haven’t found yet — and what they tell you.', null],
  ['Spring Campaign – Behind the Scenes', ['instagram', 'linkedin'], 'draft', 'Spring Sale Push', P.jason, 30 * 60_000, null, 'Summit Hero.jpg', ['#Spring', '#BTS'],
    'From moodboard to final cut: how we made the spring campaign.', null],
  ['Creator spotlight: Jess Morgan', ['instagram'], 'approved', 'Creator Collab Drop', P.priya, 3 * D, 4 * D, 'Creator Portrait.jpg', ['#CreatorSpotlight', '#UGC'],
    'Meet Jess — the creator behind our most-saved reel this month.', null],
  ['Brand refresh sneak peek', ['instagram', 'x'], 'draft', 'Press Launch Kit', P.david, 6 * D, null, 'Blue Waves Background.png', ['#Brand', '#SneakPeek'],
    'Something new is coming. Here’s a first look at our refreshed brand.', null],
  ['Webinar: Master Social Strategy', ['linkedin', 'facebook'], 'scheduled', 'Webinar Series Q2', P.sarah, 3 * D, 9 * D, 'Future of Digital Marketing.png', ['#Webinar', '#SocialStrategy'],
    'Join our live session on building a social strategy that actually ships. Save your seat.', null],
  ['Quiet desk, loud ideas', ['x'], 'published', 'Brand Awareness Q2', P.emma, 7 * D, -7 * D, 'Studio Chair.jpg', ['#Focus'],
    'Great ideas start with a clear desk and a clear head.', eng(5100, 320, 14, 41)],
  ['Autumn essentials edit', ['instagram', 'pinterest'], 'scheduled', 'Autumn Essentials Edit', P.emma, 1 * D, 12 * D, 'Hydrating Serum.jpg', ['#Autumn', '#Essentials'],
    'Five autumn essentials our team can’t stop reaching for.', null],
  ['Referral programme reminder', ['instagram', 'facebook'], 'approved', 'Referral Boost', P.david, 4 * D, 8 * D, 'Workspace Desk.jpg', ['#Referral'],
    'Share Caption Fox with a friend and you both get a month on us.', null],
  ['Trade show booth recap', ['linkedin'], 'published', 'Trade Show Roadshow', P.michael, 9 * D, -9 * D, 'Planning Workshop.jpg', ['#Events', '#Recap'],
    'Thank you to everyone who stopped by the booth — here are the highlights.', eng(7300, 410, 33, 52)],
]

const postRows = POSTS.map(([title, platforms, status, campaign, owner, age, sched, assetName, hashtags, caption, engagement], i) => {
  const a = asset(assetName)
  const scheduledAt = sched === null ? null : sched > 0 ? future(sched) : at(-sched)
  return {
    workspace_id: WS, title, internal_title: title, caption, hashtags, platforms, status,
    post_type: platforms.includes('tiktok') ? 'reel' : 'post',
    // The workspace owner started the hero draft, so their Overview composer resumes it.
    campaign_id: camp(campaign), owner_id: owner, created_by: HERO_DRAFTS.includes(title) ? OWNER : owner, updated_by: owner,
    scheduled_at: status === 'published' ? scheduledAt ?? at(age) : scheduledAt,
    published_at: status === 'published' ? scheduledAt ?? at(age) : null,
    thumbnail_url: a?.thumbnail_path ?? null,
    tags: i % 3 === 0 ? ['launch'] : i % 3 === 1 ? ['evergreen'] : ['campaign'],
    tone: pick(['professional', 'friendly', 'confident', 'inspirational'], i),
    cta_label: i % 2 === 0 ? 'Learn More' : null, cta_url: i % 2 === 0 ? 'https://captionfox.app/studio' : null,
    utm_enabled: i % 2 === 0,
    quality_score: 60 + ((i * 7) % 38),
    source: pick(['manual', 'ai', 'template', 'idea', 'manual'], i),
    engagement: engagement ?? {},
    is_demo: true,
    // The Overview quick composer resumes quick drafts; Compose resumes the rest.
    metadata: { seed: 'studio', origin: title.startsWith('Smarter content') ? 'quick_composer' : 'compose', cta_button: i % 2 === 0 ? 'learn_more' : null },
    created_at: at(age + 2 * D), updated_at: at(age),
  }
})
const posts = must(await db.from('content_posts').insert(postRows).select('id, title, thumbnail_url'), 'posts')
const post = title => posts.find(p => p.title === title)
must(await db.from('content_posts').update({
  cta_label: 'Explore Caption Fox Studio', cta_url: 'https://captionfox.app/studio', utm_enabled: true, tone: 'professional',
  tags: ['Product Launch', 'Announcement', 'Q2 2026'], scheduled_at: future(6 * D),
}).eq('id', post('Product Launch Announcement – Q2 2026').id), 'hero draft details')

must(await db.from('studio_content_assets').insert(posts.map((p, i) => ({
  workspace_id: WS, content_id: p.id, asset_id: asset(POSTS[i][7]).id, position: 0,
}))), 'content assets')
const launch = post('Product Launch Announcement – Q2 2026')
must(await db.from('studio_content_assets').insert([
  { workspace_id: WS, content_id: launch.id, asset_id: asset('Blue Waves Background.png').id, position: 1 },
  { workspace_id: WS, content_id: launch.id, asset_id: asset('Team Photo.jpg').id, position: 2 },
]), 'launch assets')

for (const target of [launch, post('Smarter content. Stronger impact.')]) {
  const src = POSTS.find(p => p[0] === target.title)
  must(await db.from('post_versions').insert([
    { post_id: target.id, workspace_id: WS, version_number: 1, caption: src[9].split('\n\n')[0], hashtags: src[8], platforms: src[1], status: 'draft', changed_by: P.jason, change_note: 'First draft', created_at: at(3 * D + 5 * H) },
    { post_id: target.id, workspace_id: WS, version_number: 2, caption: src[9].slice(0, 220), hashtags: src[8], platforms: src[1], status: 'draft', changed_by: P.sarah, change_note: 'Tightened the intro', created_at: at(2 * D + 4 * H) },
    { post_id: target.id, workspace_id: WS, version_number: 3, caption: src[9], hashtags: src[8], platforms: src[1], status: 'draft', changed_by: P.jason, change_note: 'Added feature list', created_at: at(20 * 60_000) },
  ]), 'versions')
}
const c1 = must(await db.from('post_comments').insert({ post_id: launch.id, workspace_id: WS, user_id: P.sarah, body: 'Love this! The messaging is on point 💙 Maybe we can A/B test the CTA button text?', created_at: at(5 * 60_000) }).select('id').single(), 'comment')
must(await db.from('post_comments').insert({ post_id: launch.id, workspace_id: WS, user_id: P.jason, parent_id: c1.id, body: 'Great idea! I’ll prepare a variation.', created_at: at(2 * 60_000) }), 'reply')
console.log(`content: ${posts.length} posts`)

// ── Ideas ────────────────────────────────────────────────────────────────────
const ideaCollections = must(await db.from('studio_idea_collections').insert([
  { workspace_id: WS, name: 'Q2 Campaign Ideas', colour: 'violet', created_by: P.jason },
  { workspace_id: WS, name: 'Product Launch Series', colour: 'blue', created_by: P.michael },
  { workspace_id: WS, name: 'Thought Leadership', colour: 'green', created_by: P.sarah },
]).select('id, name'), 'idea collections')
const icol = name => ideaCollections.find(c => c.name === name).id

// title, description, score, stage, source label, tags, owner, age, platforms, collection, featured
const IDEAS = [
  ['How AI is reshaping content workflows', 'Explore the practical ways AI tools are accelerating ideation, creation, and optimisation for teams.', 92, 'prioritised', 'Industry Trends Report', ['AI', 'Workflow', 'Productivity'], P.jason, 4 * D, ['linkedin', 'instagram'], 'Thought Leadership', true],
  ['10 time-saving hacks for busy marketers', 'Actionable tips to streamline your daily marketing tasks and ship content faster.', 88, 'ready_to_draft', 'Google Trends', ['Productivity', 'Tips', 'Marketing'], P.sarah, 5 * D, ['instagram', 'tiktok'], 'Q2 Campaign Ideas'],
  ['The future of short-form video content', 'Why short-form video continues to dominate and how brands can stay ahead of the curve.', 85, 'in_research', 'TikTok Creative Center', ['Video', 'Trends', 'Social'], P.michael, 6 * D, ['tiktok', 'instagram'], 'Q2 Campaign Ideas'],
  ['Repurposing content across channels effectively', 'A playbook for turning one piece of content into multiple high-performing assets.', 78, 'backlog', 'Internal Brainstorm', ['Content', 'Strategy', 'Repurpose'], P.emily, 7 * D, ['linkedin'], 'Thought Leadership'],
  ['Building a community around your brand', 'Tactics to grow engaged communities and turn followers into advocates.', 76, 'in_research', 'Community Roundup', ['Community', 'Engagement', 'Growth'], P.david, 7 * D, ['instagram', 'facebook'], 'Q2 Campaign Ideas'],
  ['Email marketing that actually converts', 'Best practices for writing, timing, and personalising emails that drive results.', 74, 'backlog', 'HubSpot Blog', ['Email', 'Conversion', 'CRM'], P.priya, 8 * D, ['linkedin'], 'Product Launch Series'],
  ['Launch week countdown series', 'A five-post countdown building anticipation for the Studio launch.', 83, 'approved', 'Launch Plan', ['Launch', 'Series'], P.jason, 2 * D, ['instagram', 'linkedin'], 'Product Launch Series'],
  ['Customer day-in-the-life reels', 'Follow three customers through a real publishing day.', 81, 'prioritised', 'Customer Interviews', ['UGC', 'Customers'], P.emily, 3 * D, ['tiktok', 'instagram'], 'Product Launch Series'],
  ['Carousel: anatomy of a viral hook', 'Break down five hooks that stopped the scroll and why they worked.', 79, 'ready_to_draft', 'Performance Review', ['Hooks', 'Education'], P.michael, 1 * D, ['instagram', 'linkedin'], 'Thought Leadership'],
  ['Sustainability behind the product', 'Show the sourcing and packaging decisions behind the serum launch.', 72, 'converted', 'Brand Team', ['Sustainability', 'Brand'], P.sarah, 12 * D, ['instagram'], 'Product Launch Series'],
  ['Team favourites: tools we use daily', 'A light, personable post on the tools behind our workflow.', 64, 'backlog', 'Internal Brainstorm', ['Culture', 'Tools'], P.david, 10 * D, ['linkedin'], null],
  ['Myth-busting social algorithms', 'Correct five common myths about how feeds rank content.', 70, 'in_research', 'Competitor Research', ['Education', 'Algorithms'], P.priya, 9 * D, ['linkedin', 'x'], 'Thought Leadership'],
  ['Holiday gift guide teaser', 'Tease the gift guide with three hero products.', 68, 'backlog', 'Seasonal Calendar', ['Seasonal', 'Gifting'], P.emma, 11 * D, ['instagram', 'pinterest'], 'Q2 Campaign Ideas'],
  ['Founder Q&A live session', 'Monthly live Q&A answering community questions.', 75, 'prioritised', 'Community Roundup', ['Live', 'Community'], P.jason, 13 * D, ['instagram', 'linkedin'], 'Thought Leadership'],
  ['Before and after: brand refresh', 'Side-by-side reveal of the refreshed visual identity.', 71, 'converted', 'Brand Team', ['Brand', 'Design'], P.david, 15 * D, ['instagram', 'x'], null],
  ['Quick wins for analytics beginners', 'Three reports anyone can set up in ten minutes.', 66, 'ready_to_draft', 'Support Tickets', ['Analytics', 'Education'], P.michael, 6 * D, ['linkedin'], null],
]
const ideaRows = IDEAS.map(([title, description, score, stage, source, tags, owner, age, platforms, collection, featured], i) => ({
  workspace_id: WS, title, description, score, stage, tags, owner_id: owner, created_by: owner, platforms,
  source: pick(['research', 'trend', 'trend', 'manual', 'community', 'research'], i),
  status: stage === 'converted' ? 'converted' : i % 4 === 1 ? 'saved' : 'idea',
  collection_id: collection ? icol(collection) : null, featured: Boolean(featured),
  why_it_works: featured ? ['High demand topic with consistent search growth', 'Solves a real pain point for our audience', 'Strong potential for multi-format content'] : ['Relevant to our audience', 'Easy to produce this month'],
  next_step: featured ? 'Develop an outline and interview internal SMEs for real-world examples.' : 'Draft an outline and assign an owner.',
  ai_generated: i % 5 === 0, is_demo: true, metadata: { seed: 'studio', source_label: source },
  created_at: at(age), updated_at: at(age - Math.min(age / 2, D)),
}))
const ideas = must(await db.from('content_ideas').insert(ideaRows).select('id, title, stage'), 'ideas')
for (const idea of ideas.filter(i => i.stage === 'converted')) {
  const target = posts[Math.floor(Math.random() * posts.length)]
  await db.from('content_ideas').update({ converted_to_post_id: target.id }).eq('id', idea.id)
}
const featuredIdea = ideas.find(i => i.title === 'How AI is reshaping content workflows')
must(await db.from('studio_idea_tasks').insert([
  ['Review outline for featured idea', 2], ['Research stats for AI workflows', 3], ['Identify experts for interview', 4],
].map(([title, days]) => ({
  workspace_id: WS, idea_id: featuredIdea.id, title, due_on: future(days * D).slice(0, 10), created_by: OWNER, assignee_id: OWNER,
}))), 'idea tasks')
console.log(`ideas: ${ideas.length}`)

// ── Templates ────────────────────────────────────────────────────────────────
const tplCover = file => asset(file)?.thumbnail_path ?? null
async function coverFrom(source) {
  const entry = manifest[source]
  const key = `studio/${WS}/demo/templates/${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`
  await put(key, entry.thumb, 'image/jpeg')
  return `r2:${key}`
}
const COVERS = {
  grow: await coverFrom('Template Grow Your Brand.png'),
  feature: await coverFrom('Template New Feature.png'),
  success: await coverFrom('Template Customer Success.png'),
  webinar: await coverFrom('Template Webinar.png'),
}
// name, channel, category, usage, owner, status, updated age, cover, approved, tags, caption
const TEMPLATES = [
  ['Brand Awareness Post', 'linkedin', 'social', 1200, P.sarah, 'published', 2 * D, COVERS.grow, true, ['Branding', 'Awareness', 'Product'], 'Boost your content output without sacrificing quality. {{brand}} helps enterprise teams move faster! ⚡'],
  ['Product Update', 'instagram', 'product', 856, P.michael, 'published', 5 * D, COVERS.feature, true, ['Product', 'Launch'], 'New in {{product}}: {{feature}}. Here’s what it means for you 👇'],
  ['Customer Testimonial', 'x', 'testimonial', 642, P.emily, 'published', 7 * D, COVERS.success, true, ['Testimonial', 'Social proof'], '“{{quote}}” — {{customer}}'],
  ['Webinar Promotion', 'facebook', 'event', 532, P.david, 'in_review', 3 * D, COVERS.webinar, false, ['Event', 'Webinar'], 'Join us live on {{date}} for {{topic}}. Save your spot today!'],
  ['Product Launch Announcement', 'linkedin', 'announcement', 1400, P.sarah, 'published', 2 * D, tplCover('Create Without Limits.png'), true, ['Launch', 'Announcement'], 'Big news! We’re thrilled to introduce {{product}} — {{value_prop}}.'],
  ['Event Promotion Template', 'facebook', 'event', 965, P.david, 'published', 3 * D, tplCover('Planning Workshop.jpg'), true, ['Event'], 'Save the date: {{event}} on {{date}}.'],
  ['Tips & Tricks Carousel', 'instagram', 'education', 753, P.emily, 'published', 5 * D, tplCover('Workspace Desk.jpg'), true, ['Education', 'Carousel'], '{{number}} tips for {{topic}} — swipe to learn more ➡️'],
  ['Holiday Campaign Post', 'x', 'campaign', 612, P.michael, 'in_review', 7 * D, tplCover('Monstera Still Life.jpg'), false, ['Seasonal', 'Campaign'], 'Our {{holiday}} edit is here. {{offer}} for a limited time.'],
  ['Customer Story Highlight', 'linkedin', 'testimonial', 489, P.sarah, 'published', 8 * D, tplCover('Team Photo.jpg'), true, ['Testimonial', 'Story'], 'How {{customer}} achieved {{result}} with {{product}}.'],
  ['Behind the Scenes Reel', 'tiktok', 'social', 402, P.priya, 'approved', 9 * D, tplCover('Strategy Meeting.jpg'), true, ['Culture', 'BTS'], 'A day in the life at {{brand}} 🎬'],
  ['Weekly Industry Roundup', 'linkedin', 'education', 318, P.jason, 'draft', 10 * D, tplCover('Analytics Dashboard.jpg'), false, ['Thought leadership'], 'This week in {{industry}}: {{headline_1}}, {{headline_2}} and {{headline_3}}.'],
  ['Flash Sale Countdown', 'instagram', 'campaign', 287, P.emma, 'changes_requested', 11 * D, tplCover('Hydrating Serum.jpg'), false, ['Sale', 'Urgency'], '⏰ {{hours}} hours left: {{discount}} off {{collection}}.'],
  ['Hiring Announcement', 'linkedin', 'announcement', 204, P.david, 'published', 16 * D, tplCover('Office Corridor.jpg'), true, ['Hiring', 'Culture'], 'We’re hiring a {{role}} to join our {{team}} team.'],
  ['Creator Collab Intro', 'instagram', 'social', 176, P.priya, 'published', 18 * D, tplCover('Creator Portrait.jpg'), true, ['UGC', 'Creators'], 'Meet {{creator}} — our newest collaborator 💫'],
]
const templateRows = TEMPLATES.map(([name, channel, category, usage, owner, status, age, cover, approved, tags, caption], i) => ({
  workspace_id: WS, name, channel, platforms: channel === 'linkedin' && i === 0 ? ['linkedin', 'x', 'facebook'] : [channel], category,
  post_type: channel === 'tiktok' ? 'reel' : i === 6 ? 'carousel' : 'post', usage_count: usage, owner_id: owner, created_by: owner,
  status, cover_url: cover, brand_approved: approved, approved_by: approved ? P.jason : null, approved_at: approved ? at(age + D) : null,
  tags, caption_template: caption, description: `Reusable ${category} template for ${channel === 'x' ? 'X' : channel[0].toUpperCase() + channel.slice(1)}.`,
  hashtags: tags.map(t => `#${t.replace(/[^A-Za-z]/g, '')}`),
  variables: [...caption.matchAll(/\{\{(\w+)\}\}/g)].map(m => ({ key: m[1], label: m[1].replace(/_/g, ' ') })),
  review_note: status === 'changes_requested' ? 'Please use the approved sale lock-up.' : null,
  is_demo: true, created_at: at(age + (i < 4 ? 5 * D : 40 * D)), updated_at: at(age),
}))
const templates = must(await db.from('content_templates').insert(templateRows).select('id, name'), 'templates')
const usageRows = []
for (const [t, tpl] of templates.entries()) {
  const events = Math.max(4, Math.round(60 / (t + 1)))
  for (let e = 0; e < events; e++) {
    const day = Math.floor((e / events) ** 0.7 * 29)
    usageRows.push({ workspace_id: WS, template_id: tpl.id, used_by: pick(TEAM, e + t), content_id: e < 2 ? pick(posts, t + e).id : null, created_at: at((29 - day) * D + (e % 9) * H) })
  }
}
must(await db.from('studio_template_usage').insert(usageRows), 'template usage')
must(await db.from('studio_template_favourites').insert(templates.slice(0, 3).map(t => ({ workspace_id: WS, template_id: t.id, user_id: P.jason }))), 'favourites')
console.log(`templates: ${templates.length}, usage events: ${usageRows.length}`)

// ── Hashtags & keywords ──────────────────────────────────────────────────────
// name, kind, icon, relevance, volume, competition, growth, topic, platform, updated age, terms [term, volume, comp, growth, relevance]
const SETS = [
  ['Productivity & Focus', 'cluster', 'target', 87, 32400, 0.42, 28, 'Productivity', 'instagram', 2 * H, [
    ['productivity', 32400, 0.41, 12, 94], ['focus', 18700, 0.38, 9, 90], ['deep work', 8900, 0.33, 31, 88], ['concentration', 7200, 0.29, 6, 81], ['distraction free', 6100, 0.24, 18, 77],
    ['#focusmode', 24800, 0.31, 132, 86], ['#deepwork', 9300, 0.28, 98, 84], ['#dopaminedetox', 7400, 0.36, 76, 72], ['#intentionalwork', 4100, 0.18, 22, 79], ['#flowstate', 3900, 0.22, 17, 76], ['#quietproductivity', 2800, 0.24, 11, 74],
    ['#productivitytips', 21000, 0.46, 9, 88], ['#getthingsdone', 7800, 0.39, 7, 80], ['#mindfulwork', 5900, 0.27, 12, 78]]],
  ['Remote Work', 'cluster', 'laptop', 76, 27100, 0.48, 15, 'Work', 'linkedin', 1 * D, [
    ['remote work', 27100, 0.52, 8, 88], ['work from home', 22300, 0.61, 3, 80], ['hybrid team', 9100, 0.37, 19, 76], ['#workwithintention', 3600, 0.21, 41, 77], ['#remoteteams', 8800, 0.44, 12, 74]]],
  ['Time Management', 'cluster', 'clock', 84, 21600, 0.51, 12, 'Productivity', 'instagram', 3 * H, [
    ['time management', 21600, 0.55, 6, 90], ['time blocking', 9800, 0.34, 21, 86], ['#focusrituals', 2900, 0.19, 37, 75], ['#timemanagement', 15400, 0.49, 8, 83], ['#successmindset', 12200, 0.57, 5, 71]]],
  ['Personal Growth', 'cluster', 'leaf', 79, 18200, 0.46, 9, 'Wellbeing', 'tiktok', 5 * H, [
    ['personal growth', 18200, 0.49, 7, 84], ['habits', 14300, 0.45, 5, 78], ['#clarityoverchaos', 2100, 0.17, 33, 73], ['#growthmindset', 19800, 0.62, 4, 70]]],
  ['Mindset & Motivation', 'cluster', 'brain', 82, 19800, 0.44, 22, 'Wellbeing', 'instagram', 1 * D, [
    ['motivation', 19800, 0.58, 6, 80], ['mindset', 16500, 0.47, 14, 82], ['#mondaymotivation', 25100, 0.71, 2, 66], ['#mindsetmatters', 6400, 0.35, 16, 79]]],
  ['Skincare Launch Hashtags', 'set', 'sparkles', 88, 41200, 0.63, 18, 'Beauty', 'instagram', 2 * D, [
    ['#skincare', 41200, 0.82, 3, 92], ['#glowingskin', 12400, 0.51, 14, 88], ['#hydration', 8800, 0.39, 11, 85], ['#cleanbeauty', 15300, 0.58, 9, 82]]],
  ['LinkedIn Thought Leadership', 'set', 'briefcase', 81, 14500, 0.41, 11, 'Leadership', 'linkedin', 4 * D, [
    ['#leadership', 14500, 0.59, 4, 83], ['#marketingstrategy', 9700, 0.43, 13, 86], ['#contentmarketing', 11800, 0.48, 8, 84]]],
  ['TikTok Trend Tags', 'set', 'music', 73, 38400, 0.69, 27, 'Trends', 'tiktok', 6 * D, [
    ['#fyp', 38400, 0.93, 1, 60], ['#smallbusiness', 17600, 0.66, 12, 78], ['#marketingtips', 10200, 0.47, 23, 81]]],
]
for (const [name, kind, icon, relevance, volume, comp, growth, topic, platform, age, terms] of SETS) {
  const set = must(await db.from('hashtag_sets').insert({
    workspace_id: WS, name, kind, icon, relevance_score: relevance, avg_volume: volume, competition: comp, growth_30d: growth,
    topic, platform, platforms: [platform], language: 'en-GB', region: 'GB', status: 'active',
    hashtags: terms.filter(t => t[0].startsWith('#')).map(t => t[0]), favourite: name === 'Productivity & Focus' || kind === 'set',
    usage_count: Math.round(volume / 900), owner_id: P.jason, created_by: P.jason, is_demo: true,
    created_at: at(240 * D), updated_at: at(age),
  }).select('id').single(), `set ${name}`)
  must(await db.from('studio_keyword_terms').insert(terms.map(([term, v, c, g, r], i) => ({
    workspace_id: WS, set_id: set.id, term, kind: term.startsWith('#') ? 'hashtag' : 'keyword',
    avg_volume: v, competition: c, growth_30d: g, relevance: r, source: i % 4 === 3 ? 'recommendation' : 'manual', created_by: P.jason,
  }))), `terms ${name}`)
}
must(await db.from('studio_blocked_terms').insert(['#followforfollow', '#like4like', '#f4f', '#spam', '#giveawayscam', '#instabot']
  .map((term, i) => ({ workspace_id: WS, term, reason: i < 3 ? 'Engagement bait — hurts reach' : 'Brand safety', created_by: P.jason }))), 'blocked')
console.log(`keyword sets: ${SETS.length}`)

// ── AI generations + prompts ─────────────────────────────────────────────────
const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
const sinceMonth = NOW - monthStart.getTime()
const AI_TOPICS = [
  ['AI Caption Generator launch post', 'linkedin', 'gpt-5.4-mini', 'used'], ['Product update announcement', 'x', 'gpt-5.4-mini', 'draft'],
  ['Webinar reminder post', 'linkedin', 'gpt-5.4-mini', 'draft'], ['Customer testimonial post', 'instagram', 'gpt-5.4-mini', 'used'],
  ['Tips for content marketing', 'linkedin', 'gpt-5.4-mini', 'draft'], ['Serum launch caption', 'instagram', 'gpt-5.4-mini', 'used'],
  ['Behind the scenes reel script', 'tiktok', 'gpt-5.4-mini', 'discarded'], ['Holiday offer teaser', 'facebook', 'gpt-5.4-mini', 'draft'],
]
const OUTPUTS = [
  '🚀 Big news! We just launched the AI Caption Generator — your new partner for creating scroll-stopping content in seconds.\n\nWhether you’re short on time or ideas, our AI helps you craft engaging, on-brand captions that connect and convert.\n\n✅ Built for marketers\n⚡ Smart, fast, and easy to use\n🎯 On-brand every time\n📈 More engagement, less effort\n\nTry it free today and see the difference AI can make.\nYour next viral post is one click away. 👉\n\n🔗 Try AI Caption Generator Free → https://captionfox.app\n\n#AI #Marketing #ContentCreation #CaptionFox #SocialMedia',
  'Introducing AI Caption Generator by Caption Fox! Turn ideas into engaging, on-brand content that drives results. Built for marketers, loved by teams. Start creating better captions today. #AI #MarketingTools',
  'Write better. Faster. Smarter. Our AI Caption Generator helps you craft high-performing captions that connect, convert, and grow your audience — without the blank-page panic. #ContentMarketing',
]
const aiRows = []
let batch = randomUUID()
for (let i = 0; i < 128 + 46; i++) {
  const today = i < 18
  const ageMs = today ? (i * 23 * 60_000) + 60_000 : Math.min(sinceMonth - H, D + ((i - 18) * 3.1 * H))
  if (i % 3 === 0) batch = randomUUID()
  const [topic, channel, model, status] = pick(AI_TOPICS, i)
  const output = pick(OUTPUTS, i)
  aiRows.push({
    workspace_id: WS, user_id: pick(TEAM, i), type: 'custom', mode: 'demo', topic, prompt: `Write a ${channel} post: ${topic}`,
    output, channel, platform: channel, tone: pick(['professional', 'friendly', 'confident'], i), objective: 'product_launch', audience: 'Marketing leaders',
    model, word_count: output.split(/\s+/).length, match_score: 80 + (i % 18), bookmarked: i % 7 === 0,
    status: i === 0 ? 'used' : i === 1 ? 'draft' : i === 2 ? 'draft' : status, batch_id: batch,
    prompt_tokens: 380 + (i % 90), completion_tokens: 260 + (i % 160), created_at: at(ageMs),
  })
}
must(await db.from('ai_generations').insert(aiRows), 'ai generations')
must(await db.from('studio_prompts').insert([
  ['Product Launch Announcement', 'Write a LinkedIn post announcing {{product}}. Highlight key benefits for marketers, include a call to action to try it free, and keep the tone professional and engaging.', 'linkedin', 'professional', 'product_launch'],
  ['Thought Leadership Post', 'Write a thought leadership post about {{topic}} with one surprising insight and a question for the audience.', 'linkedin', 'confident', 'awareness'],
  ['Event Promotion', 'Write a post promoting {{event}} on {{date}}. Include what attendees will learn and a registration CTA.', 'facebook', 'friendly', 'engagement'],
  ['Customer Case Study', 'Summarise the {{customer}} case study in a post: challenge, solution, result with one metric.', 'linkedin', 'professional', 'conversion'],
  ['Feature Highlight', 'Write an Instagram caption highlighting {{feature}} with three emoji bullet points.', 'instagram', 'playful', 'education'],
].map(([name, prompt, channel, tone, objective], i) => ({
  workspace_id: WS, name, prompt, channel, tone, objective, audience: 'Marketing leaders', saved: true, usage_count: 40 - i * 6,
  created_by: P.jason, created_at: at((i + 3) * 7 * D), updated_at: at((i + 1) * 5 * H),
}))), 'prompts')
console.log(`ai: ${aiRows.length} generations, 5 prompts`)

// ── Activity ─────────────────────────────────────────────────────────────────
const { data: wsRow } = await db.from('workspaces').select('type').eq('id', WS).single()
const base = `/${wsRow.type === 'small_business' ? 'business' : wsRow.type}/studio`
const ACTIVITY = [
  [P.sarah, 'content', launch.id, 'scheduled', 'scheduled a post to Instagram', `${base}/compose?id=${post('3 ways to boost engagement').id}`, 2 * 60_000],
  [P.jason, 'ai', null, 'generated', 'generated an AI post', `${base}/ai-generate`, 15 * 60_000],
  [P.michael, 'content', null, 'updated', 'updated campaign “Summer Launch”', `${base}/content`, 1 * H],
  [P.sarah, 'asset', hero.id, 'uploaded', 'uploaded 6 assets', `${base}/media?selected=${hero.id}`, 2 * H],
  [P.michael, 'asset', asset('Team Photo.jpg').id, 'approved', 'approved 3 assets', `${base}/media`, 3 * H],
  [P.jason, 'asset', hero.id, 'collection', 'added “Mountain Landscape.jpg” to Campaign Spring 2026', `${base}/media?selected=${hero.id}`, 4 * H],
  [P.emily, 'content', post('Hydrating Serum Launch').id, 'approved', 'approved content', `${base}/content?selected=${post('Hydrating Serum Launch').id}`, 3 * H + 10 * 60_000],
  [P.sarah, 'content', post('Digital Marketing Trends 2026').id, 'scheduled', 'rescheduled content', `${base}/content`, 5 * H],
  [P.emily, 'content', post('Hydrating Serum Launch').id, 'tagged', 'added tag #Skincare', `${base}/content`, 1 * D],
  [P.jason, 'content', post('Hydrating Serum Launch').id, 'updated', 'updated content details', `${base}/content`, 2 * D],
  [P.sarah, 'idea', ideas[0].id, 'prioritised', 'moved an idea to Prioritised', `${base}/ideas?selected=${ideas[0].id}`, 2 * H + 5 * 60_000],
  [P.michael, 'idea', null, 'created', 'added 3 inspirations', `${base}/ideas`, 4 * H + 5 * 60_000],
  [P.emily, 'idea', ideas[3].id, 'commented', 'commented on an idea', `${base}/ideas`, 6 * H],
  [P.jason, 'template', templates[0].id, 'used', 'used the template “Brand Awareness Post”', `${base}/templates?selected=${templates[0].id}`, 7 * H],
  [P.jason, 'keyword', null, 'created', 'created the keyword cluster “Productivity & Focus”', `${base}/hashtags`, 9 * H],
]
must(await db.from('studio_activity').insert(ACTIVITY.map(([actor, entity, id, action, summary, link, age]) => ({
  workspace_id: WS, actor_id: actor, entity_type: entity, entity_id: id, action, summary, link, surface: 'studio',
  metadata: { seed: 'studio' }, created_at: at(age),
}))), 'activity')
console.log('activity: done')

// Daily history: 30 days of keyword volume ending at each group's stored volume
// and 30-day growth, and 14 days of per-post engagement that sums to the
// post's stored totals (decaying after publish).
const dayIso = offset => new Date(NOW - offset * D).toISOString().slice(0, 10)
const { data: histSets } = await db.from('hashtag_sets').select('id, name, avg_volume, growth_30d, relevance_score')
  .eq('workspace_id', WS).not('avg_volume', 'is', null)
const kwRows = []
for (const s of histSets ?? []) {
  const end = Number(s.avg_volume)
  const start = end / (1 + Number(s.growth_30d ?? 0) / 100)
  for (let d = 0; d < 30; d += 1) {
    const value = d === 29 ? end : start + (end - start) * (d / 29) + Math.sin(d * 1.7 + s.name.length) * end * 0.025
    kwRows.push({ workspace_id: WS, set_id: s.id, day: dayIso(29 - d), avg_volume: Math.max(0, Math.round(value)), relevance: s.relevance_score })
  }
}
if (kwRows.length) must(await db.from('studio_keyword_metrics_daily').upsert(kwRows, { onConflict: 'set_id,day' }), 'keyword history')

const { data: histPosts } = await db.from('content_posts').select('id, engagement, published_at, updated_at')
  .eq('workspace_id', WS).eq('status', 'published')
const engRows = []
for (const p of histPosts ?? []) {
  const e = p.engagement ?? {}
  if (!Number(e.views)) continue
  const weights = Array.from({ length: 14 }, (_, i) => 0.5 ** i)
  const total = weights.reduce((a, b) => a + b, 0)
  const published = new Date(p.published_at ?? p.updated_at).getTime()
  const first = Math.max(published, NOW - 13 * D)
  weights.forEach((w, i) => {
    const dayMs = first + i * D
    if (dayMs > NOW) return
    const share = key => Math.floor(Number(e[key] ?? 0) * w / total)
    engRows.push({ workspace_id: WS, post_id: p.id, day: new Date(dayMs).toISOString().slice(0, 10), views: share('views'), likes: share('likes'), comments: share('comments'), shares: share('shares') })
  })
}
if (engRows.length) must(await db.from('content_engagement_daily').upsert(engRows, { onConflict: 'post_id,day' }), 'engagement history')
console.log(`history: ${kwRows.length} keyword days, ${engRows.length} engagement days`)
console.log('Studio demo seed complete.')
