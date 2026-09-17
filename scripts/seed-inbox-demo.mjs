// Seeds the Inbox + Fox AI Copilot demo data for one demo workspace.
//
//   python scripts/render-inbox-seed-media.py        # once, renders media
//   node scripts/seed-inbox-demo.mjs [workspaceId]   # defaults to the Brand demo workspace
//
// Everything written here is marked demo (is_demo / external_thread_id prefix /
// source 'inbox-demo') and the script first deletes its own previous output, so
// it is safe to re-run. Timestamps are relative to "now" so SLA countdowns,
// "2m ago" labels and due dates stay live. Media goes to the private R2 bucket.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const WS = process.argv[2] ?? 'd7b7c61e-7685-4b15-8a0c-d9fa85f25103'
const MARK = 'inbox-demo:'
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const s3 = new S3Client({
  region: 'auto', endpoint: new URL(env.CLOUDFLARE_R2_S3_API).origin,
  credentials: { accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS },
})
const MEDIA = path.join('supabase', 'seed-media', 'inbox')

const now = Date.now()
const ago = mins => new Date(now - mins * 60_000).toISOString()
const ahead = mins => new Date(now + mins * 60_000).toISOString()
const must = (label, res) => { if (res.error) throw new Error(`${label}: ${res.error.message}`); return res.data }

// Deterministic PRNG so repeated runs produce the same demo.
let seed = 20260917
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = list => list[Math.floor(rand() * list.length)]

// ------------------------------------------------------------------ media
async function put(key, file, ContentType) {
  await s3.send(new PutObjectCommand({ Bucket: env.CLOUDFLARE_S3_BUCKET, Key: key, Body: fs.readFileSync(path.join(MEDIA, file)), ContentType, CacheControl: 'private, max-age=86400' }))
  return `r2:${key}`
}
const avatars = {}
for (const file of fs.readdirSync(path.join(MEDIA, 'avatars'))) {
  avatars[file.replace('.jpg', '')] = await put(`inbox/${WS}/demo/avatars/${file}`, `avatars/${file}`, 'image/jpeg')
}
const slugOf = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const avatarFor = name => avatars[slugOf(name)] ?? null
console.log('media: avatars', Object.keys(avatars).length)

// ------------------------------------------------------------------ people
const members = must('members', await db.from('workspace_members').select('user_id, role, profile:profiles!workspace_members_user_id_fkey(full_name)').eq('workspace_id', WS))
const person = Object.fromEntries(members.map(m => [m.profile?.full_name, m.user_id]))
const ownerId = must('workspace', await db.from('workspaces').select('owner_id').eq('id', WS).single()).owner_id
const P = name => { const id = person[name]; if (!id) throw new Error(`member missing: ${name}`); return id }

// ------------------------------------------------------------------ cleanup
const oldThreads = must('old threads', await db.from('inbox_threads').select('id').eq('workspace_id', WS).like('external_thread_id', `${MARK}%`))
for (let i = 0; i < oldThreads.length; i += 100) {
  must('delete threads', await db.from('inbox_threads').delete().in('id', oldThreads.slice(i, i + 100).map(t => t.id)))
}
for (const table of ['messaging_contacts', 'inbox_saved_views', 'inbox_group_chats', 'inbox_queues', 'inbox_routing_rules', 'inbox_teams', 'inbox_sla_policies', 'workspace_alerts', 'media_generation_jobs', 'agent_runs', 'inbox_activity']) {
  must(`cleanup ${table}`, await db.from(table).delete().eq('workspace_id', WS).eq('is_demo', true))
}
must('cleanup tasks', await db.from('campaign_tasks').delete().eq('workspace_id', WS).eq('source', 'inbox-demo'))
must('cleanup posts', await db.from('content_posts').delete().eq('workspace_id', WS).contains('tags', ['inbox-demo']))
must('cleanup assets', await db.from('media_assets').delete().eq('workspace_id', WS).contains('tags', ['inbox-demo']))
must('cleanup generations', await db.from('ai_generations').delete().eq('workspace_id', WS).eq('channel', 'inbox-demo'))
must('cleanup campaign', await db.from('campaigns').delete().eq('workspace_id', WS).contains('tags', ['inbox-demo']))

// ------------------------------------------------------------------ SLA + teams
const policy = must('sla', await db.from('inbox_sla_policies').insert({
  workspace_id: WS, name: 'Standard Support', is_default: true, is_demo: true,
  targets: { urgent: { first: 15, resolve: 240 }, high: { first: 30, resolve: 480 }, normal: { first: 30, resolve: 1440 }, low: { first: 480, resolve: 4320 } },
  business_hours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
}).select('id').single())

const TEAMS = {
  'Support Team': ['Emma Davis', 'Liam Chen', 'Sophia Patel', 'Noah Williams', 'Ava Martinez', 'Michael Chen'],
  'Customer Support': ['Emma Davis', 'Liam Chen', 'Mia Thompson', 'Olivia Martinez'],
  'High Value Support': ['Emma Davis', 'Liam Chen', 'Sophia Patel', 'Noah Williams', 'Ava Martinez', 'Michael Chen', 'Mia Thompson', 'Olivia Martinez', 'Ethan Roberts', 'Mason Lee', 'Sarah Williams', 'Priya Shah'],
  'Billing & Payments': ['Sophia Patel', 'David Martinez', 'Emily Johnson'],
}
const team = {}
for (const [name, people] of Object.entries(TEAMS)) {
  const row = must(`team ${name}`, await db.from('inbox_teams').insert({ workspace_id: WS, name, is_demo: true, is_default: name === 'Support Team', created_by: ownerId }).select('id').single())
  team[name] = row.id
  must(`team members ${name}`, await db.from('inbox_team_members').insert(people.map(p => ({ team_id: row.id, user_id: P(p), workspace_id: WS, capacity: 30, role_label: p === 'Emma Davis' ? 'Support Specialist' : 'Agent' }))))
}

