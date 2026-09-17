import { NextResponse, type NextRequest } from 'next/server'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import { canAccessSocialCapability, canAccessSocialSurface, type SocialSurface } from '@/lib/social/entitlements'
import { checkSocialRateLimit, getSocialSession, logSocialActivity } from '@/lib/social/server'
import { rangeFromDays } from '@/lib/social/metrics'
import { toCsv, toPdf, toXlsx } from '@/lib/social/export-formats'
import { parseDays, parseSearch } from '@/lib/social/url-state'
import {
  getChannelBreakdown, getChannels, getContentPerformance, getConversations,
  getMentions, getPostsInRange,
} from '@/lib/social/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Dataset = 'posts' | 'engagement' | 'listening' | 'connections' | 'analytics'

const PERMISSION_FOR: Record<Dataset, Permission> = {
  posts: PERMISSIONS.SOCIAL_PUBLISHING_EXPORT,
  engagement: PERMISSIONS.SOCIAL_ANALYTICS_EXPORT,
  listening: PERMISSIONS.SOCIAL_LISTENING_EXPORT,
  connections: PERMISSIONS.SOCIAL_ANALYTICS_EXPORT,
  analytics: PERMISSIONS.SOCIAL_ANALYTICS_EXPORT,
}

const SURFACE_FOR: Record<Dataset, SocialSurface> = {
  posts: 'publishing',
  engagement: 'engagement',
  listening: 'listening',
  connections: 'connections',
  analytics: 'analytics',
}

