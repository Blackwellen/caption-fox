// Development-only demo seed for the Advertising module.
//
// Every row is flagged is_demo (where the column exists) and is removed and
// re-created on each run, so the script is idempotent. Numbers come from a
// seeded PRNG, so repeated runs produce identical data — nothing is random at
// render time. Never run against production.
//
// Usage: node scripts/seed-advertising-demo.mjs <workspace_id> [<workspace_id> ...]

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)
if (env.NODE_ENV === 'production' || /prod/i.test(env.VERCEL_ENV ?? '')) {
  console.error('Refusing to seed demo advertising data in production.')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------- PRNG
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260915)
const wobble = (day, phase, amp = 0.35) => 1 + amp * Math.sin(day / 3.1 + phase) + (rand() - 0.5) * 0.25

const DAYS = 60
const today = new Date()
const dayString = offset => {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset))
  return date.toISOString().slice(0, 10)
}
const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString()

// ---------------------------------------------------------------- fixtures
const ACCOUNTS = [
  { key: 'meta_main', provider: 'meta', name: 'CF Main Account', ext: 'act_238947123', sync: 'synced', syncedMin: 5 },
  { key: 'meta_brand', provider: 'meta', name: 'CF Brand Awareness', ext: 'act_109283475', sync: 'synced', syncedMin: 7 },
  { key: 'meta_rt', provider: 'meta', name: 'CF Retargeting', ext: 'act_556781209', sync: 'synced', syncedMin: 7 },
  { key: 'g_search', provider: 'google', name: 'CF Google Search', ext: 'mgr_4421172099', sync: 'synced', syncedMin: 12 },
  { key: 'g_pmax', provider: 'google', name: 'CF Performance Max', ext: 'mgr_8876512201', sync: 'synced', syncedMin: 12 },
  { key: 'tt_main', provider: 'tiktok', name: 'CF TikTok Main', ext: 'tt_9023317781', sync: 'synced', syncedMin: 8 },
  { key: 'tt_rt', provider: 'tiktok', name: 'CF TikTok Retargeting', ext: 'tt_4428871190', sync: 'synced', syncedMin: 8 },
  { key: 'li_b2b', provider: 'linkedin', name: 'CF LinkedIn B2B', ext: 'li_7738812000', sync: 'warning', syncedMin: 31 },
  { key: 'pin_traffic', provider: 'pinterest', name: 'CF Pinterest Traffic', ext: 'pn_5544332211', sync: 'failed', syncedMin: null },
]

const CONNECTIONS = {
  meta: { status: 'connected', scopes: ['ads_read', 'ads_management', 'business_management', 'read_insights', 'pages_read_engagement', 'catalog_management', 'leads_retrieval'] },
  google: { status: 'connected', scopes: ['adwords', 'reporting', 'audiences', 'conversions', 'billing', 'mcc'] },
  tiktok: { status: 'connected', scopes: ['ad.read', 'ad.write', 'report.read', 'audience.read', 'creative.read', 'pixel.read', 'bc.read'] },
  linkedin: { status: 'attention', scopes: ['r_ads', 'rw_ads', 'r_ads_reporting', 'r_organization_social', 'rw_dmp_segments'] },
  pinterest: { status: 'error', scopes: ['ads:read', 'ads:write', 'boards:read', 'pins:read', 'user_accounts:read'] },
}

