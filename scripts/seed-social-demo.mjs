// Development-only demo seed for the shared Social module.
//
// Populates Overview, Publishing, Engagement, Listening, Connections and
// Analytics for the given workspaces through the same tables the app reads.
// Every row is flagged is_demo (or tagged `seed:social`) and is removed and
// re-created on each run, so the script is idempotent. Figures come from a
// seeded PRNG and fixed curves, so repeated runs produce identical data —
// nothing is random at render time. Rows owned by other modules (Calendar and
// Campaign posts, real channels) are enriched, never deleted.
//
// Media: avatars and post imagery are copied inside Supabase Storage into each
// workspace's own `social-demo/<workspace_id>/` folder — no hotlinked URLs.
//
// Usage: node scripts/seed-social-demo.mjs [<workspace_id> ...]
//        (no ids = the four "Jamahl Thomas …" demo workspaces)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line && !line.trimStart().startsWith('#')).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo social data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Mixed-shape bulk inserts must fall back to column defaults, not NULL.
const builderProto = Object.getPrototypeOf(admin.from('workspaces'))
const originalInsert = builderProto.insert
builderProto.insert = function insert(values, options = {}) {
  return originalInsert.call(this, values, { defaultToNull: false, ...options })
}

const TAG = 'seed:social'
const MEDIA_SOURCE_WS = 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'

// ---------------------------------------------------------------- helpers
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const now = Date.now()
const iso = ms => new Date(ms).toISOString()
const ago = minutes => iso(now - minutes * MIN)
const dayString = offset => {
  const date = new Date(now - offset * DAY)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
/** A local wall-clock time `days` from today, e.g. at(2, 9, 30). */
const at = (days, hours, minutes = 0) => {
  const date = new Date(now + days * DAY)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)]

async function chunkedInsert(table, rows, label, size = 400) {
  for (let index = 0; index < rows.length; index += size) {
    await must(admin.from(table).insert(rows.slice(index, index + size), { defaultToNull: false }), `${label} ${index}`)
  }
}

// ---------------------------------------------------------------- media
const AVATARS = ['ava-martinez', 'emma-davis', 'ethan-roberts', 'liam-chen', 'mason-lee', 'mia-thompson', 'noah-williams', 'olivia-martinez', 'sophia-patel']
const IMAGES = [
  'summer-launch-2024', 'product-teaser', 'studio-tour-series', 'customer-stories', 'webinar-series-q2',
  'brand-awareness-q2', 'creator-collab-drop', 'video-shorts-sprint', 'sustainability-story', 'press-launch-kit',
  'influencer-partnership', 'community-ambassadors',
]

async function copyMedia(workspaceId) {
  const bucket = admin.storage.from('media')
  const urls = { avatars: [], images: {} }
  const listed = new Set()
  for (const folder of ['avatars', 'posts']) {
    const { data } = await bucket.list(`social-demo/${workspaceId}/${folder}`, { limit: 100 })
    for (const item of data ?? []) listed.add(`social-demo/${workspaceId}/${folder}/${item.name}`)
  }
  const copy = async (from, to) => {
    if (!listed.has(to)) {
      const { data: blob, error } = await bucket.download(from)
      if (error) throw new Error(`download ${from}: ${error.message}`)
      const { error: upError } = await bucket.upload(to, blob, { contentType: 'image/jpeg', upsert: true })
      if (upError) throw new Error(`upload ${to}: ${upError.message}`)
    }
    return bucket.getPublicUrl(to).data.publicUrl
  }
  for (const slug of AVATARS) {
    urls.avatars.push(await copy(`campaigns-demo/${MEDIA_SOURCE_WS}/avatars/${slug}.jpg`, `social-demo/${workspaceId}/avatars/${slug}.jpg`))
  }
  for (const slug of IMAGES) {
    urls.images[slug] = await copy(`campaigns-demo/${MEDIA_SOURCE_WS}/campaigns/${slug}.jpg`, `social-demo/${workspaceId}/posts/${slug}.jpg`)
  }
  return urls
}

// ---------------------------------------------------------------- fixtures
// 7-day reach, engagement rate, week-on-week growth, scopes, sync age (minutes).
const CHANNEL_PROFILE = {
  instagram: { reach: 432_000, rate: 0.0412, growth: 0.162, rateShift: 0.0008, type: 'business', granted: 8, required: 9, handleFallback: '@captionfox', followers: 48_200, synced: 4, perm: 'read_write', health: 'healthy', token: 'valid' },
  tiktok: { reach: 281_000, rate: 0.0508, growth: 0.127, rateShift: 0.0011, type: 'business', granted: 7, required: 8, handleFallback: '@captionfox', followers: 36_900, synced: 11, perm: 'read_write', health: 'healthy', token: 'valid' },
  facebook: { reach: 196_000, rate: 0.0241, growth: 0.093, rateShift: 0.0003, type: 'page', granted: 10, required: 12, handleFallback: 'Caption Fox', followers: 22_400, synced: 5, perm: 'read_write', health: 'healthy', token: 'valid' },
  linkedin: { reach: 154_000, rate: 0.0278, growth: 0.086, rateShift: 0.0004, type: 'company_page', granted: 6, required: 8, handleFallback: 'Caption Fox', followers: 15_800, synced: 8, perm: 'read_write', health: 'healthy', token: 'valid' },
  youtube: { reach: 98_700, rate: 0.0192, growth: -0.024, rateShift: -0.002, type: 'channel', granted: 5, required: 7, handleFallback: 'Caption Fox', followers: 9_300, synced: 31, perm: 'read_only', health: 'warning', token: 'expiring' },
  x: { reach: 83_200, rate: 0.0136, growth: 0.061, rateShift: 0.0002, type: 'business', granted: 7, required: 9, handleFallback: '@captionfox', followers: 12_100, synced: 14, perm: 'read_write', health: 'healthy', token: 'valid' },
}

const SCOPES = {
  instagram: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'instagram_manage_insights', 'instagram_manage_messages', 'pages_show_list', 'business_management', 'pages_read_engagement', 'read_insights'],
  facebook: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'pages_manage_engagement', 'pages_messaging', 'read_insights', 'business_management', 'pages_manage_metadata', 'public_profile', 'pages_read_user_content', 'pages_manage_ads', 'instagram_basic'],
  tiktok: ['user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list', 'video.publish', 'comment.list', 'comment.list.manage', 'video.upload'],
  linkedin: ['r_organization_social', 'w_organization_social', 'rw_organization_admin', 'r_organization_admin', 'r_basicprofile', 'w_member_social', 'r_1st_connections_size', 'r_ads_reporting'],
  youtube: ['youtube.readonly', 'youtube.upload', 'youtube.force-ssl', 'yt-analytics.readonly', 'youtubepartner', 'youtube.channel-memberships.creator', 'userinfo.profile'],
  x: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'like.read', 'dm.read', 'dm.write', 'follows.read', 'space.read'],
}

const EXTRA_CHANNELS = [
  { platform: 'instagram', account_name: '@captionfox_uk', handle: '@captionfox_uk', team: 'UK Team', reach: 21_400, rate: 0.038, growth: 0.04, followers: 6_900, synced: 17 },
  { platform: 'tiktok', account_name: 'captionfox_global', handle: '@captionfox_global', team: 'Global Team', reach: 15_900, rate: 0.047, growth: 0.07, followers: 5_200, synced: 25 },
]

