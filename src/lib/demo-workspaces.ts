import { createClient } from '@supabase/supabase-js'

const DEMO_EMAIL = 'jamahlthomas1996@gmail.com'

type DemoWorkspace = {
  name: string
  slug: string
  type: 'brand' | 'creator' | 'small_business' | 'agency'
  industry: string
  brand: string
  brandSlug: string
  primaryColor: string
  campaign: string
  campaignStatus: 'draft' | 'active' | 'live'
  objective: string
}

const DEMO_WORKSPACES: DemoWorkspace[] = [
  {
    name: 'Jamahl Thomas Campaign Manager',
    slug: 'jamahl-thomas-campaign-manager-demo',
    type: 'brand',
    industry: 'Digital marketing',
    brand: 'Jamahl Thomas Studio',
    brandSlug: 'jamahl-thomas-studio',
    primaryColor: '#2563EB',
    campaign: 'Summer Creator Launch',
    campaignStatus: 'active',
    objective: 'Build awareness and generate qualified leads through creator-led social content.',
  },
  {
    name: 'Jamahl Thomas Creator Lab',
    slug: 'jamahl-thomas-creator-lab-demo',
    type: 'creator',
    industry: 'Creator economy',
    brand: 'JT Creator Lab',
    brandSlug: 'jt-creator-lab',
    primaryColor: '#7C3AED',
    campaign: 'Weekly Growth Experiments',
    campaignStatus: 'live',
    objective: 'Turn repeatable short-form content into audience growth and partnership opportunities.',
  },
  {
    name: 'Jamahl Thomas Growth Co.',
    slug: 'jamahl-thomas-business-demo',
    type: 'small_business',
    industry: 'Local services',
    brand: 'Growth Co.',
    brandSlug: 'jamahl-growth-co',
    primaryColor: '#059669',
    campaign: 'Local Discovery Sprint',
    campaignStatus: 'active',
    objective: 'Generate qualified local enquiries through helpful social content and campaign follow-up.',
  },
  {
    name: 'Jamahl Thomas Agency Hub',
    slug: 'jamahl-thomas-agency-demo',
    type: 'agency',
    industry: 'Marketing agency',
    brand: 'JT Agency',
    brandSlug: 'jt-agency',
    primaryColor: '#DB2777',
    campaign: 'Client Growth Programme',
    campaignStatus: 'draft',
    objective: 'Coordinate a multi-channel client campaign with clear approvals, deliverables and reporting.',
  },
]

type DemoQuery = {
  eq: (column: string, value: string) => DemoQuery
  limit: (count: number) => DemoQuery
  maybeSingle: () => Promise<{ data: { id?: string } | null }>
}

