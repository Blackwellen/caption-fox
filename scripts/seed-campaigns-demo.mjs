// Development-only demo seed for the Campaigns module
// (/{type}/campaigns, /all, /giveaways, /competitions, /templates, /board, /timeline).
//
// It reproduces the seven approved Campaigns design images with live records:
// ~45 curated campaigns across every lifecycle stage, 5 giveaways with real
// entries, 5 competitions with real submissions, 10 templates, timeline phases
// / milestones / dependencies, 60 days of daily metrics and the activity feeds
// each surface reads.
//
// Idempotent: every row it owns is tagged (campaigns.tags contains
// 'campaigns_demo', giveaway / competition descriptions carry a [campaigns_demo]
// marker, templates / activity carry metadata demo flags) and is deleted and
// re-created on each run, so a second run produces identical counts.
//
// Pre-existing stress-test rows in the same workspace are ARCHIVED, never
// deleted, and tagged so the change is auditable and reversible — see
// `--unarchive` below. Dates are anchored to "today" in Europe/London.
//
// Usage:
//   node scripts/seed-campaigns-demo.mjs <workspace_id> [<workspace_id> ...]
//   node scripts/seed-campaigns-demo.mjs --unarchive <workspace_id>   (reverse only)
//   node scripts/seed-campaigns-demo.mjs --skip-upload <workspace_id> (reuse stored URLs)
//   node scripts/seed-campaigns-demo.mjs --archive-only <workspace_id> (re-hide stray rows)

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line.includes('=') && !line.trimStart().startsWith('#')).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo campaign data in production.')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production' || /prod/i.test(process.env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo campaign data in production.')
  process.exit(1)
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TZ = 'Europe/London'
const DEMO_TAG = 'campaigns_demo'
const DEMO_MARK = '[campaigns_demo]'
const STRESS_TAG = 'stress_archived'
const STRESS_MARK = '[stress_archived'
const BUCKET = 'media'
// How many real child rows to write per stored headline figure. 1.0 writes one
// `giveaway_entries` row per entry in `giveaways.total_entries` and one
// `competition_submissions` row per `competitions.submission_count`, which is
// what the entries / submissions trend charts, the judging donut and the
// approval-rate KPI are computed from.
//
// These existed because PostgREST caps a select at 1,000 rows and the Campaigns
// aggregates used to select their child rows unpaginated, so anything above the
// cap produced silently wrong KPIs. `fetchAll` in src/lib/campaigns/data.ts now
// pages to 50,000, so full volume is safe; drop the scales again only if that
// pagination is ever removed.
const ENTRY_SAMPLE_SCALE = 1
const SUBMISSION_SAMPLE_SCALE = 1
const MEDIA_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed-media', 'campaigns')

// ---------------------------------------------------------------- time helpers
const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(p => [p.type, p.value]))
const TODAY = { y: +todayParts.year, m: +todayParts.month - 1, d: +todayParts.day }

/** Calendar date `offset` days from today in Europe/London, as YYYY-MM-DD. */
const day = offset => new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + offset)).toISOString().slice(0, 10)
/** Same day, midday UTC — safe for timestamptz columns either side of BST. */
const ts = (offset, hh = 12) => new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + offset, hh)).toISOString()
const minsAgo = minutes => new Date(Date.now() - minutes * 60_000).toISOString()

/** Deterministic PRNG so repeated runs produce byte-identical data. */
function rng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

// ---------------------------------------------------------------- fixtures
const TEAMMATES = [
  { key: 'emma', name: 'Emma Davis', role: 'manager', title: 'Content Lead', slug: 'emma-davis' },
  { key: 'liam', name: 'Liam Chen', role: 'member', title: 'Growth Marketer', slug: 'liam-chen' },
  { key: 'sophia', name: 'Sophia Patel', role: 'manager', title: 'Brand Manager', slug: 'sophia-patel' },
  { key: 'noah', name: 'Noah Williams', role: 'member', title: 'Content Designer', slug: 'noah-williams' },
  { key: 'mason', name: 'Mason Lee', role: 'member', title: 'Copywriter', slug: 'mason-lee' },
  { key: 'olivia.martinez', name: 'Olivia Martinez', role: 'member', title: 'Campaign Manager', slug: 'olivia-martinez' },
  { key: 'ethan', name: 'Ethan Roberts', role: 'member', title: 'Events Marketer', slug: 'ethan-roberts' },
  { key: 'ava.martinez', name: 'Ava Martinez', role: 'member', title: 'Lifecycle Marketer', slug: 'ava-martinez' },
  { key: 'mia', name: 'Mia Thompson', role: 'member', title: 'Paid Social Lead', slug: 'mia-thompson' },
]

