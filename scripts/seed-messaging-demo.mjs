// Development-only demo seed for the Messaging module (eight approved designs).
//
// Removes and re-creates every Messaging row for the target workspace, so the
// script is idempotent. Numbers come from a seeded PRNG, so repeated runs
// produce identical data - nothing is random at render time. Images are
// uploaded to the private R2 bucket and stored as `r2:` paths. Never run
// against production.
//
// Usage: node scripts/seed-messaging-demo.mjs [<workspace_id> ...]
//        (defaults to every brand workspace)

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => line.includes('=') && !line.trimStart().startsWith('#')).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, '')]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo messaging data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const s3 = new S3Client({
  region: 'auto', endpoint: new URL(env.CLOUDFLARE_R2_S3_API).origin,
  credentials: { accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS },
})

// ---------------------------------------------------------------- helpers
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rand = mulberry32(20260916)
const DAY = 86_400_000
const now = Date.now()
const ago = minutes => new Date(now - minutes * 60_000).toISOString()
const inDays = days => new Date(now + days * DAY).toISOString()
const dayString = offset => {
  const d = new Date(now - offset * DAY)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10)
}
const round = n => Math.round(n)

async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}
async function insertChunks(table, rows, size = 500) {
  const out = []
  for (let i = 0; i < rows.length; i += size) {
    const data = await must(admin.from(table).insert(rows.slice(i, i + size), { defaultToNull: false }).select('*'), `insert ${table}`)
    out.push(...data)
  }
  return out
}

const IMAGES = {
  sneaker: 'supabase/seed-media/brand-assets/thumbs/product-acm-2005.jpg',
  sneaker_white: 'scripts/seed-media/creators/sneaker-drop.jpg',
  sneaker_dark: 'supabase/seed-media/brand-assets/thumbs/product-acm-2011.jpg',
  backpack: 'supabase/seed-media/brand-assets/thumbs/product-acm-4009.jpg',
  headphones: 'supabase/seed-media/brand-assets/thumbs/product-acm-4007.jpg',
  desk: 'scripts/seed-media/creators/tech-desk.jpg',
  tote: 'supabase/seed-media/brand-assets/thumbs/product-acm-5003.jpg',
  coffee: 'supabase/seed-media/brand-assets/thumbs/product-acm-6001.jpg',
  serum: 'supabase/seed-media/brand-assets/thumbs/product-acm-1001.jpg',
}

async function uploadImages(workspaceId) {
  const paths = {}
  for (const [key, file] of Object.entries(IMAGES)) {
    const objectKey = `messaging/${workspaceId}/demo/${key}.jpg`
    await s3.send(new PutObjectCommand({
      Bucket: env.CLOUDFLARE_S3_BUCKET, Key: objectKey, Body: readFileSync(file),
      ContentType: 'image/jpeg', CacheControl: 'private, max-age=86400',
    }))
    paths[key] = `r2:${objectKey}`
  }
  return paths
}

// ---------------------------------------------------------------- 30-day channel targets
// [sent, delivery%, open/read%, click%, conversion%, opt-out%] for the current
// 30 days, then the same for the previous 30 days (drives every KPI delta).
const CHANNEL_TARGETS = {
  email: { now: [1_240_000, 98.3, 31.6, 7.4, 3.1, 0.18], prev: [1_045_500, 96.2, 28.4, 6.3, 2.3, 0.21] },
  sms: { now: [856_200, 98.7, 0, 7.8, 2.6, 0.42], prev: [723_100, 96.8, 0, 6.9, 2.2, 0.48] },
  whatsapp: { now: [248_600, 98.7, 87.2, 11.6, 4.2, 0.09], prev: [209_600, 96.5, 83.8, 10.0, 3.4, 0.11] },
  rcs: { now: [876_400, 97.6, 18.9, 7.2, 2.8, 0.12], prev: [757_500, 96.0, 16.6, 6.1, 2.1, 0.15] },
  push: { now: [5_430_000, 97.8, 24.6, 7.6, 1.8, 0.05], prev: [4_578_000, 95.7, 21.4, 6.6, 1.3, 0.06] },
}

function dailyMetrics(workspaceId) {
  rand = mulberry32(7331)
  const rows = []
  for (const [channel, target] of Object.entries(CHANNEL_TARGETS)) {
    for (const [window, offsetStart] of [['now', 0], ['prev', 30]]) {
      const [sent, del, open, click, conv, opt] = target[window]
      const weights = Array.from({ length: 30 }, (_, i) => 1 + 0.18 * Math.sin((i + offsetStart) / 2.4) + (rand() - 0.5) * 0.22)
      const total = weights.reduce((a, b) => a + b, 0)
      weights.forEach((w, i) => {
        const daySent = round(sent * w / total)
        const delivered = round(daySent * del / 100 * (1 + (rand() - 0.5) * 0.004))
        rows.push({
          workspace_id: workspaceId, channel, metric_date: dayString(offsetStart + 29 - i),
          sent: daySent, delivered,
          opened: round(delivered * open / 100 * (1 + (rand() - 0.5) * 0.08)),
          clicked: round(delivered * click / 100 * (1 + (rand() - 0.5) * 0.1)),
          converted: round(delivered * conv / 100 * (1 + (rand() - 0.5) * 0.1)),
          opt_outs: round(daySent * opt / 100),
        })
      })
    }
  }
  return rows
}

// ---------------------------------------------------------------- audiences
// name, size, tags, exclusions, reach per channel [eligible%, risky%, ineligible%], filter extras
const AUDIENCES = [
  ['High Value Customers', 124_832, ['High Value', 'Product Interest: Shoes', 'VIP', 'Repeat Buyer'], ['Unsubscribed', 'Do not contact', 'Hard bounced'],
    { email: 99.3, sms: 97.8, whatsapp: 65.2, rcs: 72.1, push: 61.4 }, { risky: 0.7, ineligible: 0.6, unknown: 0.4 }, {}],
  ['High Value SMS Subscribers', 245_621, ['High Value', 'Loyal Customer', 'SMS Opt-in', 'Repeat Buyer'], ['Do not contact', 'Unsubscribed', 'Invalid phone'],
    { email: 88.2, sms: 100, whatsapp: 41.2, rcs: 52.4, push: 38.1 }, { risky: 0.4, ineligible: 0.3, unknown: 0.2 }, { opted_in_label: 'SMS Subscribers' }],
  ['High Value WhatsApp Users', 342_812, ['High Value', 'Product Interest: Shoes', 'Returning', 'App User'], ['Unsubscribed', 'Bounced', 'Blocked'],
    { email: 81.4, sms: 77.9, whatsapp: 92.2, rcs: 60.3, push: 54.8 }, { risky: 0.5, ineligible: 0.6, unknown: 0.8 }, { regions: ['United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia'] }],
  ['RCS Active Shoppers', 342_186, ['High Value', 'Product Interest: Shoes', 'Mobile', 'Android', 'Returning'], ['Unsubscribed', 'Do not contact', 'iOS < 18'],
    { email: 11.9, sms: 14.6, whatsapp: 22.1, rcs: 82.4, push: 9.1 }, { risky: 0.4, ineligible: 0.5, unknown: 0.6 }, {}],
  ['Active App Users', 1_243_876, ['App User', 'Active 30d'], ['Unsubscribed', 'App Uninstalled', 'Push disabled'],
    { email: 58.2, sms: 44.1, whatsapp: 31.5, rcs: 28.9, push: 100 }, { risky: 0.3, ineligible: 0.4, unknown: 0.2 }, { opt_in_rate: 82.4, prior_opt_in_rate: 79.8 }],
  ['Cart Abandoners', 98_412, ['Cart Abandoner', 'High Intent'], ['Unsubscribed'], { email: 97.1, sms: 88.5, whatsapp: 55.8, rcs: 61.2, push: 70.4 }, { risky: 0.6, ineligible: 0.8, unknown: 0.5 }, {}],
  ['All Customers', 534_210, ['Customer'], ['Unsubscribed', 'Do not contact'], { email: 96.8, sms: 81.2, whatsapp: 48.3, rcs: 55.1, push: 62.7 }, { risky: 0.9, ineligible: 1.1, unknown: 0.6 }, {}],
  ['Inactive 90+ Days', 76_541, ['Lapsed', 'Win back'], ['Unsubscribed'], { email: 94.2, sms: 72.3, whatsapp: 38.1, rcs: 41.7, push: 33.2 }, { risky: 1.8, ineligible: 1.2, unknown: 0.7 }, {}],
  ['Birthday This Month', 12_843, ['Birthday', 'Lifecycle'], ['Unsubscribed'], { email: 99.1, sms: 90.2, whatsapp: 60.7, rcs: 63.3, push: 71.8 }, { risky: 0.2, ineligible: 0.3, unknown: 0.1 }, {}],
  ['Loyal Customers', 132_448, ['Loyal Customer', 'Repeat Buyer'], ['Unsubscribed'], { email: 98.4, sms: 97.8, whatsapp: 63.9, rcs: 66.4, push: 68.2 }, { risky: 0.4, ineligible: 0.5, unknown: 0.3 }, {}],
  ['Back in Stock Subs', 42_185, ['Back in Stock'], ['Unsubscribed'], { email: 97.2, sms: 99.0, whatsapp: 44.1, rcs: 48.2, push: 58.3 }, { risky: 0.3, ineligible: 0.2, unknown: 0.2 }, {}],
  ['New Subscribers', 54_216, ['New', 'Welcome'], ['Unsubscribed'], { email: 99.4, sms: 70.1, whatsapp: 52.6, rcs: 57.4, push: 61.0 }, { risky: 0.2, ineligible: 0.1, unknown: 0.3 }, {}],
  ['Overdue Payments', 31_245, ['Billing', 'Overdue'], ['Do not contact'], { email: 99.0, sms: 95.2, whatsapp: 88.1, rcs: 40.3, push: 50.2 }, { risky: 0.4, ineligible: 0.4, unknown: 0.2 }, {}],
  ['Engaged Users', 18_724, ['Engaged'], ['Unsubscribed'], { email: 98.3, sms: 84.2, whatsapp: 90.4, rcs: 51.8, push: 66.9 }, { risky: 0.3, ineligible: 0.3, unknown: 0.2 }, {}],
  ['Recent Buyers', 12_043, ['Buyer', '30d'], ['Unsubscribed'], { email: 99.2, sms: 86.4, whatsapp: 86.7, rcs: 49.9, push: 59.3 }, { risky: 0.2, ineligible: 0.2, unknown: 0.1 }, {}],
  ['Sneaker Fans', 128_412, ['Product Interest: Shoes'], ['Unsubscribed'], { email: 95.6, sms: 80.1, whatsapp: 49.4, rcs: 84.2, push: 62.3 }, { risky: 0.5, ineligible: 0.6, unknown: 0.4 }, {}],
  ['Students', 214_687, ['Student', 'Back to school'], ['Unsubscribed'], { email: 93.1, sms: 76.4, whatsapp: 57.2, rcs: 79.8, push: 64.1 }, { risky: 0.8, ineligible: 0.9, unknown: 0.7 }, {}],
  ['Local Shoppers', 76_541, ['Local', 'Store visitor'], ['Unsubscribed'], { email: 92.4, sms: 88.7, whatsapp: 45.9, rcs: 81.2, push: 55.5 }, { risky: 0.6, ineligible: 0.7, unknown: 0.5 }, {}],
  ['Inactive 30+ Days', 42_118, ['Lapsed'], ['Unsubscribed'], { email: 95.3, sms: 70.8, whatsapp: 36.4, rcs: 44.2, push: 40.3 }, { risky: 1.4, ineligible: 1.0, unknown: 0.6 }, {}],
]