// name, account, objective, status, 30-day spend target, budget, roas, ctr %, conversions
const CAMPAIGNS = [
  ['Summer Sale | Prospecting', 'meta_main', 'sales', 'active', 78541.32, 90000, 4.82, 2.11, 1842],
  ['Brand Awareness | Q2', 'g_search', 'awareness', 'active', 56312.18, 65000, 6.21, 1.43, 1256],
  ['BB: New Collection | Conversions', 'tt_main', 'conversions', 'active', 42118.77, 50000, 3.78, 1.92, 938],
  ['Retargeting | Engagers', 'meta_rt', 'conversions', 'active', 37026.44, 45000, 5.16, 2.64, 821],
  ['B2B Leads | Webinar', 'li_b2b', 'leads', 'paused', 28664.91, 40000, 2.31, 0.97, 534],
  ['Video Views | Launch', 'meta_brand', 'video_views', 'learning', 18910.22, 25000, 1.72, 1.15, 423],
  ['Product Demo | Lookalike', 'g_pmax', 'conversions', 'active', 14221.33, 20000, 3.21, 2.01, 311],
  ['App Installs | iOS', 'meta_main', 'app_installs', 'completed', 9181.65, 15000, 2.09, 1.05, 198],
  ['Holiday Promo | Teaser', 'g_search', 'traffic', 'draft', 0, 15000, 0, 0, 0],
  ['Q3 Launch | Save The Date', 'meta_brand', 'awareness', 'draft', 0, 20000, 0, 0, 0],
  ['Lookalike Testing | US', 'tt_rt', 'conversions', 'learning', 8214.44, 12000, 1.41, 1.38, 142],
  ['Retargeting | Abandoned Cart', 'li_b2b', 'sales', 'paused', 6144.22, 10000, 1.28, 1.12, 96],
  ['Spring Clearance | March', 'g_pmax', 'sales', 'completed', 12445.33, 14000, 3.11, 1.87, 288],
  ['Always-On | Search Brand', 'g_search', 'traffic', 'active', 22175.9, 30000, 7.93, 4.12, 612],
  ['Creator Collab | Spark Ads', 'tt_main', 'engagement', 'active', 16480.12, 22000, 4.4, 2.33, 402],
  ['Catalogue | Dynamic Product', 'meta_main', 'sales', 'active', 31602.5, 38000, 5.02, 2.21, 744],
]

// name, format, campaignIndex, provider override, status, review, feedback, hookBase, winning
const CREATIVES = [
  ['Glow Naturally, Every Day', 'video', 0, null, 'active', 'approved', null, 0.638, true],
  ['Your Skin, Your Glow', 'video', 1, 'tiktok', 'active', 'approved', null, 0.592, true],
  ['Skincare Essentials', 'carousel', 3, null, 'active', 'approved', null, 0.615, false],
  ['Hydrate. Nourish. Glow.', 'story', 0, null, 'active', 'under_review', null, 0.689, false],
  ['Beach-Ready Skin', 'video', 1, 'meta', 'active', 'approved', null, 0.57, true],
  ['Clean Ingredients. Real Results.', 'image', 1, 'google', 'paused', 'approved', null, null, false],
  ['New Arrivals Collection', 'carousel', 3, 'tiktok', 'active', 'approved', null, 0.51, false],
  ['Morning Routine Glow', 'video', 1, 'google', 'active', 'approved', null, 0.6, false],
  ['Pure Glow, Naturally', 'image', 1, null, 'active', 'under_review', null, null, false],
  ['Sun. Skin. Care.', 'video', 3, 'tiktok', 'paused', 'disapproved', 'Before/after health claims are not permitted in this market.', 0.44, false],
  ['Summer Sale Static', 'image', 0, null, 'active', 'approved', null, null, false],
  ['Webinar Promo Card', 'image', 4, null, 'paused', 'changes_requested', null, null, false],
]

// name, type, size, matched, matchRate, refresh, refreshStatus, status, spend, roas, ctr, cpa, recency
const AUDIENCES = [
  ['Purchasers 30D', 'custom', 1280000, 870400, 68, 'daily', 'ready', 'ready', 42631.21, 6.32, 2.81, 24.18, 30],
  ['Lookalike 1%', 'lookalike', 4520000, 2757200, 61, 'weekly', 'ready', 'ready', 56312.18, 4.72, 2.23, 31.64, 30],
  ['Website Visitors 7D', 'website_visitors', 2140000, 1540800, 72, 'daily', 'ready', 'ready', 38741.55, 3.85, 3.14, 28.93, 7],
  ['Engagers 14D', 'engagers', 856000, 556400, 65, 'daily', 'ready', 'ready', 24915.33, 5.21, 2.67, 26.77, 14],
  ['CRM Customers', 'crm_list', 632000, 562480, 89, 'weekly', 'ready', 'ready', 31882.44, 7.01, 2.91, 21.34, 90],
  ['Interest: Fitness', 'interest', 6240000, 2995200, 48, 'weekly', 'review', 'review', 18331.02, 1.92, 1.18, 47.81, 30],
]

