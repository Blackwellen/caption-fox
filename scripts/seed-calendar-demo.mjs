// Development-only demo seed for the Calendar module
// (/{type}/calendar, /publishing-queue, /agenda, /conflicts).
//
// Idempotent: every row it creates is tagged (is_demo / metadata.demo /
// tags ['calendar_demo']) and is removed and re-created on each run. Dates are
// anchored to "today" in Europe/London so the pages always show a live month.
// A seeded PRNG keeps repeated runs identical. Never run against production.
//
// Usage: node scripts/seed-calendar-demo.mjs <workspace_id> [<workspace_id> ...]

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#')).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo calendar data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TZ = 'Europe/London'
const DEMO_TAG = 'calendar_demo'

// ---------------------------------------------------------------- time helpers
function tzOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]))
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return (asUtc - date.getTime()) / 60000
}
const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date()).map(p => [p.type, p.value]))
const TODAY = { y: +todayParts.year, m: +todayParts.month - 1, d: +todayParts.day }

/** London wall-clock time `dayOffset` days from today → UTC ISO string. */
function at(dayOffset, hh = 9, mm = 0) {
  const guess = new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + dayOffset, hh, mm))
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000).toISOString()
}
const dateOnly = dayOffset => new Date(Date.UTC(TODAY.y, TODAY.m, TODAY.d + dayOffset)).toISOString().slice(0, 10)
const minsAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString()

// ---------------------------------------------------------------- fixtures
const TEAMMATES = [
  { key: 'emma', name: 'Emma Davis', role: 'manager', title: 'Content Lead' },
  { key: 'noah', name: 'Noah Williams', role: 'member', title: 'Designer' },
  { key: 'liam', name: 'Liam Chen', role: 'member', title: 'Growth Marketer' },
  { key: 'sophia', name: 'Sophia Patel', role: 'manager', title: 'Brand Manager' },
  { key: 'ava', name: 'Ava Rodriguez', role: 'member', title: 'Social Producer' },
  { key: 'mason', name: 'Mason Lee', role: 'member', title: 'Copywriter' },
  { key: 'olivia', name: 'Olivia Moore', role: 'member', title: 'Designer' },
  { key: 'james', name: 'James Carter', role: 'member', title: 'Video Editor' },
]

const CAMPAIGNS = [
  { key: 'launch', name: 'Autumn Launch 2026', start: 4, end: 40, priority: 'high' },
  { key: 'awareness', name: 'Brand Awareness Q3', start: -30, end: 20, priority: 'medium' },
  { key: 'updates', name: 'Product Updates', start: -60, end: 60, priority: 'medium' },
  { key: 'stories', name: 'Customer Stories', start: -45, end: 45, priority: 'medium' },
  { key: 'leadership', name: 'Thought Leadership', start: -20, end: 70, priority: 'low' },
  { key: 'engagement', name: 'Engagement Boost', start: -10, end: 30, priority: 'medium' },
  { key: 'giveaway', name: 'Giveaway: Win Big', start: 1, end: 14, priority: 'high' },
]

const CHANNELS = [
  { platform: 'instagram', name: 'Caption Fox Instagram', handle: '@captionfox' },
  { platform: 'youtube', name: 'Caption Fox YouTube', handle: '@captionfoxhq' },
  { platform: 'linkedin', name: 'Caption Fox LinkedIn', handle: 'caption-fox' },
  { platform: 'x', name: 'Caption Fox on X', handle: '@captionfox' },
  { platform: 'tiktok', name: 'Caption Fox TikTok', handle: '@captionfox' },
  { platform: 'facebook', name: 'Caption Fox Facebook', handle: 'captionfox' },
]