// ---------------------------------------------------------------- people
const PEOPLE = ['Emma Davis', 'Liam Chen', 'Sophia Patel', 'Noah Williams', 'Ava Martinez']

// ---------------------------------------------------------------- programmes (messages)
// name, category, type, audience, sent, delivery, open/read, click, conversion, status, owner, lastSent(min ago | null), scheduledInDays, prior deltas [del, open, click, conv] (pp), channel_mix, extra
const MESSAGES = {
  email: [
    ['Welcome Series', 'lifecycle', 'journey', 'High Value Customers', 286_124, 98.6, 42.7, 11.3, 4.6, 'sending', 0, 5, null, [1.9, 3.4, 1.2, 0.9], ['email', 'whatsapp', 'push', 'sms']],
    ['Abandoned Cart', 'transactional', 'journey', 'Cart Abandoners', 214_681, 97.9, 24.5, 8.7, 3.2, 'sending', 1, 18, null, [1.2, 2.1, 0.8, 0.6], ['whatsapp', 'sms', 'push']],
    ['Spring Promo 2024', 'promotional', 'broadcast', 'All Customers', 341_902, 98.1, 29.8, 6.2, 2.1, 'sending', 2, 60, null, [0.8, 1.6, 0.7, 0.5], ['email', 'push']],
    ['Win Back Campaign', 're_engagement', 'journey', 'Inactive 90+ Days', 76_541, 97.3, 18.6, 4.1, 1.4, 'paused', 3, 2880, null, [0.6, 1.3, 0.5, 0.2], ['email', 'whatsapp', 'sms', 'push']],
    ['Birthday Wishes', 'lifecycle', 'journey', 'Birthday This Month', 12_843, 99.1, 53.9, 12.6, 5.2, 'scheduled', 4, null, 6, [2.5, 4.1, 1.6, 1.1], ['email', 'whatsapp', 'push']],
  ],
  sms: [
    ['Spring Sale 20% Off', 'promotional', 'broadcast', 'High Value SMS Subscribers', 245_621, 98.6, 0, 8.3, 2.9, 'sent', 0, 8, null, [1.7, 0, 0.8, 0.05], ['sms'], { opt_out: 0.38 }],
    ['Abandoned Cart Reminder', 'transactional', 'journey', 'Cart Abandoners', 184_731, 98.9, 0, 12.1, 3.4, 'sending', 1, 21, null, [2.1, 0, 1.2, 0.04], ['sms'], { opt_out: 0.29 }],
    ['Loyalty Double Points', 'promotional', 'broadcast', 'Loyal Customers', 132_448, 97.8, 0, 6.2, 1.9, 'sent', 2, 1540, null, [-0.6, 0, -0.3, 0.07], ['sms'], { opt_out: 0.46 }],
    ['Win Back Campaign', 'promotional', 'journey', 'Inactive 90+ Days', 98_312, 98.1, 0, 5.4, 1.2, 'sending', 3, 1620, null, [1.3, 0, 0.6, 0.09], ['sms'], { opt_out: 0.52 }],
    ['Product Restock Alert', 'transactional', 'broadcast', 'Back in Stock Subs', 42_185, 99.0, 0, 9.6, 3.1, 'sent', 4, 2800, null, [2.4, 0, 1.1, 0.02], ['sms'], { opt_out: 0.21 }],
  ],
  whatsapp: [
    ['Order Update Flow', 'transactional', 'journey', 'High Value Users', 69_120, 99.0, 91.3, 12.7, 4.8, 'sending', 0, 120, null, [0.4, 3.2, 1.5, 0.7], ['whatsapp'], { template: 'order_update_v2', delivered: 68_421 }],
    ['Abandoned Cart Flow', 'transactional', 'journey', 'Cart Abandoners', 55_700, 98.4, 84.6, 18.3, 7.1, 'sending', 1, 300, null, [0.3, 2.6, 1.6, 0.9], ['whatsapp'], { template: 'abandoned_cart_v3', delivered: 54_812 }],
    ['Payment Reminder', 'transactional', 'journey', 'Overdue Payments', 31_700, 98.6, 89.2, 7.9, 6.2, 'sending', 2, 1440, null, [0.2, 4.1, 0.5, 1.2], ['whatsapp'], { template: 'payment_reminder_v1', delivered: 31_245 }],
    ['Welcome Series', 'lifecycle', 'journey', 'New Subscribers', 25_300, 98.5, 93.6, 11.4, 5.6, 'sending', 3, 1500, null, [0.2, 2.9, 1.6, 0.6], ['whatsapp'], { template: 'welcome_v2', delivered: 24_933 }],
    ['Offer Ending Soon', 'promotional', 'broadcast', 'Engaged Users', 19_100, 98.0, 76.1, 15.2, 3.9, 'paused', 4, 2880, null, [0.1, 1.8, 1.4, -0.2], ['whatsapp'], { template: 'offer_ending_soon_v1', delivered: 18_724 }],
    ['Feedback Request', 'engagement', 'broadcast', 'Recent Buyers', 12_300, 97.9, 72.8, 8.6, 2.7, 'draft', 0, null, null, [0.1, -2.1, -0.4, 0.3], ['whatsapp'], { template: 'feedback_request_v1', delivered: 12_043, noLastSent: true }],
  ],
  rcs: [
    ['New Arrivals May', 'promotional', 'broadcast', 'RCS Active Shoppers', 342_186, 97.6, 21.3, 7.8, 3.1, 'sending', 0, 2, null, [1.1, 2.0, 0.9, 0.6], ['rcs'], { layout: 'Carousel', fallback: 14.8 }],
    ['Sneaker Launch', 'promotional', 'broadcast', 'Sneaker Fans', 128_412, 96.8, 20.7, 8.3, 3.6, 'sending', 1, 15, null, [0.9, 1.7, 1.0, 0.5], ['rcs'], { layout: 'Carousel', fallback: 16.2 }],
    ['Back to School', 'promotional', 'broadcast', 'Students', 214_687, 97.1, 17.5, 6.2, 2.2, 'sending', 2, 60, null, [0.7, 1.2, 0.4, 0.3], ['rcs'], { layout: 'Single Card', fallback: 20.9 }],
    ['Abandoned Cart Nudge', 'transactional', 'journey', 'Cart Abandoners', 96_845, 95.3, 14.0, 5.1, 1.8, 'sending', 3, 120, null, [0.5, 0.9, 0.3, 0.2], ['rcs'], { layout: 'Single Card', fallback: 18.7 }],
    ['Store Locator Promo', 'promotional', 'broadcast', 'Local Shoppers', 76_541, 95.5, 16.8, 6.3, 2.5, 'paused', 4, 25_000, null, [0.4, 0.6, 0.2, 0.1], ['rcs'], { layout: 'Single Card', fallback: 19.3 }],
    ['Welcome Series', 'lifecycle', 'journey', 'New Subscribers', 54_216, 95.9, 19.6, 7.0, 2.9, 'sent', 0, 32_000, null, [0.6, 1.4, 0.8, 0.4], ['rcs'], { layout: 'Carousel', fallback: 16.7 }],
  ],
  push: [
    ['Welcome Series', 'lifecycle', 'journey', 'Active App Users', 1_102_334, 97.9, 26.6, 7.9, 2.1, 'sending', 0, 60, null, [0.8, 3.4, 1.1, 0.4], ['email', 'whatsapp', 'push', 'sms']],
    ['Cart Abandonment', 'transactional', 'journey', 'Cart Abandoners', 987_412, 97.6, 32.1, 11.3, 2.7, 'sending', 1, 120, null, [0.6, 4.2, 1.8, 0.9], ['whatsapp', 'push']],
    ['Browse Abandonment', 'behavioral', 'journey', 'Active App Users', 642_558, 97.4, 24.7, 8.4, 1.8, 'sending', 2, 180, null, [0.5, 2.3, 0.9, 0.4], ['whatsapp', 'push']],
    ['Price Drop Alert', 'trigger_based', 'transactional', 'Active App Users', 532_771, 97.6, 27.6, 9.8, 2.0, 'sending', 3, 300, null, [0.4, 3.3, 1.2, 0.2], ['email', 'whatsapp', 'push', 'sms']],
    ['Re-engagement', 'lifecycle', 'journey', 'Inactive 30+ Days', 482_156, 97.1, 21.9, 6.3, 1.2, 'paused', 4, 1440, null, [0.3, 0.9, 0.3, 0.2], ['email', 'whatsapp', 'push']],
    ['Win Back', 'lifecycle', 'journey', 'Inactive 90+ Days', 341_027, 96.6, 19.4, 5.1, 0.9, 'sending', 0, 2880, null, [0.3, 0.7, 0.2, 0.4], ['whatsapp', 'push']],
    ['Flash Sale Alerts', 'promotional', 'transactional', 'All Customers', 296_881, 96.8, 18.7, 4.6, 0.8, 'scheduled', 1, null, 3, [0.3, 0.3, 0.2, 0.4], ['email', 'whatsapp', 'push']],
    // Broadcast campaigns (Top push campaigns list)
    ['Summer Sale - Sneakers', 'promotional', 'broadcast', 'Active App Users', 1_243_876, 97.8, 28.6, 8.7, 2.1, 'sent', 2, 4000, null, [0.5, 3.4, 1.1, 0.6], ['push']],
    ['Abandoned Cart Reminder', 'transactional', 'broadcast', 'Cart Abandoners', 987_412, 97.6, 32.1, 11.3, 2.7, 'sent', 3, 4300, null, [0.4, 4.2, 1.8, 0.9], ['push']],
    ['Back in Stock - Watch', 'promotional', 'broadcast', 'Back in Stock Subs', 542_991, 97.4, 24.7, 9.6, 1.9, 'sent', 4, 5000, null, [0.2, 2.2, 0.8, 0.4], ['push']],
    ['Weekly Picks', 'promotional', 'broadcast', 'Active App Users', 431_207, 97.4, 21.3, 6.2, 1.3, 'sent', 0, 6000, null, [0.3, 1.1, 0.3, 0.2], ['push']],
    ['New Arrivals - Apparel', 'promotional', 'broadcast', 'All Customers', 392_118, 97.2, 20.8, 5.7, 1.1, 'sent', 1, 7000, null, [0.1, 0.9, 0.3, 0.2], ['push']],
    // Stale campaigns: paused with no sends for 14 / 21 / 30+ days
    ['Re-engagement - May', 'promotional', 'broadcast', 'Inactive 30+ Days', 4_210, 96.2, 12.1, 2.2, 0.4, 'paused', 2, 14 * 1440 + 30, null, [0, 0, 0, 0], ['push']],
    ['Flash Sale - April', 'promotional', 'broadcast', 'All Customers', 3_880, 96.0, 11.4, 2.0, 0.3, 'paused', 3, 21 * 1440 + 30, null, [0, 0, 0, 0], ['push']],
    ['Winter Collection Launch', 'promotional', 'broadcast', 'Active App Users', 2_950, 95.8, 10.9, 1.9, 0.3, 'paused', 4, 33 * 1440, null, [0, 0, 0, 0], ['push']],
  ],
}