// slug, name, type, stage, health, priority, owner, budget, spend, progress,
// endOffset, startOffset, launchOffset|null, channels, approval
//
// The first eight rows are ordered by end date so the Overview "Featured
// campaigns" strip and the All Campaigns card grid render in the exact order
// the design images show.
const CAMPAIGNS = [
  ['summer-launch-2024', 'Summer Launch 2024', 'product_launch', 'in_progress', 'on_track', 'high', 'emma', 45000, 32450, 72, 1, -34, null, ['instagram', 'tiktok', 'youtube', 'email', 'facebook'], 'approved'],
  ['brand-awareness-q2', 'Brand Awareness Q2', 'brand_awareness', 'live', 'on_track', 'high', 'liam', 30000, 22180, 55, 3, -41, null, ['facebook', 'instagram', 'linkedin', 'x'], 'approved'],
  ['giveaway-win-big', 'Giveaway: Win Big', 'giveaway', 'in_review', 'at_risk', 'medium', 'sophia', 15000, 12890, 48, 4, -20, null, ['tiktok', 'instagram', 'facebook', 'email'], 'pending'],
  ['customer-stories', 'Customer Stories', 'ugc', 'planning', 'on_track', 'low', 'noah', 18000, 4120, 25, 5, -12, null, ['youtube', 'linkedin', 'email', 'web'], 'not_required'],
  ['spring-sale-push', 'Spring Sale Push', 'seasonal', 'in_progress', 'on_track', 'medium', 'olivia.martinez', 22000, 13200, 60, 6, -26, null, ['facebook', 'instagram', 'email'], 'approved'],
  ['webinar-series-q2', 'Webinar Series Q2', 'event', 'scheduled', 'at_risk', 'medium', 'ethan', 12500, 4375, 35, 7, -9, 5, ['linkedin', 'youtube', 'email'], 'approved'],
  ['referral-boost', 'Referral Boost', 'partnership', 'in_progress', 'on_track', 'medium', 'ava.martinez', 10000, 6700, 67, 9, -30, null, ['email', 'web'], 'approved'],
  ['product-teaser', 'Product Teaser', 'product_launch', 'planning', 'overdue', 'high', 'mason', 8000, 2400, 30, 10, -6, null, ['tiktok', 'instagram'], 'not_required'],

  // Planning (7 total, incl. Customer Stories + Product Teaser above)
  ['back-to-school-promo', 'Back to School Promo', 'seasonal', 'planning', 'on_track', 'medium', 'ava.martinez', 12000, 4800, 40, 26, -4, null, ['instagram', 'facebook', 'email'], 'not_required'],
  ['gift-guide-2024', 'Gift Guide 2024', 'seasonal', 'planning', 'on_track', 'low', 'mia', 9500, 1900, 18, 31, -3, 20, ['instagram', 'pinterest', 'email'], 'not_required'],
  ['sustainability-story', 'Sustainability Story', 'brand_awareness', 'planning', 'on_track', 'low', 'noah', 7500, 1500, 15, 38, -2, null, ['linkedin', 'web'], 'not_required'],
  ['trade-show-roadshow', 'Trade Show Roadshow', 'event', 'planning', 'on_track', 'medium', 'ethan', 16000, 3200, 20, 44, -5, null, ['linkedin', 'email', 'web'], 'not_required'],
  ['press-launch-kit', 'Press Launch Kit', 'product_launch', 'planning', 'on_track', 'low', 'mason', 6000, 900, 12, 49, -1, null, ['email', 'web'], 'not_required'],

  // In review (5 total, incl. Giveaway: Win Big above)
  ['email-newsletter-boost', 'Email Newsletter Boost', 'standard', 'in_review', 'on_track', 'medium', 'olivia.martinez', 8000, 3040, 38, 14, -18, null, ['email'], 'pending'],
  ['creator-collab-drop', 'Creator Collab Drop', 'influencer', 'in_review', 'on_track', 'high', 'sophia', 24000, 9600, 40, 17, -15, null, ['instagram', 'tiktok'], 'approved'],
  ['autumn-essentials-edit', 'Autumn Essentials Edit', 'seasonal', 'in_review', 'on_track', 'medium', 'emma', 14000, 5600, 42, 19, -13, null, ['instagram', 'pinterest', 'email'], 'not_required'],
  ['community-ambassadors', 'Community Ambassadors', 'ugc', 'in_review', 'on_track', 'low', 'noah', 5500, 1650, 30, 23, -11, null, ['instagram', 'web'], 'not_required'],

  // Scheduled (6) — these carry the future launch dates behind "Planned launches"
  ['holiday-collection-teaser', 'Holiday Collection Teaser', 'product_launch', 'scheduled', 'on_track', 'medium', 'mia', 22000, 13200, 60, 29, -7, 2, ['instagram', 'facebook', 'email'], 'pending'],
  ['flash-sale-weekend', 'Flash Sale Weekend', 'seasonal', 'scheduled', 'on_track', 'medium', 'ava.martinez', 10000, 5000, 50, 21, -6, 6, ['instagram', 'tiktok'], 'pending'],
  ['weekend-flash-drop', 'Weekend Flash Drop', 'retargeting', 'scheduled', 'on_track', 'low', 'liam', 6500, 2600, 34, 24, -5, 9, ['instagram', 'facebook'], 'not_required'],
  ['seasonal-bundle-offer', 'Seasonal Bundle Offer', 'seasonal', 'scheduled', 'on_track', 'medium', 'mason', 11500, 4600, 36, 27, -4, 11, ['email', 'web', 'facebook'], 'not_required'],
  ['video-shorts-sprint', 'Video Shorts Sprint', 'ugc', 'scheduled', 'on_track', 'low', 'emma', 7000, 2450, 28, 33, -3, 13, ['youtube', 'tiktok'], 'not_required'],

  // Live (9)
  ['spring-collection-launch', 'Spring Collection Launch', 'product_launch', 'live', 'on_track', 'high', 'emma', 50000, 35000, 70, 12, -45, null, ['instagram', 'facebook', 'tiktok', 'email', 'youtube'], 'approved'],
  ['brand-awareness-q1', 'Brand Awareness Q1', 'brand_awareness', 'live', 'on_track', 'medium', 'liam', 28000, 19600, 70, 15, -60, null, ['facebook', 'linkedin', 'youtube', 'x'], 'approved'],
  ['customer-stories-q1', 'Customer Stories Q1', 'ugc', 'live', 'on_track', 'medium', 'noah', 16000, 12800, 80, 18, -52, null, ['youtube', 'linkedin', 'email'], 'approved'],
  ['loyalty-club-relaunch', 'Loyalty Club Relaunch', 'standard', 'live', 'on_track', 'medium', 'ava.martinez', 13000, 9100, 65, 20, -38, null, ['email', 'web'], 'approved'],
  ['wellness-week', 'Wellness Week', 'seasonal', 'live', 'on_track', 'low', 'sophia', 9000, 5850, 62, 22, -24, null, ['instagram', 'email'], 'approved'],
  ['studio-tour-series', 'Studio Tour Series', 'brand_awareness', 'live', 'on_track', 'low', 'mia', 8500, 5100, 58, 25, -28, null, ['youtube', 'instagram'], 'approved'],
  ['always-on-retargeting', 'Always-On Retargeting', 'retargeting', 'live', 'on_track', 'medium', 'mia', 18000, 12600, 68, 40, -70, null, ['facebook', 'instagram', 'web'], 'approved'],
  ['winter-warmers-push', 'Winter Warmers Push', 'seasonal', 'live', 'on_track', 'medium', 'olivia.martinez', 15000, 9000, 55, 35, -21, null, ['facebook', 'email'], 'approved'],
  ['influencer-gifting-wave', 'Influencer Gifting Wave', 'influencer', 'in_progress', 'on_track', 'low', 'sophia', 9500, 6175, 60, 28, -19, null, ['instagram', 'tiktok'], 'approved'],

  // Completed (8) — 100% budget on the first three drives "Budget at risk"
  ['valentines-day-campaign', "Valentine's Day Campaign", 'seasonal', 'completed', 'on_track', 'medium', 'sophia', 18500, 18500, 100, null, -60, null, ['instagram', 'facebook', 'email'], 'approved'],
  ['january-clearance-sale', 'January Clearance Sale', 'seasonal', 'completed', 'on_track', 'medium', 'ava.martinez', 12000, 12000, 100, null, -70, null, ['tiktok', 'facebook'], 'approved'],
  ['new-year-new-you', 'New Year New You', 'brand_awareness', 'completed', 'on_track', 'low', 'liam', 14000, 14000, 100, null, -80, null, ['instagram', 'linkedin', 'email'], 'approved'],
  ['festive-gifting-2023', 'Festive Gifting 2023', 'seasonal', 'completed', 'on_track', 'low', 'emma', 16500, 8000, 100, null, -90, null, ['instagram', 'email'], 'approved'],
  ['black-friday-blitz', 'Black Friday Blitz', 'seasonal', 'completed', 'on_track', 'medium', 'mia', 26000, 12000, 100, null, -95, null, ['facebook', 'instagram', 'email'], 'approved'],
  ['autumn-brand-refresh', 'Autumn Brand Refresh', 'brand_awareness', 'completed', 'on_track', 'low', 'noah', 11000, 6000, 100, null, -100, null, ['linkedin', 'web'], 'approved'],
  ['summer-ugc-showcase', 'Summer UGC Showcase', 'ugc', 'completed', 'on_track', 'low', 'mason', 7500, 4500, 100, null, -105, null, ['instagram', 'youtube'], 'approved'],
  ['partner-webinar-series', 'Partner Webinar Series', 'event', 'completed', 'on_track', 'low', 'ethan', 9000, 5000, 100, null, -110, null, ['linkedin', 'email'], 'approved'],

  // At risk (3)
  ['app-relaunch-campaign', 'App Relaunch Campaign', 'product_launch', 'at_risk', 'at_risk', 'high', 'mia', 40000, 36000, 90, 16, -36, null, ['facebook', 'web', 'instagram'], 'approved'],
  ['q2-paid-acquisition', 'Q2 Paid Acquisition', 'lead_gen', 'at_risk', 'at_risk', 'high', 'ethan', 35000, 29750, 85, 13, -33, null, ['facebook', 'web', 'linkedin'], 'approved'],
  ['influencer-partnership', 'Influencer Partnership', 'partnership', 'at_risk', 'at_risk', 'medium', 'olivia.martinez', 12500, 10000, 80, 11, -29, null, ['instagram', 'tiktok'], 'approved'],

  // Blocked (3) — two sit past their end date and drive the "Overdue" KPI
  ['legacy-catalogue-refresh', 'Legacy Catalogue Refresh', 'standard', 'blocked', 'blocked', 'medium', 'mason', 8500, 4250, 45, 42, -42, null, ['web', 'email'], 'changes_requested'],
  ['marketplace-pilot', 'Marketplace Pilot', 'lead_gen', 'blocked', 'blocked', 'medium', 'ethan', 9500, 4750, 35, 47, -37, null, ['web'], 'changes_requested'],
  ['podcast-sponsorship', 'Podcast Sponsorship', 'partnership', 'blocked', 'blocked', 'low', 'liam', 6500, 2600, 25, 36, -16, null, ['web', 'email'], 'changes_requested'],
]
// Health overrides applied after the table above (see byHealth targets in README of this file).
const HEALTH_OVERRIDES = { 'gift-guide-2024': 'blocked' }