type DemoDb = {
  from: (table: string) => {
    select: (fields: string) => DemoQuery
    insert: (row: Record<string, unknown>) => Promise<unknown>
  }
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function insertIfMissing(
  supabase: unknown,
  table: string,
  filters: Record<string, string>,
  row: Record<string, unknown>,
) {
  const db = supabase as DemoDb
  let query = db.from(table).select('id').limit(1)
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
  const { data } = await query.limit(1).maybeSingle()
  if (!data) await db.from(table).insert(row)
}

/**
 * Creates safe, clearly demo-labelled workspaces for the requested test account.
 * This is server-only and idempotent. It intentionally does nothing for any other
 * email and gracefully no-ops when the optional marketplace migration is absent.
 */
export async function ensureDemoWorkspaces(userId: string, email?: string | null) {
  if (email?.toLowerCase() !== DEMO_EMAIL) return
  const supabase = serviceClient()
  if (!supabase) return

  for (const demo of DEMO_WORKSPACES) {
    const { data: existing, error: lookupError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', demo.slug)
      .limit(1).maybeSingle()
    if (lookupError) return

    let workspaceId = existing?.id as string | undefined
    if (!workspaceId) {
      const { data: created } = await supabase.from('workspaces').insert({
        name: demo.name,
        slug: demo.slug,
        type: demo.type,
        plan: 'team',
        plan_status: 'active',
        owner_id: userId,
        industry: demo.industry,
        content_goals: ['Build brand awareness', 'Generate leads', 'Grow followers'],
        settings: { demo: true, demo_owner_email: DEMO_EMAIL },
      }).select('id').single()
      workspaceId = created?.id as string | undefined
    }
    if (!workspaceId) continue

    await supabase.from('workspace_members').upsert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      permissions: { demo: true },
    }, { onConflict: 'workspace_id,user_id', ignoreDuplicates: true })

    const { data: brand } = await supabase.from('brands').upsert({
      workspace_id: workspaceId,
      name: demo.brand,
      slug: demo.brandSlug,
      industry: demo.industry,
      primary_color: demo.primaryColor,
      description: 'Demo brand created for the Caption Fox workspace tour.',
      is_default: true,
    }, { onConflict: 'workspace_id,slug' }).select('id').single()
    const brandId = brand?.id as string | undefined
    if (!brandId) continue

    await supabase.from('brand_voice_profiles').upsert({
      brand_id: brandId,
      workspace_id: workspaceId,
      tones: ['Confident', 'Warm', 'Witty'],
      style_rules: 'Use clear British English. Keep hooks specific, useful and human.',
    }, { onConflict: 'brand_id' })

    const channels = [
      ['instagram', '@jtstudio', 12800],
      ['tiktok', '@jtcreatorlab', 24600],
      ['linkedin', 'Jamahl Thomas', 3800],
    ] as const
    for (const [platform, accountName, followers] of channels) {
      await insertIfMissing(supabase, 'social_channels', { workspace_id: workspaceId, platform, account_name: accountName }, {
        workspace_id: workspaceId,
        brand_id: brandId,
        platform,
        account_name: accountName,
        follower_count: followers,
        is_active: true,
      })
    }

    const { data: existingCampaign } = await supabase.from('campaigns').select('id').eq('workspace_id', workspaceId).eq('name', demo.campaign).limit(1).maybeSingle()
    const { data: campaign } = existingCampaign
      ? { data: existingCampaign }
      : await supabase.from('campaigns').insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      name: demo.campaign,
      description: demo.objective,
      status: demo.campaignStatus,
      objective: demo.objective,
      start_date: '2026-07-01',
      end_date: '2026-08-31',
      budget: demo.type === 'brand' ? 2500 : 750,
      actual_spend: demo.type === 'brand' ? 840 : 185,
      currency: 'GBP',
      target_reach: demo.type === 'brand' ? 50000 : 15000,
      tags: ['demo', 'cross-channel', demo.type === 'brand' ? 'launch' : 'always-on'],
      created_by: userId,
      owner_id: userId,
      lifecycle_stage: demo.campaignStatus === 'live' ? 'live' : demo.campaignStatus === 'active' ? 'in_progress' : 'planning',
      priority: 'high',
      health: 'on_track',
      progress: demo.campaignStatus === 'live' ? 68 : demo.campaignStatus === 'active' ? 42 : 12,
      channels: ['instagram', 'tiktok', 'linkedin'],
      engagements: 24500, reach: 118000, conversions: 640,
    }).select('id').single()
    const campaignId = campaign?.id as string | undefined
    if (!campaignId) continue

    const taskRows = [
      { title: 'Approve the campaign brief', status: 'done', priority: 'high', due_date: '2026-07-10T12:00:00Z' },
      { title: 'Prepare creator briefing pack', status: 'in_progress', priority: 'medium', due_date: '2026-07-28T12:00:00Z' },
      { title: 'Review weekly performance report', status: 'todo', priority: 'low', due_date: '2026-08-03T12:00:00Z' },
    ] as const
    for (const task of taskRows) {
      await insertIfMissing(supabase, 'campaign_tasks', { campaign_id: campaignId, title: task.title }, {
        campaign_id: campaignId,
        workspace_id: workspaceId,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        created_by: userId,
      })
    }

    const postRows = [
      {
        workspace_id: workspaceId, brand_id: brandId, campaign_id: campaignId,
        title: 'The hook that made our audience stop scrolling',
        caption: 'Three practical ways to make your next campaign more memorable. Save this for your next planning session.',
        hashtags: ['#ContentMarketing', '#CreatorEconomy', '#CaptionFox'],
        platforms: ['instagram', 'linkedin'], post_type: 'carousel', status: 'published',
        published_at: '2026-07-15T09:30:00Z', created_by: userId,
      },
      {
        workspace_id: workspaceId, brand_id: brandId, campaign_id: campaignId,
        title: 'Behind the scenes: campaign planning',
        caption: 'A quick look at how we turn one idea into a complete cross-channel campaign.',
        hashtags: ['#BehindTheScenes', '#MarketingStrategy'],
        platforms: ['tiktok', 'instagram'], post_type: 'reel', status: 'scheduled',
        scheduled_at: '2026-07-29T17:00:00Z', created_by: userId,
      },
      {
        workspace_id: workspaceId, brand_id: brandId, campaign_id: campaignId,
        title: 'Partner announcement draft',
        caption: 'Draft awaiting team approval before publishing.',
        platforms: ['linkedin'], post_type: 'post', status: 'pending_approval',
        approval_required: true, created_by: userId,
      },
    ]
    for (const post of postRows) await insertIfMissing(supabase, 'content_posts', { workspace_id: workspaceId, title: post.title ?? '' }, post)

    await insertIfMissing(supabase, 'ugc_briefs', { workspace_id: workspaceId, title: 'Three creator videos for the summer launch' }, {
      workspace_id: workspaceId,
      brand_id: brandId,
      campaign_id: campaignId,
      title: 'Three creator videos for the summer launch',
      description: 'Demo UGC brief with clear hooks, deliverables and commercial usage rights.',
      status: 'open',
      platforms: ['instagram', 'tiktok'],
      deliverables: '3 x vertical videos, 30 seconds each',
      budget: 600,
      currency: 'GBP',
      deadline: '2026-08-10',
      max_creators: 3,
      usage_rights: 'licensed',
      created_by: userId,
    })

    // Campaign Manager: a small realistic spread across the board/timeline
    // stages, plus one giveaway, one competition and one template so the
    // seven Campaigns surfaces are never empty for the demo account.
    const extraCampaignRows = [
      { name: `${demo.brand} — Product Teaser`, type: 'product_launch', stage: 'planning', health: 'on_track', progress: 8, priority: 'medium', budget: 6000, spend: 320, start: '2026-08-05', end: '2026-08-25' },
      { name: `${demo.brand} — Community Spotlight`, type: 'ugc', stage: 'in_review', health: 'on_track', progress: 55, priority: 'medium', budget: 3000, spend: 1650, start: '2026-07-10', end: '2026-08-01' },
      { name: `${demo.brand} — Autumn Refresh`, type: 'seasonal', stage: 'scheduled', health: 'at_risk', progress: 30, priority: 'high', budget: 9000, spend: 8700, start: '2026-08-20', end: '2026-09-30' },
      { name: `${demo.brand} — Newsletter Push`, type: 'lead_gen', stage: 'completed', health: 'on_track', progress: 100, priority: 'low', budget: 1500, spend: 1480, start: '2026-06-01', end: '2026-06-30' },
    ] as const
    const extraCampaignIds: string[] = []
    for (const row of extraCampaignRows) {
      const { data: existing } = await supabase.from('campaigns').select('id').eq('workspace_id', workspaceId).eq('name', row.name).limit(1).maybeSingle()
      if (existing?.id) { extraCampaignIds.push(existing.id as string); continue }
      const { data: created } = await supabase.from('campaigns').insert({
        workspace_id: workspaceId, brand_id: brandId, name: row.name,
        description: `Demo campaign covering the ${row.stage.replace('_', ' ')} stage.`,
        status: 'active', campaign_type: row.type, objective: 'engagement',
        start_date: row.start, end_date: row.end, budget: row.budget, actual_spend: row.spend,
        currency: 'GBP', tags: ['demo'], created_by: userId, owner_id: userId,
        lifecycle_stage: row.stage, priority: row.priority, health: row.health, progress: row.progress,
        channels: ['instagram', 'facebook'], engagements: Math.round(row.progress * 210), reach: Math.round(row.progress * 900),
      }).select('id').single()
      if (created?.id) extraCampaignIds.push(created.id as string)
    }

    if (extraCampaignIds[0]) {
      await insertIfMissing(supabase, 'campaign_milestones', { campaign_id: extraCampaignIds[0], title: 'Brief approved' }, {
        workspace_id: workspaceId, campaign_id: extraCampaignIds[0], title: 'Brief approved',
        due_date: '2026-08-08', milestone_type: 'brief', status: 'completed', owner_id: userId, created_by: userId,
        completed_at: '2026-08-07T10:00:00Z',
      })
      await insertIfMissing(supabase, 'campaign_milestones', { campaign_id: extraCampaignIds[0], title: 'Launch' }, {
        workspace_id: workspaceId, campaign_id: extraCampaignIds[0], title: 'Launch',
        due_date: '2026-08-25', milestone_type: 'launch', status: 'pending', owner_id: userId, created_by: userId,
      })
    }

    const { data: existingGiveaway } = await supabase.from('giveaways').select('id').eq('workspace_id', workspaceId).eq('title', `${demo.brand} Summer Giveaway`).limit(1).maybeSingle()
    if (!existingGiveaway) {
      await supabase.from('giveaways').insert({
        workspace_id: workspaceId, campaign_id: campaignId, brand_id: brandId,
        title: `${demo.brand} Summer Giveaway`, description: 'Win a full brand bundle from the summer collection.',
        status: 'active', start_date: '2026-07-01T00:00:00Z', end_date: '2026-08-15T23:59:59Z',
        platform: 'instagram', prize_title: 'Summer bundle worth £250', prize_value: 250, prize_currency: 'GBP',
        entry_methods: ['follow', 'like', 'comment'], entry_hashtag: '#SummerWithUs', max_entries_per_person: 1,
        winner_count: 1, winner_selection: 'random', total_entries: 1842, total_unique_participants: 1560,
        owner_id: userId, created_by: userId, prize_fulfilment: 'pending', progress: 62, health: 'on_track',
        channels: ['instagram', 'tiktok'],
      })
    }

    const { data: existingCompetition } = await supabase.from('competitions').select('id').eq('workspace_id', workspaceId).eq('title', `${demo.brand} Creator Challenge`).limit(1).maybeSingle()
    if (!existingCompetition) {
      await supabase.from('competitions').insert({
        workspace_id: workspaceId, campaign_id: campaignId, brand_id: brandId,
        title: `${demo.brand} Creator Challenge`, description: 'Submit your best short-form video for a chance to be featured.',
        competition_type: 'video', status: 'judging', start_date: '2026-07-01T00:00:00Z', end_date: '2026-08-10T23:59:59Z',
        submission_deadline: '2026-08-01T23:59:59Z', prize_title: 'Featured campaign spot + £500', prize_value: 500,
        judging_type: 'panel', max_submissions_per_person: 1, submission_count: 214, vote_count: 3800,
        owner_id: userId, created_by: userId, judging_stage: 'review', progress: 48, health: 'on_track',
        channels: ['tiktok', 'instagram'], engagement_rate: 8.4,
      })
    }

    await insertIfMissing(supabase, 'campaign_templates', { workspace_id: workspaceId, name: 'Product launch playbook' }, {
      workspace_id: workspaceId, name: 'Product launch playbook',
      description: 'A six-week multi-channel launch structure with brief, teaser, launch and follow-up phases.',
      category: 'product_launch', template_type: 'multi_channel', status: 'published', usage_count: 4,
      linked_workflows: 2, channels: ['instagram', 'tiktok', 'email'], default_budget: 6000, default_duration_days: 42,
      owner_id: userId, created_by: userId, is_favourite: true,
    })

    const activityRows = [
      { action: 'created', entity_type: 'campaign', summary: `created campaign ${demo.campaign}` },
      { action: 'stage_changed', entity_type: 'campaign', summary: `moved ${demo.campaign} to ${demo.campaignStatus}` },
      { action: 'entries_imported', entity_type: 'entry', summary: `imported entries for ${demo.brand} Summer Giveaway` },
    ] as const
    for (const activity of activityRows) {
      await insertIfMissing(supabase, 'campaign_activity', { workspace_id: workspaceId, summary: activity.summary }, {
        workspace_id: workspaceId, actor_id: userId, entity_type: activity.entity_type,
        action: activity.action, summary: activity.summary, surface: 'campaigns',
      })
    }

    // 30 days of metric snapshots so the performance trend chart has real data.
    const { data: existingMetric } = await supabase.from('campaign_metrics_daily').select('id').eq('workspace_id', workspaceId).limit(1).maybeSingle()
    if (!existingMetric) {
      const metricRows = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10)
        const base = 400 + i * 22
        return {
          workspace_id: workspaceId, campaign_id: campaignId, metric_date: date,
          engagements: base + (i % 5) * 30, reach: base * 4, conversions: Math.round(base / 12),
          spend: 40 + i * 3,
        }
      })
      await supabase.from('campaign_metrics_daily').insert(metricRows)
    }
  }

  // Supplier data is optional until the marketplace migration has been applied.
  try {
    const { data: supplier } = await supabase.from('marketplace_suppliers').upsert({
      user_id: userId,
      slug: 'jamahl-thomas-creative-studio',
      display_name: 'Jamahl Thomas Creative Studio',
      type: 'agency',
      headline: 'Creator-led campaigns, paid social and content systems.',
      bio: 'A demo supplier profile for exploring Caption Fox Marketplace workflows.',
      location: 'London, UK / Remote',
      verified: false,
      status: 'active',
    }, { onConflict: 'slug' }).select('id').single()
    const supplierId = supplier?.id as string | undefined
    if (supplierId) {
      const listings = [
        { supplier_id: supplierId, kind: 'service', title: '30-day social content system', summary: 'Strategy, content calendar and 12 on-brand posts.', category: 'Social strategy', price_cents: 85000, currency: 'GBP', delivery_days: 14, status: 'active' },
        { supplier_id: supplierId, kind: 'service', title: 'Paid social launch sprint', summary: 'Campaign structure, creative angles and reporting plan.', category: 'Paid Ads', price_cents: 120000, currency: 'GBP', delivery_days: 10, status: 'active' },
        { supplier_id: supplierId, kind: 'service', title: 'Creator UGC starter pack', summary: 'Three short-form concepts with scripts and usage guidance.', category: 'UGC Video', price_cents: 45000, currency: 'GBP', delivery_days: 7, status: 'active' },
      ]
      for (const listing of listings) await insertIfMissing(supabase, 'marketplace_listings', { supplier_id: supplierId, title: listing.title }, listing)
    }
  } catch {
    // Marketplace is an optional migration; campaign demos must still provision.
  }
}