const PUBLISHED_POSTS = [
  // title, platform, type, days ago, hour, minute, reach, engagement rate, link clicks, image
  ['5 Tips to Improve Your Captions', 'instagram', 'reel', 0, 10, 30, 24_600, 0.0432, 1_200, 'summer-launch-2024'],
  ['Behind the Scenes 🎬', 'tiktok', 'short', 1, 18, 15, 18_900, 0.0561, 842, 'studio-tour-series'],
  ['New Feature: Auto Hashtags', 'linkedin', 'post', 1, 14, 45, 12_300, 0.0214, 612, 'product-teaser'],
  ['Caption Fox vs Manual Writing', 'facebook', 'post', 2, 12, 10, 9_800, 0.0192, 2_100, 'webinar-series-q2'],
  ['How to Write Better CTAs', 'x', 'thread', 2, 9, 10, 7_400, 0.0112, 1_600, 'press-launch-kit'],
  ['Hook formulas that stop the scroll', 'instagram', 'carousel', 3, 11, 0, 6_900, 0.0392, 540, 'creator-collab-drop'],
  ['Weekly creator roundup', 'youtube', 'short', 4, 16, 0, 5_600, 0.0171, 310, 'video-shorts-sprint'],
  ['Customer spotlight: Northwind Studio', 'linkedin', 'carousel', 5, 13, 30, 4_800, 0.0283, 420, 'customer-stories'],
  ['Three caption mistakes to avoid', 'tiktok', 'short', 6, 19, 0, 4_200, 0.0466, 205, 'brand-awareness-q2'],
  // Previous period, so week-on-week comparisons have a real baseline.
  ['Sustainability in social storytelling', 'facebook', 'post', 8, 12, 0, 16_900, 0.0228, 188, 'sustainability-story'],
  ['Q3 content planning checklist', 'linkedin', 'post', 9, 9, 0, 13_400, 0.0261, 260, 'community-ambassadors'],
  ['Caption length experiment', 'instagram', 'reel', 10, 17, 0, 19_800, 0.0405, 390, 'influencer-partnership'],
  ['Trending audio picks', 'tiktok', 'short', 11, 18, 30, 15_200, 0.0498, 180, 'video-shorts-sprint'],
  ['Thread: writing for skimmers', 'x', 'thread', 12, 9, 0, 6_100, 0.0121, 140, 'press-launch-kit'],
]

const UPCOMING_POSTS = [
  ['Productivity Sunday', 'instagram', 'post', 1, 9, 0, 'studio-tour-series'],
  ['Caption Tips #12', 'tiktok', 'short', 1, 12, 0, 'creator-collab-drop'],
  ['Industry Insights', 'linkedin', 'post', 2, 10, 0, 'webinar-series-q2'],
  ['Customer Testimonial', 'facebook', 'post', 2, 15, 0, 'customer-stories'],
  ['Thought Leadership', 'x', 'thread', 3, 11, 30, 'press-launch-kit'],
  ['Motivation Monday', 'x', 'thread', 5, 9, 0, 'brand-awareness-q2'],
  ['Carousel: Social Proof', 'instagram', 'carousel', 6, 11, 0, 'influencer-partnership'],
]

const APPROVAL_POSTS = [
  ['Product Update 🎉', 'facebook', 'post', 4, 9, 0, 'product-teaser'],
  ['Customer Testimonial Quote', 'linkedin', 'post', 4, 14, 0, 'customer-stories'],
  ['How to Write Better Captions', 'instagram', 'reel', 5, 17, 0, 'summer-launch-2024'],
  ['Thought Leadership Quote', 'x', 'thread', 4, 8, 30, 'press-launch-kit'],
]

// Senders shown at the top of the Engagement inbox and Overview feed, newest first.
const HEADLINE_THREADS = [
  { name: 'Jessica Luxe', handle: 'jessica.luxe_', platform: 'instagram', type: 'comment', content: 'Love this! The caption is 🔥', sentiment: 'positive', tags: ['Comment'], minutes: 2, related: '5 Tips to Improve Your Captions', unread: true },
  { name: 'Creative Hub', handle: 'creative.hub', platform: 'tiktok', type: 'dm', content: 'How do you edit your photos?', sentiment: 'neutral', tags: ['DM', 'Question'], minutes: 8 },
  { name: 'Mark Davidson', handle: 'markdavidson', platform: 'x', type: 'mention', content: 'Super useful thread! Thanks for sharing.', sentiment: 'positive', tags: ['Mention'], minutes: 15 },
  { name: 'Sarah Johnson', handle: 'sarahjohnson', platform: 'facebook', type: 'dm', content: 'We’re interested in collaborating on a campaign next quarter.', sentiment: 'positive', tags: ['Message', 'Lead'], minutes: 32 },
  { name: 'TechTalks', handle: 'techtalks', platform: 'youtube', type: 'comment', content: 'Great content as always!', sentiment: 'positive', tags: ['Comment'], minutes: 45 },
  { name: 'Mike Thompson', handle: 'mikethompson', platform: 'linkedin', type: 'comment', content: 'Very insightful, thanks!', sentiment: 'positive', tags: ['Comment'], minutes: 60 },
  { name: 'Brand Builder', handle: 'brand.builder', platform: 'instagram', type: 'comment', content: 'Can you share more tips on reels?', sentiment: 'neutral', tags: ['Comment', 'Question'], minutes: 70 },
  { name: 'Startup Daily', handle: 'startupdaily', platform: 'x', type: 'mention', content: 'This changed how we think about growth.', sentiment: 'positive', tags: ['Mention'], minutes: 120 },
]

const FLAGGED_THREADS = [
  { name: 'Tech Guru', handle: 'tech.guru', platform: 'x', type: 'mention', content: 'Honestly the pricing feels steep for small teams.', sentiment: 'negative', flag: 'Negative feedback on pricing', minutes: 30 },
  { name: 'Angry Customer', handle: 'angry.customer', platform: 'facebook', type: 'dm', content: 'The scheduler has not been working as expected this morning.', sentiment: 'negative', flag: 'Service not working as expected', minutes: 60 },
  { name: 'user_9821', handle: 'user_9821', platform: 'instagram', type: 'comment', content: 'Reported comment awaiting moderation.', sentiment: 'neutral', flag: 'Inappropriate comment', minutes: 120 },
]

const FILLER_SENDERS = [
  ['Nina Patel', 'nina.creates'], ['Oliver Grant', 'olivergrant'], ['Maya Brooks', 'mayabrooks.co'], ['Leo Hart', 'leohart'],
  ['Studio North', 'studionorth'], ['Growth Lab', 'growthlab.io'], ['Ella Stone', 'ellastone'], ['Ryan Cole', 'ryancole'],
  ['Zara Quinn', 'zaraquinn'], ['Daily Marketer', 'dailymarketer'], ['Chloe Park', 'chloe.park'], ['Ben Walsh', 'benwalsh'],
]
const FILLER_CONTENT = {
  positive: ['This is exactly what I needed today.', 'Saved this for later — brilliant tips.', 'Your posts keep getting better!', 'Shared with my whole team.', 'The before/after example is so helpful.'],
  neutral: ['Does this work for LinkedIn too?', 'What tool did you use for the graphics?', 'Is there a template for this?', 'When is the next live session?', 'How long does scheduling take to sync?'],
  negative: ['The link in bio seems broken.', 'I could not find the export option.', 'Wish this was cheaper for freelancers.', 'Notifications arrived late for me.'],
}