/**
 * Past due dates for the completed campaigns, so their Board / All cards can
 * show a real date like design image 6 instead of an em dash.
 *
 * OFF by default, because the Campaigns default sort is `due_soonest`
 * (`end_date ASC` with `nullsFirst: false`, src/lib/campaigns/data.ts:41+115).
 * Nulls sort last but past dates sort FIRST, so enabling this puts all eight
 * completed campaigns ahead of the live work — Overview's four Featured cards
 * become Black Friday Blitz / New Year New You / Autumn Brand Refresh / Summer
 * UGC Showcase, and the whole first row of All Campaigns goes with them
 * (evidence: docs/ui-verification/caption-fox/campaigns/seed-overview-completed-dates.jpeg).
 *
 * Flip this to `true` once the default sort puts completed work last — the
 * design's card order comes back and the dates come with it. Setting
 * `updated_at` older does not help: `due_soonest` never reads updated_at.
 */
const SHOW_COMPLETED_DUE_DATES = false
const COMPLETED_END_OFFSETS = {
  'valentines-day-campaign': -18, 'january-clearance-sale': -25, 'new-year-new-you': -32,
  'festive-gifting-2023': -40, 'black-friday-blitz': -46, 'autumn-brand-refresh': -52,
  'summer-ugc-showcase': -58, 'partner-webinar-series': -64,
}

const STATUS_FOR_STAGE = {
  planning: 'draft', in_progress: 'active', in_review: 'active', scheduled: 'active',
  live: 'live', completed: 'completed', at_risk: 'active', blocked: 'paused',
}

// slug, name, category, template_type, status, uses, workflows, owner, favourite, updatedHoursAgo, channels, budget, days
const TEMPLATES = [
  ['summer-launch-2024', 'Summer Launch 2024', 'product_launch', 'multi_channel', 'published', 24, 3, 'emma', true, 1, ['instagram', 'tiktok', 'youtube', 'email'], 45000, 45],
  ['brand-awareness-q2', 'Brand Awareness Q2', 'awareness', 'multi_channel', 'published', 18, 2, 'liam', false, 3, ['facebook', 'instagram', 'linkedin'], 30000, 60],
  ['giveaway-win-big', 'Giveaway: Win Big', 'giveaway', 'social_email', 'in_review', 12, 2, 'sophia', false, 6, ['tiktok', 'instagram', 'email'], 15000, 21],
  ['customer-stories', 'Customer Stories', 'content', 'omnichannel', 'draft', 7, 1, 'noah', false, 12, ['youtube', 'linkedin', 'email'], 18000, 30],
  ['referral-boost', 'Referral Boost', 'referral', 'multi_channel', 'published', 9, 2, 'olivia.martinez', false, 26, ['email', 'web'], 10000, 28],
  ['back-to-school-giveaway', 'Back to School Giveaway', 'giveaway', 'social_email', 'in_review', 5, 1, 'sophia', false, 50, ['instagram', 'email'], 12000, 21],
  ['holiday-promo-2024', 'Holiday Promo 2024', 'promotion', 'multi_channel', 'in_review', 4, 1, 'liam', false, 74, ['instagram', 'facebook', 'email'], 22000, 35],
  ['webinar-series-template', 'Webinar Series Template', 'webinar', 'event', 'in_review', 6, 2, 'ethan', false, 98, ['linkedin', 'youtube', 'email'], 12500, 14],
  ['product-launch-playbook', 'Product Launch Playbook', 'product_launch', 'omnichannel', 'draft', 3, 1, 'mason', false, 122, ['instagram', 'web', 'email'], 26000, 60],
  ['seasonal-sale-blueprint', 'Seasonal Sale Blueprint', 'seasonal', 'multi_channel', 'published', 8, 2, 'ava.martinez', false, 146, ['facebook', 'instagram', 'email'], 14000, 21],
]

// slug, title, prize, prizeValue, fulfilment, entries, conversion%, progress, health,
// endOffset, owner, platform, channels, pendingWinners, status
const GIVEAWAYS = [
  ['summer-sneakers-giveaway', 'Summer Sneakers Giveaway', 'Designer Trainers Bundle', 12000, 'fulfilled', 2416, 9.62, 72, 'on_track', 2, 'emma', 'instagram', ['instagram', 'tiktok', 'youtube', 'email', 'facebook'], 5],
  ['tech-upgrade-giveaway', 'Tech Upgrade Giveaway', 'Flagship Phone + Smartwatch', 9400, 'fulfilled', 1852, 7.18, 55, 'on_track', 3, 'liam', 'multi', ['facebook', 'instagram', 'linkedin', 'email'], 3],
  ['mothers-day-giveaway', "Mother's Day Giveaway", 'Spa & Wellness Pack', 7000, 'fulfilled', 3124, 8.91, 68, 'on_track', 4, 'sophia', 'tiktok', ['tiktok', 'instagram', 'email'], 4],
  ['dream-vacation-giveaway', 'Dream Vacation Giveaway', '7-Day Trip to Bali', 6100, 'pending', 1740, 6.33, 35, 'at_risk', 5, 'noah', 'youtube', ['youtube', 'facebook', 'email'], 2],
  ['photography-kit-giveaway', 'Photography Kit Giveaway', 'Pro Mirrorless Camera Kit', 5000, 'in_progress', 710, 4.11, 15, 'at_risk', 6, 'emma', 'instagram', ['instagram', 'email'], 2],
]

// slug, title, type, submissions, engagement%, judgingStage, status, progress, health,
// endOffset, owner, channels, votes
const COMPETITIONS = [
  ['capture-the-adventure', 'Capture the Adventure', 'photo', 428, 8.7, 'in_progress', 'judging', 72, 'on_track', 2, 'emma', ['instagram', 'facebook', 'youtube'], 3452],
  ['latte-art-showdown', 'Latte Art Showdown', 'photo', 312, 9.3, 'review', 'judging', 65, 'on_track', 4, 'liam', ['instagram', 'tiktok', 'facebook'], 2516],
  ['design-your-space', 'Design Your Space', 'design', 256, 11.2, 'shortlist', 'judging', 48, 'at_risk', 5, 'sophia', ['pinterest', 'instagram', 'web'], 2064],
  ['celebrate-and-win', 'Celebrate & Win', 'photo', 198, 14.6, 'completed', 'completed', 100, 'on_track', 6, 'noah', ['facebook', 'youtube'], 1596],
  ['eco-innovators-challenge', 'Eco Innovators Challenge', 'video', 143, 7.9, 'pending', 'open', 32, 'on_track', 12, 'olivia.martinez', ['youtube', 'web'], 1154],
]