const DEMO_PHOTOS = [
  'm-r-woman.webp', 'm-hero-portrait.webp', 'm-brand-abstract.webp', 'm-s3-portrait.webp', 'm-hero-mountain.webp',
  'm-brand-sneaker.webp', 'm-row1.webp', 'm-studio-video.webp', 'm-row2.webp', 'm-r-sneaker.webp', 'm-launch.webp', 'm-row3.webp',
]

const PEOPLE = ['Jason Ranti', 'Sofia Patel', 'Ethan Kim', 'Priya Shah', 'Marcus Lee', 'Diana Kim', 'Bayu Salto', 'Alicia Morgan']

// ---------------------------------------------------------------- helpers
async function must(promise, label) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function insertChunks(table, rows, label) {
  for (let index = 0; index < rows.length; index += 500) {
    await must(admin.from(table).insert(rows.slice(index, index + 500)), `${label} [${index}]`)
  }
}

async function clearWorkspace(workspaceId) {
  // Only demo rows are removed; real customer rows are never touched. Issues,
  // overlaps and audience links cascade from the demo parents deleted below.
  const { data: demoAccounts } = await admin.from('ad_accounts').select('id').eq('workspace_id', workspaceId).eq('is_demo', true)
  const accountIds = (demoAccounts ?? []).map(row => row.id)

  const { data: demoPreset } = await admin.from('ad_report_presets').select('id')
    .eq('workspace_id', workspaceId).eq('name', 'Monthly Performance').maybeSingle()
  if (demoPreset) {
    await must(admin.from('ad_report_exports').delete().eq('preset_id', demoPreset.id), 'clear exports')
    await must(admin.from('ad_scheduled_reports').delete().eq('preset_id', demoPreset.id), 'clear scheduled')
    await must(admin.from('ad_report_presets').delete().eq('id', demoPreset.id), 'clear preset')
  }

  if (accountIds.length) {
    const [{ data: demoCampaigns }, { data: demoCreatives }, { data: demoAudiences }] = await Promise.all([
      admin.from('ad_campaigns').select('id').in('account_id', accountIds),
      admin.from('ad_creatives').select('id').in('account_id', accountIds),
      admin.from('ad_audiences').select('id').eq('workspace_id', workspaceId).eq('is_demo', true),
    ])
    const demoEntityIds = [...accountIds, ...[demoCampaigns, demoCreatives, demoAudiences].flatMap(list => (list ?? []).map(row => row.id))]
    for (let index = 0; index < demoEntityIds.length; index += 200) {
      await must(admin.from('ad_activity').delete().eq('workspace_id', workspaceId).in('entity_id', demoEntityIds.slice(index, index + 200)), 'clear activity')
    }
    await must(admin.from('ad_metrics_daily').delete().in('account_id', accountIds), 'clear metrics')
    await must(admin.from('ad_audiences').delete().eq('workspace_id', workspaceId).eq('is_demo', true), 'clear audiences')
    await must(admin.from('ad_creatives').delete().in('account_id', accountIds), 'clear creatives')
    await must(admin.from('ad_campaigns').delete().in('account_id', accountIds), 'clear campaigns')
    await must(admin.from('ad_accounts').delete().in('id', accountIds), 'clear accounts')
  }
  await must(admin.from('ad_connections').delete().eq('workspace_id', workspaceId).like('external_business_id', 'demo_%'), 'clear connections')
}

