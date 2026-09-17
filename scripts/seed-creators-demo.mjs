// Development-only demo seed for Creators & UGC.
//
// Every seeded row is flagged is_demo (or cascades from an is_demo parent) and
// is removed and re-created on each run, so the script is idempotent. Values
// come from a seeded PRNG, so repeated runs produce identical data and nothing
// is random at render time. UGC media is uploaded to the PRIVATE
// `ugc-submissions` bucket under {workspace}/seed/ and only ever read back
// through signed URLs. Never run against production.
//
// Prerequisite: python scripts/render-creators-seed-media.py
// Usage: node scripts/seed-creators-demo.mjs <workspace_id> [<workspace_id> ...]

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line && !line.trimStart().startsWith('#') && line.includes('='))
    .map(line => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()] }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo creators data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86_400_000
const now = Date.now()
const isoAgo = (days, hours = 0) => new Date(now - days * DAY - hours * 3_600_000).toISOString()
const dateIn = days => new Date(now + days * DAY).toISOString().slice(0, 10)
const MEDIA_DIR = new URL('./seed-media/creators/', import.meta.url)
const BUCKET = 'ugc-submissions'

// name, handle, niche, audience, region, platforms, engagement, rate, tier, status, rights, availability, shortlisted, fit, avatar?
const CREATORS = [
  ['Lena Park', 'lenalife', 'beauty', 1_200_000, 'US', ['instagram', 'tiktok', 'youtube'], 5.6, 1800, 'elite', 'active', 'full', 'available', false, 94, 'lena-park'],
  ['Noah Rivera', 'noahrv', 'travel', 890_000, 'US', ['instagram', 'youtube', 'tiktok'], 4.1, 1450, 'pro', 'active', 'full', 'limited', false, 87, 'noah-rivera'],
  ['Maya Chen', 'mayachenlooks', 'fashion', 760_000, 'CA', ['instagram', 'tiktok'], 5.9, 1650, 'pro', 'in_review', 'limited', 'available', false, 82, 'maya-chen'],
  ['Ethan Brooks', 'ethan_brooks', 'tech', 540_000, 'US', ['youtube', 'tiktok'], 3.2, 1250, 'creator', 'active', 'full', 'booked', false, 76, 'ethan-brooks'],
  ['Sofia Martinez', 'sofi.mtz', 'wellness', 410_000, 'US', ['instagram', 'tiktok'], 4.8, 1100, 'creator', 'in_review', 'limited', 'available', false, 80, 'sofia-martinez'],
  ['James Walker', 'jameswalks', 'fitness', 330_000, 'UK', ['instagram', 'tiktok', 'youtube'], 3.6, 950, 'creator', 'shortlisted', 'none', 'available', true, 71, 'james-walker'],
  ['Aisha Patel', 'aishapatel', 'food', 290_000, 'CA', ['instagram', 'tiktok'], 6.2, 1300, 'pro', 'active', 'full', 'available', false, 88, 'aisha-patel'],
  ['Lucas Martin', 'lucasmartin_', 'lifestyle', 210_000, 'AU', ['instagram', 'youtube'], 3.1, 900, 'creator', 'shortlisted', 'limited', 'limited', true, 69, 'lucas-martin'],
  ['Ella Johnson', 'ellajohnson', 'home', 180_000, 'US', ['instagram', 'tiktok'], 2.9, 800, 'creator', 'discovered', 'none', 'unknown', false, 58, 'ella-johnson'],
  ['Daniel Kim', 'danielkim', 'gaming', 150_000, 'KR', ['youtube', 'twitch', 'tiktok'], 4.3, 1050, 'creator', 'active', 'full', 'available', false, 73, 'daniel-kim'],
  ['Olivia Bennett', 'oliviabennett', 'beauty', 820_000, 'UK', ['instagram', 'tiktok'], 5.1, 1700, 'elite', 'shortlisted', 'full', 'available', true, 91, 'olivia-bennett'],
  ['Ryan Carter', 'ryancarter', 'fitness', 710_000, 'US', ['instagram', 'youtube'], 4.4, 1500, 'pro', 'shortlisted', 'limited', 'available', true, 84, 'ryan-carter'],
  ['Hannah Lee', 'hannahleestyle', 'fashion', 560_000, 'UK', ['instagram', 'tiktok'], 4.9, 1350, 'pro', 'shortlisted', 'full', 'limited', true, 86, 'hannah-lee'],
  ['Tyler Adams', 'theadams', 'travel', 480_000, 'CA', ['youtube', 'instagram'], 3.9, 1200, 'creator', 'shortlisted', 'limited', 'available', true, 78, 'tyler-adams'],
  ['Emma Johnson', 'emmabeauty', 'beauty', 395_000, 'UK', ['instagram', 'tiktok'], 4.6, 1150, 'pro', 'active', 'full', 'available', false, 83, 'emma-johnson'],
  ['Liam Anderson', 'liam.and', 'fitness', 265_000, 'IE', ['instagram', 'youtube'], 3.4, 980, 'creator', 'active', 'limited', 'booked', false, 70, 'liam-anderson'],
  ['Chloe Evans', 'chloecooks', 'food', 142_000, 'UK', ['instagram', 'tiktok'], 5.3, 720, 'creator', 'active', 'full', 'available', false, 77, null],
  ['Marcus Green', 'marcusgreen', 'tech', 98_000, 'US', ['youtube'], 3.0, 650, 'creator', 'invited', 'none', 'unknown', false, 54, null],
  ['Priya Nair', 'priyanair', 'wellness', 76_000, 'UK', ['instagram'], 6.8, 540, 'creator', 'onboarding', 'none', 'available', false, 66, null],
  ['Oscar Reid', 'oscarreid', 'pets', 64_000, 'AU', ['tiktok', 'instagram'], 7.1, 480, 'creator', 'available', 'limited', 'available', false, 62, null],
  ['Zara Ahmed', 'zarastyle', 'fashion', 188_000, 'UK', ['instagram', 'tiktok'], 4.2, 860, 'creator', 'active', 'full', 'limited', false, 74, null],
  ['Ben Foster', 'benfosterfit', 'fitness', 57_000, 'US', ['instagram'], 5.9, 420, 'creator', 'paused', 'limited', 'unavailable', false, 49, null],
  ['Isla Murray', 'islamurray', 'home', 121_000, 'UK', ['instagram', 'pinterest'], 3.7, 690, 'creator', 'active', 'full', 'available', false, 72, null],
  ['Kenji Sato', 'kenjieats', 'food', 233_000, 'JP', ['tiktok', 'youtube'], 5.5, 990, 'pro', 'invitation_accepted', 'none', 'available', false, 68, null],
  ['Grace O\'Neill', 'graceoneill', 'family', 88_000, 'IE', ['instagram'], 4.0, 510, 'creator', 'active', 'limited', 'available', false, 63, null],
  ['Theo Walsh', 'theowalsh', 'finance', 45_000, 'UK', ['youtube', 'linkedin'], 3.3, 600, 'creator', 'discovered', 'none', 'unknown', false, 41, null],
  ['Nina Rossi', 'ninarossi', 'travel', 310_000, 'FR', ['instagram', 'youtube'], 4.5, 1180, 'pro', 'active', 'full', 'booked', false, 79, null],
  ['Sam Okoro', 'samokoro', 'lifestyle', 67_000, 'UK', ['tiktok'], 6.4, 450, 'creator', 'blocked', 'none', 'unavailable', false, 20, null],
]