// Additional older programmes so each channel list paginates like the designs.
const FILLER_NAMES = {
  email: ['Weekly Newsletter', 'Order Confirmation', 'Shipping Update', 'Product Launch', 'VIP Early Access', 'Review Request', 'Referral Invite', 'Loyalty Points Update', 'Password Reset', 'Back in Stock', 'Price Drop Alert', 'Seasonal Lookbook', 'Survey Invite', 'Event Invitation', 'Replenishment Reminder', 'Cross-sell Picks', 'Wishlist Reminder', 'Anniversary Offer', 'Trial Ending', 'Subscription Renewal', 'Holiday Gift Guide', 'Flash Sale', 'Membership Upgrade'],
  sms: ['Delivery Out Today', 'Order Shipped', 'Flash Sale 24h', 'VIP Preview', 'Appointment Reminder', 'Payment Received', 'Store Event RSVP', 'Weekend Offer', 'Loyalty Tier Upgrade', 'Review Request', 'Referral Reward', 'Stock Alert', 'Birthday Treat', 'Survey Link', 'Two-factor Code', 'Pickup Ready', 'Price Drop', 'Final Hours', 'Early Access', 'New Store Opening', 'Cart Expiring', 'Win Back 30d', 'Holiday Hours'],
  whatsapp: ['Delivery Rescheduled', 'Return Label', 'Refund Processed', 'Appointment Confirmed', 'Back in Stock', 'Price Drop', 'VIP Offer', 'Order Delayed', 'Loyalty Balance', 'Survey Invite', 'Store Pickup Ready', 'Subscription Renewal', 'Membership Welcome', 'Event Reminder', 'Warranty Registration', 'Size Exchange', 'Gift Card Delivered', 'Restock Waitlist'],
  rcs: ['Weekend Deals', 'Store Opening', 'Loyalty Rewards', 'Flash Carousel', 'Holiday Picks', 'Trending Now', 'Top Rated', 'Bundle Offer', 'App Download', 'Membership Perks', 'Event Tickets', 'Style Quiz', 'Order Tracking', 'Delivery Slots', 'Size Guide', 'Gift Finder', 'Clearance', 'New Colours', 'Staff Picks', 'Price Match', 'Last Chance', 'Refer a Friend'],
  push: [],
}

// Newest-first order of each channel's design rows (Overview lists the email programmes first).
const CHANNEL_ORDER = { email: 0, sms: 20, whatsapp: 40, rcs: 60, push: 80 }

// Unsent drafts the composers resume, one per channel.
const COMPOSER_DRAFTS = {
  email: {
    name: 'Personalised update', sender: 'Acme Marketing <hello@acme.com>', subject: 'Your personalized update is ready', audience: null,
    content: {
      subject: 'Your personalized update is ready', replyTo: 'hello@acme.com', preheader: "A quick summary of what's new for you",
      body: "Hi {{first_name}} 👋\nWe've picked something special for you.", image: 'sneaker', cta: { label: 'Shop now', url: 'https://acme.com/new' },
    },
  },
  sms: {
    name: 'Spring Collection launch', sender: 'AcmeOffers', audience: 'High Value SMS Subscribers',
    content: { body: 'Hi {{first_name}}! 👋\nOur Spring Collection is live 🌸 Shop now and get 20% off your first order.\n{{short_url}}', trackLinks: true },
  },
  whatsapp: {
    name: 'Order shipped update', sender: 'Acme Store', audience: 'High Value WhatsApp Users',
    content: {
      templateName: 'order_update_v2', image: 'sneaker', body: 'Hi {{1}}, your order {{2}} has been shipped 🚚\nIt will reach you by {{3}}.\nTrack your order and stay updated.',
      quickReplies: ['Track order', 'Change delivery date'], cta: { label: 'Visit website', url: 'https://acme.com/track/{{1}}' },
      personalisation: [{ token: '{{1}}', label: 'First name', sample: 'Alex' }, { token: '{{2}}', label: 'Order ID', sample: '#12345' }, { token: '{{3}}', label: 'ETA', sample: 'May 22' }],
    },
  },
  rcs: {
    name: 'New arrivals carousel', sender: 'Acme Store', audience: 'RCS Active Shoppers',
    content: {
      headline: 'New arrivals are here', body: 'New arrivals are here', layout: 'carousel',
      cards: [
        { title: 'Cloud Runner 2', price: '£129.00', action: 'Shop now', image: 'sneaker' },
        { title: 'Urban Backpack', price: '£89.00', action: 'View details', image: 'backpack' },
        { title: 'Apex Headphones', price: '£299.00', action: 'Explore', image: 'headphones' },
      ],
      quickReplies: ['Shop now', 'View all', 'Find a store'], cta: { label: 'Shop now' }, secondaryCta: { label: 'Find a store' },
    },
  },
  push: {
    name: 'Summer sneakers drop', sender: 'Acme App', audience: 'Active App Users',
    content: { title: 'New arrivals just landed', body: 'Check out the latest sneakers in our summer collection.', deepLink: 'myapp://category/sneakers', image: 'sneaker_white' },
  },
}

// ---------------------------------------------------------------- journeys
// A canvas node's `x` is a 0..1 horizontal position and `row` a vertical slot;
// the canvas renderer scales both to the panel. Edges carry yes/no branches.
const n = (id, type, x, row, extra = {}) => ({ id, type, x, row, ...extra })
const e = (from, to, branch) => (branch ? { from, to, branch } : { from, to })