// title, channel, campaign, day offset, hh, mm, post status, post_type, owner
const POSTS = [
  ['Brand Awareness Post', 'facebook', 'awareness', -16, 10, 0, 'published', 'post', 'liam'],
  ['Product Launch Email', 'linkedin', 'launch', -15, 9, 30, 'published', 'post', 'emma'],
  ['LinkedIn Article', 'linkedin', 'leadership', -14, 11, 0, 'published', 'post', 'liam'],
  ['Promo Video', 'youtube', 'launch', -13, 14, 0, 'published', 'short', 'noah'],
  ['Customer Story', 'x', 'stories', -9, 9, 0, 'published', 'thread', 'sophia'],
  ['Twitter Thread', 'x', 'engagement', -8, 10, 30, 'published', 'thread', 'mason'],
  ['Blog Post', 'linkedin', 'leadership', -2, 9, 30, 'published', 'post', 'mason'],
  ['Case Study', 'linkedin', 'stories', -1, 11, 0, 'approved', 'carousel', 'olivia'],
  ['Instagram Post', 'instagram', 'launch', 0, 10, 30, 'published', 'post', 'emma'],
  ['Facebook Post', 'facebook', 'awareness', 0, 12, 0, 'pending_approval', 'carousel', 'sophia'],
  ['TikTok Video', 'tiktok', 'stories', 0, 15, 0, 'approved', 'short', 'ava'],
  ['Instagram Story', 'instagram', 'launch', 0, 18, 0, 'scheduled', 'story', 'emma'],
  ['Retargeting Ad', 'facebook', 'awareness', 1, 14, 0, 'scheduled', 'post', 'liam'],
  ['LinkedIn Article: Trends', 'linkedin', 'leadership', 1, 9, 0, 'scheduled', 'post', 'liam'],
  ['Facebook Ad', 'facebook', 'engagement', 1, 11, 0, 'pending_approval', 'post', 'noah'],
  ['TikTok Behind the Scenes', 'tiktok', 'stories', 1, 13, 0, 'approved', 'short', 'ava'],
  ['Giveaway: Win Big', 'instagram', 'giveaway', 1, 10, 0, 'pending_approval', 'post', 'sophia'],
  ['Brand Awareness Reel', 'instagram', 'awareness', 1, 10, 30, 'pending_approval', 'reel', 'sophia'],
  ['YouTube Video', 'youtube', 'updates', 2, 10, 0, 'draft', 'short', 'sophia'],
  ['Summer Recap Carousel', 'instagram', 'awareness', 2, 12, 0, 'scheduled', 'carousel', 'emma'],
  ['Product Update v2.1', 'linkedin', 'updates', 3, 14, 0, 'approved', 'post', 'liam'],
  ['Tips & Tricks', 'tiktok', 'engagement', 3, 15, 30, 'approved', 'short', 'ava'],
  ['Webinar Promotion', 'x', 'leadership', 4, 9, 0, 'approved', 'thread', 'mason'],
  ['Customer Testimonial', 'youtube', 'stories', 5, 18, 0, 'scheduled', 'short', 'noah'],
  ['Case Study: Acme', 'linkedin', 'leadership', 5, 16, 0, 'scheduled', 'post', 'mason'],
  ['Partner Post', 'linkedin', 'leadership', 6, 11, 0, 'scheduled', 'post', 'liam'],
  ['Social Post', 'facebook', 'engagement', 7, 9, 0, 'scheduled', 'post', 'emma'],
  ['Launch Teaser', 'instagram', 'launch', 8, 10, 0, 'pending_approval', 'reel', 'emma'],
  ['Spring Product Launch', 'linkedin', 'launch', 9, 11, 0, 'draft', 'post', 'sophia'],
  ['Customer Stories Carousel', 'linkedin', 'stories', 10, 9, 0, 'draft', 'carousel', 'olivia'],
  ['Influencer Collab', 'instagram', 'launch', 12, 10, 0, 'scheduled', 'reel', 'ava'],
  ['Influencer Collab #2', 'instagram', 'launch', 12, 10, 45, 'scheduled', 'reel', 'ava'],
  ['Product Explainer Video', 'youtube', 'updates', 13, 14, 0, 'draft', 'short', 'james'],
  ['Newsletter Promo', 'linkedin', 'updates', 14, 9, 0, 'scheduled', 'post', 'noah'],
  ['Monthly Report Teaser', 'x', 'leadership', 15, 10, 0, 'draft', 'thread', 'mason'],
]