// title, category, status, approval, campaignIdx, budget, deadlineOffset, creators, target, submitted, shot, ownerIdx
const BRIEFS = [
  ['Summer Skincare Routine', 'Skincare', 'draft', 'not_sent', 0, 6500, 34, 24, 4, 0, 'skincare-bottle', 0],
  ['Weekend Adventure', 'Travel', 'open', 'brief_sent', 1, 8000, 10, 32, 3, 2, 'hiker-portrait', 1],
  ['Quick & Healthy Meals', 'Food', 'in_progress', 'in_review', 2, 4200, 16, 18, 3, 1, 'healthy-bowl', 2],
  ['Capture Every Moment', 'Tech', 'submitted', 'pending_approval', 3, 7800, 20, 26, 5, 4, 'camera-lens', 3],
  ['Refreshing Summer Drinks', 'Beverage', 'completed', 'approved', 0, 3300, -4, 16, 3, 3, 'summer-drink', 4],
  ['Outdoor Adventure', 'Travel', 'open', 'brief_sent', 1, 6100, 28, 28, 4, 2, 'mountain-hiker', 1],
  ['Morning Motivation', 'Wellness', 'draft', 'not_sent', 5, 2900, 30, 20, 2, 0, 'morning-routine', 5],
  ['Glow Serum Launch', 'Skincare', 'open', 'waiting_for_creator', 0, 9200, 3, 12, 3, 0, 'skincare-flatlay', 0],
  ['Makeup Tutorial Series', 'Beauty', 'in_progress', 'in_review', 2, 5400, 22, 9, 4, 2, 'makeup-tutorial', 2],
  ['Unboxing Experience', 'Tech', 'in_progress', 'changes_requested', 3, 3800, 12, 7, 2, 1, 'product-unboxing', 3],
  ['City Exploration Diaries', 'Travel', 'submitted', 'pending_approval', 1, 4600, 18, 11, 3, 3, 'city-exploration', 1],
  ['Home Cooking Stories', 'Food', 'completed', 'approved', 2, 2500, -12, 8, 2, 2, 'home-cooking', 4],
  ['30-Day Fitness Reset', 'Fitness', 'on_hold', 'not_sent', 5, 5100, 40, 6, 3, 0, 'workout-session', 5],
  ['Coffee Ritual Reels', 'Beverage', 'completed', 'approved', 4, 1900, -20, 5, 2, 2, 'coffee-moment', 0],
  ['Desk Setup Tour', 'Tech', 'open', 'brief_sent', 3, 3500, 25, 10, 2, 0, 'tech-desk', 2],
  ['Sneaker Drop Teaser', 'Fashion', 'draft', 'not_sent', 4, 4400, 45, 14, 3, 0, 'sneaker-drop', 3],
]