const CANVASES = {
  overview: {
    nodes: [
      n('t', 'trigger', 0.5, 0, { label: 'User Sign Up' }),
      n('m1', 'message', 0.5, 1, { channel: 'email', label: 'Welcome Email', content: { subject: 'Welcome to Acme!', body: 'Hi {{first_name}}, welcome aboard.' } }),
      n('w1', 'wait', 0.5, 2, { waitHours: 48, label: '2 days' }),
      n('c1', 'condition', 0.5, 3, { conditionType: 'opened_previous', label: 'Opened?' }),
      n('m2', 'message', 0.13, 4, { channel: 'sms', label: 'Special Offer', content: { body: 'Hi {{first_name}}, here is 10% off: {{short_url}}' } }),
      n('m3', 'message', 0.87, 4, { channel: 'email', label: 'Reminder Email', content: { subject: 'Did you miss this?', body: 'A quick reminder from Acme.' } }),
      n('w2', 'wait', 0.5, 5, { waitHours: 24, label: '1 day' }),
      n('x', 'end', 0.5, 6, { label: 'Exit' }),
    ],
    edges: [e('t', 'm1'), e('m1', 'w1'), e('w1', 'c1'), e('c1', 'm2', 'yes'), e('c1', 'm3', 'no'), e('m2', 'w2'), e('m3', 'w2'), e('w2', 'x')],
  },
  email: {
    nodes: [
      n('t', 'trigger', 0.5, 0, { label: 'User Sign Up' }),
      n('m1', 'message', 0.5, 1, { channel: 'email', label: 'Welcome Email', content: { subject: 'Welcome to Acme!', body: 'Hi {{first_name}}, welcome aboard.' } }),
      n('w1', 'wait', 0.5, 2, { waitHours: 48, label: '2 days' }),
      n('c1', 'condition', 0.5, 3, { conditionType: 'opened_previous', label: 'Opened?' }),
      n('m2', 'message', 0.16, 4, { channel: 'email', label: 'Product Recommendations', content: { subject: 'Picked for you', body: 'Recommendations based on your interests.' } }),
      n('w2', 'wait', 0.16, 5, { waitHours: 72, label: '3 days' }),
      n('m3', 'message', 0.16, 6, { channel: 'email', label: 'Special Offer', content: { subject: 'A special offer inside', body: 'Enjoy 15% off your next order.' } }),
      n('m4', 'message', 0.84, 4, { channel: 'email', label: 'Reminder Email', content: { subject: 'Did you miss this?', body: 'A quick reminder from Acme.' } }),
      n('x', 'end', 0.5, 7, { label: 'Exit' }),
    ],
    edges: [e('t', 'm1'), e('m1', 'w1'), e('w1', 'c1'), e('c1', 'm2', 'yes'), e('c1', 'm4', 'no'), e('m2', 'w2'), e('w2', 'm3'), e('m3', 'x'), e('m4', 'x')],
  },
  sms: {
    nodes: [
      n('t', 'trigger', 0.5, 0, { label: 'Abandoned Cart' }),
      n('m1', 'message', 0.5, 1, { channel: 'sms', label: 'Cart Reminder', content: { body: 'You left something behind: {{short_url}}' } }),
      n('w1', 'wait', 0.5, 2, { waitHours: 24, label: '1 day' }),
      n('c1', 'condition', 0.5, 3, { conditionType: 'clicked_previous', label: 'Clicked?' }),
      n('m2', 'message', 0.2, 4, { channel: 'sms', label: 'Thank You + Offer', sublabel: '10% Off', content: { body: 'Thanks! Here is 10% off.' } }),
      n('x1', 'end', 0.2, 5, { label: 'End' }),
      n('m3', 'message', 0.8, 4, { channel: 'sms', label: 'Last Chance Reminder', content: { body: 'Last chance - your cart expires soon.' } }),
      n('w2', 'wait', 0.8, 5, { waitHours: 24, label: '1 day' }),
      n('x2', 'end', 0.8, 6, { label: 'End' }),
    ],
    edges: [e('t', 'm1'), e('m1', 'w1'), e('w1', 'c1'), e('c1', 'm2', 'yes'), e('c1', 'm3', 'no'), e('m2', 'x1'), e('m3', 'w2'), e('w2', 'x2')],
  },
  whatsapp: {
    nodes: [
      n('t', 'trigger', 0.55, 0, { label: 'Order Shipped' }),
      n('m1', 'message', 0.55, 1, { channel: 'whatsapp', label: 'Order Update', content: { body: 'Your order {{2}} has been shipped.' } }),
      n('w1', 'wait', 0.55, 2, { waitHours: 1, label: '1 hour' }),
      n('c1', 'condition', 0.55, 3, { label: 'Order delivered?' }),
      n('m2', 'message', 0.2, 4, { channel: 'whatsapp', label: 'Delivery Confirmation', content: { body: 'Your order was delivered.' } }),
      n('m3', 'message', 0.85, 4, { channel: 'whatsapp', label: 'Need help?', content: { body: 'Need help with your delivery?' } }),
      n('w2', 'wait', 0.55, 5, { waitHours: 24, label: '24 hours' }),
      n('m4', 'message', 0.55, 6, { channel: 'whatsapp', label: 'Feedback Request', content: { body: 'How did we do?' } }),
    ],
    edges: [e('t', 'm1'), e('m1', 'w1'), e('w1', 'c1'), e('c1', 'm2', 'yes'), e('c1', 'm3', 'no'), e('m2', 'w2'), e('m3', 'w2'), e('w2', 'm4')],
  },
  rcs: {
    nodes: [
      n('t', 'trigger', 0.5, 0, { label: 'RCS Campaign Start' }),
      n('m1', 'message', 0.5, 1, { channel: 'rcs', label: 'RCS Rich Message', content: { headline: 'New arrivals are here', body: 'Tap to explore.' } }),
      n('c1', 'condition', 0.5, 2, { label: 'Engaged with card?' }),
      n('a1', 'action', 0.26, 3, { actionKind: 'open_url', label: 'Product Page' }),
      n('c2', 'condition', 0.26, 4, { label: 'Clicked "Buy"?' }),
      n('a2', 'action', 0.15, 5, { actionKind: 'webhook', label: 'Purchase Event' }),
      n('x', 'end', 0.15, 6, { label: 'End' }),
      n('m2', 'message', 0.74, 3, { channel: 'rcs', label: 'RCS Reminder', content: { headline: 'Still interested?', body: 'Your picks are waiting.' } }),
      n('m3', 'message', 0.74, 4.8, { channel: 'sms', fallback: true, label: 'SMS Message', content: { body: 'New arrivals at Acme: {{short_url}}' } }),
    ],
    edges: [e('t', 'm1'), e('m1', 'c1'), e('c1', 'a1', 'yes'), e('c1', 'm2', 'no'), e('a1', 'c2'), e('c2', 'a2', 'yes'), e('c2', 'x', 'no'), e('a2', 'x'), e('m2', 'm3', 'no')],
  },
  push: {
    nodes: [
      n('m1', 'message', 0.5, 0, { channel: 'push', label: 'Browse Abandonment', content: { headline: 'Still browsing?', body: 'Your picks are waiting.' } }),
      n('w1', 'wait', 0.5, 1, { waitHours: 1, label: '1 hour' }),
      n('m2', 'message', 0.5, 2, { channel: 'push', label: 'Still thinking?', content: { headline: 'Still thinking?', body: 'Come back and check out.' } }),
      n('c1', 'condition', 0.5, 3, { conditionType: 'clicked_previous', label: 'Clicked?' }),
      n('w2', 'wait', 0.15, 4, { waitHours: 24, label: '1 day' }),
      n('m3', 'message', 0.15, 5, { channel: 'push', label: 'Back in stock!', content: { headline: 'Back in stock!', body: 'Grab it before it goes.' } }),
      n('m4', 'message', 0.85, 4, { channel: 'push', label: 'We miss you', emoji: true, content: { headline: 'We miss you', body: 'Here is something new.' } }),
      n('w3', 'wait', 0.85, 5, { waitHours: 72, label: '3 days' }),
      n('m5', 'message', 0.85, 6, { channel: 'push', label: 'Final offer inside', content: { headline: 'Final offer inside', body: 'Our last offer for you.' } }),
    ],
    edges: [e('m1', 'w1'), e('w1', 'm2'), e('m2', 'c1'), e('c1', 'w2', 'yes'), e('c1', 'm4', 'no'), e('w2', 'm3'), e('m4', 'w3'), e('w3', 'm5')],
  },
  journeys: {
    nodes: [
      n('t', 'trigger', 0.5, 0, { label: 'User signs up', stats: { count: 52_430, label: 'Entered' } }),
      n('m1', 'message', 0.5, 1, { channel: 'email', label: 'Welcome Email', content: { subject: 'Welcome to Acme!', from: 'Acme Marketing <hello@acme.com>', body: "Hi {{first_name}},\nWe're excited to have you with us. Here's what you can do next.", cta: 'Explore now' }, stats: { count: 48_126, rate: 91.8 } }),
      n('w1', 'wait', 0.5, 2, { waitHours: 24, label: '1 day', stats: { count: 47_038, rate: 87.3 } }),
      n('m2', 'message', 0.5, 3, { channel: 'whatsapp', label: 'Product Guide', content: { body: 'Here is your product guide.' }, stats: { count: 36_854, rate: 78.4 } }),
      n('c1', 'condition', 0.5, 4, { label: 'Engaged with guide?' }),
      n('m3', 'message', 0.18, 5, { channel: 'sms', label: 'Exclusive Offer', content: { body: 'An exclusive offer for you.' }, stats: { count: 24_821, rate: 67.3 } }),
      n('m4', 'message', 0.82, 5, { channel: 'email', label: 'Helpful Resources', content: { subject: 'Resources to get started', body: 'Guides and tips.' }, stats: { count: 11_789, rate: 55.6 } }),
      n('w2', 'wait', 0.5, 6, { waitHours: 48, label: '2 days' }),
      n('c2', 'condition', 0.5, 7, { label: 'Made a purchase?' }),
      n('m5', 'message', 0.2, 8, { channel: 'email', label: 'Thank You', content: { subject: 'Thank you!', body: 'Thanks for your order.' }, stats: { count: 53_982, rate: 63.3 } }),
      n('m6', 'message', 0.8, 8, { channel: 'push', label: 'Reminder', content: { headline: 'Still deciding?', body: 'Your picks are waiting.' }, stats: { count: 8_112, rate: 36.7 } }),
      n('x1', 'end', 0.2, 9, { label: 'End' }),
      n('x2', 'end', 0.8, 9, { label: 'End' }),
    ],
    edges: [e('t', 'm1'), e('m1', 'w1'), e('w1', 'm2'), e('m2', 'c1'), e('c1', 'm3', 'yes'), e('c1', 'm4', 'no'), e('m3', 'w2'), e('m4', 'w2'), e('w2', 'c2'), e('c2', 'm5', 'yes'), e('c2', 'm6', 'no'), e('m5', 'x1'), e('m6', 'x2')],
  },
}