// ---------------------------------------------------------------- seed
async function seedWorkspace(workspaceId, ownerId) {
  await clearWorkspace(workspaceId)

  const connectionIds = {}
  for (const [provider, info] of Object.entries(CONNECTIONS)) {
    const [row] = await must(admin.from('ad_connections').insert({
      workspace_id: workspaceId, provider, status: info.status,
      external_business_id: `demo_${provider}`, display_name: `Caption Fox ${provider} business`,
      scopes: info.scopes, owner_user_id: ownerId, connected_by: ownerId,
      connected_at: ago(60 * 24 * 90), last_synced_at: provider === 'pinterest' ? null : ago(8),
      last_sync_attempt_at: ago(5),
      last_error: provider === 'pinterest' ? 'Re-authentication required.' : provider === 'linkedin' ? 'A required reporting scope was revoked.' : null,
    }).select('id'), `connection ${provider}`)
    connectionIds[provider] = row.id
  }

  const accountIds = {}
  for (const account of ACCOUNTS) {
    const [row] = await must(admin.from('ad_accounts').insert({
      workspace_id: workspaceId, connection_id: connectionIds[account.provider], provider: account.provider,
      external_id: account.ext, name: account.name, currency: 'GBP', timezone: 'Europe/London',
      sync_status: account.sync, mapping_label: 'Campaign Manager', owner_user_id: ownerId,
      scopes: CONNECTIONS[account.provider].scopes,
      last_synced_at: account.syncedMin === null ? null : ago(account.syncedMin),
      last_sync_attempt_at: ago(account.syncedMin ?? 180), is_demo: true,
    }).select('id'), `account ${account.name}`)
    accountIds[account.key] = row.id
  }

  const campaignRows = []
  for (const [index, [name, accountKey, objective, status, , budget]] of CAMPAIGNS.entries()) {
    const provider = ACCOUNTS.find(a => a.key === accountKey).provider
    const [row] = await must(admin.from('ad_campaigns').insert({
      workspace_id: workspaceId, account_id: accountIds[accountKey], provider,
      external_id: `demo_c_${index}`, name, objective, status,
      budget_amount: budget, budget_type: 'lifetime', currency: 'GBP',
      starts_at: status === 'draft' ? new Date(Date.now() + 14 * 86400000).toISOString() : ago(60 * 24 * 40),
      ends_at: new Date(Date.now() + (status === 'completed' ? -2 : 12) * 86400000).toISOString(),
      owner_user_id: ownerId, labels: [PEOPLE[index % PEOPLE.length]],
      provider_synced_at: ago(8), is_demo: true, updated_at: ago(index * 37),
    }).select('id'), `campaign ${name}`)
    campaignRows.push({ id: row.id, index, provider, accountId: accountIds[accountKey], spec: CAMPAIGNS[index] })
  }

  // Daily metrics per campaign; account rows are the per-day sum of their campaigns.
  const metricRows = []
  const accountDaily = new Map()
  for (const campaign of campaignRows) {
    const [, , , status, spend30, , roas, ctr, conv30] = campaign.spec
    if (spend30 === 0) continue
    const phase = campaign.index * 0.9
    for (let offset = 0; offset < DAYS; offset += 1) {
      // Previous 30-day window runs ~13% lower so comparison deltas are realistic.
      const periodScale = offset >= 30 ? 0.87 : 1
      const stopped = (status === 'completed' && offset < 2) || (status === 'paused' && offset < 5)
      const factor = stopped ? 0 : wobble(offset, phase) * periodScale
      const spend = +(spend30 / 30 * factor).toFixed(2)
      const impressions = Math.round(spend * 22.5 * (1 + (rand() - 0.5) * 0.1))
      const clicks = Math.round(impressions * ctr / 100)
      const conversions = Math.round(conv30 / 30 * factor)
      const revenue = +(spend * roas * (offset >= 30 ? 0.93 : 1)).toFixed(2)
      const row = {
        workspace_id: workspaceId, account_id: campaign.accountId, entity_type: 'campaign', entity_id: campaign.id,
        provider: campaign.provider, metric_date: dayString(offset), currency: 'GBP', attribution_window: '7d_click',
        spend, impressions, reach: Math.round(impressions / 2.4), clicks, conversions, revenue,
        video_views: Math.round(impressions * 0.3), video_3s_views: Math.round(impressions * 0.12),
        engagements: Math.round(clicks * 1.7), is_demo: true,
      }
      metricRows.push(row)
      const key = `${campaign.accountId}|${row.metric_date}`
      const agg = accountDaily.get(key) ?? { ...row, entity_type: 'account', entity_id: campaign.accountId, spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, video_views: 0, video_3s_views: 0, engagements: 0 }
      for (const field of ['spend', 'impressions', 'reach', 'clicks', 'conversions', 'revenue', 'video_views', 'video_3s_views', 'engagements']) agg[field] += row[field]
      agg.spend = +agg.spend.toFixed(2); agg.revenue = +agg.revenue.toFixed(2)
      accountDaily.set(key, agg)
    }
  }
  metricRows.push(...accountDaily.values())

  // Creatives + their metrics.
  const creativeIds = []
  for (const [index, [name, format, campaignIndex, providerOverride, status, review, feedback, hookBase, winning]] of CREATIVES.entries()) {
    const campaign = campaignRows[campaignIndex]
    const provider = providerOverride ?? campaign.provider
    const [row] = await must(admin.from('ad_creatives').insert({
      workspace_id: workspaceId, account_id: campaign.accountId, campaign_id: campaign.id, provider,
      external_id: `demo_cr_${index}`, name, format, status, review_status: review,
      review_source: review === 'disapproved' ? 'provider' : 'internal', provider_feedback: feedback,
      aspect_ratio: format === 'story' ? '9:16' : format === 'image' ? '4:5' : '1:1',
      duration_seconds: format === 'video' || format === 'story' ? [15, 20, 30, 10][index % 4] : null,
      is_winning_variant: winning, is_demo: true, created_by: ownerId,
      updated_at: ago([12, 27, 45, 60, 90, 120, 150, 180, 180, 300, 400, 500][index]),
    }).select('id'), `creative ${name}`)
    creativeIds.push(row.id)
    // Demo thumbnail: a product photo that already ships in public/home-v2,
    // uploaded to the private bucket under this workspace's folder.
    const photo = DEMO_PHOTOS[index % DEMO_PHOTOS.length]
    const path = `${workspaceId}/demo/${row.id}.webp`
    const bytes = readFileSync(new URL(`../public/home-v2/${photo}`, import.meta.url))
    const { error: uploadError } = await admin.storage.from('ad-creatives').upload(path, bytes, { contentType: 'image/webp', upsert: true })
    if (!uploadError) await admin.from('ad_creatives').update({ thumbnail_path: path }).eq('id', row.id)
    const spend30 = [18743.24, 15682.11, 12409.76, 9873.22, 8420.5, 6120.4, 5980.3, 5210.1, 4300, 2100, 3900, 1800][index]
    const ctr = [2.34, 1.82, 1.76, 3.12, 3.48, 1.2, 1.9, 2.05, 1.7, 1.1, 1.5, 0.9][index]
    for (let offset = 0; offset < DAYS; offset += 1) {
      const factor = wobble(offset, index) * (offset >= 30 ? 0.88 : 1)
      const spend = +(spend30 / 30 * factor).toFixed(2)
      const impressions = Math.round(spend * 24)
      metricRows.push({
        workspace_id: workspaceId, account_id: campaign.accountId, entity_type: 'creative', entity_id: row.id,
        provider, metric_date: dayString(offset), currency: 'GBP', attribution_window: '7d_click',
        spend, impressions, reach: Math.round(impressions / 2.2), clicks: Math.round(impressions * ctr / 100),
        conversions: Math.round(spend / 440), revenue: +(spend * 3.9).toFixed(2),
        video_views: hookBase ? Math.round(impressions * 0.5) : 0,
        video_3s_views: hookBase ? Math.round(impressions * hookBase) : 0,
        engagements: Math.round(impressions * 0.04), is_demo: true,
      })
    }
  }

  // Audiences + links + overlaps + metrics.
  const audienceIds = []
  for (const [index, [name, type, size, matched, matchRate, refresh, refreshStatus, status, spend30, roas, ctr, cpa, recency]] of AUDIENCES.entries()) {
    const campaign = campaignRows[index % 5]
    const [row] = await must(admin.from('ad_audiences').insert({
      workspace_id: workspaceId, account_id: campaign.accountId, provider: campaign.provider,
      external_id: `demo_aud_${index}`, name, audience_type: type, size_estimate: size, matched_users: matched,
      match_rate: matchRate, recency_days: recency, refresh_schedule: refresh, refresh_status: refreshStatus,
      status, last_refreshed_at: ago(60 * (index + 2)), is_demo: true, created_by: ownerId,
    }).select('id'), `audience ${name}`)
    audienceIds.push(row.id)
    for (let offset = 0; offset < DAYS; offset += 1) {
      const factor = wobble(offset, index * 1.3, 0.2) * (offset >= 30 ? 0.88 : 1)
      const spend = +(spend30 / 30 * factor).toFixed(2)
      const clicks = Math.round(spend / cpa * 38)
      const impressions = Math.round(clicks / (ctr / 100))
      metricRows.push({
        workspace_id: workspaceId, account_id: campaign.accountId, entity_type: 'audience', entity_id: row.id,
        provider: campaign.provider, metric_date: dayString(offset), currency: 'GBP', attribution_window: '7d_click',
        spend, impressions, reach: Math.round(impressions / 2.42), clicks,
        conversions: Math.round(spend / cpa), revenue: +(spend * roas).toFixed(2),
        video_views: 0, video_3s_views: 0, engagements: Math.round(clicks * 1.4), is_demo: true,
      })
    }
  }
  await insertChunks('ad_metrics_daily', metricRows, 'metrics')

  await insertChunks('ad_audience_campaigns', audienceIds.flatMap((audienceId, index) =>
    campaignRows.slice(index % 4, (index % 4) + 3).map(campaign => ({ audience_id: audienceId, campaign_id: campaign.id, workspace_id: workspaceId })),
  ), 'audience links')
  await insertChunks('ad_audience_overlaps', [
    [0, 2, 23], [0, 1, 18], [1, 3, 32], [2, 3, 27], [4, 1, 41], [5, 1, 9], [3, 4, 12],
  ].map(([a, b, pct]) => ({
    workspace_id: workspaceId, audience_a_id: audienceIds[a], audience_b_id: audienceIds[b],
    overlap_pct: pct, overlap_users: Math.round(AUDIENCES[a][2] * pct / 100), is_estimate: true,
  })), 'overlaps')

  await insertChunks('ad_issues', [
    { severity: 'critical', issue_type: 'budget_threshold', title: 'Budget threshold exceeded', detail: 'Campaign "Summer Sale | Prospecting" exceeded 90% of budget.', campaign_id: campaignRows[0].id, created_at: ago(10) },
    { severity: 'warning', issue_type: 'creative_disapproved', title: 'Creative disapproval', detail: '2 ads were disapproved in Meta Ads account "CF Main Account".', creative_id: creativeIds[9], created_at: ago(34) },
    { severity: 'warning', issue_type: 'scope_missing', title: 'Sync warning', detail: 'LinkedIn Ads account "CF LinkedIn B2B" has a permission issue.', account_id: accountIds.li_b2b, connection_id: connectionIds.linkedin, required_action: 'Review scopes and re-authorise LinkedIn.', created_at: ago(60) },
    { severity: 'critical', issue_type: 'auth_expired', title: 'Pinterest account connection failed', detail: 'Pinterest account connection failed. Re-authentication required.', account_id: accountIds.pin_traffic, connection_id: connectionIds.pinterest, required_action: 'Re-authenticate Pinterest.', created_at: ago(180) },
  ].map(issue => ({ workspace_id: workspaceId, provider: null, ...issue })), 'issues')

  await insertChunks('ad_activity', [
    ['sync.completed', 'account', accountIds.meta_main, 'meta', 'Meta Ads account "CF Main Account" synced successfully', PEOPLE[0], 5],
    ['campaign.approved', 'campaign', campaignRows[4].id, 'linkedin', 'Campaign "B2B Leads | Webinar" is now live', PEOPLE[3], 120],
    ['account.updated', 'account', accountIds.g_pmax, 'google', 'Google Ads manager "CF Performance Max" updated', PEOPLE[5], 60],
    ['sync.completed', 'account', accountIds.tt_rt, 'tiktok', 'TikTok Ads account "CF TikTok Retargeting" synced', PEOPLE[6], 120],
    ['campaign.budget_changed', 'campaign', campaignRows[1].id, 'google', 'Budget increased for Brand Awareness | Q2 (+15%)', PEOPLE[1], 60 * 24 * 3],
    ['campaign.paused', 'campaign', campaignRows[3].id, 'meta', 'Paused underperforming ad set in Retargeting | Engagers', PEOPLE[2], 60 * 24 * 4],
    ['creative.replaced', 'creative', creativeIds[0], 'meta', 'Creative replaced for Summer Sale | Prospecting', PEOPLE[4], 60 * 24 * 5],
    ['performance.spike', 'campaign', campaignRows[1].id, 'google', 'ROAS for "Brand Awareness | Q2" increased by 25%', 'System', 180],
  ].map(([event_type, entity_type, entity_id, provider, summary, actor_label, minutes]) => ({
    workspace_id: workspaceId, event_type, entity_type, entity_id, provider, summary, actor_label,
    actor_id: actor_label === 'System' ? null : ownerId, created_at: ago(minutes), source_route: '/advertising',
  })), 'activity')

  const [preset] = await must(admin.from('ad_report_presets').insert({
    workspace_id: workspaceId, name: 'Monthly Performance', config: { groupBy: 'platform', granularity: 'daily', attributionWindow: '7d_click' },
    is_shared: true, is_default: true, created_by: ownerId,
  }).select('id'), 'preset')
  await must(admin.from('ad_scheduled_reports').insert([
    { name: 'Weekly Paid Media Digest', cadence: 'weekly', recipients: ['team@captionfox.test'], format: 'pdf' },
    { name: 'Monthly Board Pack', cadence: 'monthly', recipients: ['leadership@captionfox.test'], format: 'pdf' },
    { name: 'Daily Spend Check', cadence: 'daily', recipients: ['ops@captionfox.test'], format: 'csv' },
  ].map(report => ({ workspace_id: workspaceId, preset_id: preset.id, created_by: ownerId, next_run_at: ago(-60 * 24), ...report }))), 'scheduled')
  await must(admin.from('ad_report_exports').insert([
    ['Monthly Performance Report', 'pdf', 60 * 24 * 1], ['Campaign Deep Dive – Q2', 'csv', 60 * 24 * 2], ['Creative Performance Report', 'pdf', 60 * 24 * 2 + 300],
  ].map(([name, format, minutes]) => ({
    workspace_id: workspaceId, preset_id: preset.id, name, format, status: 'ready', row_count: 128,
    requested_by: ownerId, created_at: ago(minutes), completed_at: ago(minutes - 1),
  }))), 'exports')

  console.log(`Seeded workspace ${workspaceId}: ${ACCOUNTS.length} accounts, ${campaignRows.length} campaigns, ${CREATIVES.length} creatives, ${AUDIENCES.length} audiences, ${metricRows.length} metric rows.`)
}

const workspaceIds = process.argv.slice(2)
if (workspaceIds.length === 0) {
  console.error('Usage: node scripts/seed-advertising-demo.mjs <workspace_id> [...]')
  process.exit(1)
}
for (const workspaceId of workspaceIds) {
  const workspace = await must(admin.from('workspaces').select('owner_id').eq('id', workspaceId).single(), 'workspace')
  await seedWorkspace(workspaceId, workspace.owner_id)
}