// title, briefIdx, creatorIdx, status, assetType, shot, durationSec, files, views, eng, comments, daysAgo, reviewerIdx, issues[]
const SUBMISSIONS = [
  ['Summer Glow Skincare Reel', 7, 0, 'waiting_review', 'video', 'skincare-bottle', 28, 1, 108_000, 4.2, 128, 0.08, null, ['brand_guideline']],
  ['Weekend Adventure Vlog', 1, 1, 'in_review', 'video', 'hiker-portrait', 22, 1, 85_000, 3.8, 92, 0.21, 1, []],
  ['Quick & Healthy Meals', 2, 2, 'approved', 'video', 'healthy-bowl', 41, 1, 120_000, 5.6, 134, 0.9, 0, []],
  ['Capture Every Moment', 3, 3, 'changes_requested', 'video', 'camera-lens', 25, 1, 64_000, 2.9, 74, 1.1, 1, ['missing_disclosure', 'low_resolution']],
  ['Refreshing Summer Drinks', 4, 4, 'approved', 'video', 'summer-drink', 19, 1, 92_000, 3.2, 101, 1.9, 0, []],
  ['Skincare Flatlay Set', 7, 0, 'waiting_review', 'carousel', 'skincare-flatlay', null, 5, 68_000, 4.0, 87, 2.1, null, []],
  ['Makeup Tutorial: Natural Look', 8, 14, 'in_review', 'video', 'makeup-tutorial', 35, 1, 77_000, 4.6, 113, 2.3, 0, ['incorrect_product_usage']],
  ['Hiking Essentials Pack', 5, 1, 'approved', 'package', 'mountain-hiker', null, 3, 66_000, 3.6, 79, 3, 1, []],
  ['Beach Day Moments', 1, 4, 'waiting_review', 'video', 'beach-day', 24, 1, 0, 0, 0, 3.2, null, []],
  ['Product Unboxing', 9, 3, 'waiting_review', 'package', 'product-unboxing', null, 3, 0, 0, 0, 3.4, 1, ['missing_disclosure']],
  ['Morning Routine', 8, 2, 'in_review', 'video', 'morning-routine', 31, 1, 0, 0, 0, 3.6, null, []],
  ['City Exploration', 10, 1, 'waiting_review', 'video', 'city-exploration', 27, 1, 0, 0, 0, 3.8, 2, []],
  ['Cooking At Home', 11, 6, 'waiting_review', 'carousel', 'home-cooking', null, 4, 0, 0, 0, 4.1, null, ['brand_guideline']],
  ['Workout Session Cut', 12, 5, 'rejected', 'video', 'workout-session', 45, 1, 12_000, 1.8, 9, 6, 0, ['copyright_risk']],
  ['Coffee Ritual Reel', 13, 14, 'published', 'video', 'coffee-moment', 18, 1, 9_000, 6.1, 210, 22, 0, []],
  ['Desk Setup Walkthrough', 10, 9, 'approved', 'video', 'tech-desk', 52, 1, 58_000, 3.4, 66, 4, 2, []],
  ['Sneaker Styling Shots', 11, 12, 'approved', 'image', 'sneaker-drop', null, 1, 41_000, 4.4, 52, 5, 1, []],
  ['Headphones Honest Review', 3, 9, 'in_review', 'video', 'headphones-review', 63, 1, 22_000, 2.7, 31, 5.5, 1, ['low_resolution']],
  ['Healthy Bowl Recipe Card', 2, 16, 'approved', 'image', 'healthy-bowl', null, 1, 38_000, 5.2, 47, 7, 0, []],
  ['Glow Serum Flatlay', 7, 10, 'changes_requested', 'image', 'skincare-flatlay', null, 1, 18_000, 3.9, 22, 4.6, 0, ['brand_guideline']],
  ['Travel Packing Hacks', 5, 26, 'approved', 'video', 'city-exploration', 39, 1, 47_000, 4.3, 118, 8, 1, []],
  ['Summer Drinks Carousel', 4, 16, 'published', 'carousel', 'summer-drink', null, 6, 34_000, 5.0, 93, 18, 2, []],
  ['Camera Gear Launch', 3, 3, 'approved', 'video', 'camera-lens', 33, 1, 21_000, 3.1, 58, 9, 1, []],
  ['Morning Skincare Steps', 0, 14, 'draft', 'video', 'morning-routine', 26, 1, 0, 0, 0, 6.5, null, []],
]

function pick(rand, list) { return list[Math.floor(rand() * list.length)] }

async function uploadMedia(workspaceId) {
  const files = readdirSync(MEDIA_DIR).filter(name => name.endsWith('.jpg'))
  if (files.length === 0) throw new Error('No seed media found. Run: python scripts/render-creators-seed-media.py')
  const paths = {}
  for (const file of files) {
    const path = `${workspaceId}/seed/${file}`
    const { error } = await admin.storage.from(BUCKET).upload(path, readFileSync(new URL(file, MEDIA_DIR)), {
      contentType: 'image/jpeg', upsert: true,
    })
    if (error) throw new Error(`upload ${path}: ${error.message}`)
    paths[file.replace(/\.jpg$/, '')] = { path, size: readFileSync(new URL(file, MEDIA_DIR)).length }
  }
  return paths
}

async function clear(workspaceId) {
  const steps = [
    ['ugc_activity', 'is_demo'], ['ugc_payments', 'is_demo'], ['ugc_payment_batches', 'is_demo'],
    ['creator_lists', 'is_demo'], ['creator_invitations', 'is_demo'], ['ugc_briefs', 'is_demo'],
  ]
  for (const [table, flag] of steps) {
    const { error } = await admin.from(table).delete().eq('workspace_id', workspaceId).eq(flag, true)
    if (error) throw new Error(`clear ${table}: ${error.message}`)
  }
  // Rights and rights requests cascade from creators; remove them explicitly
  // first so the restrict FK on payments never blocks a creator delete.
  const { data: demoCreators } = await admin.from('ugc_creators').select('id').eq('workspace_id', workspaceId).eq('is_demo', true)
  const ids = (demoCreators ?? []).map(row => row.id)
  if (ids.length) {
    await admin.from('ugc_payments').delete().in('creator_id', ids)
    const { error } = await admin.from('ugc_creators').delete().in('id', ids)
    if (error) throw new Error(`clear ugc_creators: ${error.message}`)
  }
}