// ------------------------------------------------------------------ contacts
const CONTACTS = [
  // name, email, phone, segment, tags, location, last channel, last activity
  ['Emma Davis', 'emma.davis@email.com', '+1 (415) 555-0123', 'vip', ['High Value', 'Customer'], 'San Francisco, CA, USA', 'email', 'Replied'],
  ['Liam Chen', 'liam.chen@email.com', '+1 (555) 234-5678', 'vip', ['Engaged', 'VIP'], 'Seattle, WA, USA', 'whatsapp', 'Mentioned'],
  ['Sophia Patel', 'sophia.patel@email.com', '+1 (555) 345-6789', 'customer', ['Lead', 'Prospect'], 'Austin, TX, USA', 'email', 'Opened'],
  ['Noah Williams', 'noah.williams@email.com', '+1 (555) 456-7890', 'customer', ['Customer', 'Repeat'], 'Chicago, IL, USA', 'sms', 'Replied'],
  ['Ava Martinez', 'ava.martinez@email.com', '+1 (555) 567-8901', 'follower', ['High Value', 'Influencer'], 'Miami, FL, USA', 'instagram', 'Commented'],
  ['James Thompson', 'james.thompson@email.com', '+1 (555) 678-9012', 'pending', ['Prospect', 'New'], 'Boston, MA, USA', 'x', 'Mentioned'],
  ['Olivia Kim', 'olivia.kim@email.com', '+1 (555) 789-0123', 'customer', ['Engaged', 'Customer'], 'Los Angeles, CA, USA', 'whatsapp', 'Replied'],
  ['Michael Brown', 'michael.brown@email.com', '+1 (555) 890-1234', 'vip', ['Lead', 'VIP'], 'Denver, CO, USA', 'email', 'Opened'],
  ['Isabella Garcia', 'isabella.garcia@email.com', '+1 (555) 901-2345', 'follower', ['Prospect', 'New'], 'Phoenix, AZ, USA', 'instagram', 'Commented'],
  ['Ethan Johnson', 'ethan.johnson@email.com', '+1 (555) 012-3456', 'customer', ['Customer', 'Repeat'], 'Portland, OR, USA', 'sms', 'Replied'],
  ['Jane Cooper', 'jane.cooper@email.com', '+1 (555) 123-4567', 'customer', ['Onboarding'], 'Denver, CO, USA', 'email', 'Replied'],
  ['Robert Fox', 'robert.fox@email.com', '+1 (555) 222-1100', 'customer', ['Customer'], 'Dallas, TX, USA', 'email', 'Replied'],
  ['Marvin McKinney', 'marvin.mckinney@email.com', '+1 (555) 222-1101', 'follower', ['Engaged'], 'Atlanta, GA, USA', 'email', 'Replied'],
  ['Cody Fisher', 'cody.fisher@email.com', '+1 (555) 222-1102', 'customer', ['Billing'], 'San Diego, CA, USA', 'email', 'Replied'],
  ['Darrell Steward', 'darrell.steward@email.com', '+1 (555) 222-1103', 'vip', ['VIP'], 'New York, NY, USA', 'email', 'Replied'],
  ['Dianne Russell', 'dianne.russell@email.com', '+1 (555) 222-1104', 'pending', ['Lead'], 'Nashville, TN, USA', 'email', 'Opened'],
  ['Theresa Webb', 'theresa.webb@email.com', '+1 (555) 222-1105', 'customer', ['Partner'], 'Columbus, OH, USA', 'email', 'Replied'],
  ['Alex Morgan', 'alex.morgan@email.com', '+1 (555) 222-1106', 'customer', ['Customer'], 'Charlotte, NC, USA', 'whatsapp', 'Replied'],
  ['Jordan Lee', 'jordan.lee@email.com', '+1 (555) 222-1107', 'customer', ['Customer'], 'Detroit, MI, USA', 'email', 'Replied'],
  ['Taylor Kim', 'taylor.kim@email.com', '+1 (555) 222-1108', 'follower', ['Student'], 'Madison, WI, USA', 'instagram', 'Commented'],
  ['Casey Nguyen', 'casey.nguyen@email.com', '+1 (555) 222-1109', 'customer', ['Billing'], 'San Jose, CA, USA', 'sms', 'Replied'],
  ['Jamie Patel', 'jamie.patel@email.com', '+1 (555) 222-1110', 'lead', ['Integration'], 'Raleigh, NC, USA', 'email', 'Opened'],
  ['Riley Adams', 'riley.adams@email.com', '+1 (555) 222-1111', 'customer', ['Customer'], 'Tampa, FL, USA', 'whatsapp', 'Replied'],
  ['Morgan Smith', 'morgan.smith@email.com', '+1 (555) 222-1112', 'customer', ['Customer'], 'Omaha, NE, USA', 'live_chat', 'Replied'],
  ['Sam Williams', 'sam.williams@email.com', '+1 (555) 222-1113', 'customer', ['Billing'], 'Tulsa, OK, USA', 'email', 'Replied'],
  ['James Wilson', 'james.wilson@email.com', '+1 (555) 222-1114', 'customer', ['Customer'], 'Richmond, VA, USA', 'email', 'Replied'],
  ['Olivia Brown', 'olivia.brown@email.com', '+1 (555) 222-1115', 'customer', ['Customer'], 'Boise, ID, USA', 'whatsapp', 'Replied'],
  ['Benjamin Lee', 'benjamin.lee@email.com', '+1 (555) 222-1116', 'follower', ['Engaged'], 'Salt Lake City, UT, USA', 'live_chat', 'Replied'],
  ['Emma Thompson', 'emma.thompson@email.com', '+1 (555) 222-1117', 'vip', ['VIP'], 'London, UK', 'email', 'Replied'],
  ['James Anderson', 'james.anderson@email.com', '+1 (555) 222-1118', 'vip', ['VIP'], 'Toronto, Canada', 'email', 'Replied'],
  ['William Taylor', 'william.taylor@email.com', '+1 (555) 222-1119', 'vip', ['VIP'], 'Sydney, Australia', 'whatsapp', 'Replied'],
  ['Matthew Taylor', 'matthew.taylor@email.com', '+1 (555) 222-1120', 'follower', ['Engaged'], 'Leeds, UK', 'youtube', 'Commented'],
  ['Ethan Brown', 'ethan.brown@email.com', '+1 (555) 222-1121', 'customer', ['Customer'], 'Manchester, UK', 'instagram', 'Replied'],
]
const FILLER_FIRST = ['Grace', 'Henry', 'Chloe', 'Lucas', 'Zoe', 'Mason', 'Lily', 'Owen', 'Ella', 'Jack', 'Harper', 'Leo', 'Aria', 'Caleb', 'Nora', 'Isaac', 'Ruby', 'Adam', 'Maya', 'Dylan']
const FILLER_LAST = ['Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins']
const CHANNEL_POOL = ['email', 'email', 'email', 'whatsapp', 'whatsapp', 'sms', 'instagram', 'facebook', 'rcs', 'live_chat']
const usedNames = new Set(CONTACTS.map(c => c[0]))
while (CONTACTS.length < 96) {
  const name = `${pick(FILLER_FIRST)} ${pick(FILLER_LAST)}`
  if (usedNames.has(name)) continue
  usedNames.add(name)
  const handle = name.toLowerCase().replace(' ', '.')
  CONTACTS.push([name, `${handle}@email.com`, `+1 (555) ${300 + CONTACTS.length}-${String(1000 + CONTACTS.length * 7).slice(0, 4)}`,
    pick(['follower', 'customer', 'customer', 'vip', 'pending']), [pick(['Customer', 'Engaged', 'Lead', 'Prospect']), pick(['Repeat', 'New', 'VIP'])],
    pick(['London, UK', 'Bristol, UK', 'Austin, TX, USA', 'Chicago, IL, USA', 'Dublin, Ireland']), pick(CHANNEL_POOL), pick(['Replied', 'Opened', 'Commented', 'Mentioned'])])
}
const contactRows = CONTACTS.map(([name, email, phone, segment, tags, location, lastChannel, lastActivity], i) => ({
  id: randomUUID(), workspace_id: WS, full_name: name, email, phone, segment, tags, location,
  handle: `@${name.toLowerCase().replace(/\s+/g, '.')}`, avatar_url: avatarFor(name),
  whatsapp_id: phone.replace(/[^0-9+]/g, ''), last_channel: lastChannel, last_activity: lastActivity,
  last_activity_at: ago([2, 15, 32, 60, 120, 180, 300, 1440, 1500, 2880][i] ?? 60 * (i + 2)),
  lifetime_value_band: segment === 'vip' ? 'High' : segment === 'customer' ? 'Medium' : 'Low',
  sentiment_trend: pick(['Improving', 'Stable', 'Improving']), source: 'import',
  email_consent: true, sms_consent: true, whatsapp_consent: true, is_demo: true,
  created_at: ago(60 * 24 * (30 + i)),
}))
must('contacts', await db.from('messaging_contacts').insert(contactRows))
const contactId = Object.fromEntries(contactRows.map(c => [c.full_name, c.id]))
console.log('contacts', contactRows.length)