// campaign slug -> phases [name, startOffset, endOffset, accent]
const PHASES = {
  'summer-launch-2024': [['Planning', -34, -18, 'blue'], ['Assets & Content', -18, -4, 'blue'], ['Launch', -4, 8, 'blue'], ['Post-launch', 8, 22, 'blue']],
  'brand-awareness-q2': [['Planning', -41, -28, 'green'], ['Content Production', -28, -10, 'green'], ['Live Campaign', -10, 6, 'green'], ['Analysis', 6, 20, 'green']],
  'giveaway-win-big': [['Planning', -20, -11, 'violet'], ['Build & Setup', -11, -2, 'violet'], ['Live Giveaway', -2, 8, 'violet'], ['Winner Selection', 8, 18, 'violet']],
  'customer-stories': [['Discovery', -12, -4, 'blue'], ['Content Production', -4, 6, 'blue'], ['Review & Approvals', 6, 14, 'blue'], ['Publish', 14, 24, 'blue']],
  'product-teaser': [['Planning', -6, 2, 'slate'], ['Content', 2, 9, 'slate'], ['Review', 9, 16, 'slate'], ['Launch', 16, 23, 'slate']],
  'spring-sale-push': [['Planning', -26, -14, 'amber'], ['Assets & Content', -14, -2, 'amber'], ['Launch', -2, 7, 'amber'], ['Wrap-up', 7, 16, 'amber']],
  'webinar-series-q2': [['Planning', -9, 0, 'violet'], ['Speaker Prep', 0, 5, 'violet'], ['Live Sessions', 5, 12, 'violet'], ['Follow-up', 12, 20, 'violet']],
  'referral-boost': [['Planning', -30, -20, 'green'], ['Build', -20, -8, 'green'], ['Promotion', -8, 5, 'green'], ['Review', 5, 14, 'green']],
}

// campaign slug -> milestones [title, dueOffset, type, status]
const MILESTONES = {
  'summer-launch-2024': [['Brief approved', -11, 'brief', 'completed'], ['Assets due', 1, 'assets', 'at_risk'], ['Launch', 8, 'launch', 'pending'], ['Review', 15, 'review', 'pending']],
  'brand-awareness-q2': [['Strategy review', -13, 'review', 'completed'], ['Go live', -5, 'launch', 'completed'], ['Mid-campaign check', 2, 'checkpoint', 'in_progress'], ['Report due', 9, 'report', 'pending']],
  'giveaway-win-big': [['Setup complete', -7, 'checkpoint', 'completed'], ['Launch', 0, 'launch', 'in_progress'], ['Promotion push', 5, 'checkpoint', 'pending'], ['Winners announced', 16, 'review', 'pending']],
  'customer-stories': [['Kickoff', -11, 'brief', 'completed'], ['Content due', 3, 'assets', 'pending'], ['Approvals', 10, 'approval', 'pending'], ['Publish', 22, 'launch', 'pending']],
  'product-teaser': [['Brief', -4, 'brief', 'completed'], ['Assets ready', 6, 'assets', 'pending'], ['Review', 14, 'review', 'pending'], ['Launch', 21, 'launch', 'pending']],
  'spring-sale-push': [['Creative sign-off', -6, 'approval', 'completed'], ['Launch', 4, 'launch', 'pending'], ['Performance review', 13, 'report', 'pending']],
  'webinar-series-q2': [['Speakers confirmed', 1, 'checkpoint', 'at_risk'], ['Dry run', 4, 'review', 'pending'], ['Session one live', 7, 'launch', 'pending']],
  'referral-boost': [['Programme live', -8, 'launch', 'completed'], ['Partner check-in', 6, 'checkpoint', 'pending'], ['Quarter report', 14, 'report', 'pending']],
}

// [campaign slug, depends on slug, label, status]
const DEPENDENCIES = [
  ['summer-launch-2024', 'brand-awareness-q2', 'Waiting on Brand Kit v2', 'blocking'],
  ['customer-stories', 'product-teaser', 'Depends on Product Update', 'in_progress'],
  ['product-teaser', 'spring-collection-launch', 'Awaiting feature freeze', 'pending'],
  ['webinar-series-q2', 'referral-boost', 'Needs partner list', 'in_progress'],
]

// surface, actor, action, entity type, summary, link slug, minutes ago
const ACTIVITY = [
  ['overview', 'emma', 'budget_updated', 'campaign', 'updated budget for Summer Launch 2024', 'summer-launch-2024', 2],
  ['overview', 'liam', 'content_published', 'campaign', 'published content for Brand Awareness Q2', 'brand-awareness-q2', 15],
  ['overview', 'sophia', 'submitted', 'campaign', 'submitted Giveaway: Win Big for review', 'giveaway-win-big', 31],
  ['overview', 'noah', 'stage_changed', 'campaign', 'moved Customer Stories to Planning', 'customer-stories', 62],
  ['overview', 'olivia.martinez', 'updated', 'campaign', 'set due date for Spring Sale Push', 'spring-sale-push', 121],
  ['overview', null, 'report_generated', 'system', 'generated performance report for 5 campaigns', null, 128],

  ['giveaways', null, 'entries_received', 'giveaway', '157 new entries for Summer Sneakers Giveaway', null, 182],
  ['giveaways', 'liam', 'winners_approved', 'giveaway', 'approved 5 winners for Tech Upgrade Giveaway', null, 195],
  ['giveaways', 'sophia', 'prize_fulfilled', 'giveaway', "marked prizes as fulfilled for Mother's Day Giveaway", null, 211],
  ['giveaways', 'noah', 'prize_added', 'giveaway', 'added a new prize to Dream Vacation Giveaway', null, 240],
  ['giveaways', 'emma', 'entries_exported', 'giveaway', 'exported entries for Photography Kit Giveaway', null, 300],

  ['competitions', 'emma', 'submissions_advanced', 'competition', 'advanced submissions for Capture the Adventure to Shortlist', null, 186],
  ['competitions', 'liam', 'submissions_approved', 'competition', 'approved 25 submissions for Latte Art Showdown', null, 202],
  ['competitions', 'sophia', 'submissions_added', 'competition', 'added 40 submissions to Design Your Space', null, 238],
  ['competitions', 'noah', 'completed', 'competition', 'marked Celebrate & Win as Completed', null, 264],
  ['competitions', null, 'report_exported', 'system', 'exported submissions report for 4 competitions', null, 320],

  ['templates', 'emma', 'published', 'template', 'published Summer Launch 2024', null, 188],
  ['templates', 'liam', 'updated', 'template', 'updated Brand Awareness Q2', null, 204],
  ['templates', 'sophia', 'submitted', 'template', 'submitted Giveaway: Win Big for review', null, 242],
  ['templates', 'noah', 'created', 'template', 'created Customer Stories', null, 266],
  ['templates', 'olivia.martinez', 'duplicated', 'template', 'duplicated Referral Boost', null, 322],

  ['board', 'mia', 'stage_changed', 'board', 'moved Holiday Collection Teaser to Scheduled', 'holiday-collection-teaser', 190],
  ['board', 'sophia', 'stage_changed', 'board', 'moved Giveaway: Win Big to In Review', 'giveaway-win-big', 206],
  ['board', 'emma', 'stage_changed', 'board', 'moved Spring Collection Launch to Live', 'spring-collection-launch', 244],
  ['board', 'ethan', 'status_updated', 'board', 'updated status for App Relaunch Campaign to At risk', 'app-relaunch-campaign', 268],
  ['board', null, 'archived', 'system', 'archived 3 completed campaigns', null, 324],

  ['timeline', 'emma', 'milestone_updated', 'milestone', 'updated milestone Assets due for Summer Launch 2024', 'summer-launch-2024', 192],
  ['timeline', 'liam', 'stage_changed', 'timeline', 'moved Brand Awareness Q2 to Live', 'brand-awareness-q2', 208],
  ['timeline', 'sophia', 'milestone_completed', 'milestone', 'marked Giveaway: Win Big Setup complete', 'giveaway-win-big', 246],
  ['timeline', 'noah', 'milestone_added', 'milestone', 'added milestone Publish for Customer Stories', 'customer-stories', 270],
  ['timeline', null, 'report_generated', 'system', 'generated timeline update', null, 326],
]

// ---------------------------------------------------------------- helpers
async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function insertAll(table, rows, label, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await must(admin.from(table).insert(rows.slice(i, i + size)), `${label} [${i}]`)
  }
}