// Queue rows keyed by post title: delivery status, approval, priority, extra
const QUEUE = {
  'Promo Video': { status: 'published', approval: 'approved', priority: 'high', lateMin: 4 },
  'Brand Awareness Post': { status: 'published', approval: 'approved', priority: 'medium', lateMin: 2 },
  'LinkedIn Article': { status: 'published', approval: 'approved', priority: 'medium', lateMin: 40 },
  'Customer Story': { status: 'published', approval: 'approved', priority: 'medium', lateMin: 1 },
  'Blog Post': { status: 'published', approval: 'approved', priority: 'low', lateMin: 3 },
  'Instagram Post': { status: 'published', approval: 'approved', priority: 'high', lateMin: 0 },
  'Case Study': { status: 'failed', approval: 'approved', priority: 'medium', failure: 'Media upload rejected by provider (aspect ratio).', code: 'MEDIA_INVALID', attempts: 2 },
  'Facebook Post': { status: 'draft', approval: 'awaiting_approval', priority: 'high' },
  'TikTok Video': { status: 'ready', approval: 'approved', priority: 'medium' },
  'Instagram Story': { status: 'scheduled', approval: 'approved', priority: 'medium' },
  'Retargeting Ad': { status: 'scheduled', approval: 'approved', priority: 'high' },
  'LinkedIn Article: Trends': { status: 'scheduled', approval: 'approved', priority: 'medium' },
  'Facebook Ad': { status: 'draft', approval: 'awaiting_approval', priority: 'high' },
  'TikTok Behind the Scenes': { status: 'ready', approval: 'approved', priority: 'low' },
  'Giveaway: Win Big': { status: 'draft', approval: 'awaiting_approval', priority: 'high' },
  'Brand Awareness Reel': { status: 'draft', approval: 'awaiting_approval', priority: 'medium' },
  'YouTube Video': { status: 'draft', approval: 'not_required', priority: 'medium' },
  'Summer Recap Carousel': { status: 'scheduled', approval: 'approved', priority: 'medium' },
  'Product Update v2.1': { status: 'ready', approval: 'approved', priority: 'medium' },
  'Tips & Tricks': { status: 'ready', approval: 'approved', priority: 'low' },
  'Webinar Promotion': { status: 'queued', approval: 'approved', priority: 'medium' },
  'Customer Testimonial': { status: 'scheduled', approval: 'approved', priority: 'medium' },
  'Case Study: Acme': { status: 'scheduled', approval: 'approved', priority: 'high' },
  'Partner Post': { status: 'scheduled', approval: 'approved', priority: 'low' },
  'Social Post': { status: 'scheduled', approval: 'approved', priority: 'medium' },
  'Launch Teaser': { status: 'draft', approval: 'awaiting_approval', priority: 'high' },
  'Spring Product Launch': { status: 'draft', approval: 'not_required', priority: 'medium' },
  'Customer Stories Carousel': { status: 'draft', approval: 'not_required', priority: 'low' },
  'Influencer Collab': { status: 'scheduled', approval: 'approved', priority: 'high' },
  'Influencer Collab #2': { status: 'scheduled', approval: 'approved', priority: 'high' },
  'Newsletter Promo': { status: 'scheduled', approval: 'approved', priority: 'medium' },
}
// Overdue, never-published items power "Delayed items" and SLA alerts.
const OVERDUE = [
  ['Promo Code Reminder', 'facebook', 'engagement', 135, 'failed', 'high', 'ava', 'Provider rate limit reached for this page.', 'RATE_LIMITED'],
  ['Event Reminder', 'instagram', 'launch', 105, 'failed', 'high', 'mason', 'Access token expired — reconnect the channel.', 'AUTH_EXPIRED'],
  ['Weekly Newsletter', 'linkedin', 'updates', 45, 'queued', 'medium', 'emma', null, null],
  ['Blog Post: Trends 2026', 'linkedin', 'leadership', 30, 'queued', 'medium', 'liam', null, null],
]

// Calendar items with no other canonical home.
// type, title, description, day, hh, mm, durationMin|null, allDay, owner, team, campaign, channel, status, priority
const ITEMS = [
  ['meeting', 'Team Stand-up', 'Daily alignment and priorities', 0, 9, 0, 30, false, 'you', 'Marketing Team', null, null, 'completed', 'medium'],
  ['launch', 'Campaign Launch', 'Autumn Launch 2026 goes live', 4, 13, 0, null, false, 'liam', 'Growth Team', 'launch', null, 'scheduled', 'high'],
  ['review', 'Approval Checkpoint', 'Creative assets final approval', 0, 14, 30, 60, false, 'noah', 'Design Team', 'awareness', null, 'scheduled', 'high'],
  ['reminder', 'Reminder', 'Submit weekly performance report', 0, 16, 30, null, false, 'you', 'Personal', null, null, 'scheduled', 'low'],
  ['meeting', 'Webinar Invite', 'Customer education series', -7, 12, 0, 60, false, 'sophia', 'Content Team', 'leadership', null, 'completed', 'medium'],
  ['launch', 'Product Launch', 'Flagship product release', -6, 0, 0, null, true, 'emma', 'Growth Team', 'updates', null, 'completed', 'high'],
  ['review', 'Design Review', 'Autumn launch assets', 3, 13, 0, 60, false, 'noah', 'Design Team', 'launch', null, 'scheduled', 'medium'],
  ['launch', 'Launch Day', 'Website and email go live', 4, 0, 0, null, true, 'sophia', 'Growth Team', 'launch', null, 'scheduled', 'high'],
  ['meeting', 'Confirm Webinar Speakers', 'Customer education series', 5, 11, 0, 30, false, 'emma', 'Content Team', 'leadership', null, 'scheduled', 'medium'],
  ['milestone', 'Monthly Report', 'Performance review for leadership', 10, 10, 0, null, false, 'you', 'Analytics Team', null, null, 'scheduled', 'medium'],
  ['holiday', 'Bank Holiday', 'Office closed', 11, 0, 0, null, true, 'you', null, null, null, 'scheduled', 'low'],
  ['meeting', 'Content Planning', 'Plan next month’s calendar', 1, 10, 0, 60, false, 'emma', 'Content Team', null, null, 'scheduled', 'medium'],
  ['event', 'Survey Email', 'Customer satisfaction survey', 9, 15, 0, null, false, 'emma', 'Content Team', 'stories', null, 'scheduled', 'low'],
  ['meeting', 'Stakeholder Sync', 'Autumn launch go/no-go', 2, 11, 0, 45, false, 'sophia', 'Marketing Team', 'launch', null, 'scheduled', 'high'],
  ['event', 'Ad Set Review', 'Paid social optimisation', 1, 9, 0, 60, false, 'liam', 'Growth Team', 'awareness', null, 'scheduled', 'medium'],
]