// ------------------------------------------------------------------ conversations
const threads = []
const messages = []
const activity = []
const history = []
const TYPE = platform => (platform === 'email' ? 'email' : 'dm')

/**
 * c: { name, platform, subject?, priority, status, assignee?, team?, tags, sla: 'at_risk'|'breached'|'on_track'|'met',
 *      dueIn (mins, for open first responses), createdAgo, unread, lines: [[who, text, minsAgo]] , snoozed?, closed?, waiting? }
 */
function conversation(c) {
  const id = randomUUID()
  const last = c.lines[c.lines.length - 1]
  const firstOut = c.lines.find(l => l[0] === 'us')
  const lastIn = [...c.lines].reverse().find(l => l[0] === 'them')
  const created = c.createdAgo ?? c.lines[0][2]
  const replied = Boolean(firstOut)
  const requiresReply = last[0] === 'them'
  const firstDue = c.dueIn != null ? ahead(c.dueIn) : new Date(new Date(ago(created)).getTime() + 30 * 60_000).toISOString()
  threads.push({
    id, workspace_id: WS, external_thread_id: `${MARK}${id}`, type: TYPE(c.platform), platform: c.platform,
    sender_name: c.name, sender_handle: CONTACTS.find(x => x[0] === c.name)?.[1] ?? null, sender_avatar: avatarFor(c.name),
    contact_id: contactId[c.name] ?? null, subject: c.subject ?? null, content: c.lines[0][1],
    status: c.closed ? 'resolved' : c.assignee ? 'assigned' : 'open', priority: c.priority ?? 'normal',
    assigned_to: c.assignee ? P(c.assignee) : null, team_id: c.team ? team[c.team] : null,
    tags: c.tags ?? [], sentiment: c.sentiment ?? 'neutral', language: c.language ?? 'en',
    is_read: !c.unread, unread_count: c.unread ?? 0, requires_reply: requiresReply && !c.closed,
    waiting_on_customer: Boolean(c.waiting), escalated_at: c.escalated ? ago(20) : null,
    snoozed_until: c.snoozed ? ahead(c.snoozed) : null, closed_at: c.closed ? ago(last[2] - 1) : null,
    resolved_at: c.closed ? ago(Math.max(0, last[2] - 1)) : null,
    first_response_at: replied ? ago(firstOut[2]) : null, first_response_due_at: firstDue,
    resolution_due_at: c.resolutionDueIn != null ? ahead(c.resolutionDueIn) : ahead(60 * 20),
    sla_policy_id: policy.id, sla_target_minutes: 30,
    sla_state: c.sla === 'breached' ? 'breached' : c.sla === 'at_risk' ? 'warning' : replied ? 'met' : 'on_track',
    suggested_owner_id: c.suggested ? P(c.suggested[0]) : null, suggested_owner_score: c.suggested?.[1] ?? null,
    created_at: ago(created), updated_at: ago(last[2]), last_message_at: ago(lastIn && !replied ? lastIn[2] : last[2]),
    last_message_preview: last[1].slice(0, 200), is_demo: true,
  })
  for (const [who, text, mins, extra] of c.lines) {
    messages.push({
      id: randomUUID(), thread_id: id, workspace_id: WS, content: text,
      sender_type: who === 'them' ? 'external' : 'internal',
      sent_by: who === 'them' ? null : P(extra?.author ?? c.assignee ?? 'Emma Davis'),
      sent_at: ago(mins), is_internal_note: who === 'note', delivery_status: who === 'them' ? 'sent' : 'simulated',
      read_at: who === 'us' && c.read !== false ? ago(Math.max(0, mins - 1)) : null, is_demo: true,
    })
  }
  activity.push({ workspace_id: WS, thread_id: id, actor_id: null, action: 'conversation.opened', summary: 'Conversation opened', created_at: ago(created), is_demo: true })
  if (c.assignee) {
    const assignedAt = Math.max(0, created - 3)
    history.push({ workspace_id: WS, thread_id: id, to_user_id: P(c.assignee), to_team_id: c.team ? team[c.team] : null, actor_id: ownerId, reason: c.byRule ? 'Assigned by routing rule' : null, created_at: ago(assignedAt) })
    activity.push({ workspace_id: WS, thread_id: id, actor_id: c.byRule ? null : ownerId, action: 'conversation.assigned', summary: `Assigned to ${c.assignee}`, metadata: { assignee: c.assignee, by_rule: Boolean(c.byRule) }, created_at: ago(assignedAt), is_demo: true })
  }
  if (replied) activity.push({ workspace_id: WS, thread_id: id, actor_id: c.assignee ? P(c.assignee) : ownerId, action: 'reply.sent', summary: 'First reply sent', created_at: ago(firstOut[2]), is_demo: true })
  if (requiresReply && replied) activity.push({ workspace_id: WS, thread_id: id, actor_id: null, action: 'status.changed', summary: 'Status changed to Awaiting reply', created_at: ago(last[2]), is_demo: true })
  if (c.sla === 'at_risk') activity.push({ workspace_id: WS, thread_id: id, actor_id: null, action: 'sla.at_risk', summary: 'SLA at risk', created_at: ago(1), is_demo: true })
  if (c.priority === 'high') activity.push({ workspace_id: WS, thread_id: id, actor_id: c.assignee ? P(c.assignee) : null, action: 'priority.changed', summary: 'Priority set to High', created_at: ago(Math.max(0, created - 4)), is_demo: true })
  return id
}