// name, type, status, health, audience, inFlow, entered, onTrack, conversion, priorConversion, owner, updatedMin, nextLaunchDays, canvasKey
const JOURNEYS = [
  ['Welcome Series', 'onboarding', 'active', 'good', 'High Value Customers', 52_430, 64_120, 94.1, 18.7, 16.9, 0, 2, null, 'journeys'],
  ['Abandoned Cart', 'transactional', 'active', 'at_risk', 'Cart Abandoners', 98_412, 121_004, 81.2, 24.5, 22.4, 1, 15, -3, 'sms'],
  ['Win Back Campaign', 're_engagement', 'active', 'good', 'Inactive 90+ Days', 76_541, 90_338, 93.5, 12.2, 10.9, 2, 60, -2, 'push'],
  ['Post-Purchase Flow', 'transactional', 'active', 'good', 'All Customers', 134_221, 150_778, 95.2, 28.9, 26.3, 3, 120, null, 'whatsapp'],
  ['Re-engagement Pro', 're_engagement', 'paused', 'at_risk', 'Inactive 30+ Days', 42_118, 60_402, 78.6, 9.8, 10.4, 4, 180, -0.5, 'push'],
]
const JOURNEY_FILLER = ['VIP Nurture', 'Cart Recovery', 'Browse Recovery', 'Birthday Rewards', 'Loyalty Onboarding', 'Replenishment', 'Review Request Flow', 'Referral Journey', 'Trial Conversion', 'Subscription Renewal', 'Back in Stock Flow', 'Price Drop Flow', 'Sunset Policy', 'Holiday Countdown', 'Event Follow-up', 'App Onboarding', 'Wishlist Nudge', 'Cross-sell Flow', 'Win Back 60d', 'Store Visit Follow-up', 'Membership Upgrade', 'Product Education', 'Survey Follow-up']

// ---------------------------------------------------------------- templates
// name, channel, category, status, owner, uses, recipients, reuse, uplift, updatedDays, image, preview
const TEMPLATES = [
  ['Welcome Series - Email 1', 'email', 'lifecycle', 'published', 0, 842, 124_832, 8.6, 19.6, 0.3, 'desk', { preview: 'Welcome to Acme! Here\'s...', subject: 'Welcome to Acme! Here\'s what\'s next', body: "Hi {{first_name}},\nThanks for joining Acme! We're excited to have you on board.", cta_label: 'Explore your account', cta_url: 'https://acme.com/get-started', headline: 'Hi {{first_name}}', tags: ['Welcome', 'Product Interest: Shoes', 'Onboarding'], segments: ['High Value Customers', 'New Subscribers', 'VIP'], lastUsedDays: 110 }],
  ['Abandoned Cart - SMS', 'sms', 'transactional', 'published', 1, 621, 98_412, 6.2, 15.2, 1.3, 'sneaker', { preview: 'Still thinking it over?', body: 'Still thinking it over? Your cart is waiting: {{short_url}}' }],
  ['Post Purchase - WhatsApp', 'whatsapp', 'transactional', 'published', 2, 512, 76_541, 7.1, 21.3, 2.3, 'tote', { preview: 'Thanks for your order...', body: 'Thanks for your order {{1}}! We will keep you posted.' }],
  ['Win Back - Email', 'email', 'retention', 'in_review', 3, 309, 54_201, 4.7, 8.1, 3.3, 'headphones', { preview: 'We miss you!', subject: 'We miss you!', body: 'It has been a while. Here is 15% off.' }],
  ['Shipping Update - SMS', 'sms', 'transactional', 'published', 4, 1_120, 211_340, 9.3, 17.8, 4.3, 'backpack', { preview: 'Your order is on the way', body: 'Your order {{order_id}} is on the way.' }],
  ['Back in Stock - Push', 'push', 'engagement', 'draft', 0, 182, 32_118, 2.1, null, 4.3, 'sneaker_white', { preview: "Good news! It's back.", headline: 'Good news!', body: "It's back in stock." }],
]
const TEMPLATE_WORDS = {
  base: ['Welcome', 'Order Confirmation', 'Shipping Update', 'Delivery Update', 'Back in Stock', 'Price Drop', 'Flash Sale', 'VIP Offer', 'Birthday', 'Anniversary', 'Review Request', 'Referral Invite', 'Survey Invite', 'Win Back', 'Re-engagement', 'Loyalty Update', 'Payment Reminder', 'Renewal Notice', 'Event Invite', 'Product Launch', 'Promo Code', 'Summer Sale', 'Spring Sale', 'Holiday Offer', 'Cart Reminder', 'Wishlist Nudge', 'Restock Alert', 'Appointment Reminder', 'Password Reset', 'Account Update', 'Weekly Newsletter', 'New Arrivals'],
  channel: ['email', 'sms', 'whatsapp', 'rcs', 'push'],
  category: ['lifecycle', 'transactional', 'retention', 'engagement', 'promotional'],
}

// ---------------------------------------------------------------- channel configs (provider-reported state)
const CHANNEL_CONFIGS = {
  email: {
    provider: 'Resend',
    config: {
      from_identities: ['Acme Marketing <hello@acme.com>', 'Acme Support <support@acme.com>', 'Acme News <news@acme.com>'],
      reply_to: ['hello@acme.com', 'support@acme.com'],
      domains: [
        { domain: 'acme.com', spf: 'pass', dkim: 'pass', dmarc: 'pass', status: 'healthy' },
        { domain: 'email.acme.com', spf: 'pass', dkim: 'pass', dmarc: 'pass', status: 'healthy' },
        { domain: 'mail.acme.com', spf: 'pass', dkim: 'pass', dmarc: 'pass', status: 'healthy' },
        { domain: 'news.acme.com', spf: 'pass', dkim: 'fail', dmarc: 'pass', status: 'warning', issue: 'DKIM record missing for selector s2' },
      ],
    },
  },
  sms: {
    provider: 'Twilio',
    config: {
      sender_ids: ['AcmeOffers', 'AcmeAlerts', '+1 415 555 0142'],
      unverified_sender_ids: 2,
      alerts: [
        { id: 'tendlc', title: '10DLC registration expires', sub: 'AcmeOffers', value: 'In 12 days', severity: 'amber', kind: 'registration' },
        { id: 'flagged', title: 'Message content flagged', sub: 'Promo: Spring Sale', value: 'Needs review', severity: 'red', kind: 'content' },
        { id: 'optout', title: 'Opt-out language missing', sub: '2 templates', value: 'Warning', severity: 'amber', kind: 'optout' },
      ],
      carriers: [{ key: 'verizon', label: 'Verizon Wireless', note: 'Elevated failure rate' }, { key: 'att', label: 'AT&T', note: 'Route congestion' }, { key: 'tmobile', label: 'T-Mobile', note: 'Normal' }],
    },
  },
  whatsapp: {
    provider: 'WhatsApp (Meta)',
    config: {
      quality: { rating: 'High', score: 92, tier: 'High', window_days: 30 },
      components: [{ label: 'WhatsApp (Meta)', status: 'operational' }, { label: 'Phone numbers', status: 'operational' }, { label: 'Webhooks', status: 'operational' }],
      failed_issues: [{ label: 'Invalid phone number', count: 1024 }, { label: 'Temporarily blocked', count: 412 }, { label: 'Rate limited', count: 198 }],
      quality_alerts: [
        { title: 'Low read rate', sub: 'order_update_v2', value: '72.1%' },
        { title: 'High opt-outs', sub: 'promotion_may_v1', value: '1.8%' },
        { title: 'Spam reports detected', sub: 'feedback_request_v1', value: '0.6%' },
      ],
      pricing_note: 'WhatsApp messages are charged per conversation.',
    },
  },
  rcs: {
    provider: 'LivePerson',
    config: {
      sender: 'Acme Store', verified: true,
      brand: { brand: 'Acme Store', business: 'Acme Retail Ltd.', agent: 'LivePerson', last_verified_days: 0, brand_status: 'Verified', business_status: 'Verified', agent_status: 'Connected' },
      diagnostics: [{ label: 'RCS Agent', status: 'operational' }, { label: 'Fallback (SMS)', status: 'operational' }, { label: 'Fallback (Email)', status: 'operational' }, { label: 'LivePerson', status: 'operational' }, { label: 'Google Jibe Cloud', status: 'operational' }],
      agent_issues: 12,
      delivery_alerts: [
        { title: 'High fallback rate', sub: 'BlackBerry devices', value: '6.3%', severity: 'red', icon: 'shield' },
        { title: 'Unsupported device spike', sub: 'Samsung S8 & older', value: '4.2%', severity: 'amber', icon: 'warning' },
        { title: 'Agent response latency', sub: 'LivePerson', value: '1.2s', severity: 'red', icon: 'chat' },
      ],
    },
  },
  push: {
    provider: 'Firebase Cloud Messaging',
    config: {
      components: [{ label: 'Mobile SDK', status: 'operational' }, { label: 'Web Push', status: 'operational' }, { label: 'API', status: 'operational' }],
      issues: [
        { label: 'iOS notification failures', rate: 0.7, delta: 0.2 },
        { label: 'Android delivery failures', rate: 0.4, delta: 0.1 },
        { label: 'Web push failures', rate: 1.2, delta: -0.3 },
      ],
      timezone: '(GMT-07:00) Pacific Time (US & Canada)',
    },
  },
}