async function ensureTeammates(workspaceId) {
  const ids = {}
  const emails = TEAMMATES.map(mate => `${mate.key}.demo@captionfox-demo.invalid`)
  // `auth.admin.listUsers` is not usable on this project, so existing demo users
  // are resolved through `profiles` (whose id is the auth user id) and only
  // genuinely new ones are created.
  const { data: known } = await admin.from('profiles').select('id, email').in('email', emails)
  const byEmail = new Map((known ?? []).map(row => [row.email, row.id]))
  const { data: existingMembers } = await admin.from('workspace_members')
    .select('user_id').eq('workspace_id', workspaceId)
  const members = new Set((existingMembers ?? []).map(row => row.user_id))

  for (const mate of TEAMMATES) {
    const email = `${mate.key}.demo@captionfox-demo.invalid`
    let userId = byEmail.get(email)
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email, email_confirm: true, password: randomUUID(),
        user_metadata: { full_name: mate.name, demo: true },
      })
      if (error) throw new Error(`create demo user ${email}: ${error.message}`)
      userId = data.user.id
    }
    ids[mate.key] = userId
    await must(admin.from('profiles').upsert({
      id: userId, email, full_name: mate.name, job_title: mate.title, onboarding_completed: true,
    }), `profile ${mate.key}`)
    if (!members.has(userId)) {
      // Insert only: `workspace_members` carries an updated_at trigger without
      // the matching column, so an upsert that takes the UPDATE path errors.
      await must(admin.from('workspace_members').insert(
        { workspace_id: workspaceId, user_id: userId, role: mate.role, joined_at: ts(-120), permissions: { demo: true } },
      ), `member ${mate.key}`)
      members.add(userId)
    }
  }
  return ids
}

/** Uploads the rendered media to the public `media` bucket, returns slug -> public URL. */
async function uploadMedia(workspaceId, skip) {
  const manifestPath = path.join(MEDIA_ROOT, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error('supabase/seed-media/campaigns/manifest.json missing — run python scripts/render-campaigns-seed-media.py first')
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const urls = {}
  let uploaded = 0
  for (const [group, entries] of Object.entries(manifest)) {
    urls[group] = {}
    for (const [slug, rel] of Object.entries(entries)) {
      const key = `campaigns-demo/${workspaceId}/${rel.replace(/\\/g, '/')}`
      if (!skip) {
        const body = readFileSync(path.join(MEDIA_ROOT, rel))
        const { error } = await admin.storage.from(BUCKET)
          .upload(key, body, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' })
        if (error) throw new Error(`upload ${key}: ${error.message}`)
        uploaded += 1
      }
      urls[group][slug] = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
    }
  }
  console.log(`  media: ${uploaded} file(s) uploaded to ${BUCKET}/campaigns-demo/${workspaceId}/`)
  return urls
}

/**
 * Archives the pre-existing stress-test rows so the curated demo set is what
 * the Campaigns surfaces show. Nothing is deleted: campaigns get
 * archived_at + a 'stress_archived' tag, giveaways / competitions get
 * status='archived' and a '[stress_archived:<previous status>]' description
 * marker. Both are reversed by `--unarchive`.
 */
async function archiveStressRows(workspaceId, keepCampaignIds) {
  const keep = new Set(keepCampaignIds)
  const now = new Date().toISOString()
  let archivedCampaigns = 0
  // PostgREST caps a select at 1000 rows, so keep sweeping until the workspace
  // has no un-archived campaign left outside the curated demo set.
  for (;;) {
    const { data: campaigns } = await admin.from('campaigns')
      .select('id, tags').eq('workspace_id', workspaceId).is('archived_at', null).limit(1000)
    const stale = (campaigns ?? []).filter(row => !keep.has(row.id))
    if (!stale.length) break
    for (let i = 0; i < stale.length; i += 200) {
      const batch = stale.slice(i, i + 200)
      await Promise.all(batch.map(row => must(
        admin.from('campaigns').update({
          archived_at: now,
          tags: [...new Set([...(row.tags ?? []), STRESS_TAG])],
        }).eq('id', row.id), 'archive campaign')))
    }
    archivedCampaigns += stale.length
  }

  let giveaways = 0
  let competitions = 0
  for (const table of ['giveaways', 'competitions']) {
    let count = 0
    for (;;) {
      const { data } = await admin.from(table)
        .select('id, status, description').eq('workspace_id', workspaceId).neq('status', 'archived').limit(1000)
      const rows = (data ?? []).filter(row => !(row.description ?? '').includes(DEMO_MARK))
      if (!rows.length) break
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200)
        await Promise.all(batch.map(row => must(
          admin.from(table).update({
            status: 'archived',
            description: (row.description ?? '').includes(STRESS_MARK)
              ? row.description
              : `${row.description ?? ''} ${STRESS_MARK}:${row.status}]`.trim(),
          }).eq('id', row.id), `archive ${table}`)))
      }
      count += rows.length
    }
    if (table === 'giveaways') giveaways = count
    else competitions = count
  }
  // Pre-existing templates are archived the same way, flagged in `config` so
  // `--unarchive` can restore them.
  const { data: templates } = await admin.from('campaign_templates')
    .select('id, config').eq('workspace_id', workspaceId).is('archived_at', null)
  const staleTemplates = (templates ?? []).filter(row => row.config?.demo !== true)
  for (const row of staleTemplates) {
    await must(admin.from('campaign_templates').update({
      archived_at: now, config: { ...(row.config ?? {}), stress_archived: true },
    }).eq('id', row.id), 'archive template')
  }
  console.log(`  archived: ${archivedCampaigns} campaigns · ${giveaways} giveaways · ${competitions} competitions `
    + `· ${staleTemplates.length} templates (tagged, reversible)`)
}

/** Reverses `archiveStressRows` — restores every row this seeder archived. */
async function unarchive(workspaceId) {
  let restoredCampaigns = 0
  for (;;) {
    const { data: campaigns } = await admin.from('campaigns')
      .select('id, tags').eq('workspace_id', workspaceId).contains('tags', [STRESS_TAG]).limit(500)
    if (!campaigns?.length) break
    for (let i = 0; i < campaigns.length; i += 200) {
      await Promise.all(campaigns.slice(i, i + 200).map(row => must(
        admin.from('campaigns').update({
          archived_at: null, tags: (row.tags ?? []).filter(tag => tag !== STRESS_TAG),
        }).eq('id', row.id), 'unarchive campaign')))
    }
    restoredCampaigns += campaigns.length
  }
  const restored = { giveaways: 0, competitions: 0 }
  for (const table of ['giveaways', 'competitions']) {
    for (;;) {
      const { data } = await admin.from(table)
        .select('id, description').eq('workspace_id', workspaceId).like('description', `%${STRESS_MARK}%`).limit(500)
      if (!data?.length) break
      for (const row of data) {
        const match = /\[stress_archived:([a-z_]+)\]/.exec(row.description ?? '')
        await must(admin.from(table).update({
          status: match ? match[1] : 'draft',
          description: (row.description ?? '').replace(/\s*\[stress_archived:[a-z_]+\]/, '').trim() || null,
        }).eq('id', row.id), `unarchive ${table}`)
      }
      restored[table] += data.length
    }
  }
  const { data: staleTemplates } = await admin.from('campaign_templates')
    .select('id, config').eq('workspace_id', workspaceId).eq('config->>stress_archived', 'true')
  for (const row of staleTemplates ?? []) {
    const config = { ...(row.config ?? {}) }
    delete config.stress_archived
    await must(admin.from('campaign_templates').update({ archived_at: null, config }).eq('id', row.id), 'unarchive template')
  }
  console.log(`Restored ${restoredCampaigns} campaigns · ${restored.giveaways} giveaways · ${restored.competitions} competitions · ${(staleTemplates ?? []).length} templates.`)
}