// --- Unified hero conversations
const heroEmma = conversation({
  name: 'Emma Davis', platform: 'whatsapp', priority: 'normal', assignee: 'Michael Chen', team: 'Support Team',
  tags: ['Order Inquiry', 'eCommerce', 'VIP'], unread: 2, createdAgo: 25, dueIn: 12,
  lines: [
    ['them', 'Hi! I wanted to check if my order #ACME-10482 has been shipped yet?', 25],
    ['us', 'Hi Emma! \u{1F44B} Let me check the status for you right away.', 22],
    ['them', 'Great, thank you!', 21],
    ['us', 'Good news! Your order was shipped this morning via FedEx and is expected to arrive on Thursday. You’ll receive a tracking link shortly.', 18],
    ['them', 'Perfect, thanks so much! \u{1F60A}', 1],
  ],
})
conversation({ name: 'Liam Chen', platform: 'email', subject: 'Latest pricing', assignee: 'Liam Chen', team: 'Customer Support', tags: ['Sales'], createdAgo: 40, lines: [['them', 'Can you send me the latest pricing for the annual plan?', 40], ['us', 'Of course — I’ve attached our current pricing sheet.', 16]] })
conversation({ name: 'Sophia Patel', platform: 'instagram', priority: 'high', tags: ['product question'], sla: 'at_risk', dueIn: 9, createdAgo: 27, lines: [['them', 'Do you have this in size 9?', 27]] })
conversation({ name: 'Noah Williams', platform: 'live_chat', assignee: 'Noah Williams', team: 'Support Team', tags: ['Support'], createdAgo: 70, lines: [['them', 'The discount code isn’t applying at checkout.', 70], ['us', 'Sorry about that — I’ve refreshed the code, please try again.', 50], ['them', 'Thanks! That helped.', 44]] })
conversation({ name: 'Ava Martinez', platform: 'facebook', assignee: 'Ava Martinez', team: 'Support Team', tags: ['Returns'], unread: 3, dueIn: 25, createdAgo: 72, lines: [['them', 'Is there a return policy for sale items?', 72], ['us', 'Sale items can be returned within 14 days.', 60], ['them', 'Is there a return policy for sale items bought online and in store?', 70]] })
conversation({ name: 'James Wilson', platform: 'email', subject: 'Invoice request', assignee: 'Sophia Patel', team: 'Billing & Payments', tags: ['billing'], createdAgo: 81, lines: [['them', 'Requesting invoice for recent purchase, order #A-8812.', 81], ['us', 'Invoice sent to your inbox — let us know if you need anything else.', 30]] })
conversation({ name: 'Olivia Brown', platform: 'whatsapp', tags: ['delivery'], sla: 'at_risk', dueIn: 14, createdAgo: 97, lines: [['them', 'Can I change my delivery address before it ships?', 97]] })
conversation({ name: 'Benjamin Lee', platform: 'live_chat', assignee: 'Liam Chen', team: 'Customer Support', tags: ['product question'], createdAgo: 114, lines: [['them', 'Product out of stock?', 114], ['us', 'It’s back in stock on Friday — want a restock alert?', 90]] })

// --- Assignments hero conversations
conversation({
  name: 'Jane Cooper', platform: 'email', subject: 'Welcome Series question', priority: 'high', assignee: 'Emma Davis', team: 'Customer Support',
  tags: ['Welcome Series', 'Onboarding'], sla: 'at_risk', createdAgo: 8, dueIn: 138, resolutionDueIn: 138, byRule: true, unread: 1,
  lines: [
    ['them', 'Hi! I’m not receiving the welcome emails after signing up. Can you help?', 8],
    ['note', 'This conversation was assigned to Emma Davis by rule.', 7, { author: 'Emma Davis' }],
    ['us', 'Hi Jane! Thanks for reaching out. I’ll check this for you right away.', 6, { author: 'Emma Davis' }],
    ['them', 'Great, thank you!', 5],
    ['note', 'Customer added to onboarding list but welcome email status shows ‘bounce’. Investigating email deliverability.', 4, { author: 'Emma Davis' }],
  ],
})
conversation({ name: 'Robert Fox', platform: 'email', subject: 'Product return request', priority: 'normal', assignee: 'Emma Davis', team: 'Customer Support', tags: ['Returns'], waiting: true, createdAgo: 15, lines: [['them', 'I’d like to return the shoes I ordered, they’re too small.', 18], ['us', 'Happy to help — can you confirm your order number?', 15]] })
conversation({ name: 'Marvin McKinney', platform: 'email', subject: 'Campaign feedback', priority: 'low', assignee: 'Emma Davis', team: 'Customer Support', tags: ['Feedback'], createdAgo: 32, lines: [['them', 'Great campaign! A couple of thoughts on the landing page.', 32]] })
conversation({ name: 'Cody Fisher', platform: 'email', subject: 'Payment not going through', priority: 'high', assignee: 'Emma Davis', team: 'Billing & Payments', tags: ['billing'], createdAgo: 60, dueIn: 40, lines: [['them', 'My payment is failing with an error at checkout.', 60]] })
conversation({ name: 'Darrell Steward', platform: 'email', subject: 'VIP: Early access invite', priority: 'normal', assignee: 'Emma Davis', team: 'High Value Support', tags: ['VIP'], sla: 'at_risk', dueIn: 18, createdAgo: 120, lines: [['them', 'Just checking if early access is still available for members?', 120]] })
conversation({ name: 'Dianne Russell', platform: 'email', subject: 'Bulk order inquiry', priority: 'low', assignee: 'Emma Davis', team: 'Customer Support', tags: ['Sales'], waiting: true, createdAgo: 180, lines: [['them', 'Do you offer discounts for bulk orders?', 190], ['us', 'We do — how many units are you looking for?', 180]] })
conversation({ name: 'Theresa Webb', platform: 'email', subject: 'Integration help', priority: 'normal', assignee: 'Emma Davis', team: 'Customer Support', tags: ['partner'], createdAgo: 240, lines: [['them', 'Need help connecting via API to our warehouse system.', 240]] })

// --- Unassigned hero conversations
conversation({
  name: 'Alex Morgan', platform: 'whatsapp', priority: 'high', tags: ['delivery', 'order status'], sla: 'at_risk', dueIn: 13, createdAgo: 12,
  suggested: ['Emma Davis', 98], sentiment: 'negative',
  lines: [
    ['them', 'Hi, I placed an order 5 days ago and haven’t received any updates. Can you help?', 12],
    ['us', 'Hi Alex! I’m sorry about the delay. I’d be happy to look into this for you. Can you share your order number?', 11, { author: 'Liam Chen' }],
    ['them', 'Sure, it’s #AM-8427', 10],
    ['us', 'Thanks! One moment please.', 9, { author: 'Liam Chen' }],
    ['them', 'Hi, I placed an order 5 days ago and haven’t received any updates.', 2],
  ],
})
conversation({ name: 'Jordan Lee', platform: 'email', tags: ['delivery'], sla: 'breached', dueIn: -12, createdAgo: 45, suggested: ['Liam Chen', 91], lines: [['them', 'Can I update my delivery address?', 45]] })
conversation({ name: 'Taylor Kim', platform: 'instagram', priority: 'high', tags: ['product question'], dueIn: 20, createdAgo: 30, suggested: ['Sophia Patel', 88], lines: [['them', 'Do you offer student discounts? I’m trying to order for my class.', 30]] })
conversation({ name: 'Casey Nguyen', platform: 'sms', tags: ['billing issue', 'refund'], dueIn: 25, createdAgo: 35, suggested: ['Sophia Patel', 94], lines: [['them', 'I was charged twice for my order #12345', 35]] })
conversation({ name: 'Jamie Patel', platform: 'email', tags: ['technical'], createdAgo: 60, dueIn: 45, suggested: ['Noah Williams', 82], lines: [['them', 'Need help integrating with Shopify', 60]] })
conversation({ name: 'Riley Adams', platform: 'whatsapp', tags: ['order status', 'delivery'], createdAgo: 62, dueIn: 50, suggested: ['Emma Davis', 90], lines: [['them', 'Where is my order? Tracking hasn’t updated.', 62]] })
conversation({ name: 'Morgan Smith', platform: 'live_chat', tags: ['product question'], createdAgo: 120, dueIn: 90, lines: [['them', 'Thanks! That worked \u{1F603}', 120]] })
conversation({ name: 'Sam Williams', platform: 'email', tags: ['billing issue'], createdAgo: 180, dueIn: 120, suggested: ['Sophia Patel', 86], lines: [['them', 'Requesting invoice for last month', 180]] })