const MENTION_AUTHORS = [
  { name: 'Jessica Luxe', handle: 'jessica_luxe', platform: 'instagram', content: 'Loving how @captionfox has completely streamlined my content workflow. The auto-captions are 🔥', sentiment: 'positive', reach: 24_600, rate: 0.0432, minutes: 2, starred: true, topic: 'Caption Fox AI Captions' },
  { name: 'Creative Hub', handle: 'creative_hub', platform: 'tiktok', content: 'Just switched to @captionfox and seeing huge time savings already. Game changer for teams!', sentiment: 'positive', reach: 18_900, rate: 0.0561, minutes: 8, topic: 'Team Collaboration' },
  { name: 'Mark Davidson', handle: 'markdavidson', platform: 'x', content: 'The pricing seems a bit steep compared to other tools. Not sure if it’s worth it yet. #captionfox', sentiment: 'negative', reach: 7_300, rate: 0.0112, minutes: 15, priority: 'high', topic: 'Pricing & Plans' },
  { name: 'Sarah Johnson', handle: 'sarahjohnson', platform: 'linkedin', content: '@captionfox customer support is top-notch. They resolved my issue in minutes. 🙌', sentiment: 'positive', reach: 3_200, rate: 0.0345, minutes: 32, topic: 'Social Media ROI' },
  { name: 'Content Creator', handle: 'contentcreator', platform: 'youtube', content: 'New video up! How I grew to 100K using Caption Fox. Watch here 👇', sentiment: 'positive', reach: 52_100, rate: 0.0671, minutes: 45, influencer: true, topic: 'Caption Fox AI Captions' },
  { name: 'Tech Review', handle: 'techreview', platform: 'x', content: 'Having issues exporting analytics reports. Anyone else facing this?', sentiment: 'negative', reach: 5_100, rate: 0.021, minutes: 34, priority: 'high', topic: 'New Feature: Auto Hashtags' },
  { name: 'SaaS Daily', handle: 'saasdaily', platform: 'x', content: 'Caption Fox just launched a new integration with Google Drive. Nice update!', sentiment: 'positive', reach: 9_200, rate: 0.034, minutes: 60, priority: 'high', influencer: true, topic: 'New Feature: Auto Hashtags' },
]

const TOPICS = [
  ['Caption Fox AI Captions', 'Creators are loving the accuracy and language support of AI Captions.', 28],
  ['Social Media ROI', 'Discussions around measuring content impact and proving social ROI.', 16],
  ['Team Collaboration', 'How teams use Caption Fox to streamline approvals and content workflows.', 9],
  ['Pricing & Plans', 'Community feedback and comparisons with other tools.', -4],
  ['New Feature: Auto Hashtags', 'Excitement around the new hashtag suggestion engine.', 22],
]

// source key, label, source type, share of mentions
const SOURCES = [
  ['instagram', 'Instagram', 'first_party', 0.27], ['x', 'X (Twitter)', 'public_api', 0.222], ['tiktok', 'TikTok', 'public_api', 0.187],
  ['linkedin', 'LinkedIn', 'first_party', 0.126], ['youtube', 'YouTube', 'public_api', 0.099], ['facebook', 'Facebook', 'first_party', 0.061],
  ['reddit', 'Reddit', 'search_index', 0.023], ['blogs', 'Blogs', 'search_index', 0.012],
]
const COUNTRIES = [['US', 0.253], ['IN', 0.147], ['GB', 0.076], ['CA', 0.055], ['AU', 0.043], ['DE', 0.036], ['BR', 0.032], ['FR', 0.028], ['NG', 0.022], [null, 0.308]]
const KEYWORDS = ['captionfox', 'ai captions', 'social media', 'content', 'workflow', 'engagement', 'hashtags', 'productivity', 'reports', 'brand', 'creator', 'integration']
const MENTION_BODY = [
  ['Tried the caption generator for our launch posts — really impressed.', 'positive'], ['Anyone compared Caption Fox with Brand A for agencies?', 'neutral'],
  ['Brand B pushed a similar feature today, curious how it compares to captionfox.', 'neutral'], ['captionfox scheduling saved me hours this week', 'positive'],
  ['Export to CSV took a while for me today.', 'negative'], ['The new hashtag suggestions from captionfox are spot on.', 'positive'],
  ['Not sure the analytics match what Instagram shows.', 'negative'], ['Workflow approvals in captionfox are super clean.', 'positive'],
  ['Looking for a tool like captionfox for my small team.', 'neutral'], ['Brand A is cheaper but captionfox is easier to use.', 'neutral'],
]