const DUP_SUFFIX = /\s\[cf-dup \d+\]$/

/**
 * `src/lib/demo-workspaces.ts` tops the demo workspace up on every /app load and
 * guards each row with `.eq('name', ...).maybeSingle()`. `maybeSingle()` errors
 * once two rows share a name, so the guard silently fails open and the workspace
 * grows by four campaigns, a giveaway and a competition on every page view —
 * which is why this workspace already holds ~475 copies of each.
 *
 * Renaming every duplicate but the oldest makes those guards resolve again, so
 * the top-up stops re-creating rows and the curated demo set stays visible.
 * Nothing is deleted and the suffix is stripped again by `--unarchive`.
 */
async function neutraliseDemoDuplicates(workspaceId) {
  const report = {}
  for (const [table, column] of [['campaigns', 'name'], ['giveaways', 'title'], ['competitions', 'title']]) {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const { data } = await admin.from(table)
        .select(`id, ${column}, created_at`).eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }).range(offset, offset + 999)
      if (!data?.length) break
      rows.push(...data)
      if (data.length < 1000) break
    }
    const groups = new Map()
    for (const row of rows) {
      const name = row[column] ?? ''
      if (DUP_SUFFIX.test(name)) continue
      const bucket = groups.get(name) ?? []
      bucket.push(row)
      groups.set(name, bucket)
    }
    const renames = []
    for (const bucket of groups.values()) {
      if (bucket.length < 2) continue
      bucket.slice(1).forEach((row, index) => renames.push({
        id: row.id, value: `${row[column]} [cf-dup ${index + 2}]`,
      }))
    }
    for (let i = 0; i < renames.length; i += 100) {
      await Promise.all(renames.slice(i, i + 100).map(item => must(
        admin.from(table).update({ [column]: item.value }).eq('id', item.id), `dedupe ${table}`)))
    }
    report[table] = renames.length
  }
  console.log(`  de-duplicated names: ${report.campaigns} campaigns · ${report.giveaways} giveaways · ${report.competitions} competitions`)
}

/** Reverses `neutraliseDemoDuplicates`. */
async function restoreDuplicateNames(workspaceId) {
  for (const [table, column] of [['campaigns', 'name'], ['giveaways', 'title'], ['competitions', 'title']]) {
    for (;;) {
      const { data } = await admin.from(table)
        .select(`id, ${column}`).eq('workspace_id', workspaceId).like(column, '% [cf-dup %').limit(500)
      if (!data?.length) break
      await Promise.all(data.map(row => must(
        admin.from(table).update({ [column]: row[column].replace(DUP_SUFFIX, '') }).eq('id', row.id),
        `restore ${table} name`)))
    }
  }
}

/**
 * Archives everything outside the curated set and repairs the duplicate names
 * that keep the app's demo top-up from re-inserting. The de-dupe runs on both
 * sides of the archive pass because the running dev server can insert rows
 * while the sweep is in flight.
 */
async function sweep(workspaceId, keepCampaignIds) {
  await neutraliseDemoDuplicates(workspaceId)
  await archiveStressRows(workspaceId, keepCampaignIds)
  await neutraliseDemoDuplicates(workspaceId)
  await archiveStressRows(workspaceId, keepCampaignIds)
}

/** `--archive-only`: re-runs the sweep without touching the demo rows. */
async function archiveOnly(workspaceId) {
  const { data } = await admin.from('campaigns')
    .select('id').eq('workspace_id', workspaceId).contains('tags', [DEMO_TAG])
  console.log(`
${workspaceId}`)
  await sweep(workspaceId, (data ?? []).map(row => row.id))
}

async function cleanup(workspaceId) {
  const { data: demoCampaigns } = await admin.from('campaigns')
    .select('id').eq('workspace_id', workspaceId).contains('tags', [DEMO_TAG])
  const campaignIds = (demoCampaigns ?? []).map(row => row.id)

  const { data: demoGiveaways } = await admin.from('giveaways')
    .select('id').eq('workspace_id', workspaceId).like('description', `%${DEMO_MARK}%`)
  const giveawayIds = (demoGiveaways ?? []).map(row => row.id)

  const { data: demoCompetitions } = await admin.from('competitions')
    .select('id').eq('workspace_id', workspaceId).like('description', `%${DEMO_MARK}%`)
  const competitionIds = (demoCompetitions ?? []).map(row => row.id)

  if (giveawayIds.length) {
    await must(admin.from('giveaway_entries').delete().in('giveaway_id', giveawayIds), 'clean entries')
    await must(admin.from('giveaways').delete().in('id', giveawayIds), 'clean giveaways')
  }
  if (competitionIds.length) {
    await must(admin.from('competition_submissions').delete().in('competition_id', competitionIds), 'clean submissions')
    await must(admin.from('competitions').delete().in('id', competitionIds), 'clean competitions')
  }
  if (campaignIds.length) {
    for (const table of ['campaign_dependencies', 'campaign_milestones', 'campaign_phases', 'campaign_metrics_daily']) {
      await must(admin.from(table).delete().in('campaign_id', campaignIds), `clean ${table}`)
    }
    await must(admin.from('campaigns').update({ template_id: null }).in('id', campaignIds), 'clean template links')
    await must(admin.from('campaigns').delete().in('id', campaignIds), 'clean campaigns')
  }
  await must(admin.from('campaign_templates').delete()
    .eq('workspace_id', workspaceId).eq('config->>demo', 'true'), 'clean templates')
  await must(admin.from('campaign_activity').delete()
    .eq('workspace_id', workspaceId).eq('metadata->>demo', 'true'), 'clean activity')
}