// --- Saved-view (high value) conversations
const VIP = [
  ['Emma Thompson', 'email', 'Issue with recent order #A12345', 'high', 12, 'Emma Davis', 2],
  ['Liam Chen', 'whatsapp', 'Need help with account upgrade', 'high', 18, 'Michael Chen', 1],
  ['Sophia Patel', 'email', 'Refund not processed', 'high', 27, 'Emma Davis', 3],
  ['Noah Williams', 'instagram', 'Question about pricing plans', 'normal', 35, 'Liam Chen', 1],
  ['Ava Martinez', 'whatsapp', 'Can’t access premium feature', 'normal', 42, 'Sophia Patel', 2],
  ['James Anderson', 'email', 'Custom integration support', 'high', 60, 'Noah Williams', 4],
  ['Olivia Brown', 'live_chat', 'Billing discrepancy', 'high', 64, 'Ava Martinez', 1],
  ['William Taylor', 'whatsapp', 'Enterprise plan renewal', 'normal', 120, 'Emma Davis', 2],
]
for (const [name, platform, subject, priority, mins, assignee, msgs] of VIP) {
  const lines = [['them', subject, mins + 30]]
  for (let i = 1; i < msgs; i++) lines.push([i % 2 ? 'us' : 'them', i % 2 ? 'Thanks for flagging — we’re on it.' : 'Any update on this?', mins + 30 - i * 5, { author: assignee }])
  lines.push(['them', subject, mins])
  conversation({ name, platform, subject, priority, assignee, team: 'High Value Support', tags: ['VIP'], sla: priority === 'high' ? 'at_risk' : 'on_track', dueIn: priority === 'high' ? 20 : 90, createdAgo: mins + 30, lines })
}

// --- Filler volume across every channel so counts, workload and pagination are real
const TOPICS = [
  ['Where is my order? It was due yesterday.', 'delivery', 'Order Inquiry'],
  ['Can I get a refund for a damaged item?', 'refund', 'Returns'],
  ['How do I reset my password?', 'technical', 'Support'],
  ['Do you ship internationally?', 'product question', 'Shipping'],
  ['My discount code isn’t working.', 'billing issue', 'Promotions'],
  ['Can I change the size on my order?', 'order status', 'Order Inquiry'],
  ['Is this available in blue?', 'product question', 'eCommerce'],
  ['I’d like to cancel my subscription.', 'billing issue', 'Billing'],
  ['The app keeps logging me out.', 'technical', 'Support'],
  ['When will the new collection launch?', 'product question', 'Marketing'],
]
const ASSIGNEES = [
  ...Array(12).fill('Emma Davis'), ...Array(11).fill('Liam Chen'), ...Array(8).fill('Sophia Patel'),
  ...Array(6).fill('Noah Williams'), ...Array(4).fill('Ava Martinez'), ...Array(8).fill('Jamahl Thomas'),
  ...Array(14).fill(null),
]
const fillerNames = CONTACTS.slice(33).map(c => c[0])
for (let i = 0; i < ASSIGNEES.length + 18; i++) {
  const [text, tag, tag2] = TOPICS[i % TOPICS.length]
  const assignee = ASSIGNEES[i] ?? null
  const closed = i >= ASSIGNEES.length
  const snoozed = !closed && i % 13 === 5
  const mins = 130 + i * 37
  const platform = CHANNEL_POOL[i % CHANNEL_POOL.length]
  const replied = i % 3 !== 0 || closed
  const lines = [['them', text, mins + 20]]
  if (replied) lines.push(['us', 'Thanks for getting in touch — let me look into that for you.', mins + 8, { author: assignee ?? 'Emma Davis' }])
  if (i % 4 === 1 && !closed) lines.push(['them', 'Any update?', mins])
  conversation({
    name: fillerNames[i % fillerNames.length], platform, subject: platform === 'email' ? text.replace(/[?.!]$/, '') : null,
    priority: i % 7 === 0 ? 'high' : i % 5 === 0 ? 'low' : 'normal', assignee, team: assignee ? pick(['Support Team', 'Customer Support']) : null,
    tags: [tag, tag2], sla: closed ? 'met' : i % 9 === 2 ? 'at_risk' : i % 11 === 3 ? 'breached' : 'on_track',
    dueIn: replied ? null : i % 9 === 2 ? 22 : i % 11 === 3 ? -30 : 60 + i, waiting: replied && !closed && i % 4 !== 1,
    escalated: i % 17 === 4, snoozed: snoozed ? 240 : null, closed, createdAgo: mins + 20,
    unread: i % 4 === 1 && !closed ? 1 : 0, lines,
  })
}

for (let i = 0; i < threads.length; i += 100) must('threads', await db.from('inbox_threads').insert(threads.slice(i, i + 100)))
for (let i = 0; i < messages.length; i += 200) must('messages', await db.from('inbox_messages').insert(messages.slice(i, i + 200)))
// The message trigger derives unread/reply state as rows land; restore the seeded state exactly.
for (const t of threads) {
  must('thread state', await db.from('inbox_threads').update({
    unread_count: t.unread_count, is_read: t.is_read, requires_reply: t.requires_reply, waiting_on_customer: t.waiting_on_customer,
    first_response_at: t.first_response_at, status: t.status, last_message_at: t.last_message_at, last_message_preview: t.last_message_preview,
    updated_at: t.updated_at, snoozed_until: t.snoozed_until,
  }).eq('id', t.id))
}
must('activity', await db.from('inbox_activity').insert(activity.map(a => ({ metadata: {}, ...a }))))
must('history', await db.from('inbox_assignment_history').insert(history))
console.log('threads', threads.length, 'messages', messages.length)

// ------------------------------------------------------------------ queues + routing
must('queues', await db.from('inbox_queues').insert([
  ['My assignments', 'user', { assignee: 'me' }], ['High priority', 'flag', { priority: ['high', 'urgent'] }],
  ['SLA at risk', 'alert', { sla: ['at_risk', 'breached'] }], ['Waiting on customer', 'clock', { waiting: true }],
  ['Escalated', 'escalate', { escalated: true }], ['VIP customers', 'star', { segment: ['vip'] }],
  ['Partners', 'handshake', { tags: ['partner'] }], ['Billing & Payments', 'card', { teamName: 'Billing & Payments' }],
].map(([name, icon, filters], position) => ({ workspace_id: WS, name, icon, filters, position, is_system: position < 5, is_demo: true, created_by: ownerId }))))
must('routing', await db.from('inbox_routing_rules').insert([
  { workspace_id: WS, name: 'VIP customers to High Value Support', conditions: { segment: ['vip'] }, actions: { team: team['High Value Support'], priority: 'high' }, position: 0, is_active: true, match_count: 142, is_demo: true, created_by: ownerId },
  { workspace_id: WS, name: 'Billing keywords to Billing & Payments', conditions: { keywords: ['invoice', 'charged', 'refund', 'payment'] }, actions: { team: team['Billing & Payments'], tags: ['billing issue'] }, position: 1, is_active: true, match_count: 64, is_demo: true, created_by: ownerId },
  { workspace_id: WS, name: 'Out-of-hours WhatsApp to Support Team', conditions: { channel: ['whatsapp'], outside_business_hours: true }, actions: { team: team['Support Team'] }, position: 2, is_active: false, match_count: 0, is_demo: true, created_by: ownerId },
]))

