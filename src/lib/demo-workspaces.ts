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
  const { data } = await query.maybeSingle()
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
      .maybeSingle()
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

    const { data: existingCampaign } = await supabase.from('campaigns').select('id').eq('workspace_id', workspaceId).eq('name', demo.campaign).maybeSingle()
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