// ---------------------------------------------------------------- seed
async function seedWorkspace(workspaceId, opts) {
  const { data: workspace } = await admin.from('workspaces')
    .select('id, name, owner_id, type').eq('id', workspaceId).single()
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)
  console.log(`\n${workspace.name} (${workspace.type})`)

  const people = await ensureTeammates(workspaceId)
  const media = await uploadMedia(workspaceId, opts.skipUpload)

  for (const mate of TEAMMATES) {
    await must(admin.from('profiles')
      .update({ avatar_url: media.avatars[mate.slug] }).eq('id', people[mate.key]), `avatar ${mate.key}`)
  }

  await cleanup(workspaceId)

  // ── Templates ──────────────────────────────────────────────────────────────
  const templateIds = {}
  const templateRows = TEMPLATES.map(([slug, name, category, type, status, uses, workflows, owner, fav, hoursAgo, channels, budget, days]) => {
    const id = randomUUID()
    templateIds[slug] = id
    return {
      id, workspace_id: workspaceId, name,
      description: `Reusable ${category.replace(/_/g, ' ')} template for ${name}. ${DEMO_MARK}`,
      category, template_type: type, status, usage_count: uses, linked_workflows: workflows,
      cover_url: media.templates[slug] ?? null, is_favourite: fav, channels,
      default_budget: budget, default_duration_days: days, owner_id: people[owner],
      created_by: people[owner], config: { demo: true },
      created_at: minsAgo(hoursAgo * 60 + 60 * 24 * 30), updated_at: minsAgo(hoursAgo * 60),
    }
  })
  await insertAll('campaign_templates', templateRows, 'templates')

  // ── Campaigns ──────────────────────────────────────────────────────────────
  // Spend on the last live campaign is trimmed so total utilisation lands on
  // the 62% the Overview design shows.
  const budgetTotal = CAMPAIGNS.reduce((sum, row) => sum + row[7], 0)
  const targetSpend = Math.round(budgetTotal * 0.62)
  const rawSpend = CAMPAIGNS.reduce((sum, row) => sum + row[8], 0)
  const balancerIndex = CAMPAIGNS.findIndex(row => row[0] === 'winter-warmers-push')
  const balancedSpend = CAMPAIGNS[balancerIndex][8] + (targetSpend - rawSpend)

  const templateSlugs = TEMPLATES.map(t => t[0])
  const random = rng(20260916)
  const campaignIds = {}
  const campaignRows = CAMPAIGNS.map((row, index) => {
    const [slug, name, type, stage, health, priority, owner, budget, spend, progress,
      endOffset, startOffset, launchOffset, channels, approval] = row
    const id = randomUUID()
    campaignIds[slug] = id
    const actualSpend = index === balancerIndex ? balancedSpend : spend
    // Every fourth campaign is attributed to a template so the Templates usage
    // trend is derived from real reuse rather than a stored counter.
    const template = index % 4 === 0 ? templateIds[templateSlugs[(index / 4) % templateSlugs.length]] : null
    return {
      id, workspace_id: workspaceId, name,
      description: `${name} — ${type.replace(/_/g, ' ')} campaign for ${workspace.name}.`,
      campaign_type: type, status: STATUS_FOR_STAGE[stage], lifecycle_stage: stage,
      priority, health: HEALTH_OVERRIDES[slug] ?? health, progress, approval_status: approval,
      budget, actual_spend: actualSpend, currency: 'GBP',
      engagements: Math.round(2000 + random() * 40_000), reach: Math.round(20_000 + random() * 300_000),
      conversions: Math.round(80 + random() * 2400),
      channels, tags: [DEMO_TAG, type],
      start_date: day(startOffset),
      end_date: endOffset !== null ? day(endOffset)
        : SHOW_COMPLETED_DUE_DATES && COMPLETED_END_OFFSETS[slug] !== undefined ? day(COMPLETED_END_OFFSETS[slug])
        : null,
      launch_date: launchOffset === null ? null : day(launchOffset),
      thumbnail_url: media.campaigns[slug] ?? null,
      template_id: template, owner_id: people[owner], created_by: people[owner],
      archived_at: null,
      created_at: ts(-30 + (index % 30)), updated_at: minsAgo(5 + index * 7),
    }
  })
  await insertAll('campaigns', campaignRows, 'campaigns')

  // ── Timeline: phases, milestones, dependencies ────────────────────────────
  const phaseRows = []
  for (const [slug, phases] of Object.entries(PHASES)) {
    phases.forEach(([name, start, end, accent], order) => phaseRows.push({
      workspace_id: workspaceId, campaign_id: campaignIds[slug], name,
      start_date: day(start), end_date: day(end), accent, sort_order: order,
    }))
  }
  await insertAll('campaign_phases', phaseRows, 'phases')

  const milestoneRows = []
  for (const [slug, milestones] of Object.entries(MILESTONES)) {
    const owner = CAMPAIGNS.find(row => row[0] === slug)[6]
    for (const [title, due, type, status] of milestones) {
      milestoneRows.push({
        workspace_id: workspaceId, campaign_id: campaignIds[slug], title,
        due_date: day(due), milestone_type: type, status, owner_id: people[owner],
        completed_at: status === 'completed' ? ts(due) : null,
        created_by: people[owner],
      })
    }
  }
  await insertAll('campaign_milestones', milestoneRows, 'milestones')

  await insertAll('campaign_dependencies', DEPENDENCIES.map(([slug, dependsOn, label, status]) => ({
    workspace_id: workspaceId, campaign_id: campaignIds[slug],
    depends_on_campaign_id: campaignIds[dependsOn], label, status,
  })), 'dependencies')

  // ── Giveaways + entries ────────────────────────────────────────────────────
  const giveawayIds = {}
  const giveawayRows = GIVEAWAYS.map(([slug, title, prize, prizeValue, fulfilment, entries, conversion,
    progress, health, endOffset, owner, platform, channels]) => {
    const id = randomUUID()
    giveawayIds[slug] = id
    return {
      id, workspace_id: workspaceId, campaign_id: campaignIds['giveaway-win-big'], title,
      description: `${title} — win ${prize}. ${DEMO_MARK}`,
      status: 'active', start_date: ts(endOffset - 30), end_date: ts(endOffset, 18),
      platform, prize_title: prize, prize_value: prizeValue, prize_currency: 'GBP',
      prize_quantity: 1, entry_methods: ['follow', 'like', 'comment', 'tag_friend'],
      entry_hashtag: `#${slug.replace(/-/g, '')}`, max_entries_per_person: 3,
      winner_count: 5, winner_selection: 'random',
      total_entries: entries,
      total_unique_participants: Math.round(entries * conversion / 100),
      prize_fulfilment: fulfilment, approval_status: 'approved', progress, health,
      channels, cover_url: media.giveaways[slug] ?? null,
      owner_id: people[owner], created_by: people[owner],
      created_at: ts(endOffset - 30), updated_at: minsAgo(9 + endOffset),
    }
  })
  await insertAll('giveaways', giveawayRows, 'giveaways')

  // Real entry rows: the current 30-day window matches each giveaway's stored
  // total, plus a smaller previous window so the entries-trend chart has a
  // comparison line. Winner states drive the review queue and approval rate.
  const entryRandom = rng(77_001)
  const entryRows = []
  const REVIEWED = [
    ['approved', 12], ['contacted', 8], ['accepted', 6], ['fulfilled', 6], ['rejected', 2],
  ]
  // All 34 reviewed winner states sit on the first giveaway; only the workspace
  // totals feed the approval-rate KPI, and keeping them together stays stable
  // across runs.
  const reviewedQueue = REVIEWED.flatMap(([state, count]) => Array.from({ length: count }, () => state))
  GIVEAWAYS.forEach(([slug, , , , , storedEntries, , , , , , , , pendingWinners], gi) => {
    const id = giveawayIds[slug]
    const entries = Math.round(storedEntries * ENTRY_SAMPLE_SCALE)
    // One handle per entrant: `idx_giveaway_entries_unique_handle` is unique on
    // (giveaway_id, lower(participant_handle)), so the counter must not repeat.
    let seq = 0
    const push = (offset, count) => {
      for (let i = 0; i < count; i++) {
        const n = seq++
        entryRows.push({
          giveaway_id: id, workspace_id: workspaceId,
          participant_handle: `@entrant${gi}_${n}`,
          participant_email: `entrant${gi}-${n}@captionfox-demo.invalid`,
          entry_method: ['follow', 'like', 'comment', 'tag_friend'][Math.floor(entryRandom() * 4)],
          is_valid: true, is_winner: false, winner_status: 'none', source: 'social',
          entered_at: new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + offset, 8 + Math.floor(entryRandom() * 12), Math.floor(entryRandom() * 60))).toISOString(),
        })
      }
    }
    // Rising daily distribution across the last 30 days, summing to `entries`.
    const windowStart = entryRows.length
    const weights = Array.from({ length: 30 }, (_, i) => 0.6 + (i / 29) * 0.8)
    const weightSum = weights.reduce((a, b) => a + b, 0)
    let placed = 0
    for (let d = 0; d < 30; d++) {
      const count = d === 29 ? entries - placed : Math.round(entries * weights[d] / weightSum)
      placed += count
      push(d - 29, Math.max(0, count))
    }

    // Winner states land on the newest entries of this giveaway, so the review
    // queue and approval-rate KPI read the intended counts whatever the sample
    // size is.
    const special = []
    for (let i = 0; i < pendingWinners; i++) special.push('candidate')
    if (gi === 0) special.push(...reviewedQueue)
    special.forEach((state, i) => {
      const row = entryRows[entryRows.length - 1 - i]
      if (!row || entryRows.length - 1 - i < windowStart) return
      row.winner_status = state
      row.is_winner = !['none', 'candidate', 'rejected'].includes(state)
    })

    // Previous 30-day window at ~75% volume for the comparison line.
    const prev = Math.round(entries * 0.75)
    let prevPlaced = 0
    for (let d = 0; d < 30; d++) {
      const count = d === 29 ? prev - prevPlaced : Math.round(prev / 30)
      prevPlaced += count
      push(d - 59, Math.max(0, count))
    }
  })
  await insertAll('giveaway_entries', entryRows, 'giveaway entries', 1000)

  // ── Competitions + submissions ─────────────────────────────────────────────
  const competitionIds = {}
  const competitionRows = COMPETITIONS.map(([slug, title, type, submissions, engagement, judgingStage,
    status, progress, health, endOffset, owner, channels, votes]) => {
    const id = randomUUID()
    competitionIds[slug] = id
    return {
      id, workspace_id: workspaceId, campaign_id: null, title,
      description: `${title} — ${type} competition. ${DEMO_MARK}`,
      competition_type: type, status,
      start_date: ts(endOffset - 30), end_date: ts(endOffset, 18),
      submission_deadline: ts(endOffset - 2, 18), platform: channels[0],
      entry_hashtag: `#${slug.replace(/-/g, '')}`,
      prize_title: `${title} winner prize`, prize_value: 2500, prize_currency: 'GBP',
      judging_type: 'panel', max_submissions_per_person: 1,
      submission_count: submissions, vote_count: votes, engagement_rate: engagement,
      judging_stage: judgingStage, approval_status: 'approved', progress, health,
      channels, cover_url: media.competitions[slug] ?? null,
      owner_id: people[owner], created_by: people[owner],
      created_at: ts(endOffset - 30), updated_at: minsAgo(11 + endOffset),
    }
  })
  await insertAll('competitions', competitionRows, 'competitions')

  // Judging-status mix matches the design's distribution donut exactly.
  const MIX = [['in_progress', 0.32], ['review', 0.24], ['shortlist', 0.18], ['pending', 0.14], ['completed', 0.12]]
  const subRandom = rng(31_337)
  const submissionRows = []
  COMPETITIONS.forEach(([slug, , , storedSubmissions], ci) => {
    const id = competitionIds[slug]
    const submissions = Math.round(storedSubmissions * SUBMISSION_SAMPLE_SCALE)
    const states = []
    let assigned = 0
    MIX.forEach(([state, share], i) => {
      const count = i === MIX.length - 1 ? submissions - assigned : Math.round(submissions * share)
      assigned += count
      for (let n = 0; n < count; n++) states.push(state)
    })
    for (let i = 0; i < submissions; i++) {
      const judging = states[i]
      const offset = -29 + Math.floor((i / submissions) * 30)
      submissionRows.push({
        competition_id: id, workspace_id: workspaceId,
        participant_handle: `@creator${ci}-${i % 180}`,
        participant_email: `creator${ci}-${i}@captionfox-demo.invalid`,
        submission_url: `https://demo.captionfox.invalid/${slug}/${i}`,
        submission_text: `Entry ${i + 1} for ${slug.replace(/-/g, ' ')}`,
        media_urls: [], vote_count: Math.floor(subRandom() * 40),
        judge_scores: {}, status: ['pending', 'in_progress'].includes(judging) ? 'pending' : 'approved',
        judging_status: judging, source: 'social', is_winner: false,
        submitted_at: new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + offset, 9 + Math.floor(subRandom() * 10))).toISOString(),
      })
    }
  })
  await insertAll('competition_submissions', submissionRows, 'submissions', 1000)

  // ── Daily metrics ──────────────────────────────────────────────────────────
  // metricSeries sums every workspace row in the window, so the pre-existing
  // stress metrics are measured and subtracted to land the +32% uplift KPI.
  const to = day(0)
  const from = day(-29)
  const prevFrom = day(-59)
  const { data: existing } = await admin.from('campaign_metrics_daily')
    .select('metric_date, engagements').eq('workspace_id', workspaceId)
    .gte('metric_date', prevFrom).lte('metric_date', to)
  let existingCurrent = 0
  let existingPrevious = 0
  for (const row of existing ?? []) {
    if (row.metric_date >= from) existingCurrent += Number(row.engagements ?? 0)
    else existingPrevious += Number(row.engagements ?? 0)
  }
  const TARGET_PREVIOUS = 300_000
  const TARGET_CURRENT = Math.round(TARGET_PREVIOUS * 1.32)
  const minePrevious = Math.max(0, TARGET_PREVIOUS - existingPrevious)
  const mineCurrent = Math.max(0, TARGET_CURRENT - existingCurrent)

  const metricsHolder = campaignIds['summer-launch-2024']
  const metricRows = []
  const spread = (total, rising) => {
    const weights = Array.from({ length: 30 }, (_, i) => (rising ? 0.72 + (i / 29) * 0.56 : 0.94 + (i % 5) * 0.03))
    const sum = weights.reduce((a, b) => a + b, 0)
    let placed = 0
    return weights.map((w, i) => {
      const value = i === 29 ? total - placed : Math.round(total * w / sum)
      placed += value
      return value
    })
  }
  spread(minePrevious, false).forEach((engagements, i) => metricRows.push({
    workspace_id: workspaceId, campaign_id: metricsHolder, metric_date: day(-59 + i),
    engagements, reach: Math.round(engagements * 2.4), conversions: Math.round(engagements * 0.18),
    spend: Math.round(engagements * 0.42),
  }))
  spread(mineCurrent, true).forEach((engagements, i) => metricRows.push({
    workspace_id: workspaceId, campaign_id: metricsHolder, metric_date: day(-29 + i),
    engagements, reach: Math.round(engagements * 2.4), conversions: Math.round(engagements * 0.18),
    spend: Math.round(engagements * 0.42),
  }))
  await insertAll('campaign_metrics_daily', metricRows, 'metrics')

  // ── Activity feeds ─────────────────────────────────────────────────────────
  await insertAll('campaign_activity', ACTIVITY.map(([surface, actor, action, entityType, summary, slug, ago]) => ({
    workspace_id: workspaceId, actor_id: actor ? people[actor] : null,
    entity_type: entityType, entity_id: slug ? campaignIds[slug] ?? null : null,
    action, summary, link: slug ? `/campaigns/${campaignIds[slug]}` : null,
    surface, metadata: { demo: true }, created_at: minsAgo(ago),
  })), 'activity')

  // ── Archive the pre-existing stress rows ──────────────────────────────────
  await sweep(workspaceId, Object.values(campaignIds))

  console.log(`  ${campaignRows.length} campaigns · ${templateRows.length} templates · ${giveawayRows.length} giveaways `
    + `(${entryRows.length} entries) · ${competitionRows.length} competitions (${submissionRows.length} submissions)`)
  console.log(`  ${phaseRows.length} phases · ${milestoneRows.length} milestones · ${DEPENDENCIES.length} dependencies `
    + `· ${metricRows.length} metric days · ${ACTIVITY.length} activity rows`)
  console.log(`  budget £${budgetTotal.toLocaleString('en-GB')} · spend £${targetSpend.toLocaleString('en-GB')} `
    + `(${Math.round(targetSpend / budgetTotal * 100)}%)`)
}

// ---------------------------------------------------------------- entry point
const args = process.argv.slice(2)
const opts = {
  unarchive: args.includes('--unarchive'),
  archiveOnly: args.includes('--archive-only'),
  skipUpload: args.includes('--skip-upload'),
}
const targets = args.filter(arg => !arg.startsWith('--'))
if (!targets.length) {
  console.error('Usage: node scripts/seed-campaigns-demo.mjs [--unarchive] [--skip-upload] <workspace_id> [...]')
  process.exit(1)
}
for (const id of targets) {
  if (opts.unarchive) { await restoreDuplicateNames(id); await unarchive(id) }
  else if (opts.archiveOnly) await archiveOnly(id)
  else await seedWorkspace(id, opts)
}
console.log(opts.unarchive ? '\nStress rows restored.' : '\nCampaigns demo seed complete.')