/**
 * Exports the current view. The filters, range and workspace scope come from
 * the same query string the page is using, so the file always matches what the
 * user can see — and never includes tokens or another workspace's records.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const dataset = (params.get('dataset') ?? 'analytics') as Dataset
  if (!Object.hasOwn(PERMISSION_FOR, dataset)) {
    return NextResponse.json({ error: 'Unknown dataset.' }, { status: 400 })
  }

  const session = await getSocialSession()
  // The capability and the surface the data belongs to must both be open: a
  // workspace without Listening cannot export mentions by calling the API.
  const surface = SURFACE_FOR[dataset]
  const surfaceAccess = canAccessSocialSurface(session.ctx, surface)
  if (!surfaceAccess.allowed) return NextResponse.json({ error: surfaceAccess.message }, { status: 403 })
  const access = canAccessSocialCapability(session.ctx, PERMISSION_FOR[dataset])
  if (!access.allowed) return NextResponse.json({ error: access.message }, { status: 403 })
  const limited = await checkSocialRateLimit(session, 'social.export', 20, 10 * 60_000)
  if (limited) return NextResponse.json({ error: limited }, { status: 429 })

  const days = parseDays(params.get('days'))
  const range = rangeFromDays(days)
  const channels = await getChannels(session)
  const channelName = new Map(channels.map(channel => [channel.id, channel.account_name]))

  let rows: (string | number | null)[][] = []
  const format = params.get('format') === 'xlsx' ? 'xlsx' : params.get('format') === 'pdf' ? 'pdf' : 'csv'
  let filename = `caption-fox-social-${dataset}`

  if (dataset === 'posts') {
    const posts = await getPostsInRange(session, range, { limit: 1000 })
    rows = [['Post', 'Status', 'Type', 'Channels', 'Scheduled', 'Published', 'Timezone']]
    for (const post of posts) {
      rows.push([
        post.title ?? post.caption?.slice(0, 80) ?? 'Untitled',
        post.status, post.post_type,
        (post.platforms ?? []).join(' | '),
        post.scheduled_at ?? '', post.published_at ?? '', post.timezone,
      ])
    }
  } else if (dataset === 'engagement') {
    const { rows: conversations } = await getConversations(session, range, {
      view: (params.get('view') as 'feed') ?? 'all',
      channelId: params.get('channel') ?? undefined,
      sentiment: params.get('sentiment') ?? undefined,
      search: parseSearch(params.get('q')) ?? undefined,
      pageSize: 1000,
    })
    rows = [['Author', 'Handle', 'Channel', 'Type', 'Sentiment', 'Status', 'Priority', 'Assigned', 'SLA', 'Received', 'Message']]
    for (const row of conversations) {
      rows.push([
        row.sender_name, row.sender_handle,
        row.channel_id ? channelName.get(row.channel_id) ?? '' : '',
        row.type, row.sentiment, row.status, row.priority,
        row.assignee?.full_name ?? '', row.sla_state, row.created_at,
        row.content?.slice(0, 500) ?? '',
      ])
    }
  } else if (dataset === 'listening') {
    const { rows: mentions } = await getMentions(session, range, {
      tab: (params.get('tab') as 'all') ?? 'all',
      search: parseSearch(params.get('q')) ?? undefined,
      source: params.get('source') ?? undefined,
      sentiment: params.get('sentiment') ?? undefined,
      pageSize: 1000,
    })
    rows = [['Author', 'Handle', 'Source', 'Source type', 'Sentiment', 'Priority', 'Reach', 'Engagements', 'Country', 'Mentioned at', 'Mention']]
    for (const row of mentions) {
      rows.push([
        row.author_name, row.author_handle, row.platform, row.source_type,
        row.sentiment, row.priority, row.reach_estimate, row.engagement_count,
        row.country_code, row.mentioned_at, row.content.slice(0, 500),
      ])
    }
  } else if (dataset === 'connections') {
    rows = [['Account', 'Platform', 'Type', 'Team', 'Health', 'Token', 'Permissions', 'Granted scopes', 'Missing scopes', 'Last sync']]
    for (const channel of channels) {
      const missing = channel.required_scopes.filter(scope => !channel.granted_scopes.includes(scope))
      rows.push([
        channel.account_name, channel.platform, channel.account_type, channel.team_label,
        channel.health, channel.token_status, channel.permission_mode,
        `${channel.granted_scopes.length} of ${channel.required_scopes.length}`,
        missing.join(' | '), channel.last_successful_sync_at ?? channel.last_sync_at ?? '',
      ])
    }
  } else {
    const [content, breakdown] = await Promise.all([
      getContentPerformance(session, range, { limit: 1000 }),
      getChannelBreakdown(session, range, channels),
    ])
    rows = [['Section', 'Name', 'Channel', 'Reach', 'Impressions', 'Engagements', 'Engagement rate', 'Link clicks']]
    for (const row of breakdown) {
      rows.push(['Channel', row.channel.account_name, row.channel.platform, row.reach, row.impressions, row.engagements,
        row.engagementRate === null ? '' : row.engagementRate.toFixed(4), ''])
    }
    for (const row of content) {
      rows.push(['Content', row.post.title ?? 'Untitled', (row.post.platforms ?? []).join(' | '),
        row.reach, row.impressions, row.engagements,
        row.engagementRate === null ? '' : row.engagementRate.toFixed(4), row.linkClicks])
    }
  }

  await logSocialActivity(session, {
    action: 'social.export', entityType: 'social_export',
    summary: `Exported ${dataset} as ${format.toUpperCase()} (${rows.length - 1} rows, last ${days} days)`,
    href: `${session.basePath}/analytics`,
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const common = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  if (format === 'xlsx') {
    return new NextResponse(Buffer.from(toXlsx(rows, dataset)), {
      headers: { ...common, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}-${stamp}.xlsx"` },
    })
  }
  if (format === 'pdf') {
    const title = `Caption Fox - Social ${dataset.charAt(0).toUpperCase()}${dataset.slice(1)}`
    return new NextResponse(Buffer.from(toPdf(rows, title, `${session.workspace.name} - last ${days} days - times in UTC - ${rows.length - 1} rows`)), {
      headers: { ...common, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}-${stamp}.pdf"` },
    })
  }
  return new NextResponse(toCsv(rows), {
    headers: { ...common, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}-${stamp}.csv"` },
  })
}