async function insert(table, rows, select = 'id') {
  if (rows.length === 0) return []
  const { data, error } = await admin.from(table).insert(rows).select(select)
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

async function seedWorkspace(workspaceId) {
  const rand = mulberry32(20260916)
  const { data: workspace } = await admin.from('workspaces').select('id, name, owner_id').eq('id', workspaceId).single()
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)

  const { data: memberRows } = await admin.from('workspace_members')
    .select('user_id, role').eq('workspace_id', workspaceId)
  const writers = (memberRows ?? []).filter(m => ['owner', 'admin', 'manager', 'member'].includes(m.role)).map(m => m.user_id)
  const reviewers = (memberRows ?? []).filter(m => ['owner', 'admin', 'manager'].includes(m.role)).map(m => m.user_id)
  const owner = workspace.owner_id ?? reviewers[0]
  const ownerAt = i => writers[(i * 3 + 1) % writers.length] ?? owner
  const reviewerAt = i => (i === null ? null : reviewers[i % reviewers.length] ?? owner)

  const { data: campaignRows } = await admin.from('campaigns').select('id, name')
    .eq('workspace_id', workspaceId).order('created_at', { ascending: true }).limit(8)
  const campaigns = campaignRows ?? []
  const campaignAt = i => campaigns.length ? campaigns[i % campaigns.length].id : null

  console.log(`\n${workspace.name}: clearing previous demo rows`)
  await clear(workspaceId)
  const media = await uploadMedia(workspaceId)

  // ── Creators ──────────────────────────────────────────────────────────────
  const creators = await insert('ugc_creators', CREATORS.map((c, i) => ({
    workspace_id: workspaceId, name: c[0], handle: c[1], niche: c[2], audience_size: c[3], follower_count: c[3],
    region: c[4], country: c[4], platforms: c[5], platform: c[5][0], engagement_rate: c[6], avg_rate: c[7],
    rate_per_video: c[7], currency: 'GBP', creator_tier: c[8], relationship_status: c[9], rights_readiness: c[10],
    availability: c[11], shortlisted: c[12], campaign_fit: c[13],
    avatar_url: c[14] ? `/demo/creators/avatars/${c[14]}.jpg` : null,
    email: `${c[1].replace(/[^a-z0-9]/gi, '')}@example.com`,
    bio: `${c[0]} creates ${c[2]} content for an engaged ${c[4]} audience.`,
    languages: ['English'], payment_ready: i % 7 !== 3, owner_id: ownerAt(i), added_by: owner,
    tags: [c[2], c[8]], source: i % 5 === 0 ? 'marketplace' : 'manual', is_demo: true,
    archived_at: c[9] === 'blocked' ? null : null,
    created_at: isoAgo(90 - i * 2.5), updated_at: isoAgo(i * 0.7),
  })), 'id, name')
  const creatorId = i => creators[i].id
  console.log(`  ${creators.length} creators`)

  const lists = await insert('creator_lists', [
    { workspace_id: workspaceId, name: 'Summer skincare shortlist', list_type: 'shortlist', campaign_id: campaignAt(0), owner_id: owner, created_by: owner, is_shared: true, is_demo: true },
    { workspace_id: workspaceId, name: 'Travel & outdoors roster', list_type: 'list', campaign_id: null, owner_id: owner, created_by: owner, is_shared: false, is_demo: true },
  ])
  await insert('creator_list_members', [
    ...[0, 10, 12, 14].map(i => ({ workspace_id: workspaceId, list_id: lists[0].id, creator_id: creatorId(i), added_by: owner })),
    ...[1, 13, 26].map(i => ({ workspace_id: workspaceId, list_id: lists[1].id, creator_id: creatorId(i), added_by: owner })),
  ], 'id')

  await insert('creator_invitations', [
    { email: 'marcusgreen@example.com', display_name: 'Marcus Green', creator_id: creatorId(17), status: 'sent', sent_at: isoAgo(2), expires_at: new Date(now + 12 * DAY).toISOString() },
    { email: 'kenjieats@example.com', display_name: 'Kenji Sato', creator_id: creatorId(23), status: 'accepted', sent_at: isoAgo(9), responded_at: isoAgo(1, 2) },
    { email: 'priyanair@example.com', display_name: 'Priya Nair', creator_id: creatorId(18), status: 'accepted', sent_at: isoAgo(12), responded_at: isoAgo(6) },
    { email: 'studio.hello@example.com', display_name: 'Harbour Studio', status: 'expired', sent_at: isoAgo(30), expires_at: isoAgo(16) },
  ].map(row => ({ ...row, workspace_id: workspaceId, created_by: owner, is_demo: true })), 'id')

  // ── Briefs ────────────────────────────────────────────────────────────────
  const briefs = await insert('ugc_briefs', BRIEFS.map((b, i) => ({
    workspace_id: workspaceId, title: b[0], category: b[1], status: b[2], approval_stage: b[3],
    campaign_id: campaignAt(b[4]), budget: b[5], currency: 'GBP', deadline: dateIn(b[6]),
    creators_assigned: b[7], deliverables_target: b[8], deliverables_submitted: b[9],
    cover_path: media[b[10]].path, owner_id: ownerAt(b[11]), created_by: owner, priority: i % 4 === 0 ? 'high' : 'medium',
    channels: i % 2 ? ['instagram', 'tiktok'] : ['tiktok', 'youtube'], platforms: i % 2 ? ['instagram', 'tiktok'] : ['tiktok', 'youtube'],
    description: `Creator brief for ${b[0].toLowerCase()} content, delivered as short-form vertical video.`,
    do_instructions: 'Show the product within the first three seconds. Use natural light.',
    dont_instructions: 'No competitor products, no unverified health claims.',
    rights_requirement: i % 3 === 0 ? 'paid_social' : 'organic_only',
    completed_at: b[2] === 'completed' ? isoAgo(Math.abs(b[6]) + 1) : null,
    board_position: i, is_demo: true, created_at: isoAgo(40 - i * 1.8), updated_at: isoAgo(i * 0.4),
  })), 'id, title, status')
  console.log(`  ${briefs.length} briefs`)

  const briefCreatorRows = []
  const deliverableRows = []
  briefs.forEach((brief, i) => {
    const count = 2 + (i % 4)
    for (let k = 0; k < count; k += 1) {
      const status = brief.status === 'completed' ? 'completed'
        : brief.status === 'draft' ? 'invited'
          : pick(rand, ['accepted', 'in_production', 'submitted', 'viewed', 'approved'])
      briefCreatorRows.push({
        workspace_id: workspaceId, brief_id: brief.id, creator_id: creatorId((i * 3 + k * 5) % CREATORS.length),
        status, agreed_rate: 400 + Math.round(rand() * 1400), currency: 'GBP',
        invited_at: isoAgo(30 - i), responded_at: status === 'invited' ? null : isoAgo(25 - i), created_by: owner,
      })
    }
    const deliverables = [['Hero video', 'video', 1, 'tiktok'], ['Story set', 'image', 3, 'instagram'], ['Raw footage', 'raw_footage', 1, null]]
    deliverables.slice(0, 1 + (i % 3)).forEach((d, position) => deliverableRows.push({
      workspace_id: workspaceId, brief_id: brief.id, title: d[0], asset_type: d[1], quantity: d[2], channel: d[3],
      due_date: dateIn(BRIEFS[i][6] - 2), position,
    }))
  })
  const seen = new Set()
  await insert('ugc_brief_creators', briefCreatorRows.filter(row => {
    const key = `${row.brief_id}:${row.creator_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }))
  await insert('ugc_brief_deliverables', deliverableRows)

  // ── Submissions ──────────────────────────────────────────────────────────
  const submissions = await insert('ugc_submissions', SUBMISSIONS.map((s, i) => {
    const decided = ['approved', 'changes_requested', 'rejected', 'published'].includes(s[3])
    const submittedAt = isoAgo(s[11])
    const reviewSeconds = decided ? Math.round((8 + rand() * 26) * 3600) : null
    return {
      workspace_id: workspaceId, title: s[0], brief_id: briefs[s[1]].id, creator_id: creatorId(s[2]),
      campaign_id: campaignAt(BRIEFS[s[1]][4]), status: s[3], asset_type: s[4], thumbnail_path: media[s[5]].path,
      duration_seconds: s[6], file_count: s[7], views: s[8], engagement_rate: s[9], comments_count: s[10],
      submitted_at: submittedAt, created_at: submittedAt, version: s[3] === 'changes_requested' || i % 6 === 5 ? 2 : 1,
      reviewer_id: reviewerAt(s[12]), review_started_at: s[3] === 'in_review' || decided ? submittedAt : null,
      review_seconds: reviewSeconds, reviewed_at: decided ? new Date(Date.parse(submittedAt) + reviewSeconds * 1000).toISOString() : null,
      issue_count: s[13].length, payment_eligible: s[3] === 'approved' || s[3] === 'published',
      rights_status: s[3] === 'approved' || s[3] === 'published' ? (i % 4 === 0 ? 'pending' : 'active') : 'none',
      notes: 'Delivered through the creator portal.',
      feedback: s[3] === 'changes_requested' ? 'Please add the #ad disclosure in the first frame and re-export at 1080p.' : null,
    }
  }), 'id, title, status, creator_id, version, thumbnail_path, submitted_at')
  console.log(`  ${submissions.length} submissions`)

  const assetRows = []
  const reviewRows = []
  const issueRows = []
  submissions.forEach((sub, i) => {
    const spec = SUBMISSIONS[i]
    const shot = media[spec[5]]
    for (let f = 0; f < Math.min(spec[7], 3); f += 1) {
      assetRows.push({
        workspace_id: workspaceId, submission_id: sub.id, version: sub.version, storage_path: shot.path,
        media_type: 'image', mime_type: 'image/jpeg', size_bytes: shot.size, width: 800, height: 600,
        duration_seconds: spec[6], thumbnail_path: shot.path, original_name: `${spec[5]}-${f + 1}.jpg`, created_by: owner,
      })
    }
    if (['approved', 'changes_requested', 'rejected', 'published'].includes(sub.status)) {
      reviewRows.push({
        workspace_id: workspaceId, submission_id: sub.id, version: sub.version, reviewer_id: reviewerAt(spec[12] ?? 0),
        decision: sub.status === 'published' ? 'approved' : sub.status,
        note: sub.status === 'changes_requested' ? 'Disclosure missing; resolution below 1080p.' : 'Meets the brief.',
        creator_visible: sub.status !== 'approved', created_at: new Date(Date.parse(sub.submitted_at) + 20 * 3600_000).toISOString(),
      })
    }
    spec[13].forEach(category => issueRows.push({
      workspace_id: workspaceId, submission_id: sub.id, category, severity: category === 'copyright_risk' ? 'high' : 'medium',
      source: i % 2 ? 'automated' : 'reviewer', status: i % 2 ? 'open' : 'confirmed', raised_by: owner,
      detail: 'Flagged during first-pass review.',
    }))
  })
  // Extra open issues so the Flagged Issues rail reflects a realistic queue.
  const extraIssues = ['brand_guideline', 'brand_guideline', 'missing_disclosure', 'low_resolution', 'incorrect_product_usage', 'copyright_risk']
  extraIssues.forEach((category, k) => issueRows.push({
    workspace_id: workspaceId, submission_id: submissions[k % 8].id, category, severity: 'medium',
    source: 'automated', status: 'open', raised_by: owner, detail: 'Detected by automated pre-check; awaiting reviewer confirmation.',
  }))
  await insert('ugc_submission_assets', assetRows)
  await insert('ugc_submission_reviews', reviewRows)
  await insert('ugc_submission_issues', issueRows)

  // Brief counters must agree with the rows behind them, so derive them from
  // what was actually inserted rather than the static BRIEFS table.
  for (const brief of briefs) {
    const assigned = new Set(briefCreatorRows.filter(r => r.brief_id === brief.id).map(r => r.creator_id)).size
    const target = deliverableRows.filter(r => r.brief_id === brief.id).reduce((sum, r) => sum + r.quantity, 0)
    const submitted = submissions.filter((_, i) => briefs[SUBMISSIONS[i][1]].id === brief.id).length
    const { error } = await admin.from('ugc_briefs')
      .update({ creators_assigned: assigned, deliverables_target: Math.max(target, submitted), deliverables_submitted: submitted })
      .eq('id', brief.id)
    if (error) throw new Error(`brief counters: ${error.message}`)
  }

  // ── Rights ───────────────────────────────────────────────────────────────
  // scope, territories, channels, startAgo, expiryIn, status, signed
  const RIGHTS = [
    ['limited', ['North America'], ['instagram', 'tiktok'], 30, 31, 'active', true],
    ['exclusive', ['Worldwide'], ['youtube', 'instagram'], 60, 87, 'active', true],
    ['limited', ['US', 'CA'], ['instagram', 'tiktok'], 45, 10, 'active', true],
    ['limited', ['North America'], ['instagram'], 50, -3, 'active', true],
    ['limited', ['Worldwide'], ['instagram', 'tiktok', 'youtube'], 35, 21, 'active', true],
    ['exclusive', ['US', 'CA', 'UK'], ['youtube', 'instagram'], 40, 108, 'active', true],
    ['single_use', ['North America'], ['youtube'], 28, -1, 'active', true],
    ['limited', ['Worldwide'], ['tiktok', 'instagram'], 26, 51, 'active', true],
    ['full_digital', ['UK', 'EU'], ['instagram', 'tiktok', 'facebook'], 20, 200, 'active', true],
    ['paid_social', ['UK'], ['instagram', 'facebook'], 12, 150, 'pending_approval', false],
    ['perpetual', ['Worldwide'], ['instagram', 'tiktok', 'youtube', 'web'], 90, null, 'active', true],
    ['organic_only', ['UK'], ['instagram'], 15, 60, 'restricted', true],
    ['limited', ['US'], ['tiktok'], 70, -20, 'expired', true],
    ['paid_social', ['North America'], ['facebook', 'instagram'], 8, 120, 'requested', false],
    ['exclusive', ['EU'], ['youtube'], 100, -40, 'revoked', true],
    ['full_digital', ['Worldwide'], ['instagram', 'tiktok'], 18, 26, 'active', false],
  ]
  const rightsSources = submissions.filter(sub => ['approved', 'published', 'changes_requested', 'in_review'].includes(sub.status))
  const rights = await insert('ugc_rights', RIGHTS.map((r, i) => {
    const sub = rightsSources[i % rightsSources.length]
    return {
      workspace_id: workspaceId, creator_id: sub.creator_id, submission_id: sub.id, submission_version: sub.version,
      campaign_id: campaignAt(i), asset_label: sub.title, rights_type: 'licence', usage_scope: r[0], territories: r[1], channels: r[2],
      start_date: dateIn(-r[3]), expiry_date: r[4] === null ? null : dateIn(r[4]), status: r[5], agreement_signed: r[6],
      agreement_url: r[6] ? 'signed-agreement' : null, exclusivity: r[0] === 'exclusive', paid_amplification: r[0] === 'paid_social' || r[0] === 'full_digital',
      handle_usage: i % 3 === 0, modification_allowed: i % 2 === 0, owner_id: ownerAt(i), created_by: owner,
      notes: 'Licence captured from the creator agreement.', created_at: isoAgo(r[3]), updated_at: isoAgo(i * 0.6),
    }
  }), 'id, asset_label, status')
  await insert('ugc_rights_requests', [
    { creator_id: creatorId(2), submission_id: submissions[2].id, requested_channels: ['instagram', 'facebook'], requested_territories: ['UK'], requested_duration_days: 180, paid_media: true, proposed_fee: 450, status: 'sent' },
    { creator_id: creatorId(4), submission_id: submissions[4].id, requested_channels: ['tiktok'], requested_territories: ['Worldwide'], requested_duration_days: 90, proposed_fee: 300, status: 'countered', counter_fee: 380 },
    { creator_id: creatorId(0), submission_id: submissions[0].id, requested_channels: ['youtube'], requested_territories: ['US'], requested_duration_days: 365, exclusivity: true, proposed_fee: 900, status: 'accepted', responded_at: isoAgo(2) },
  ].map(row => ({ paid_media: false, exclusivity: false, counter_fee: null, responded_at: null, ...row, workspace_id: workspaceId, currency: 'GBP', message: 'We would love to extend usage of this piece.', created_by: owner, expires_at: new Date(now + 10 * DAY).toISOString() })))
  console.log(`  ${rights.length} rights records`)

  // ── Payments ─────────────────────────────────────────────────────────────
  const batches = await insert('ugc_payment_batches', [
    { name: 'August Payouts', status: 'completed', payment_method: 'bank_transfer', scheduled_for: dateIn(-24), approved_by: owner, approved_at: isoAgo(26), processed_at: isoAgo(24) },
    { name: 'Mid-September Payouts', status: 'scheduled', payment_method: 'paypal', scheduled_for: dateIn(2), approved_by: owner, approved_at: isoAgo(1) },
    { name: 'Late September Payouts', status: 'pending_approval', payment_method: 'wise', scheduled_for: dateIn(6) },
  ].map(row => ({ ...row, workspace_id: workspaceId, currency: 'GBP', created_by: owner, idempotency_key: `seed-${workspaceId}-${row.name}`, is_demo: true })), 'id, name')

  const METHODS = ['paypal', 'bank_transfer', 'wise', 'paypal', 'bank_transfer', 'wise', 'manual']
  // status, submittedAgo, payoutIn, batch
  const PAYMENT_PLAN = [
    ['scheduled', 0.4, 2, 1], ['scheduled', 1.3, 1, 1], ['scheduled', 1.5, 1, 1], ['scheduled', 2.2, 2, 1],
    ['in_review', 2.4, null, null], ['paid', 3.1, -2, 0], ['paid', 3.4, -2, 0], ['paid', 4.2, -3, 0],
    ['pending_approval', 1.1, null, null], ['pending_approval', 5, null, null], ['invoice_required', 6, null, null],
    ['approved', 3, 3, null], ['approved', 4, 4, null], ['approved', 2, 5, null], ['failed', 7, -1, null],
    ['on_hold', 9, null, null], ['draft', 0.2, null, null], ['invoice_submitted', 1.8, null, null],
    ['scheduled', 3.3, 6, 2], ['scheduled', 3.6, 6, 2], ['processing', 1.4, 0, null], ['cancelled', 14, null, null],
  ]
  const paymentRows = []
  let invoiceNo = 614
  for (let i = 0; i < 64; i += 1) {
    const plan = PAYMENT_PLAN[i % PAYMENT_PLAN.length]
    // Older cycles are settled; the recent cycle carries the live queue.
    const cycle = Math.floor(i / PAYMENT_PLAN.length)
    const status = cycle === 0 ? plan[0] : (i % 9 === 4 ? 'failed' : 'paid')
    const submittedAgo = plan[1] + cycle * 10 + (i % 5) * 0.7
    const creatorIdx = (i * 7) % 16
    const briefIdx = i % BRIEFS.length
    const method = METHODS[i % METHODS.length]
    const approved = ['approved', 'scheduled', 'processing', 'paid', 'failed', 'partially_paid'].includes(status)
    const paidAt = status === 'paid' ? isoAgo(Math.max(0.2, submittedAgo - 3 - (i % 3))) : null
    const invoiceFlag = i === 2 ? 'Amount mismatch' : i === 13 ? 'Missing tax info' : i === 18 ? 'Duplicate invoice' : null
    paymentRows.push({
      workspace_id: workspaceId, creator_id: creatorId(creatorIdx), brief_id: briefs[briefIdx].id,
      campaign_id: campaignAt(BRIEFS[briefIdx][4]),
      submission_id: submissions[i % submissions.length].id,
      amount: Math.round((900 + ((i * 373) % 2400)) / 10) * 10, currency: 'GBP', status,
      approval_state: approved ? 'approved' : ['in_review', 'pending_approval'].includes(status) ? 'pending' : status === 'cancelled' ? 'rejected' : 'not_submitted',
      approved_by: approved ? reviewerAt(i) : null, approved_at: approved ? isoAgo(Math.max(0.1, submittedAgo - 1)) : null,
      payment_method: method, submitted_date: isoAgo(submittedAgo, i % 7),
      payout_date: plan[2] === null ? (status === 'paid' ? paidAt.slice(0, 10) : null) : (cycle === 0 ? dateIn(plan[2]) : paidAt?.slice(0, 10) ?? null),
      paid_at: paidAt, batch_id: cycle === 0 && plan[3] !== null ? batches[plan[3]].id : null,
      invoice_number: `INV-2026-${String(invoiceNo--).padStart(4, '0')}-${String(i + 1).padStart(3, '0')}`,
      invoice_status: invoiceFlag ? 'flagged' : status === 'invoice_required' ? 'required' : 'submitted',
      invoice_flag: invoiceFlag, tax_status: i === 13 ? 'missing' : 'verified',
      failure_reason: status === 'failed' ? 'Beneficiary account details rejected by the bank.' : null,
      provider_reference: status === 'paid' ? `PAYOUT-${workspaceId.slice(0, 4).toUpperCase()}-${1000 + i}` : null,
      owner_id: owner, created_by: owner, is_demo: true, created_at: isoAgo(submittedAgo, i % 7),
    })
  }
  const payments = await insert('ugc_payments', paymentRows, 'id, status, batch_id, provider_reference, failure_reason')
  await admin.from('ugc_payment_batches').update({ item_count: 4, total_amount: 0 }).eq('id', batches[1].id)
  for (const batch of batches) {
    const items = paymentRows.filter(row => row.batch_id === batch.id)
    await admin.from('ugc_payment_batches').update({
      item_count: items.length, total_amount: items.reduce((sum, row) => sum + row.amount, 0),
    }).eq('id', batch.id)
  }
  await insert('ugc_payout_attempts', payments
    .filter(p => p.status === 'paid' || p.status === 'failed')
    .map(p => ({
      workspace_id: workspaceId, payment_id: p.id, batch_id: p.batch_id, attempt_no: 1,
      status: p.status === 'paid' ? 'succeeded' : 'failed', provider: 'manual',
      provider_reference: p.provider_reference, error_code: p.status === 'failed' ? 'beneficiary_rejected' : null,
      error_message: p.failure_reason, created_by: owner,
    })))
  const earnings = new Map()
  paymentRows.filter(row => row.status === 'paid').forEach(row => earnings.set(row.creator_id, (earnings.get(row.creator_id) ?? 0) + row.amount))
  for (const [id, total] of earnings) await admin.from('ugc_creators').update({ total_earnings: total }).eq('id', id)
  console.log(`  ${payments.length} payments, ${batches.length} batches`)

  // ── Activity ─────────────────────────────────────────────────────────────
  const link = (surface, id) => `/app/creators/${surface}/${id}`
  const activity = [
    [0.03, 'submission', submissions[2].id, 'submitted', `Maya Chen submitted content for brief "Quick & Healthy Meals"`, link('submissions', submissions[2].id), 'submissions'],
    [0.2, 'submission', submissions[1].id, 'approved', `Noah Rivera's submission was approved`, link('submissions', submissions[1].id), 'submissions'],
    [1, 'payment', payments[0].id, 'status_changed', 'Payment of £2,160.00 to Noah Rivera is processing', link('payments', payments[0].id), 'payments'],
    [1.1, 'invitation', null, 'accepted', 'New creator Kenji Sato accepted your invitation', link('creators', creatorId(23)), 'creators'],
    [2, 'brief', briefs[4].id, 'status_changed', 'Brief "Refreshing Summer Drinks" was completed', link('briefs', briefs[4].id), 'briefs'],
    [0.08, 'brief', briefs[0].id, 'updated', 'Brief "Summer Skincare Routine" was updated', link('briefs', briefs[0].id), 'briefs'],
    [0.17, 'submission', submissions[3].id, 'submitted', 'Ethan Brooks submitted 3 deliverables for "Capture Every Moment"', link('submissions', submissions[3].id), 'submissions'],
    [0.25, 'submission', submissions[3].id, 'changes_requested', 'Changes requested on "Capture Every Moment"', link('submissions', submissions[3].id), 'submissions'],
    [0.33, 'submission', submissions[4].id, 'approved', 'Deliverables approved for "Refreshing Summer Drinks"', link('submissions', submissions[4].id), 'submissions'],
    [1, 'brief', briefs[2].id, 'created', 'Brief "Quick & Healthy Meals" created', link('briefs', briefs[2].id), 'briefs'],
    [0.1, 'rights', rights[0].id, 'approved', 'Exclusive licence approved for "Weekend Adventure"', link('rights', rights[1].id), 'rights'],
    [0.21, 'rights', rights[5].id, 'approved', 'Exclusive licence approved (US, CA, UK)', link('rights', rights[5].id), 'rights'],
    [0.9, 'rights', rights[3].id, 'expired', 'Usage rights expired on "Capture Every Moment"', link('rights', rights[3].id), 'rights'],
    [0.04, 'creator', creatorId(1), 'accepted', 'Noah Rivera accepted your invitation', link('creators', creatorId(1)), 'creators'],
    [0.12, 'creator', creatorId(3), 'updated', 'Ethan Brooks updated rate card', link('creators', creatorId(3)), 'creators'],
    [0.29, 'creator', creatorId(4), 'shortlisted', 'Sofia Martinez was added to shortlist', link('creators', creatorId(4)), 'creators'],
    [0.09, 'payment_batch', batches[1].id, 'approved', 'Payment batch "Mid-September Payouts" was approved', null, 'payments'],
    [0.13, 'payment', payments[4].id, 'status_changed', "Sofia Martinez's payment moved to In Review", link('payments', payments[4].id), 'payments'],
    [1, 'payment_batch', batches[2].id, 'created', 'New payment batch "Late September Payouts" was created', null, 'payments'],
  ]
  await insert('ugc_activity', activity.map(([daysAgo, entityType, entityId, action, summary, href, surface], i) => ({
    workspace_id: workspaceId, actor_id: writers[i % writers.length] ?? owner, entity_type: entityType, entity_id: entityId,
    action, summary, link: href, surface, created_at: isoAgo(daysAgo), is_demo: true,
  })))
  console.log(`  ${activity.length} activity entries`)
}

const ids = process.argv.slice(2)
if (ids.length === 0) {
  console.error('Usage: node scripts/seed-creators-demo.mjs <workspace_id> [...]')
  process.exit(1)
}
for (const id of ids) await seedWorkspace(id)
console.log('\nDone.')