// ------------------------------------------------------------------ saved views
const FOLDERS = {
  'Customer Support': ['High value customers', 'Urgent & unresolved', 'Unanswered over 1 hour', 'Refund requests', 'Delivery issues', 'Reopened conversations', 'Negative sentiment'],
  'Sales & Revenue': ['Pricing questions', 'Bulk order enquiries', 'Upgrade requests', 'Enterprise renewals', 'Trial conversions', 'Churn risk'],
  'Marketing & Campaigns': ['Campaign replies', 'Welcome Series replies', 'Giveaway entries', 'UGC permissions', 'Newsletter replies'],
  'Product & Feedback': ['Feature requests', 'Bug reports', 'Product questions', 'Stock enquiries'],
  Operations: ['SLA breached today', 'Waiting on customer', 'Snoozed this week'],
  'VIP & Executive': ['VIP & influencers', 'Executive escalations', 'Partner accounts'],
}
const views = []
const viewOwners = ['Emma Davis', 'Liam Chen', 'Sophia Patel', 'Noah Williams']
let vi = 0
for (const [folder, names] of Object.entries(FOLDERS)) {
  for (const name of names) {
    const hv = name === 'High value customers'
    const personal = vi % 2 === 1 && !hv
    views.push({
      id: randomUUID(), workspace_id: WS, name, folder, is_demo: true,
      description: hv ? 'Conversations from high value customers across key channels that need attention.' : `Conversations matching “${name.toLowerCase()}”.`,
      filters: hv
        ? { segment: ['vip'], audienceLabel: 'High Value Customers', platform: ['email', 'sms', 'whatsapp'], lane: 'open', priority: ['high'], sla: ['breached', 'at_risk'], tags: ['VIP'] }
        : name === 'Urgent & unresolved' ? { priority: ['high', 'urgent'], lane: 'open' }
        : name === 'VIP & influencers' ? { segment: ['vip'] }
        : name === 'Refund requests' ? { tags: ['refund'] }
        : name === 'Delivery issues' ? { tags: ['delivery'] }
        : name === 'SLA breached today' ? { sla: ['breached'] }
        : name === 'Waiting on customer' ? { waiting: true }
        : { search: name.split(' ')[0].toLowerCase() },
      sort: 'newest', is_pinned: ['High value customers', 'Urgent & unresolved', 'VIP & influencers'].includes(name),
      visibility: hv ? 'personal' : personal ? 'personal' : 'team', is_shared: !personal,
      shared_team_id: hv ? team['High Value Support'] : null, shared_at: hv ? ago(60 * 24 * 6) : null,
      assignment_defaults: hv ? { teamName: 'High Value Support', team: team['High Value Support'], assignee: 'round_robin', priority: 'high', autoAssign: true } : {},
      sla_conditions: hv ? [
        { priority: 'high', respond: 30, resolve: 480 }, { priority: 'normal', respond: 120, resolve: 1440 }, { priority: 'low', respond: 480, resolve: 4320 },
      ] : [],
      needs_update: ['Giveaway entries', 'Trial conversions', 'Snoozed this week'].includes(name),
      created_by: P(hv ? 'Emma Davis' : viewOwners[vi % viewOwners.length]),
      usage_count: hv ? 1248 : 20 + vi * 3, last_used_at: ago(vi * 45),
      created_at: ago(60 * 24 * (40 - vi)), updated_at: ago(60 * 24 * (vi % 9)),
    })
    vi++
  }
}
must('views', await db.from('inbox_saved_views').insert(views))
const hvView = views[0]
const usage = []
const usageWeights = [['Emma Davis', 432], ['Liam Chen', 298], ['Sophia Patel', 186], ['Noah Williams', 140], ['Ava Martinez', 104], ['Michael Chen', 88]]
const dayShape = [0.2, 0.12, 0.13, 0.19, 0.11, 0.07, 0.18]
for (const [who, count] of usageWeights) {
  for (let i = 0; i < count; i++) {
    const r = rand(); let acc = 0; let day = 0
    for (; day < 7; day++) { acc += dayShape[day]; if (r <= acc) break }
    usage.push({ view_id: hvView.id, workspace_id: WS, user_id: P(who), used_at: ago((6 - Math.min(day, 6)) * 1440 + Math.floor(rand() * 600)) })
  }
}
for (let i = 0; i < usage.length; i += 500) must('usage', await db.from('inbox_saved_view_usage').insert(usage.slice(i, i + 500)))
must('view activity', await db.from('inbox_activity').insert([
  { workspace_id: WS, saved_view_id: hvView.id, actor_id: P('Emma Davis'), action: 'saved_view.updated', summary: 'Updated filters', created_at: ago(60 * 24 * 1 + 30), is_demo: true },
  { workspace_id: WS, saved_view_id: hvView.id, actor_id: P('Liam Chen'), action: 'saved_view.shared', summary: 'Shared with team', created_at: ago(60 * 24 * 2 + 200), is_demo: true },
  { workspace_id: WS, saved_view_id: hvView.id, actor_id: P('Sophia Patel'), action: 'saved_view.assignment_updated', summary: 'Updated assignment', created_at: ago(60 * 24 * 3 + 400), is_demo: true },
]))
console.log('saved views', views.length, 'usage', usage.length)