// title, description, campaign, day, hh, status, priority, assignee
const TASKS = [
  ['Approve Ad Copy', 'Retargeting Ad Campaign', 'awareness', 0, 17, 'review', 'high', 'sophia'],
  ['Publish Press Release', 'Product Launch', 'updates', 0, 19, 'in_progress', 'high', 'emma'],
  ['Review ad creative', 'Autumn Launch assets', 'launch', 0, 20, 'review', 'high', 'noah'],
  ['Finalise landing page', 'Autumn Launch 2026', 'launch', 0, 21, 'in_progress', 'medium', 'liam'],
  ['Blog post draft', 'Content Team', 'leadership', 0, 17, 'todo', 'medium', 'mason'],
  ['Weekly report', 'Analytics Team', 'engagement', 0, 17, 'todo', 'low', 'liam'],
  ['Send campaign brief', 'Customer Stories', 'stories', 1, 12, 'todo', 'medium', 'sophia'],
  ['Check performance alerts', 'Paid Social', 'awareness', 1, 13, 'todo', 'medium', 'liam'],
  ['Schedule LinkedIn Article', 'Thought Leadership', 'leadership', 2, 11, 'todo', 'low', 'liam'],
  ['Record product walkthrough', 'Product Updates', 'updates', -2, 15, 'in_progress', 'high', 'james'],
  ['Update brand guidelines', 'Brand Awareness Q3', 'awareness', -3, 12, 'todo', 'medium', 'olivia'],
  ['Edit event recap video', 'Customer Stories', 'stories', 3, 16, 'todo', 'medium', 'james'],
  ['Prepare giveaway terms', 'Giveaway: Win Big', 'giveaway', 1, 15, 'review', 'high', 'sophia'],
  ['Design social banners', 'Autumn Launch 2026', 'launch', 2, 14, 'todo', 'medium', 'olivia'],
  ['Write email sequence', 'Autumn Launch 2026', 'launch', 3, 11, 'todo', 'medium', 'mason'],
  ['Brief influencers', 'Autumn Launch 2026', 'launch', 4, 10, 'todo', 'high', 'ava'],
]