// ---------------------------------------------------------------- breakdowns (30-day period)
const BREAKDOWNS = [
  // channel, dimension, key, label, sent, delivered, opened, clicked, replied, converted, failed, opt_outs
  ['email', 'mailbox_provider', 'gmail', 'Gmail', 612_000, 603_432, 0, 0, 0, 0, 0, 0],
  ['email', 'mailbox_provider', 'icloud', 'Apple iCloud', 248_000, 243_536, 0, 0, 0, 0, 0, 0],
  ['email', 'mailbox_provider', 'microsoft', 'Microsoft 365', 196_000, 192_276, 0, 0, 0, 0, 0, 0],
  ['email', 'mailbox_provider', 'yahoo', 'Yahoo! Mail', 104_000, 101_712, 0, 0, 0, 0, 0, 0],
  ['email', 'mailbox_provider', 'other', 'Others', 80_000, 78_400, 0, 0, 0, 0, 0, 0],
  ['sms', 'carrier', 'verizon', 'Verizon Wireless', 310_000, 301_320, 0, 0, 0, 0, 8_680, 0],
  ['sms', 'carrier', 'att', 'AT&T', 280_000, 274_680, 0, 0, 0, 0, 5_320, 0],
  ['sms', 'carrier', 'tmobile', 'T-Mobile', 266_200, 265_668, 0, 0, 0, 0, 532, 0],
  ['sms', 'message_status', 'unique', 'Unique', 742_100, 0, 0, 0, 0, 0, 0, 0],
  ['sms', 'message_status', 'duplicate', 'Duplicates', 114_100, 0, 0, 0, 0, 0, 0, 0],
  ['sms', 'message_status', 'unique_clicks', 'Unique clicks', 0, 0, 0, 65_900, 0, 0, 0, 0],
  ['sms', 'message_status', 'total_clicks', 'Total clicks', 0, 0, 0, 82_300, 0, 0, 0, 0],
  ['sms', 'message_status', 'opt_ins', 'Opt-ins', 0, 0, 0, 0, 0, 0, 0, 1_200],
  ['sms', 'message_status', 'replied', 'Replied', 0, 80_300, 0, 0, 12_300, 0, 0, 0],
  ['whatsapp', 'message_status', 'opened', 'Opened', 216_700, 0, 216_700, 0, 0, 0, 0, 0],
  ['whatsapp', 'message_status', 'replied', 'Replied', 18_300, 0, 0, 0, 18_300, 0, 0, 0],
  ['whatsapp', 'message_status', 'clicked', 'Clicked', 12_200, 0, 0, 12_200, 0, 0, 0, 0],
  ['whatsapp', 'message_status', 'bounced', 'Bounced', 1_400, 0, 0, 0, 0, 0, 1_400, 0],
  ['whatsapp', 'conversation_state', 'active', 'Active', 179_700, 0, 0, 0, 0, 0, 0, 0],
  ['whatsapp', 'conversation_state', 'closed', 'Closed', 59_900, 0, 0, 0, 0, 0, 0, 0],
  ['whatsapp', 'conversation_state', 'expired', 'Expired', 9_000, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'rcs_support', 'android_jibe', 'Android (Jibe)', 212_456, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'rcs_support', 'android_other', 'Android (Other)', 52_329, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'rcs_support', 'ios', 'iOS', 17_081, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'rcs_support', 'windows', 'Windows', 112, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'rcs_support', 'unsupported', 'Unsupported', 60_133, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'message_status', 'card_clicks', 'Card clicks', 0, 0, 0, 115_600, 0, 0, 0, 0],
  ['rcs', 'message_status', 'replies', 'Replies', 0, 0, 0, 0, 35_900, 0, 0, 0],
  ['rcs', 'message_status', 'calls', 'Calls', 0, 0, 0, 7_900, 0, 0, 0, 0],
  ['rcs', 'message_status', 'other_actions', 'Other actions', 0, 0, 0, 6_100, 0, 0, 0, 0],
  ['rcs', 'fallback', 'sms', 'SMS', 132_300, 0, 0, 0, 0, 0, 0, 0],
  ['rcs', 'fallback', 'email', 'Email', 21_900, 0, 0, 0, 0, 0, 0, 0],
  ['push', 'device_os', 'ios', 'iOS', 3_328_590, 3_255_363, 0, 0, 0, 0, 0, 0],
  ['push', 'device_os', 'android', 'Android', 2_101_410, 2_055_179, 0, 0, 0, 0, 0, 0],
  ['push', 'platform', 'app', 'App', 4_266_980, 4_178_838, 0, 0, 0, 0, 0, 0],
  ['push', 'platform', 'web', 'Web', 1_163_020, 1_131_704, 0, 0, 0, 0, 0, 0],
]

// ---------------------------------------------------------------- activity
// [minutes ago, entity, action, summary, surface]
const ACTIVITY = [
  [2, 'message', 'sent', 'Welcome Series message sent', 'email'],
  [2, 'message', 'sent', 'Spring Sale email sent', 'email'],
  [3, 'message', 'sent', 'Spring Sale SMS sent', 'sms'],
  [2, 'message', 'sent', 'Summer Sale push sent', 'push'],
  [2, 'message', 'sent', 'RCS campaign "New Arrivals" sent', 'rcs'],
  [2, 'journey', 'completed', 'Order Update Flow completed', 'whatsapp'],
  [2, 'journey', 'updated', 'Welcome Series updated', 'journeys'],
  [2, 'template', 'published', 'Shipping Update - SMS published by Emma Davis', 'templates'],
  [5, 'message', 'opened', 'Welcome Series email opened', 'email'],
  [12, 'message', 'engagement_spike', 'Carousel interaction spike', 'rcs'],
  [12, 'message', 'paused', 'Abandoned Cart push paused', 'push'],
  [15, 'message', 'paused', 'Abandoned Cart SMS paused', 'sms'],
  [15, 'message', 'paused', 'Abandoned Cart email paused', 'email'],
  [15, 'journey', 'paused', 'Re-engagement Pro paused', 'journeys'],
  [18, 'journey', 'fallback_increase', 'Fallback to SMS increased', 'rcs'],
  [18, 'template', 'approved', 'Template order_update_v2 approved', 'whatsapp'],
  [18, 'template', 'published', 'Welcome Series - Email 1 published by Liam Chen', 'templates'],
  [20, 'journey', 'updated', 'Re-engagement journey updated', 'push'],
  [22, 'journey', 'updated', 'Spring Promo journey updated', 'overview'],
  [22, 'journey', 'launched', 'Win Back Campaign launched', 'journeys'],
  [22, 'message', 'sent', 'Order Confirmation email sent', 'email'],
  [32, 'journey', 'paused', 'Abandoned Cart flow paused', 'whatsapp'],
  [34, 'channel', 'brand_updated', 'Brand profile updated', 'rcs'],
  [35, 'system', 'bounce_alert', 'Bounce rate alert triggered', 'email'],
  [45, 'template', 'submitted', 'Promo Code - Email submitted for review', 'templates'],
  [45, 'system', 'quality_alert', 'Quality alert: Low read rate', 'whatsapp'],
  [60, 'template', 'approved', 'Template "Flash Sale" approved', 'overview'],
  [60, 'template', 'approved', 'Email template approved', 'email'],
  [60, 'template', 'updated', 'SMS template "May Promo" updated', 'sms'],
  [60, 'journey', 'approved', 'VIP Nurture approved', 'journeys'],
  [60, 'channel', 'agent_resolved', 'Agent issue resolved', 'rcs'],
  [60, 'message', 'approved', 'Welcome Series push approved', 'push'],
  [60, 'template', 'drafted', 'Back in Stock - Push draft saved by Ava Martinez', 'templates'],
  [60, 'template', 'updated', 'Welcome Template updated', 'whatsapp'],
  [120, 'template', 'synced', 'WhatsApp template synced', 'overview'],
  [120, 'channel', 'domain_updated', 'Domain SPF record updated', 'email'],
  [120, 'system', 'optout_spike', 'Opt-out spike detected', 'sms'],
  [120, 'message', 'click_improved', 'Rich card click rate improved', 'rcs'],
  [120, 'system', 'failed_spike', 'Spike in failed messages', 'whatsapp'],
  [120, 'channel', 'quiet_hours', 'iOS quiet hours updated', 'push'],
  [120, 'journey', 'updated', 'Post-Purchase Flow updated', 'journeys'],
  [180, 'system', 'audit_passed', 'Compliance audit passed', 'sms'],
  [240, 'channel', 'carrier_resolved', 'Carrier issue resolved (AT&T)', 'sms'],
]