// ------------------------------------------------------------------ group chats
const files = {
  timeline: await put(`inbox/${WS}/demo/files/Welcome_Series_Timeline.xlsx`, 'files/Welcome_Series_Timeline.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  email: await put(`inbox/${WS}/demo/files/Welcome_Email_V3.html`, 'files/Welcome_Email_V3.html', 'text/html'),
}
const launchDate = new Date(now + 7 * 86_400_000).toISOString().slice(0, 10)
const CHATS = [
  { name: 'Welcome Series Launch', icon: '\u{1F389}', members: ['Jamahl Thomas', 'Emma Davis', 'Liam Chen', 'Sophia Patel', 'Noah Williams', 'Ava Martinez'], mins: 2, unread: 3,
    summary: 'This group is focused on the Welcome Series launch across email, SMS, WhatsApp, and push.',
    context: { launch_date: launchDate, audience: 'New sign-ups', goal: 'Drive activation in first 7 days', owner: 'Jamahl Thomas' } },
  { name: 'Product Marketing', members: ['Jamahl Thomas', 'Liam Chen', 'Emma Davis', 'Mia Thompson'], mins: 15, unread: 2, last: ['Liam Chen', 'Can you share the latest positioning doc?'] },
  { name: 'Creative Team', members: ['Jamahl Thomas', 'Sophia Patel', 'Olivia Martinez', 'Mason Lee'], mins: 60, unread: 1, last: ['Sophia Patel', 'New template is ready'] },
  { name: 'Campaign Sync', members: ['Jamahl Thomas', 'Noah Williams', 'Emma Davis'], mins: 120, unread: 0, last: ['Noah Williams', 'Scheduled for tomorrow'] },
  { name: 'Growth Squad', members: ['Jamahl Thomas', 'Ava Martinez', 'Ethan Roberts'], mins: 1440, unread: 0, last: ['Ava Martinez', 'Here’s the report'] },
]
for (const chat of CHATS) {
  const row = must(`chat ${chat.name}`, await db.from('inbox_group_chats').insert({
    workspace_id: WS, name: chat.name, icon: chat.icon ?? null, context_summary: chat.summary ?? null, context: chat.context ?? {},
    owner_id: ownerId, created_by: ownerId, last_message_at: ago(chat.mins), is_demo: true, created_at: ago(60 * 24 * 10),
  }).select('id').single())
  must('chat members', await db.from('inbox_group_chat_members').insert(chat.members.map(m => ({
    chat_id: row.id, user_id: P(m), workspace_id: WS, last_read_at: m === 'Jamahl Thomas' ? ago(chat.mins + (chat.unread ? 30 : -1)) : ago(0),
  }))))
  const msgs = chat.name === 'Welcome Series Launch' ? [
    ['Emma Davis', '@team here’s the updated timeline for the Welcome Series launch. We’re targeting launch day for the first send.', 32, [], [{ name: 'Welcome_Series_Timeline.xlsx', size: 18_000, type: 'Excel', path: files.timeline }], [['\u{1F44D}', ['Liam Chen', 'Sophia Patel']]]],
    ['Liam Chen', 'Thanks @Emma Davis! The timeline looks good. @Sophia Patel can you confirm the email copy is final?', 31, ['Emma Davis', 'Sophia Patel'], [], [['\u{1F44D}', ['Emma Davis']]]],
    ['Sophia Patel', 'Yes, all set! Here’s the latest draft for review.', 3, [], [{ name: 'Welcome_Email_V3.html', size: 256_000, type: 'HTML', path: files.email }], [['\u{1F440}', ['Emma Davis', 'Noah Williams']]]],
    ['Noah Williams', 'I’ve scheduled the SMS and Push for launch day at 10:00 AM. @Ava Martinez please review the segments when you get a chance.', 2, ['Ava Martinez'], [], [['\u{1F44D}', ['Emma Davis']]]],
  ] : [[chat.last[0], chat.last[1], chat.mins, [], [], []]]
  for (const [author, body, mins, mentions, attachments, reactions] of msgs) {
    const msg = must('chat message', await db.from('inbox_group_chat_messages').insert({
      chat_id: row.id, workspace_id: WS, author_id: P(author), body, mentions: mentions.map(P), attachments, is_demo: true, created_at: ago(mins),
    }).select('id').single())
    for (const [emoji, who] of reactions) {
      must('reactions', await db.from('inbox_group_chat_reactions').insert(who.map(w => ({ message_id: msg.id, user_id: P(w), workspace_id: WS, emoji }))))
    }
  }
  // Seeding the owner's read marker after messages keeps the unread badge truthful.
  must('read marker', await db.from('inbox_group_chat_members').update({ last_read_at: ago(chat.unread ? 40 : 0) }).eq('chat_id', row.id).eq('user_id', ownerId))
}
console.log('group chats', CHATS.length)

// ------------------------------------------------------------------ campaign + tasks
const campaign = must('campaign', await db.from('campaigns').insert({
  workspace_id: WS, name: 'Sneaker Drop', description: 'Launch campaign for the new sneaker drop.', status: 'active',
  objective: 'awareness', channels: ['instagram', 'tiktok', 'linkedin'], tags: ['inbox-demo'], created_by: ownerId, owner_id: ownerId,
  start_date: new Date(now - 3 * 86_400_000).toISOString().slice(0, 10), end_date: new Date(now + 21 * 86_400_000).toISOString().slice(0, 10),
}).select('id').single())
const day = d => { const x = new Date(now); x.setHours(17, 0, 0, 0); x.setDate(x.getDate() + d); return x.toISOString() }
must('tasks', await db.from('campaign_tasks').insert([
  ['Plan Instagram content for Sneaker Drop campaign', 'in_progress', 'high', 0, 'Sarah Williams', 'instagram', campaign.id,
    'Plan and outline a week of Instagram content to promote the upcoming Sneaker Drop. Include post ideas, captions, hashtags and visual concepts aligned to the campaign brief.',
    [['Review campaign brief and objectives', true], ['Audit past Instagram performance', true], ['Brainstorm content ideas', true], ['Outline captions and hashtags', false], ['Share plan for review', false]]],
  ['Review and approve TikTok video concepts', 'done', 'medium', 0, 'Michael Chen', 'tiktok', campaign.id, 'Approve the three TikTok concepts from the creative team.', []],
  ['Draft LinkedIn post for Q2 industry insights', 'in_progress', 'medium', 1, 'Liam Chen', 'linkedin', null, 'Thought-leadership post summarising Q2 findings.', []],
  ['Review UGC submissions from community', 'review', 'medium', 2, 'Mia Thompson', 'all', null, 'Shortlist community submissions for reuse.', []],
  ['Schedule Twitter thread on brand storytelling', 'todo', 'low', 3, 'Sarah Williams', 'x', null, 'Five-post thread on our origin story.', [], 3],
  ['Create captions for product feature posts', 'todo', 'medium', 4, 'David Martinez', 'instagram', campaign.id, 'Captions for the four feature posts.', [], 4],
  ['Design carousel for customer success story', 'todo', 'medium', 6, 'Liam Chen', 'linkedin', null, 'Six-slide carousel from the customer case study.', []],
  ['Compile monthly content performance report', 'todo', 'low', 7, 'Mia Thompson', 'all', null, 'Monthly report across all channels.', []],
].map(([title, status, priority, due, who, channel, campaignId, description, checklist, scheduled], i) => ({
  workspace_id: WS, campaign_id: campaignId, title, description, status, priority: priority === 'medium' ? 'medium' : priority,
  due_date: day(due), assigned_to: P(who), created_by: ownerId, channel, source: 'inbox-demo', is_demo: true,
  checklist: checklist.map(([label, done], j) => ({ id: `c${j + 1}`, label, done })),
  scheduled_for: scheduled ? day(scheduled) : null, completed_at: status === 'done' ? ago(90) : null,
  created_at: ago(60 * 24 * 5 + i * 60),
}))))

// ------------------------------------------------------------------ agent run (completed) with real result records
const runId = randomUUID()
must('agent run', await db.from('agent_runs').insert({
  id: runId, workspace_id: WS, user_id: ownerId, objective: 'Plan and schedule a week of Instagram content for our new sneaker drop.',
  title: 'Sneaker drop – IG weekly plan', status: 'completed', brief: { platform: 'instagram', days: 7, topic: 'new sneaker drop' },
  summary: 'All set! Your week of Instagram content is planned and scheduled.', started_at: ago(3), completed_at: ago(1), is_demo: true, created_at: ago(3),
}))
const STEPS = [
  ['understand', 'Understanding the objective', 'Analysing brief and audience insights'],
  ['research', 'Research & ideation', 'Trending topics, angles and content ideas'],
  ['create', 'Create content', 'Generating captions, hashtags and visual concepts'],
  ['schedule', 'Plan & schedule', 'Building calendar and scheduling posts'],
  ['review', 'Review & optimise', 'Reviewing plan and optimising for performance'],
  ['deliver', 'Deliver results', 'Preparing summary and sharing results'],
]
must('agent steps', await db.from('agent_run_steps').insert(STEPS.map(([key, name, description], i) => ({
  run_id: runId, workspace_id: WS, position: i, step_key: key, name, description, status: 'completed',
  requires_approval: key === 'schedule', approved_by: key === 'schedule' ? ownerId : null, approved_at: key === 'schedule' ? ago(2) : null,
  started_at: ago(3), completed_at: ago(3 - i * 0.4),
}))))
const IDEAS = [
  ['Drop day countdown', 'The wait is almost over. \u{1F45F} Our lightest sneaker yet lands this week — set your reminder.', ['#SneakerDrop', '#NewRelease', '#Countdown', '#Sneakers', '#LaunchWeek']],
  ['Behind the design', 'Six months, 42 prototypes, one obsession: comfort that moves with you.', ['#DesignProcess', '#SneakerDesign', '#BehindTheScenes', '#Craft', '#SneakerDrop']],
  ['Colourway reveal', 'Three colourways. Which one is yours? Vote in the comments \u{1F447}', ['#Colourway', '#SneakerDrop', '#PickYourPair', '#Style', '#NewDrop']],
  ['Street test', 'We took them to the city for a week. Here’s what 80,000 steps looks like.', ['#StreetStyle', '#WearTest', '#SneakerDrop', '#EverydayComfort', '#CityLife']],
  ['Community styling', 'You styled them before they even launched. Tag us to be featured.', ['#UGC', '#StyleInspo', '#SneakerDrop', '#Community', '#OOTD']],
  ['Launch day', 'It’s here. Link in bio — limited first run, no restock planned.', ['#LaunchDay', '#SneakerDrop', '#LimitedEdition', '#ShopNow', '#NewIn']],
  ['Thank-you recap', 'Sold out in hours. Thank you — restock waitlist is open now.', ['#ThankYou', '#SoldOut', '#SneakerDrop', '#Waitlist', '#Community']],
]
const batchId = randomUUID()
const gens = must('generations', await db.from('ai_generations').insert(IDEAS.map(([title, caption, tags]) => ({
  workspace_id: WS, user_id: ownerId, type: 'caption', platform: 'instagram', channel: 'inbox-demo', topic: title,
  output: `${caption}\n\n${tags.join(' ')}`, model: 'gpt-5.4-mini', batch_id: batchId, status: 'used', word_count: caption.split(' ').length, created_at: ago(2),
}))).select('id'))
const posts = must('posts', await db.from('content_posts').insert(IDEAS.map(([title, caption, tags], i) => ({
  workspace_id: WS, campaign_id: campaign.id, title, caption, hashtags: tags, platforms: ['instagram'], post_type: i % 3 === 1 ? 'reel' : 'post',
  status: 'scheduled', scheduled_at: day(i + 1).replace('T17', 'T09'), source: 'ai', created_by: ownerId, owner_id: ownerId,
  tags: ['inbox-demo', 'agent'], is_demo: true, metadata: { agent_run_id: runId },
}))).select('id'))
const weekStart = new Date(now + 86_400_000).toISOString().slice(0, 10)
must('agent results', await db.from('agent_run_results').insert([
  { run_id: runId, workspace_id: WS, kind: 'content_plan', title: 'Weekly content plan', subtitle: '7 posts • Instagram', href: `/brand/calendar?view=week&date=${weekStart}`, record_type: 'content_posts', record_ids: posts.map(p => p.id) },
  { run_id: runId, workspace_id: WS, kind: 'captions', title: 'Captions & hashtags', subtitle: '7 captions • 35 hashtags', href: '/brand/studio/ai?batch=' + batchId, record_type: 'ai_generations', record_ids: gens.map(g => g.id) },
  { run_id: runId, workspace_id: WS, kind: 'scheduled_posts', title: 'Scheduled posts', subtitle: '7 posts • next 7 days', href: `/brand/calendar?view=list&date=${weekStart}`, record_type: 'content_posts', record_ids: posts.map(p => p.id) },
]))

// ------------------------------------------------------------------ media jobs + generated assets
const outputs = {}
for (const slug of ['next-drop', 'built-to-move', 'lighter-faster-louder', 'launch-mode']) {
  const key = await put(`inbox/${WS}/demo/generated/${slug}.jpg`, `outputs/${slug}.jpg`, 'image/jpeg')
  const asset = must('asset', await db.from('media_assets').insert({
    workspace_id: WS, file_name: `${slug}.jpg`, file_path: key, file_url: key, file_type: 'image', mime_type: 'image/jpeg',
    width: 800, height: 1000, file_size: fs.statSync(path.join(MEDIA, 'outputs', `${slug}.jpg`)).size, storage_bucket: 'r2', thumbnail_path: key,
    asset_kind: 'image', status: 'ready', processing_state: 'ready', scan_state: 'clean', approval_status: 'draft',
    tags: ['ai-generated', 'inbox-demo'], uploaded_by: ownerId, owner_id: ownerId, is_demo: true, alt_text: slug.replaceAll('-', ' '),
    description: 'Generated with Fox AI Media',
  }).select('id').single())
  outputs[slug] = asset.id
}
const jobThumbs = {}
for (const file of fs.readdirSync(path.join(MEDIA, 'jobs'))) jobThumbs[file.replace('.jpg', '')] = await put(`inbox/${WS}/demo/jobs/${file}`, `jobs/${file}`, 'image/jpeg')
must('media jobs', await db.from('media_generation_jobs').insert([
  ['Sneaker launch visual', 'sneaker-launch-visual', 'completed', 0, 2, ['next-drop', 'built-to-move']],
  ['Minimal product banner', 'minimal-product-banner', 'completed', 120, 1, ['lighter-faster-louder']],
  ['Reel cover options', 'reel-cover-options', 'completed', 60 * 24, 4, ['built-to-move', 'launch-mode', 'next-drop', 'lighter-faster-louder']],
  ['Brand moodboard', 'brand-moodboard', 'generating', 60 * 24 * 7, 6, []],
  ['Ad creative set', 'ad-creative-set', 'completed', 60 * 24 * 8, 2, ['launch-mode', 'next-drop']],
].map(([title, slug, status, mins, variations, outs]) => ({
  workspace_id: WS, user_id: ownerId, title, prompt: `${title} for the new sneaker drop, dynamic lighting, minimal text, premium energetic style.`,
  output_type: 'image', aspect_ratio: '4:5', style_preset: 'photographic', model_key: 'fox-image-pro', quality: 'standard',
  variations: Math.min(variations, 4), use_brand_kit: true, status, output_asset_ids: outs.map(o => outputs[o]),
  is_demo: true, created_at: ago(mins), completed_at: status === 'completed' ? ago(Math.max(0, mins - 1)) : null,
  error: null, enhanced_prompt: jobThumbs[slug] ? `thumbnail:${jobThumbs[slug]}` : null,
}))))

console.log('done for workspace', WS)