// type, severity, impact, title, description, channels, campaign, day, hh, allDay, owner, assignee, dueDay, status, recs, links(titles)
const CONFLICTS = [
  ['overlap_collision', 'high', 'high', 'Influencer Launch Overlap', 'Two influencer posts scheduled within 1 hour on Instagram.', ['instagram'], 'launch', 12, 10, false, 'emma', 'emma', 11, 'in_progress',
    [{ id: 'reschedule', label: 'Reschedule one of the influencer posts', action: 'reschedule' }, { id: 'space', label: 'Allow at least 2 hours between posts', action: 'space_posts' }],
    ['Influencer Collab', 'Influencer Collab #2']],
  ['capacity_clash', 'high', 'high', 'Video Editor Capacity Clash', 'Video editor overbooked with 3 deliverables on the same day.', ['youtube'], 'updates', 13, 0, true, 'liam', 'james', 12, 'open',
    [{ id: 'reassign', label: 'Reassign one deliverable to another editor', action: 'reassign' }, { id: 'extend', label: 'Extend the lowest-priority deadline', action: 'extend_deadline' }],
    ['Product Explainer Video']],
  ['approval_delay', 'medium', 'medium', 'Approval Delay Risk', 'Blog post awaiting legal approval beyond SLA.', ['linkedin'], 'leadership', 1, 9, false, 'sophia', 'sophia', 0, 'open',
    [{ id: 'extend', label: 'Extend the approval deadline', action: 'extend_deadline' }, { id: 'reschedule', label: 'Move the publish slot after approval', action: 'reschedule' }],
    ['LinkedIn Article: Trends']],
  ['duplicate_slot', 'medium', 'medium', 'Duplicate Publish Slot', 'Two posts scheduled for the same time slot on Facebook.', ['facebook'], 'engagement', 1, 11, false, 'noah', 'noah', 1, 'in_progress',
    [{ id: 'cancel', label: 'Cancel the duplicate queue item', action: 'cancel_duplicate' }, { id: 'reschedule', label: 'Move one post to the next free slot', action: 'reschedule' }],
    ['Facebook Ad']],
  ['capacity_clash', 'low', 'low', 'Resource Bottleneck', 'Design team at capacity with 5 tasks on the same day.', ['instagram'], 'launch', 2, 0, true, 'olivia', 'olivia', 2, 'open',
    [{ id: 'reassign', label: 'Rebalance tasks across the design team', action: 'reassign' }],
    ['Design social banners']],
  ['blocked_dependency', 'low', 'low', 'Blocked Dependency', 'Event recap video blocked by missing footage.', ['youtube'], 'stories', 3, 0, true, 'james', 'james', 3, 'open',
    [{ id: 'extend', label: 'Extend the recap deadline until footage arrives', action: 'extend_deadline' }],
    ['Edit event recap video']],
  ['channel_saturation', 'medium', 'medium', 'Channel Overlap', 'Too many posts on Instagram in one day — 4 items scheduled.', ['instagram'], 'awareness', 1, 0, true, 'emma', 'emma', 1, 'open',
    [{ id: 'reschedule', label: 'Spread posts across the week', action: 'reschedule' }],
    ['Giveaway: Win Big', 'Brand Awareness Reel']],
  ['launch_collision', 'high', 'high', 'Launch Day Collision', 'Campaign launch and product update both go live the same morning.', ['linkedin', 'instagram'], 'launch', 4, 9, false, 'liam', 'sophia', 3, 'open',
    [{ id: 'reschedule', label: 'Move the product update to the following day', action: 'reschedule' }],
    ['Campaign Launch']],
  ['approval_delay', 'medium', 'medium', 'Approval Bottleneck', '2 approvals due at the same time for the Design Team.', ['facebook'], 'awareness', 0, 14, false, 'noah', 'noah', 0, 'open',
    [{ id: 'extend', label: 'Stagger approval deadlines', action: 'extend_deadline' }],
    ['Approval Checkpoint']],
  ['overlap_collision', 'low', 'low', 'Team Resource Conflict', 'Liam Chen is overbooked — 2 overlapping items.', ['linkedin'], 'awareness', 1, 9, false, 'liam', 'liam', 1, 'open',
    [{ id: 'reassign', label: 'Reassign the ad set review', action: 'reassign' }],
    ['Ad Set Review']],
  // Resolved history (drives "Resolved this week" + resolution activity)
  ['capacity_clash', 'medium', 'medium', 'Copywriter Overload', 'Three long-form drafts due on one day.', ['linkedin'], 'leadership', -4, 0, true, 'mason', 'mason', -4, 'resolved', [], []],
  ['duplicate_slot', 'low', 'low', 'Newsletter Double Send', 'Two newsletters scheduled for the same slot.', ['linkedin'], 'updates', -5, 9, false, 'emma', 'emma', -5, 'resolved', [], []],
  ['blocked_dependency', 'low', 'low', 'Missing Product Shots', 'Carousel blocked by missing product photography.', ['instagram'], 'awareness', -6, 0, true, 'olivia', 'olivia', -6, 'resolved', [], []],
]