// ---------------------------------------------------------------- seed one workspace
async function seedWorkspace(workspaceId) {
  console.log(`Seeding messaging demo into ${workspaceId}`)
  for (const table of ['messaging_activity', 'messaging_metrics_breakdown', 'messaging_metrics_daily', 'messaging_delivery_events', 'messaging_messages', 'messaging_journeys', 'messaging_templates', 'messaging_audiences', 'messaging_channel_configs']) {
    await must(admin.from(table).delete().eq('workspace_id', workspaceId), `clear ${table}`)
  }

  // Contacts are shared with Inbox (its own is_demo rows): only remove the sample this script created.
  await must(admin.from('messaging_contacts').delete().eq('workspace_id', workspaceId).contains('tags', ['Messaging demo']), 'clear messaging demo contacts')
  await must(admin.from('messaging_contacts').delete().eq('workspace_id', workspaceId).eq('source', 'import').contains('tags', ['Demo']).like('email', '%@example.com'), 'clear legacy messaging demo contacts')

  const { data: members } = await admin.from('workspace_members').select('user_id').eq('workspace_id', workspaceId)
  const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', (members ?? []).map(m => m.user_id))
  const byName = new Map((profiles ?? []).map(p => [p.full_name, p.id]))
  const { data: workspace } = await admin.from('workspaces').select('owner_id').eq('id', workspaceId).single()
  const owner = index => byName.get(PEOPLE[index % PEOPLE.length]) ?? workspace.owner_id

  const images = await uploadImages(workspaceId)

  // Channel configs
  await must(admin.from('messaging_channel_configs').insert(Object.entries(CHANNEL_CONFIGS).map(([channel, c]) => ({
    workspace_id: workspaceId, channel, status: 'connected', provider: c.provider, config: c.config,
    connected_at: ago(60 * 24 * 90), last_checked_at: ago(4),
  }))), 'channel configs')

  // Audiences + a small real contact sample per audience (consent-aware), with
  // the full-population rollup stored in channel_reach.
  const audienceRows = AUDIENCES.map(([name, size, tags, exclusions, reach, risk, extra], index) => ({
    workspace_id: workspaceId, name, segment_type: 'dynamic', tags, exclusions, contact_count: size, owner_id: owner(index),
    description: `Demo segment: ${name}`,
    filter_definition: extra,
    channel_reach: Object.fromEntries(Object.entries(reach).map(([channel, pct]) => {
      const eligible = round(size * pct / 100)
      const riskyShare = channel === 'email' ? risk : { risky: 0, ineligible: 0, unknown: 0 }
      return [channel, {
        eligible: channel === 'email' ? round(size * (100 - risk.risky - risk.ineligible - risk.unknown) / 100) : eligible,
        risky: round(size * riskyShare.risky / 100), ineligible: round(size * riskyShare.ineligible / 100), unknown: round(size * riskyShare.unknown / 100),
      }]
    })),
    updated_at: ago(index * 30),
  }))
  const audiences = await insertChunks('messaging_audiences', audienceRows)
  const audienceByName = new Map(audiences.map(a => [a.name, a]))
  audienceByName.set('High Value Users', audienceByName.get('High Value WhatsApp Users'))

  rand = mulberry32(99)
  const sampleContacts = []
  const firstNames = ['Olivia', 'Jack', 'Amelia', 'Harry', 'Isla', 'George', 'Ava', 'Noah', 'Mia', 'Leo', 'Freya', 'Oscar']
  const lastNames = ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright']
  for (let i = 0; i < 240; i++) {
    const first = firstNames[i % firstNames.length], last = lastNames[(i * 7) % lastNames.length]
    sampleContacts.push({
      workspace_id: workspaceId, full_name: `${first} ${last}`,
      email: `${first}.${last}.${i}@example.com`.toLowerCase(), phone: `+44 7700 9${String(i).padStart(5, '0')}`,
      whatsapp_id: rand() > 0.35 ? `44770090${String(i).padStart(4, '0')}` : null,
      rcs_id: rand() > 0.3 ? `rcs-${i}` : null, push_token: rand() > 0.4 ? `demo-token-${i}` : null,
      tags: ['Messaging demo'], region: ['United Kingdom', 'United States', 'Canada'][i % 3], source: 'import',
      email_consent: rand() > 0.03, sms_consent: rand() > 0.1, whatsapp_consent: rand() > 0.3, push_consent: rand() > 0.35, rcs_consent: rand() > 0.3,
      do_not_contact: i % 97 === 0,
    })
  }
  const contacts = await insertChunks('messaging_contacts', sampleContacts)
  const memberRows = []
  audiences.forEach((audience, aIndex) => {
    contacts.forEach((contact, cIndex) => { if ((cIndex + aIndex) % 4 === 0) memberRows.push({ audience_id: audience.id, contact_id: contact.id }) })
  })
  await insertChunks('messaging_audience_members', memberRows)

  // Templates
  rand = mulberry32(4242)
  const templateRows = TEMPLATES.map(([name, channel, category, status, ownerIndex, uses, recipients, reuse, uplift, updatedDays, image, preview]) => ({
    workspace_id: workspaceId, name, channel, category, status, owner_id: owner(ownerIndex), usage_count: uses, unique_recipients: recipients,
    avg_reuse_rate: reuse, ctr_uplift: uplift, preview_image_url: images[image], preview,
    content: { subject: preview.subject, body: preview.body, headline: preview.headline, cta_label: preview.cta_label, cta_url: preview.cta_url },
    variables: ['first_name', 'last_name', 'order_id', 'product_name', 'short_url'], tags: preview.tags ?? ['Welcome'],
    last_used_at: ago((preview.lastUsedDays ?? 3) * 1440), published_at: status === 'published' ? ago((updatedDays + 30) * 1440) : null,
    prior_rates: { avg_reuse_rate: reuse - 0.6, ctr_uplift: uplift ? uplift - 2 : null },
    created_at: ago((updatedDays + 200) * 1440), updated_at: ago(updatedDays * 1440 + 60),
  }))
  const whatsappTemplateNames = ['order_update_v2', 'abandoned_cart_v3', 'payment_reminder_v1', 'welcome_v2', 'offer_ending_soon_v1', 'feedback_request_v1', 'payment_reminder_v1b', 'delivery_exception_v1', 'offer_ending_soon_v2']
  whatsappTemplateNames.forEach((name, index) => {
    const inReview = ['payment_reminder_v1b', 'delivery_exception_v1', 'offer_ending_soon_v2'].includes(name)
    templateRows.push({
      workspace_id: workspaceId, name: inReview ? name.replace('_v1b', '_v1') : name, channel: 'whatsapp', category: 'transactional',
      status: inReview ? 'in_review' : 'published', owner_id: owner(index), usage_count: 40 + index * 11, unique_recipients: 9000 + index * 1300,
      avg_reuse_rate: 5 + index * 0.3, ctr_uplift: 6 + index, provider_template_id: `meta_${name}`,
      provider_status: inReview ? (index === 6 ? 'under_review' : 'in_review') : 'approved',
      content: { body: `Template ${name}` }, variables: ['1', '2', '3'], tags: ['WhatsApp'],
      preview: { preview: `Template ${name}`, conversion_rate: [12.4, 8.7, 4.9, 6.1, 5.3, 2.1][index] ?? null },
      published_at: inReview ? null : ago(200 * 1440), created_at: ago(260 * 1440), updated_at: ago(((index * 17) % 3 + 2) * 1440 * (inReview ? 1 : 30)),
    })
  })
  // Generated library to the design's scale: 1,268 templates (842 published, 83 in review).
  const statusPlan = []
  const generatedCount = 1268 - templateRows.length - 6
  const publishedTarget = 842 - templateRows.filter(t => t.status === 'published').length
  const reviewTarget = 83 - templateRows.filter(t => t.status === 'in_review').length
  for (let i = 0; i < generatedCount; i++) statusPlan.push(i < publishedTarget ? 'published' : i < publishedTarget + reviewTarget ? 'in_review' : 'draft')
  for (let i = 0; i < generatedCount; i++) {
    const base = TEMPLATE_WORDS.base[i % TEMPLATE_WORDS.base.length]
    const channel = TEMPLATE_WORDS.channel[(i * 3) % 5]
    const status = statusPlan[(i * 7919) % generatedCount]
    const createdDays = i < 138 ? 1 + (i % 29) : 31 + ((i * 13) % 500)
    const updatedDays = i < 20 ? 1 + (i % 28) : 31 + ((i * 11) % 400)
    const uses = round(5 + rand() * 600)
    templateRows.push({
      workspace_id: workspaceId, name: `${base} - ${channel === 'sms' || channel === 'rcs' ? channel.toUpperCase() : channel[0].toUpperCase() + channel.slice(1)} ${1 + (i % 40)}`,
      channel, category: TEMPLATE_WORDS.category[i % 5], status, owner_id: owner(i),
      usage_count: uses, unique_recipients: uses * round(40 + rand() * 120),
      avg_reuse_rate: Number((7.6 + (rand() - 0.5) * 6).toFixed(1)),
      ctr_uplift: status === 'draft' ? null : Number((18.4 + (rand() - 0.5) * 14).toFixed(1)),
      prior_rates: { avg_reuse_rate: 7.0, ctr_uplift: 15.8 },
      content: { body: `${base} message` }, variables: ['first_name'], tags: [base.split(' ')[0]],
      preview: { preview: `${base} message` },
      last_used_at: ago(((i * 37) % 180 + 1) * 1440),
      published_at: status === 'published' ? ago((createdDays > 30 && i % 11 ? createdDays : 5 + (i % 20)) * 1440) : null,
      created_at: ago(createdDays * 1440), updated_at: ago(updatedDays * 1440),
      approval_priority: status === 'in_review' ? ['high', 'medium', 'low'][i % 3] : null,
    })
  }
  // Approval queue / expiring approvals / stale / governance fixtures
  const templates = await insertChunks('messaging_templates', templateRows)
  const tByName = new Map(templates.map(t => [t.name, t]))
  const approvalFixtures = [
    ['Win Back - SMS', 'sms', 'retention', 'in_review', 0, 'high', 2, 1],
    ['Promo Code - Email', 'email', 'promotional', 'in_review', 1, 'medium', 4, 1],
    ['Summer Sale - Push', 'push', 'promotional', 'in_review', 4, 'medium', 6, 1],
  ]
  const approvals = await insertChunks('messaging_templates', approvalFixtures.map(([name, channel, category, status, ownerIndex, priority, expiresDays, updatedDays]) => ({
    workspace_id: workspaceId, name, channel, category, status, owner_id: owner(ownerIndex), approval_priority: priority,
    approval_expires_at: inDays(expiresDays), usage_count: 0, unique_recipients: 0, avg_reuse_rate: 0,
    content: { body: name }, preview: { preview: name }, created_at: ago(20 * 1440), updated_at: ago(updatedDays * 1440 + 200),
  })))
  await insertChunks('messaging_templates', [
    ['Product Launch - Email', 'email', 86], ['Referral Invite - SMS', 'sms', 64], ['Survey Invite - Email', 'email', 42],
  ].map(([name, channel, uses], index) => ({
    workspace_id: workspaceId, name, channel, category: 'engagement', status: 'published', owner_id: owner(index),
    usage_count: uses, unique_recipients: uses * 90, avg_reuse_rate: 1.2, ctr_uplift: 2.1, content: { body: name }, preview: { preview: name },
    last_used_at: ago(91 * 1440), published_at: ago(300 * 1440), created_at: ago(320 * 1440), updated_at: ago(95 * 1440),
  })))
  // Six design fixture rows must sort first on "updated" - bump their timestamps last.
  for (const [i, t] of TEMPLATES.entries()) {
    await admin.from('messaging_templates').update({ updated_at: ago(i * 1440 + 60) }).eq('id', tByName.get(t[0]).id)
  }

  // Journeys
  const journeyRows = []
  JOURNEYS.forEach(([name, type, status, health, audience, inFlow, entered, onTrack, conversion, prior, ownerIndex, updatedMin, nextLaunch, canvasKey]) => {
    journeyRows.push({
      workspace_id: workspaceId, name, journey_type: type, status, health, audience_id: audienceByName.get(audience)?.id,
      contacts_in_flow: inFlow, total_entered: entered, on_track_rate: onTrack, conversion_rate: conversion, prior_conversion_rate: prior,
      owner_id: owner(ownerIndex), canvas: CANVASES[canvasKey], trigger: { label: CANVASES[canvasKey].nodes[0].label },
      next_launch_at: nextLaunch === null ? null : inDays(-nextLaunch + 0), last_launch_at: ago(updatedMin + 600),
      description: canvasKey === 'journeys' ? 'Customer Onboarding' : null,
      created_at: ago(90 * 1440), updated_at: ago(updatedMin),
    })
  })
  rand = mulberry32(5150)
  JOURNEY_FILLER.forEach((name, index) => {
    const inFlow = round(20_000 + rand() * 40_000)
    journeyRows.push({
      workspace_id: workspaceId, name, journey_type: ['lifecycle', 'transactional', 're_engagement', 'onboarding'][index % 4],
      status: 'active', health: index === 3 ? 'at_risk' : 'good', audience_id: audiences[index % audiences.length].id,
      contacts_in_flow: inFlow, total_entered: round(inFlow * 1.2), on_track_rate: Number((92 + rand() * 6).toFixed(1)),
      conversion_rate: Number((12 + rand() * 18).toFixed(1)), prior_conversion_rate: Number((11 + rand() * 16).toFixed(1)),
      owner_id: owner(index), canvas: CANVASES.journeys, trigger: { label: 'User signs up' },
      next_launch_at: index < 7 ? inDays(1 + index) : null, created_at: ago(120 * 1440), updated_at: ago(300 + index * 400),
    })
  })
  // Drafts that the channel pages select as their journey canvas, and the pending approvals.
  const drafts = [
    ['Welcome Series v2', 'overview', 'lifecycle', 'draft', 'High Value Customers', 30, { approval: 'pending', approval_note: 'Created 5h ago' }],
    ['Welcome Series - Email', 'email', 'lifecycle', 'draft', 'High Value Customers', 20, {}],
    ['SMS Abandoned Cart', 'sms', 'transactional', 'draft', 'Cart Abandoners', 25, {}],
    ['Product Launch', 'rcs', 'lifecycle', 'draft', 'RCS Active Shoppers', 35, {}],
    ['Re-engagement', 'push', 're_engagement', 'draft', 'Active App Users', 40, {}],
    ['Order Update Flow', 'whatsapp', 'transactional', 'active', 'High Value WhatsApp Users', 45, {}],
  ]
  drafts.forEach(([name, key, type, status, audience, updatedMin, trigger]) => {
    journeyRows.push({
      workspace_id: workspaceId, name, journey_type: type, status, health: 'good', audience_id: audienceByName.get(audience)?.id,
      contacts_in_flow: status === 'active' ? 68_421 : 0, total_entered: status === 'active' ? 69_120 : 0, on_track_rate: status === 'active' ? 96 : 0,
      conversion_rate: status === 'active' ? 4.8 : 0, owner_id: owner(0), canvas: CANVASES[key], trigger: { label: CANVASES[key].nodes[0].label, ...trigger },
      created_at: ago(updatedMin + 300), updated_at: ago(updatedMin),
    })
  })
  const journeys = await insertChunks('messaging_journeys', journeyRows)
  const journeyByName = new Map(journeys.map(j => [j.name, j]))

  // Template usage in journeys
  await admin.from('messaging_templates').update({
    journey_ids: [journeyByName.get('Welcome Series - Email').id, journeyByName.get('Welcome Series').id, journeyByName.get('Post-Purchase Flow').id, journeyByName.get('VIP Nurture').id, journeyByName.get('Loyalty Onboarding').id],
  }).eq('id', tByName.get('Welcome Series - Email 1').id)

  // Messages
  rand = mulberry32(2718)
  const messageRows = []
  const templateIdByName = new Map(templates.map(t => [t.name, t.id]))
  for (const [channel, list] of Object.entries(MESSAGES)) {
    const all = [...list]
    FILLER_NAMES[channel].forEach((name, index) => {
      const sent = round(3_000 + rand() * 60_000)
      all.push([name, ['lifecycle', 'transactional', 'promotional', 're_engagement'][index % 4], index % 3 === 0 ? 'journey' : 'broadcast', AUDIENCES[index % AUDIENCES.length][0],
        sent, 96 + rand() * 3, channel === 'sms' ? 0 : 15 + rand() * 30, 3 + rand() * 8, 1 + rand() * 3,
        index % 5 === 0 ? 'pending_approval' : index % 4 === 0 ? 'sent' : 'sending', index, 4000 + index * 900, null,
        [rand(), rand() * 2, rand(), rand() * 0.5].map(v => Number(v.toFixed(1))), [channel], {}])
    })
    all.forEach(([name, category, type, audience, sent, del, open, click, conv, status, ownerIndex, lastMin, schedDays, deltas, mix, extra = {}], index) => {
      const delivered = extra.delivered ?? round(sent * del / 100)
      const deliveryRate = delivered / Math.max(sent, 1) * 100
      const pending = status === 'pending_approval'
      messageRows.push({
        workspace_id: workspaceId, channel, name, category, message_type: type, status,
        approval_status: pending ? 'pending' : ['sending', 'sent', 'scheduled'].includes(status) ? 'approved' : 'not_required',
        audience_id: audienceByName.get(audience)?.id ?? null, template_id: extra.template ? templateIdByName.get(extra.template) ?? null : null,
        sender_id: { email: 'hello@acme.com', sms: 'AcmeOffers', whatsapp: 'Acme Store', rcs: 'Acme Store', push: 'Acme App' }[channel],
        subject: channel === 'email' ? `${name} - your update` : null,
        content: { body: `${name} message`, layout: extra.layout, template_name: extra.template, noLastSent: extra.noLastSent },
        sent_count: sent, delivered_count: delivered, opened_count: round(delivered * open / 100),
        clicked_count: round(delivered * click / 100), converted_count: round(delivered * conv / 100),
        opt_out_count: round(sent * (extra.opt_out ?? 0.2) / 100), failed_count: sent - delivered,
        fallback_count: extra.fallback ? round(sent * extra.fallback / 100) : 0,
        prior_rates: { delivery: deliveryRate - deltas[0], open: open - deltas[1], click: click - deltas[2], conversion: conv - deltas[3], opt_out: (extra.opt_out ?? 0.2) - (deltas[3] || 0) * 0.1 },
        channel_mix: mix, owner_id: owner(ownerIndex),
        sent_at: lastMin === null || extra.noLastSent ? null : ago(lastMin), scheduled_at: schedDays ? inDays(schedDays) : null,
        created_at: ago(90 * 1440 + index), updated_at: ago(index < list.length ? CHANNEL_ORDER[channel] + index : 5000 + index * 600),
      })
    })
  }
  // Unsent composer drafts - what each page's composer resumes (see COMPOSER_DRAFTS).
  for (const [channel, draft] of Object.entries(COMPOSER_DRAFTS)) {
    const content = { ...draft.content }
    for (const key of ['image']) if (content[key]) content[key] = images[content[key]]
    if (content.cards) content.cards = content.cards.map(card => ({ ...card, image: images[card.image] }))
    messageRows.push({
      workspace_id: workspaceId, channel, name: draft.name, category: 'promotional', message_type: 'broadcast', status: 'draft', approval_status: 'not_required',
      audience_id: draft.audience ? audienceByName.get(draft.audience)?.id ?? null : null, sender_id: draft.sender,
      template_id: content.templateName ? templateIdByName.get(content.templateName) ?? null : null,
      subject: draft.subject ?? null, content, channel_mix: [channel], owner_id: owner(0), prior_rates: {},
      created_at: ago(2 * 1440 + 30), updated_at: ago(2 * 1440),
    })
  }
  const messages = await insertChunks('messaging_messages', messageRows)

  // Metrics
  await insertChunks('messaging_metrics_daily', dailyMetrics(workspaceId))
  await insertChunks('messaging_metrics_breakdown', BREAKDOWNS.map(([channel, dimension, dim_key, dim_label, sent, delivered, opened, clicked, replied, converted, failed, opt_outs]) => ({
    workspace_id: workspaceId, channel, dimension, dim_key, dim_label, period_start: dayString(29), period_end: dayString(0),
    sent, delivered, opened, clicked, replied, converted, failed, opt_outs,
  })))

  // Activity: design feed items plus the approval submissions that drive the
  // "needing review" deltas (current 30 days vs previous 30 days).
  const messageByName = new Map(messages.map(m => [m.name, m]))
  const activityRows = ACTIVITY.map(([minutes, entity, action, summary, surface], index) => ({
    workspace_id: workspaceId, actor_id: owner(index), entity_type: entity, action, summary, surface,
    entity_id: entity === 'message' ? messages.find(m => summary.includes(m.name))?.id ?? null
      : entity === 'journey' ? journeys.find(j => summary.includes(j.name))?.id ?? null
      : entity === 'template' ? templates.find(t => summary.includes(t.name))?.id ?? null : null,
    link: surface === 'overview' || surface === 'journeys' || surface === 'templates' ? `/app/messaging${surface === 'overview' ? '' : `/${surface}`}` : `/app/messaging/${surface}`,
    created_at: ago(minutes),
  }))
  for (const [surface, current, previous] of [['email', 14, 20], ['sms', 12, 15], ['whatsapp', 7, 9], ['rcs', 12, 15], ['push', 18, 24], ['templates', 83, 91]]) {
    for (let i = 0; i < current + previous; i++) {
      const days = i < current ? 3 + (i % 26) : 31 + (i % 28)
      activityRows.push({
        workspace_id: workspaceId, actor_id: owner(i), entity_type: surface === 'templates' ? 'template' : 'message',
        action: surface === 'templates' ? 'submit_review' : 'submitted_for_approval',
        summary: surface === 'templates' ? 'submitted a template for review' : `submitted a ${surface} message for approval`,
        surface, link: `/app/messaging/${surface}`, created_at: ago(days * 1440),
      })
    }
  }
  await insertChunks('messaging_activity', activityRows)
  void messageByName; void approvals

  console.log(`  ${audiences.length} audiences, ${contacts.length} contacts, ${templates.length + 6} templates, ${journeys.length} journeys, ${messages.length} messages`)
}

let targets = process.argv.slice(2)
if (targets.length === 0) {
  const { data } = await admin.from('workspaces').select('id').in('type', ['brand'])
  targets = (data ?? []).map(w => w.id)
}
for (const id of targets) await seedWorkspace(id)
console.log('Done.')