// ---------------------------------------------------------------- seed one workspace
async function seedWorkspace(workspaceId) {
  const rand = mulberry32(parseInt(workspaceId.replace(/-/g, '').slice(0, 8), 16))
  const workspace = await must(admin.from('workspaces').select('id, name, owner_id').eq('id', workspaceId).single(), 'workspace')
  console.log(`\n▶ ${workspace.name} (${workspaceId})`)

  const members = await must(admin.from('workspace_members').select('user_id, role').eq('workspace_id', workspaceId).order('created_at'), 'members')
  const teammates = members.filter(member => member.user_id !== workspace.owner_id)
  const assignees = [workspace.owner_id, ...teammates.slice(0, 4).map(member => member.user_id)]
  const media = await copyMedia(workspaceId)
  const avatar = index => media.avatars[index % media.avatars.length]

  // ---- clean previous Social seed rows (never other modules' rows)
  const oldPostIds = (await must(admin.from('content_posts').select('id').eq('workspace_id', workspaceId).contains('tags', [TAG]), 'old posts')).map(post => post.id)
  for (const table of ['social_activity', 'social_webhook_events', 'social_sync_runs', 'social_connection_issues', 'social_audience_metrics',
    'listening_alerts', 'listening_alert_rules', 'listening_topics', 'listening_sources', 'brand_mentions', 'listening_keywords',
    'saved_replies', 'scheduled_reports', 'social_report_presets', 'post_analytics']) {
    await must(admin.from(table).delete().eq('workspace_id', workspaceId).eq('is_demo', true), `clean ${table}`)
  }
  const oldThreads = await must(admin.from('inbox_threads').select('id').eq('workspace_id', workspaceId).eq('is_demo', true), 'old threads')
  for (let index = 0; index < oldThreads.length; index += 200) {
    const ids = oldThreads.slice(index, index + 200).map(thread => thread.id)
    await must(admin.from('inbox_messages').delete().in('thread_id', ids), 'clean messages')
    await must(admin.from('inbox_threads').delete().in('id', ids), 'clean threads')
  }
  await must(admin.from('publishing_queue').delete().eq('workspace_id', workspaceId).like('idempotency_key', `${TAG}:%`), 'clean seeded queue')
  if (oldPostIds.length) {
    await must(admin.from('publishing_queue').delete().in('post_id', oldPostIds), 'clean post queue')
    await must(admin.from('content_posts').delete().in('id', oldPostIds), 'clean posts')
  }
  await must(admin.from('competitor_profiles').delete().eq('workspace_id', workspaceId).eq('notes', TAG), 'clean competitors')
  const oldExtra = await must(admin.from('social_channels').select('id').eq('workspace_id', workspaceId).like('account_id', 'seed-social-%'), 'old extra channels')
  if (oldExtra.length) {
    const ids = oldExtra.map(row => row.id)
    await must(admin.from('channel_analytics').delete().in('channel_id', ids), 'clean extra analytics')
    await must(admin.from('social_channels').delete().in('id', ids), 'clean extra channels')
  }

  // ---- channels: enrich the workspace's channels, add two extra demo accounts
  let existing = await must(admin.from('social_channels').select('id, platform, account_name, handle').eq('workspace_id', workspaceId).eq('is_active', true), 'channels')
  // Workspaces without a connected account for a primary platform get a demo one.
  const missing = Object.keys(CHANNEL_PROFILE).filter(platform => !existing.some(channel => channel.platform === platform))
  if (missing.length) {
    await must(admin.from('social_channels').insert(missing.map(platform => ({
      workspace_id: workspaceId, platform, account_name: CHANNEL_PROFILE[platform].handleFallback,
      handle: CHANNEL_PROFILE[platform].handleFallback, account_id: `seed-social-primary-${platform}`,
      is_active: true, connected_at: ago(60 * 24 * 90), connected_by: workspace.owner_id, is_demo: true,
    }))), 'primary channels')
    existing = await must(admin.from('social_channels').select('id, platform, account_name, handle').eq('workspace_id', workspaceId).eq('is_active', true), 'channels')
  }
  const channels = []
  for (const channel of existing) {
    const profile = CHANNEL_PROFILE[channel.platform]
    if (!profile) continue
    const scopes = SCOPES[channel.platform].slice(0, profile.required)
    const handle = channel.account_name.startsWith('@') ? channel.account_name : (channel.handle ?? profile.handleFallback)
    await must(admin.from('social_channels').update({
      handle,
      account_type: profile.type,
      health: profile.health,
      granted_scopes: scopes.slice(0, profile.granted),
      required_scopes: scopes,
      permission_mode: profile.perm,
      team_label: 'Marketing Team',
      token_status: profile.token,
      token_expires_at: iso(now + (profile.token === 'expiring' ? 5 : 52) * DAY),
      last_sync_at: ago(profile.synced),
      last_sync_status: profile.health === 'warning' ? 'partial' : 'success',
      last_successful_sync_at: ago(profile.synced),
      follower_count: profile.followers,
      avatar_url: channel.platform === 'instagram' || channel.platform === 'tiktok' || channel.platform === 'x' ? avatar(0) : null,
      updated_at: iso(now),
    }).eq('id', channel.id), `update ${channel.platform}`)
    channels.push({ id: channel.id, platform: channel.platform, ...profile })
  }
  for (const [index, extra] of EXTRA_CHANNELS.entries()) {
    const scopes = SCOPES[extra.platform]
    const [row] = await must(admin.from('social_channels').insert({
      workspace_id: workspaceId, platform: extra.platform, account_name: extra.account_name, handle: extra.handle,
      account_id: `seed-social-${extra.platform}-${index}`, account_type: 'business', health: 'healthy',
      granted_scopes: scopes.slice(0, scopes.length - 1), required_scopes: scopes, permission_mode: 'read_write',
      team_label: extra.team, token_status: 'valid', token_expires_at: iso(now + 40 * DAY),
      last_sync_at: ago(extra.synced), last_sync_status: 'success', last_successful_sync_at: ago(extra.synced),
      follower_count: extra.followers, avatar_url: avatar(0), is_active: true, connected_at: ago(60 * 24 * 30),
      connected_by: workspace.owner_id, is_demo: true,
    }).select('id'), `extra ${extra.account_name}`)
    channels.push({ id: row.id, platform: extra.platform, rateShift: 0, synced: extra.synced, ...extra })
  }
  const primary = platform => channels.find(channel => channel.platform === platform) ?? channels[0]

  // ---- channel_analytics: 60 days of daily rollups
  await must(admin.from('channel_analytics').delete().in('channel_id', channels.map(channel => channel.id)), 'clean channel analytics')
  const followerShare = { instagram: 0.34, tiktok: 0.27, facebook: 0.12, linkedin: 0.14, youtube: 0.05, x: 0.08 }
  const rollups = []
  channels.forEach((channel, channelIndex) => {
    let followers = channel.followers
    const share = channel.account_id ? 0.01 : followerShare[channel.platform] ?? 0.01
    for (let offset = 0; offset < 60; offset += 1) {
      const week = Math.floor(offset / 7)
      const scale = 1 / Math.pow(1 + channel.growth, week)
      const wave = 1 + 0.16 * Math.sin((60 - offset) / 1.15 + channelIndex) + 0.06 * Math.cos((60 - offset) / 2.7)
      const reach = Math.round((channel.reach / 7) * scale * wave)
      const rate = Math.max(0.004, channel.rate - (week > 0 ? channel.rateShift : 0) + 0.002 * Math.sin((60 - offset) / 1.7 + channelIndex))
      const newFollowers = Math.round(((6_210 * share) / 7) * scale * (0.85 + 0.3 * rand()))
      rollups.push({
        workspace_id: workspaceId, channel_id: channel.id, date: dayString(offset),
        follower_count: followers, follower_change: newFollowers,
        total_reach: reach, total_impressions: Math.round(reach * (2.1 + 0.3 * Math.sin(offset / 3))),
        total_engagement: Math.round(reach * rate), average_engagement_rate: Number(rate.toFixed(4)),
        posts_published: offset % 3 === 0 ? 2 : 1, is_demo: true,
      })
      followers -= newFollowers
    }
  })
  await chunkedInsert('channel_analytics', rollups, 'channel analytics')

  // ---- posts
  const postRows = []
  const base = { workspace_id: workspaceId, tags: [TAG], is_demo: true, source: 'manual' }
  for (const [title, platform, type, daysAgo, hour, minute, , , , image] of PUBLISHED_POSTS) {
    const publishedAt = at(-daysAgo, hour, minute)
    postRows.push({
      ...base, title, caption: `${title} — practical, repeatable ideas for better social content.`, platforms: [platform],
      channel_id: primary(platform).id, post_type: type, status: 'published', scheduled_at: publishedAt, published_at: publishedAt,
      thumbnail_url: media.images[image], media_urls: [media.images[image]], owner_id: workspace.owner_id,
      created_by: workspace.owner_id, external_post_id: `demo-${platform}-${title.length}`,
    })
  }
  for (const [title, platform, type, days, hour, minute, image] of UPCOMING_POSTS) {
    postRows.push({
      ...base, title, caption: `${title}: scheduled from the Social publishing calendar.`, platforms: [platform],
      channel_id: primary(platform).id, post_type: type, status: 'scheduled', scheduled_at: at(days, hour, minute),
      thumbnail_url: media.images[image], media_urls: [media.images[image]], owner_id: workspace.owner_id, created_by: workspace.owner_id,
    })
  }
  APPROVAL_POSTS.forEach(([title, platform, type, days, hour, minute, image], index) => {
    const requester = teammates[index % Math.max(1, teammates.length)]?.user_id ?? workspace.owner_id
    postRows.push({
      ...base, title, caption: `${title} — awaiting review before it can be queued.`, platforms: [platform],
      channel_id: primary(platform).id, post_type: type, status: 'pending_approval', approval_required: true, scheduled_at: at(days, hour, minute),
      thumbnail_url: media.images[image], media_urls: [media.images[image]], owner_id: requester, created_by: requester,
      created_at: ago(40 + index * 25), updated_at: ago(40 + index * 25),
    })
  })
  postRows.push({
    ...base, title: 'Flash tips: caption length', caption: 'Short captions, long impact.', platforms: ['instagram'],
    channel_id: primary('instagram').id, post_type: 'post', status: 'failed', scheduled_at: ago(95),
    failure_summary: 'Media aspect ratio is not supported for a feed post.', thumbnail_url: media.images['brand-awareness-q2'],
    owner_id: workspace.owner_id, created_by: workspace.owner_id,
  })
  postRows.push({
    ...base, title: 'Launch week recap', caption: 'Everything we shipped this week.', platforms: ['linkedin', 'x', 'facebook'],
    channel_id: primary('linkedin').id, post_type: 'post', status: 'partially_published', scheduled_at: ago(260), published_at: ago(258),
    failure_summary: 'X (Twitter): rate limit reached · Facebook: page role missing', thumbnail_url: media.images['press-launch-kit'],
    owner_id: workspace.owner_id, created_by: workspace.owner_id,
  })
  const insertedPosts = await must(admin.from('content_posts').insert(postRows, { defaultToNull: false }).select('id, title, status, platforms, scheduled_at, published_at, post_type'), 'posts')
  const postByTitle = new Map(insertedPosts.map(post => [post.title, post]))

  // ---- post_analytics for Social posts, plus lighter metrics for other modules' published posts
  const analytics = []
  for (const [title, platform, , , , , reach, rate, clicks] of PUBLISHED_POSTS) {
    const post = postByTitle.get(title)
    const engagements = Math.round(reach * rate)
    analytics.push({
      post_id: post.id, workspace_id: workspaceId, platform, recorded_at: post.published_at,
      impressions: Math.round(reach * 2.2), reach, likes: Math.round(engagements * 0.485), comments: Math.round(engagements * 0.187),
      shares: Math.round(engagements * 0.142), saves: Math.round(engagements * 0.114), clicks,
      video_views: ['reel', 'short'].includes(post.post_type) ? Math.round(reach * 1.4) : 0,
      profile_visits: Math.round(reach * 0.035), engagement_rate: Number(rate.toFixed(4)), raw_data: { source: TAG }, is_demo: true,
    })
  }
  const partial = postByTitle.get('Launch week recap')
  analytics.push({ post_id: partial.id, workspace_id: workspaceId, platform: 'linkedin', recorded_at: partial.published_at, impressions: 5_200, reach: 2_400, likes: 96, comments: 14, shares: 11, saves: 4, clicks: 88, video_views: 0, profile_visits: 60, engagement_rate: 0.0521, raw_data: { source: TAG }, is_demo: true })
  const otherPublished = await must(admin.from('content_posts').select('id, platforms, published_at, scheduled_at, tags')
    .eq('workspace_id', workspaceId).eq('status', 'published'), 'other published')
  for (const post of otherPublished.filter(row => !(row.tags ?? []).includes(TAG))) {
    const reach = 800 + Math.round(rand() * 2400)
    const engagements = Math.round(reach * (0.03 + rand() * 0.04))
    analytics.push({
      post_id: post.id, workspace_id: workspaceId, platform: post.platforms?.[0] ?? 'instagram', recorded_at: post.published_at ?? post.scheduled_at ?? ago(60),
      impressions: Math.round(reach * 2), reach, likes: Math.round(engagements * 0.6), comments: Math.round(engagements * 0.2),
      shares: Math.round(engagements * 0.12), saves: Math.round(engagements * 0.08), clicks: Math.round(reach * 0.02),
      video_views: 0, profile_visits: Math.round(reach * 0.03), engagement_rate: Number((engagements / reach).toFixed(4)), raw_data: { source: TAG }, is_demo: true,
    })
  }
  await chunkedInsert('post_analytics', analytics, 'post analytics')

  // ---- publishing queue: a delivery per channel for upcoming scheduled work, plus failures
  const queue = []
  const queueable = await must(admin.from('content_posts').select('id, platforms, scheduled_at')
    .eq('workspace_id', workspaceId).in('status', ['scheduled', 'queued']).gte('scheduled_at', iso(now)), 'queueable')
  const alreadyQueued = new Set((await must(admin.from('publishing_queue').select('post_id').eq('workspace_id', workspaceId), 'queued')).map(row => row.post_id))
  for (const post of queueable) {
    if (alreadyQueued.has(post.id)) continue
    for (const platform of post.platforms?.length ? post.platforms : ['instagram']) {
      const channel = primary(platform)
      queue.push({
        workspace_id: workspaceId, post_id: post.id, channel_id: channel.id, scheduled_at: post.scheduled_at, status: 'queued',
        idempotency_key: `${TAG}:${post.id}:${channel.id}`, provider: channel.platform, approval_status: 'not_required', priority: 'medium', is_demo: true,
      })
    }
  }
  const failed = postByTitle.get('Flash tips: caption length')
  queue.push(
    { workspace_id: workspaceId, post_id: failed.id, channel_id: primary('instagram').id, scheduled_at: failed.scheduled_at, status: 'failed', attempt_count: 2, last_attempt_at: ago(12), failure_type: 'validation', error_message: 'Media aspect ratio is not supported for a feed post.', idempotency_key: `${TAG}:${failed.id}:ig`, provider: 'instagram', is_demo: true },
    { workspace_id: workspaceId, post_id: partial.id, channel_id: primary('x').id, scheduled_at: partial.scheduled_at, status: 'failed', attempt_count: 3, last_attempt_at: ago(33), failure_type: 'rate_limit', error_message: 'Rate limit reached — the provider asked us to retry later.', next_attempt_at: iso(now + 23 * MIN), idempotency_key: `${TAG}:${partial.id}:x`, provider: 'x', is_demo: true },
    { workspace_id: workspaceId, post_id: partial.id, channel_id: primary('facebook').id, scheduled_at: partial.scheduled_at, status: 'failed', attempt_count: 1, last_attempt_at: ago(40), failure_type: 'permission', error_message: 'The connected user no longer has a page role.', idempotency_key: `${TAG}:${partial.id}:fb`, provider: 'facebook', is_demo: true },
    { workspace_id: workspaceId, post_id: partial.id, channel_id: primary('linkedin').id, scheduled_at: partial.scheduled_at, status: 'sent', attempt_count: 1, last_attempt_at: ago(258), sent_at: ago(258), provider_post_id: 'demo-li-launch', idempotency_key: `${TAG}:${partial.id}:li`, provider: 'linkedin', is_demo: true },
  )
  await chunkedInsert('publishing_queue', queue, 'queue')

  // ---- engagement threads and messages
  const threads = []
  const push = thread => threads.push({ workspace_id: workspaceId, channel_id: primary(thread.platform).id, is_demo: true, ...thread })
  HEADLINE_THREADS.forEach((thread, index) => {
    const created = now - thread.minutes * MIN
    push({
      type: thread.type, platform: thread.platform, sender_name: thread.name, sender_handle: thread.handle, sender_avatar: avatar(index + 2),
      content: thread.content, status: index === 0 ? 'assigned' : 'open', sentiment: thread.sentiment, sentiment_source: 'model', sentiment_confidence: 0.91,
      assigned_to: index === 0 ? workspace.owner_id : null, is_read: index >= 1 && index !== 3 && index !== 6, requires_reply: true,
      tags: thread.tags, priority: thread.tags.includes('Lead') ? 'high' : 'normal', sla_target_minutes: 240, sla_state: index === 0 ? 'met' : 'on_track',
      related_post_id: thread.related ? postByTitle.get(thread.related)?.id ?? null : null,
      created_at: iso(created), updated_at: iso(created + MIN), first_response_at: index === 0 ? iso(created + MIN) : null,
    })
  })
  FLAGGED_THREADS.forEach((thread, index) => {
    const created = now - thread.minutes * MIN - 3 * MIN
    push({
      type: thread.type, platform: thread.platform, sender_name: thread.name, sender_handle: thread.handle, sender_avatar: avatar(index + 5),
      content: thread.content, status: 'open', sentiment: thread.sentiment, sentiment_source: 'model', sentiment_confidence: 0.84,
      is_read: true, requires_reply: true, tags: ['Escalation'], priority: 'high', is_flagged: true, flag_reason: thread.flag,
      sla_target_minutes: 120, sla_state: thread.sentiment === 'negative' ? 'warning' : 'on_track', created_at: iso(created), updated_at: iso(created),
    })
  })
  const platforms = ['instagram', 'instagram', 'tiktok', 'facebook', 'linkedin', 'x', 'youtube']
  for (let index = 0; index < 360; index += 1) {
    const created = now - (150 + rand() * 14 * 24 * 60) * MIN
    const sentiment = rand() < 0.62 ? 'positive' : rand() < 0.75 ? 'neutral' : 'negative'
    const type = rand() < 0.55 ? 'comment' : rand() < 0.6 ? 'mention' : 'dm'
    const [name, handle] = pick(rand, FILLER_SENDERS)
    const responded = rand() < 0.86
    const responseMinutes = 20 + rand() * 150
    const resolved = responded && created < now - DAY && rand() < 0.8
    const assignee = rand() < 0.7 ? pick(rand, assignees) : null
    push({
      type, platform: pick(rand, platforms), sender_name: name, sender_handle: handle, sender_avatar: avatar(index),
      content: pick(rand, FILLER_CONTENT[sentiment]), status: resolved ? 'resolved' : assignee ? 'assigned' : 'open',
      sentiment, sentiment_source: 'model', sentiment_confidence: Number((0.7 + rand() * 0.28).toFixed(3)),
      assigned_to: assignee, is_read: resolved || rand() < 0.55, requires_reply: !resolved,
      tags: [type === 'dm' ? 'DM' : type === 'mention' ? 'Mention' : 'Comment'], priority: sentiment === 'negative' ? 'high' : 'normal',
      first_response_at: responded ? iso(created + responseMinutes * MIN) : null, resolved_at: resolved ? iso(created + (responseMinutes + 60) * MIN) : null,
      sla_target_minutes: 240, sla_state: !responded ? 'on_track' : responseMinutes <= 240 ? 'met' : 'breached',
      created_at: iso(created), updated_at: iso(created + responseMinutes * MIN),
    })
  }
  // Instagram comments run well above last week, which drives the Engagement spike alert.
  for (let index = 0; index < 34; index += 1) {
    const created = now - (40 + rand() * 6.5 * 24 * 60) * MIN
    const [name, handle] = pick(rand, FILLER_SENDERS)
    push({
      type: 'comment', platform: 'instagram', sender_name: name, sender_handle: handle, sender_avatar: avatar(index),
      content: pick(rand, FILLER_CONTENT.positive), status: 'resolved', sentiment: 'positive', sentiment_source: 'model',
      sentiment_confidence: 0.9, is_read: true, requires_reply: false, tags: ['Comment'], priority: 'normal',
      first_response_at: iso(created + 30 * MIN), resolved_at: iso(created + 90 * MIN), sla_target_minutes: 240, sla_state: 'met',
      created_at: iso(created), updated_at: iso(created + 30 * MIN),
    })
  }
  const insertedThreads = []
  for (let index = 0; index < threads.length; index += 200) {
    insertedThreads.push(...await must(admin.from('inbox_threads').insert(threads.slice(index, index + 200), { defaultToNull: false }).select('id, content, created_at, first_response_at, assigned_to, sender_handle'), 'threads'))
  }
  const messages = []
  for (const thread of insertedThreads) {
    messages.push({ thread_id: thread.id, workspace_id: workspaceId, content: thread.content, sender_type: 'external', sent_at: thread.created_at, delivery_status: 'sent', is_demo: true })
    if (thread.first_response_at) {
      messages.push({
        thread_id: thread.id, workspace_id: workspaceId, sender_type: 'internal', sent_by: thread.assigned_to ?? workspace.owner_id,
        content: thread.sender_handle === 'jessica.luxe_' ? 'Thanks so much! 🙌 Glad you found it helpful.' : 'Thanks for reaching out — we’ve shared this with the team.',
        sent_at: thread.first_response_at, delivery_status: 'sent', provider_message_id: `demo-${thread.id.slice(0, 8)}`, is_demo: true,
      })
    }
  }
  await chunkedInsert('inbox_messages', messages, 'messages')

  await must(admin.from('saved_replies').insert([
    ['Thank you', 'Thanks so much! 🙌 Glad you found it helpful.', 'Appreciation'],
    ['Pricing question', 'Thanks for asking! You can compare every plan on our pricing page — happy to help you choose.', 'Sales'],
    ['Support hand-off', 'Sorry about that — our support team will reply by DM within the hour.', 'Support'],
    ['Collaboration enquiry', 'We’d love to chat. Could you share a few details about your campaign by email?', 'Partnerships'],
    ['Feature request', 'Great idea — we’ve logged it with the product team.', 'Product'],
  ].map(([title, content, category], index) => ({ workspace_id: workspaceId, title, content, category, is_shared: true, usage_count: 40 - index * 7, created_by: workspace.owner_id, is_demo: true }))), 'saved replies')

  // ---- listening
  const keywordRows = await must(admin.from('listening_keywords').insert(KEYWORDS.map((keyword, index) => ({
    workspace_id: workspaceId, keyword, match_type: index === 0 ? 'mention' : 'contains', platforms: ['instagram', 'x', 'tiktok', 'linkedin'],
    is_active: true, alert_enabled: index < 3, topic: TOPICS[index % TOPICS.length][0], created_by: workspace.owner_id, is_demo: true,
  }))).select('id, keyword'), 'keywords')

  await must(admin.from('competitor_profiles').insert([
    { workspace_id: workspaceId, competitor_name: 'Brand A', notes: TAG, is_active: true, created_by: workspace.owner_id },
    { workspace_id: workspaceId, competitor_name: 'Brand B', notes: TAG, is_active: true, created_by: workspace.owner_id },
  ]), 'competitors')

  const mentions = MENTION_AUTHORS.map((author, index) => ({
    workspace_id: workspaceId, keyword_id: keywordRows[0].id, platform: author.platform,
    source_type: SOURCES.find(item => item[0] === author.platform)?.[2] ?? 'public_api', source_key: author.platform,
    author_name: author.name, author_handle: author.handle, author_followers: author.influencer ? 120_000 : 4_000, author_avatar_url: avatar(index + 3),
    author_verified: Boolean(author.influencer), is_influencer: Boolean(author.influencer), content: author.content,
    sentiment: author.sentiment, sentiment_score: author.sentiment === 'positive' ? 0.82 : author.sentiment === 'negative' ? -0.64 : 0,
    reach_estimate: author.reach, engagement_count: Math.round(author.reach * author.rate), engagement_rate: author.rate,
    priority: author.priority ?? 'low', topic: author.topic, country_code: ['US', 'GB', 'IN'][index % 3],
    is_read: index > 1, is_starred: Boolean(author.starred), mentioned_at: ago(author.minutes), is_demo: true,
  }))
  const weights = (list, roll) => { let total = 0; return list.find(item => (total += item.at(-1)) >= roll) ?? list[0] }
  for (const [period, count] of [['current', 620], ['previous', 520]]) {
    for (let index = 0; index < count; index += 1) {
      const offsetDays = period === 'current' ? rand() * 6.9 : 7.05 + rand() * 6.9
      const roll = rand()
      const sentiment = roll < 0.483 ? 'positive' : roll < 0.81 ? 'neutral' : 'negative'
      const source = weights(SOURCES, rand())
      const country = weights(COUNTRIES, rand())[0]
      const influencer = rand() < 0.028
      const reach = Math.round((influencer ? 20_000 : 600) + rand() * (influencer ? 60_000 : 9_000))
      const [name, handle] = pick(rand, FILLER_SENDERS)
      const topic = weights(TOPICS.map((topicRow, topicIndex) => [...topicRow, [0.35, 0.22, 0.17, 0.13, 0.13][topicIndex]]), rand())[0]
      const rate = Number((0.01 + rand() * 0.06).toFixed(4))
      mentions.push({
        workspace_id: workspaceId, keyword_id: keywordRows[index % keywordRows.length].id, platform: source[0], source_type: source[2], source_key: source[0],
        author_name: name, author_handle: handle, author_followers: influencer ? 90_000 + Math.round(rand() * 400_000) : Math.round(200 + rand() * 8_000),
        author_avatar_url: avatar(index), author_verified: influencer, is_influencer: influencer,
        content: pick(rand, MENTION_BODY.filter(item => item[1] === sentiment))[0],
        sentiment, sentiment_score: sentiment === 'positive' ? 0.7 : sentiment === 'negative' ? -0.55 : 0.02,
        reach_estimate: reach, engagement_count: Math.round(reach * rate), engagement_rate: rate,
        priority: sentiment === 'negative' && reach > 6_000 ? 'high' : influencer ? 'medium' : 'low',
        topic, country_code: country, is_read: rand() < 0.7, is_starred: rand() < 0.04,
        mentioned_at: iso(now - offsetDays * DAY - 70 * MIN), is_demo: true,
      })
    }
  }
  await chunkedInsert('brand_mentions', mentions, 'mentions')

  const currentMentions = mentions.filter(mention => Date.parse(mention.mentioned_at) > now - 7 * DAY)
  await must(admin.from('listening_topics').insert(TOPICS.map(([label, summary, growth], index) => {
    const count = currentMentions.filter(mention => mention.topic === label).length
    return { workspace_id: workspaceId, label, summary, mention_count: count, growth_pct: growth, baseline_count: Math.round(count / (1 + growth / 100)), window_start: iso(now - 7 * DAY), window_end: iso(now), computed_at: ago(10 + index), is_demo: true }
  })), 'topics')

  await must(admin.from('listening_sources').insert(SOURCES.map(([key, label, type]) => {
    const count = currentMentions.filter(mention => mention.source_key === key).length
    return {
      workspace_id: workspaceId, source_key: key, label, source_type: type, mention_count: count,
      share_pct: Number(((count / currentMentions.length) * 100).toFixed(1)), is_enabled: true, last_seen_at: ago(5),
      coverage_note: type === 'first_party' ? 'Connected channel — comments and tags on owned accounts only.'
        : type === 'search_index' ? 'Search-index sample; not every public post is captured.' : 'Public API — recent public posts matching tracked keywords.',
      is_demo: true,
    }
  })), 'sources')

  const rules = await must(admin.from('listening_alert_rules').insert([
    { name: 'Negative sentiment spike', keywords: ['captionfox'], sentiments: ['negative'], volume_threshold: 40, severity: 'high', frequency: 'realtime' },
    { name: 'Competitor launches', keywords: ['brand a', 'brand b'], severity: 'high', frequency: 'hourly' },
    { name: 'Influencer mentions', keywords: ['captionfox'], influencer_threshold: 50_000, severity: 'low', frequency: 'daily' },
  ].map(rule => ({ workspace_id: workspaceId, recipients: ['marketing@captionfox.test'], created_by: workspace.owner_id, is_active: true, is_demo: true, ...rule }))).select('id'), 'alert rules')

  await must(admin.from('listening_alerts').insert([
    ['negative_sentiment', 'Spike in negative sentiment', 'Mentions increased by 45% in the last 2 hours.', 'high', 2, 0],
    ['competitor_mention', 'Competitor campaign detected', 'Brand A launched a new campaign about AI captions.', 'high', 15, 1],
    ['product_issue', 'Export issue reports rising', 'Several mentions describe slow analytics exports.', 'high', 50, null],
    ['keyword_trend', 'Keyword trend alert', '“Social ROI” is trending in your industry.', 'medium', 32, null],
    ['volume_spike', 'Mention volume above baseline', 'Mentions are 18% above the 7-day baseline.', 'medium', 90, null],
    ['influencer_mention', 'Influencer mentioned your brand', '@techwithsarah mentioned @captionfox.', 'low', 60, 2],
    ['feature_feedback', 'New feature feedback', 'Users are discussing “Auto Hashtags”.', 'low', 120, null],
  ].map(([type, title, message, severity, minutes, ruleIndex]) => ({
    workspace_id: workspaceId, keyword_id: keywordRows[0].id, rule_id: ruleIndex === null ? null : rules[ruleIndex].id, alert_type: type, title, message,
    severity, status: 'active', is_read: false, triggered_at: ago(minutes), is_demo: true,
  }))), 'alerts')

  // ---- connections: sync runs, webhook events, issues
  const runs = []
  for (const channel of channels) {
    for (let day = 0; day < 14; day += 1) {
      const perDay = day % 3 === 0 ? 3 : 2
      for (let slot = 0; slot < perDay; slot += 1) {
        const started = now - day * DAY - (channel.synced ?? 10) * MIN - slot * 7 * HOUR
        const status = channel.platform === 'youtube' && !channel.account_id && slot === 0 ? 'partial' : 'success'
        runs.push({
          workspace_id: workspaceId, channel_id: channel.id, kind: slot === 0 ? 'incremental' : slot === 1 ? 'insights' : 'messages',
          status, trigger_source: 'schedule', records_synced: 40 + Math.round(rand() * 400),
          error_type: status === 'partial' ? 'rate_limit' : null, error_message: status === 'partial' ? 'Analytics quota reached; comments synced.' : null,
          started_at: iso(started), finished_at: iso(started + 40_000), is_demo: true,
        })
      }
    }
  }
  for (const [platform, hours] of [['facebook', 20], ['instagram', 45], ['youtube', 70]]) {
    runs.push({ workspace_id: workspaceId, channel_id: primary(platform).id, kind: 'incremental', status: 'failed', trigger_source: 'schedule', records_synced: 0, error_type: platform === 'facebook' ? 'permission' : 'network', error_message: platform === 'facebook' ? 'Page role missing for the connected user.' : 'Provider timed out.', started_at: iso(now - hours * HOUR), finished_at: iso(now - hours * HOUR + 30_000), is_demo: true })
  }
  await chunkedInsert('social_sync_runs', runs, 'sync runs')

  await must(admin.from('social_webhook_events').insert([
    ['instagram', 'post.published', 'Post Published', 4], ['tiktok', 'comment.received', 'Comment Received', 7], ['facebook', 'message.received', 'Message Received', 9],
    ['x', 'follower.new', 'New Follower', 11], ['linkedin', 'token.refreshed', 'Token Refreshed', 13], ['instagram', 'comment.received', 'Comment Received', 26],
    ['youtube', 'comment.received', 'Comment Received', 48], ['facebook', 'post.published', 'Post Published', 75], ['tiktok', 'mention.received', 'Mention Received', 90],
    ['x', 'message.received', 'Message Received', 130],
  ].map(([platform, type, summary, minutes], index) => ({
    workspace_id: workspaceId, channel_id: primary(platform).id, provider: platform, event_type: type, summary,
    external_event_id: `${TAG}:${workspaceId.slice(0, 8)}:${index}`, status: 'processed', received_at: ago(minutes), processed_at: ago(minutes), is_demo: true,
  }))), 'webhook events')

  await must(admin.from('social_connection_issues').insert([
    { channel_id: primary('youtube').id, issue_type: 'token_expiring', severity: 'warning', message: 'YouTube token expiring in 5 days', action_kind: 'renew_token', detected_at: ago(120) },
    { channel_id: primary('facebook').id, issue_type: 'missing_role', severity: 'warning', message: 'Facebook page role missing for user', action_kind: 'review_access', detected_at: ago(360) },
    { channel_id: primary('instagram').id, issue_type: 'missing_permission', severity: 'warning', message: 'Instagram insights permission missing', action_kind: 'update_scopes', detected_at: ago(1440) },
  ].map(issue => ({ workspace_id: workspaceId, status: 'open', is_demo: true, ...issue }))), 'issues')

  // ---- analytics: audience demographics and report presets
  const demographics = {
    country: [['US', 42.3], ['IN', 18.7], ['GB', 8.9], ['CA', 5.6], ['AU', 3.4], ['Other', 21.1]],
    age: [['18-24', 18.2], ['25-34', 44.7], ['35-44', 22.1], ['45-54', 9.8], ['55+', 5.2]],
    gender: [['female', 52.4], ['male', 45.1], ['unknown', 2.5]],
  }
  const audience = []
  for (const platform of ['instagram', 'facebook', 'youtube']) {
    const channel = primary(platform)
    for (const [dimension, buckets] of Object.entries(demographics)) {
      for (const [bucket, share] of buckets) {
        audience.push({ workspace_id: workspaceId, channel_id: channel.id, date: dayString(1), dimension, bucket, value: Math.round(channel.followers * share / 100), source: 'provider_api', is_demo: true })
      }
    }
  }
  await must(admin.from('social_audience_metrics').insert(audience), 'audience')

  const presets = await must(admin.from('social_report_presets').insert([
    { name: 'Weekly Performance Report', description: 'Reach, engagement and top posts across every channel.', config: { days: 7, metrics: ['reach', 'impressions', 'engagements', 'engagementRate'] }, is_default: true },
    { name: 'Executive Summary', description: 'Month-over-month headline KPIs.', config: { days: 30, metrics: ['reach', 'engagements', 'followers'] } },
    { name: 'Channel Comparison', description: 'Side-by-side channel performance.', config: { days: 7, view: 'channels' } },
    { name: 'Campaign Performance', description: 'Posts grouped by campaign.', config: { days: 30, groupBy: 'campaign' } },
  ].map(preset => ({ workspace_id: workspaceId, created_by: workspace.owner_id, is_demo: true, ...preset }))).select('id, name'), 'presets')
  const presetId = name => presets.find(preset => preset.name === name).id
  await must(admin.from('scheduled_reports').insert([
    { name: 'Weekly Performance Report', frequency: 'weekly', day_of_week: 1, preset_id: presetId('Weekly Performance Report'), format: 'pdf' },
    { name: 'Executive Summary', frequency: 'monthly', day_of_month: 1, preset_id: presetId('Executive Summary'), format: 'pdf' },
    { name: 'Channel Comparison', frequency: 'weekly', day_of_week: 5, preset_id: presetId('Channel Comparison'), format: 'csv' },
  ].map(report => ({ workspace_id: workspaceId, report_type: 'social', send_time: '09:00', recipients: ['marketing@captionfox.test'], date_range_days: 7, is_active: true, timezone: 'Europe/London', created_by: workspace.owner_id, next_send_at: iso(now + 3 * DAY), is_demo: true, ...report }))), 'scheduled reports')

  // ---- activity feed
  const actor = index => teammates[index % Math.max(1, teammates.length)]?.user_id ?? workspace.owner_id
  const post = title => postByTitle.get(title)?.id ?? null
  await must(admin.from('social_activity').insert([
    [actor(0), 'user', 'social.post.approve', 'content_post', post('Product Update 🎉'), 'approved a post', 'Product Update 🎉', 2, 'success'],
    [actor(1), 'user', 'social.post.submitted', 'content_post', post('Customer Testimonial Quote'), 'requested approval', 'Customer Testimonial', 8, 'info'],
    [actor(2), 'user', 'social.post.published', 'content_post', post('5 Tips to Improve Your Captions'), 'published a post', '5 Tips to Improve Your Captions', 15, 'success'],
    [null, 'system', 'social.post.published', 'content_post', post('Launch week recap'), 'post published successfully', 'Launch week recap', 32, 'success'],
    [actor(3), 'user', 'social.post.created', 'content_post', post('Productivity Sunday'), 'added a new post to queue', 'Productivity Sunday', 45, 'info'],
    [null, 'system', 'social.connection.token_refreshed', 'social_channel', primary('linkedin').id, 'LinkedIn connection refreshed', 'All good', 60, 'success'],
    [null, 'system', 'social.post.failed', 'content_post', post('Flash tips: caption length'), 'post failed to publish', 'Flash tips: caption length', 95, 'error'],
    [workspace.owner_id, 'user', 'social.alert.created', 'listening_alert_rule', rules[0].id, 'created a listening alert', 'Negative sentiment spike', 180, 'info'],
  ].map(([actorId, kind, action, entityType, entityId, summary, detail, minutes, severity]) => ({
    workspace_id: workspaceId, actor_id: actorId, actor_kind: kind, action, entity_type: entityType, entity_id: entityId,
    summary, detail, severity, created_at: ago(minutes), is_demo: true,
  }))), 'activity')

  console.log(`  channels ${channels.length} · rollups ${rollups.length} · posts ${insertedPosts.length} · post metrics ${analytics.length} · queue ${queue.length}`)
  console.log(`  threads ${insertedThreads.length} · messages ${messages.length} · mentions ${mentions.length} · sync runs ${runs.length}`)
}

// ---------------------------------------------------------------- main
let ids = process.argv.slice(2)
if (ids.length === 0) {
  const { data } = await admin.from('workspaces').select('id').like('name', 'Jamahl Thomas %')
  ids = (data ?? []).map(row => row.id)
}
for (const id of ids) await seedWorkspace(id)
console.log('\nSocial demo seed complete.')