// ---------------------------------------------------------------- helpers
async function ensureTeammates(workspaceId) {
  const ids = {}
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  for (const mate of TEAMMATES) {
    const email = `${mate.key}.demo@captionfox-demo.invalid`
    let user = list.users.find(u => u.email === email)
    if (!user) {
      const { data, error: createError } = await admin.auth.admin.createUser({
        email, email_confirm: true, password: randomUUID(),
        user_metadata: { full_name: mate.name, demo: true },
      })
      if (createError) throw createError
      user = data.user
    }
    ids[mate.key] = user.id
    await admin.from('profiles').upsert({ id: user.id, email, full_name: mate.name, job_title: mate.title, onboarding_completed: true })
    await admin.from('workspace_members').upsert(
      { workspace_id: workspaceId, user_id: user.id, role: mate.role, joined_at: new Date().toISOString(), permissions: { demo: true } },
      { onConflict: 'workspace_id,user_id' },
    )
  }
  return ids
}

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function cleanup(workspaceId) {
  const { data: demoCampaigns } = await admin.from('campaigns').select('id').eq('workspace_id', workspaceId).contains('tags', [DEMO_TAG])
  const campaignIds = (demoCampaigns ?? []).map(c => c.id)
  await admin.from('calendar_conflicts').delete().eq('workspace_id', workspaceId).eq('metadata->>demo', 'true')
  await admin.from('calendar_items').delete().eq('workspace_id', workspaceId).eq('metadata->>demo', 'true')
  await admin.from('audit_logs').delete().eq('workspace_id', workspaceId).like('action', 'calendar.%').eq('metadata->>demo', 'true')
  await admin.from('publishing_queue').delete().eq('workspace_id', workspaceId).eq('is_demo', true)
  const { data: demoPosts } = await admin.from('content_posts').select('id').eq('workspace_id', workspaceId).eq('is_demo', true).contains('tags', [DEMO_TAG])
  const postIds = (demoPosts ?? []).map(p => p.id)
  if (postIds.length) {
    await admin.from('approvals').delete().in('post_id', postIds)
    await admin.from('content_posts').delete().in('id', postIds)
  }
  if (campaignIds.length) {
    await admin.from('campaign_tasks').delete().in('campaign_id', campaignIds)
    await admin.from('campaigns').delete().in('id', campaignIds)
  }
  await admin.from('social_channels').delete().eq('workspace_id', workspaceId).eq('is_demo', true).eq('team_label', DEMO_TAG)
}

async function seedWorkspace(workspaceId) {
  const { data: workspace } = await admin.from('workspaces').select('id, name, owner_id, type').eq('id', workspaceId).single()
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)
  console.log(`\n→ ${workspace.name} (${workspace.type})`)

  await cleanup(workspaceId)
  const people = { you: workspace.owner_id, ...(await ensureTeammates(workspaceId)) }

  // Channels -----------------------------------------------------------------
  const { data: existingChannels } = await admin.from('social_channels').select('id, platform').eq('workspace_id', workspaceId)
  const channelByPlatform = Object.fromEntries((existingChannels ?? []).map(c => [c.platform, c.id]))
  const missing = CHANNELS.filter(c => !channelByPlatform[c.platform])
  if (missing.length) {
    const rows = await must(admin.from('social_channels').insert(missing.map(c => ({
      workspace_id: workspaceId, platform: c.platform, account_name: c.name, handle: c.handle,
      is_active: true, connected_at: minsAgo(60 * 24 * 30), health: 'healthy', token_status: 'valid',
      permission_mode: 'read_write', is_demo: true, team_label: DEMO_TAG, connected_by: workspace.owner_id,
    }))).select('id, platform'), 'channels')
    for (const row of rows) channelByPlatform[row.platform] = row.id
  }

  // Campaigns ----------------------------------------------------------------
  const campaignRows = await must(admin.from('campaigns').insert(CAMPAIGNS.map(c => ({
    workspace_id: workspaceId, name: c.name, status: 'active', priority: c.priority,
    start_date: dateOnly(c.start), end_date: dateOnly(c.end), launch_date: dateOnly(c.start),
    created_by: workspace.owner_id, owner_id: workspace.owner_id, tags: [DEMO_TAG],
  }))).select('id, name'), 'campaigns')
  const campaignId = Object.fromEntries(CAMPAIGNS.map(c => [c.key, campaignRows.find(r => r.name === c.name).id]))

  // Posts --------------------------------------------------------------------
  const postRows = await must(admin.from('content_posts').insert(POSTS.map(([title, channel, campaign, day, hh, mm, status, postType, owner]) => ({
    workspace_id: workspaceId, title, caption: `${title} — ${CAMPAIGNS.find(c => c.key === campaign).name}`,
    platforms: [channel], channel_id: channelByPlatform[channel], post_type: postType, status,
    scheduled_at: at(day, hh, mm), published_at: status === 'published' ? at(day, hh, mm) : null,
    campaign_id: campaignId[campaign], created_by: people[owner], owner_id: people[owner],
    approval_required: status === 'pending_approval', timezone: TZ, is_demo: true, tags: [DEMO_TAG], source: 'manual',
  }))).select('id, title, scheduled_at, campaign_id, owner_id, channel_id, platforms'), 'posts')
  const postByTitle = Object.fromEntries(postRows.map(p => [p.title, p]))

  const overduePosts = await must(admin.from('content_posts').insert(OVERDUE.map(([title, channel, campaign, lateMin, , , owner]) => ({
    workspace_id: workspaceId, title, caption: title, platforms: [channel], channel_id: channelByPlatform[channel],
    post_type: 'post', status: 'scheduled', scheduled_at: minsAgo(lateMin), campaign_id: campaignId[campaign],
    created_by: people[owner], owner_id: people[owner], timezone: TZ, is_demo: true, tags: [DEMO_TAG], source: 'manual',
  }))).select('id, title'), 'overdue posts')

  // Approvals for pending posts
  const pending = POSTS.filter(p => p[6] === 'pending_approval')
  await must(admin.from('approvals').insert(pending.map(p => ({
    workspace_id: workspaceId, post_id: postByTitle[p[0]].id, requested_by: people[p[8]], status: 'pending',
  }))), 'approvals')

  // Publishing queue ---------------------------------------------------------
  const queueRows = []
  for (const [title, spec] of Object.entries(QUEUE)) {
    const post = postByTitle[title]
    const scheduled = post.scheduled_at
    queueRows.push({
      workspace_id: workspaceId, post_id: post.id, channel_id: post.channel_id, provider_account_id: post.channel_id,
      provider: post.platforms[0], campaign_id: post.campaign_id, owner_id: post.owner_id, created_by: post.owner_id,
      scheduled_at: scheduled, sla_due_at: scheduled, status: spec.status, approval_status: spec.approval, priority: spec.priority,
      attempt_count: spec.status === 'published' ? 1 : spec.attempts ?? 0,
      last_attempt_at: spec.status === 'published' || spec.status === 'failed' ? scheduled : null,
      published_at: spec.status === 'published' ? new Date(new Date(scheduled).getTime() + (spec.lateMin ?? 0) * 60000).toISOString() : null,
      error_message: spec.failure ?? null, failure_code: spec.code ?? null,
      idempotency_key: `demo:${post.id}`, is_demo: true,
    })
  }
  OVERDUE.forEach(([title, channel, campaign, lateMin, status, priority, owner, failure, code]) => {
    const post = overduePosts.find(p => p.title === title)
    queueRows.push({
      workspace_id: workspaceId, post_id: post.id, channel_id: channelByPlatform[channel], provider_account_id: channelByPlatform[channel],
      provider: channel, campaign_id: campaignId[campaign], owner_id: people[owner], created_by: people[owner],
      scheduled_at: minsAgo(lateMin), sla_due_at: minsAgo(lateMin), status, approval_status: 'approved', priority,
      attempt_count: status === 'failed' ? 3 : 0, last_attempt_at: status === 'failed' ? minsAgo(lateMin - 5) : null,
      error_message: failure, failure_code: code, idempotency_key: `demo:${post.id}`, is_demo: true,
    })
  })
  const queued = await must(admin.from('publishing_queue').insert(queueRows).select('id, post_id'), 'queue')
  const queueIdByPost = Object.fromEntries(queued.map(q => [q.post_id, q.id]))

  // Calendar items -----------------------------------------------------------
  const itemRows = await must(admin.from('calendar_items').insert(ITEMS.map(([type, title, description, day, hh, mm, duration, allDay, owner, team, campaign, channel, status, priority]) => ({
    workspace_id: workspaceId, item_type: type, title, description,
    start_at: allDay ? at(day, 0, 0) : at(day, hh, mm),
    end_at: duration ? new Date(new Date(at(day, hh, mm)).getTime() + duration * 60000).toISOString() : null,
    all_day: allDay, timezone: TZ, status, priority, channel, team,
    campaign_id: campaign ? campaignId[campaign] : null, owner_id: people[owner],
    source: 'manual', created_by: people[owner], metadata: { demo: true },
  }))).select('id, title'), 'items')
  const itemByTitle = Object.fromEntries(itemRows.map(i => [i.title, i.id]))

  // Tasks --------------------------------------------------------------------
  const taskRows = await must(admin.from('campaign_tasks').insert(TASKS.map(([title, description, campaign, day, hh, status, priority, assignee]) => ({
    workspace_id: workspaceId, campaign_id: campaignId[campaign], title, description, status, priority,
    due_date: at(day, hh, 0), assigned_to: people[assignee], created_by: workspace.owner_id,
  }))).select('id, title'), 'tasks')
  const taskByTitle = Object.fromEntries(taskRows.map(t => [t.title, t.id]))

  // Conflicts ----------------------------------------------------------------
  let n = 0
  for (const [type, severity, impact, title, description, channels, campaign, day, hh, allDay, owner, assignee, dueDay, status, recs, links] of CONFLICTS) {
    n += 1
    const detectedAt = status === 'resolved' ? at(day - 1, 8, 0) : minsAgo(60 * (n * 7))
    const [conflict] = await must(admin.from('calendar_conflicts').insert({
      workspace_id: workspaceId, reference: `CONF-${String(100 - n).padStart(3, '0')}`, conflict_type: type, severity, impact,
      title, description, status, channels, campaign_id: campaignId[campaign],
      detected_at: detectedAt, start_at: allDay ? at(day, 0, 0) : at(day, hh, 0), due_at: at(dueDay, 17, 0),
      owner_id: people[owner], assignee_id: people[assignee], recommendations: recs,
      resolution_notes: status === 'resolved' ? 'Rescheduled and rebalanced across the team.' : null,
      resolved_at: status === 'resolved' ? at(day, 12, 0) : null, resolved_by: status === 'resolved' ? people[assignee] : null,
      signature: `demo:${workspaceId}:${n}`, metadata: { demo: true },
    }).select('id, reference'), `conflict ${title}`)

    const records = [{ conflict_id: conflict.id, workspace_id: workspaceId, record_kind: 'campaign', record_id: campaignId[campaign], label: CAMPAIGNS.find(c => c.key === campaign).name }]
    for (const label of links) {
      if (postByTitle[label]) {
        records.push({ conflict_id: conflict.id, workspace_id: workspaceId, record_kind: 'content_post', record_id: postByTitle[label].id, label: `Post: ${label}` })
        const job = queueIdByPost[postByTitle[label].id]
        if (job) records.push({ conflict_id: conflict.id, workspace_id: workspaceId, record_kind: 'publishing_job', record_id: job, label: `Queue: ${label}` })
      } else if (itemByTitle[label]) {
        records.push({ conflict_id: conflict.id, workspace_id: workspaceId, record_kind: 'calendar_item', record_id: itemByTitle[label], label })
      } else if (taskByTitle[label]) {
        records.push({ conflict_id: conflict.id, workspace_id: workspaceId, record_kind: 'task', record_id: taskByTitle[label], label: `Task: ${label}` })
      }
    }
    await must(admin.from('calendar_conflict_records').insert(records), 'conflict records')

    const activity = [{ conflict_id: conflict.id, workspace_id: workspaceId, actor_id: null, action: 'detected', summary: `${title} detected`, created_at: detectedAt }]
    if (status === 'in_progress') activity.push({ conflict_id: conflict.id, workspace_id: workspaceId, actor_id: people[owner], action: 'assigned', summary: `${title} assigned to ${TEAMMATES.find(t => t.key === assignee)?.name ?? 'owner'}`, created_at: minsAgo(60 * n) })
    if (status === 'resolved') activity.push({ conflict_id: conflict.id, workspace_id: workspaceId, actor_id: people[assignee], action: 'resolved', summary: `${title} marked as resolved`, created_at: at(day, 12, 0) })
    await must(admin.from('calendar_conflict_activity').insert(activity), 'conflict activity')

    for (const record of records.filter(r => r.record_kind !== 'campaign')) void record
  }

  // Activity feed (audit_logs, calendar.* actions) ---------------------------
  const audit = [
    ['queue_approved', 'publishing_job', 'Product Update v2.1', 'liam', 15],
    ['queue_published', 'publishing_job', 'Instagram Post', 'emma', 60],
    ['conflict_detected', 'calendar_conflict', 'Influencer Launch Overlap', null, 120],
    ['item_updated', 'calendar_item', 'Design Review', 'noah', 180],
    ['queue_queued', 'publishing_job', 'Giveaway: Win Big', 'sophia', 200],
    ['queue_failed', 'publishing_job', 'Promo Code Reminder', null, 130],
    ['item_created', 'calendar_item', 'Stakeholder Sync', 'sophia', 240],
    ['queue_published', 'publishing_job', 'Brand Awareness Post', 'liam', 300],
  ]
  await must(admin.from('audit_logs').insert(audit.map(([action, type, title, actor, ago]) => ({
    workspace_id: workspaceId, actor_id: actor ? people[actor] : null, action: `calendar.${action}`,
    resource_type: type, resource_id: null, created_at: minsAgo(ago),
    metadata: { title, demo: true, source_route: '/calendar' },
  }))), 'audit')

  console.log(`  ${postRows.length + overduePosts.length} posts · ${queued.length} queue jobs · ${itemRows.length} items · ${taskRows.length} tasks · ${CONFLICTS.length} conflicts`)
}

const targets = process.argv.slice(2)
if (!targets.length) {
  console.error('Usage: node scripts/seed-calendar-demo.mjs <workspace_id> [...]')
  process.exit(1)
}
for (const id of targets) await seedWorkspace(id)
console.log('\nCalendar demo seed complete.')
