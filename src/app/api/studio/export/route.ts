import { NextResponse, type NextRequest } from 'next/server'
import { getStudioSession } from '@/lib/studio/server'
import { canAccessStudioModule, type StudioCapabilities } from '@/lib/studio/entitlements'
import { parseStudioQuery } from '@/lib/studio/query'
import { listContent, listKeywordSets, listMedia, listTemplates } from '@/lib/studio/data'
import { logAudit } from '@/lib/studio/action-helpers'
import type { StudioModule } from '@/lib/studio/constants'

/**
 * CSV exports for Studio lists. The export applies exactly the filters, search
 * and sort the user is looking at (the same query parser the pages use), is
 * scoped to the session's workspace, requires the matching export permission,
 * optionally narrows to selected ids, and is audit-logged.
 */
const KINDS: Record<string, { module: StudioModule; capability: keyof StudioCapabilities }> = {
  content: { module: 'content', capability: 'exportContent' },
  templates: { module: 'templates', capability: 'exportContent' },
  hashtags: { module: 'hashtags', capability: 'exportHashtags' },
  media: { module: 'media', capability: 'viewMedia' },
}

const MAX_ROWS = 5000

function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value)
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return rows.map(r => r.map(cell).join(',')).join('\r\n')
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') ?? ''
  const spec = KINDS[kind]
  if (!spec) return NextResponse.json({ error: 'Unknown export type.' }, { status: 400 })

  const session = await getStudioSession()
  const { supabase, ctx, userId, capabilities } = session
  const access = canAccessStudioModule(ctx, spec.module)
  if (!access.allowed || !capabilities[spec.capability]) {
    return NextResponse.json({ error: 'You do not have permission to export this data.' }, { status: 403 })
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries())
  const q = { ...parseStudioQuery(raw, { views: ['cards', 'table', 'list', 'grid', 'board'] }), page: 1, size: MAX_ROWS }
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(id => /^[0-9a-f-]{36}$/i.test(id))
  const pick = <T extends { id: string }>(rows: T[]) => (ids.length ? rows.filter(r => ids.includes(r.id)) : rows)
  const date = (v: string | null | undefined) => (v ? new Date(v).toISOString() : '')

  let body: string
  let count = 0
  if (kind === 'content') {
    const page = await listContent(supabase, ctx.workspaceId, q, { paginate: false, limit: MAX_ROWS })
    if (page.error) return NextResponse.json({ error: 'Export failed. Reference CF-STUDIO.' }, { status: 500 })
    const rows = pick(page.rows)
    count = rows.length
    body = csv([
      ['Title', 'Channels', 'Status', 'Campaign', 'Owner', 'Scheduled', 'Published', 'Updated', 'Views', 'Likes', 'Comments', 'Shares', 'Tags', 'Caption'],
      ...rows.map(r => [
        r.internal_title || r.title, (r.platforms ?? []).join(' '), r.status, r.campaign?.name, r.owner?.full_name,
        date(r.scheduled_at), date(r.published_at), date(r.updated_at),
        r.engagement?.views, r.engagement?.likes, r.engagement?.comments, r.engagement?.shares,
        [...(r.hashtags ?? []), ...(r.tags ?? [])].join(' '), r.caption,
      ]),
    ])
  } else if (kind === 'templates') {
    const page = await listTemplates(supabase, ctx.workspaceId, q, { paginate: false, limit: MAX_ROWS })
    if (page.error) return NextResponse.json({ error: 'Export failed. Reference CF-STUDIO.' }, { status: 500 })
    const rows = pick(page.rows)
    count = rows.length
    body = csv([
      ['Name', 'Channel', 'Category', 'Status', 'Brand approved', 'Usage', 'Owner', 'Updated', 'Caption template'],
      ...rows.map(r => [r.name, r.channel ?? (r.platforms ?? []).join(' '), r.category, r.status, r.brand_approved ? 'Yes' : 'No', r.usage_count, r.owner?.full_name, date(r.updated_at), r.caption_template]),
    ])
  } else if (kind === 'hashtags') {
    const page = await listKeywordSets(supabase, ctx.workspaceId, q, { paginate: false, limit: MAX_ROWS })
    if (page.error) return NextResponse.json({ error: 'Export failed. Reference CF-STUDIO.' }, { status: 500 })
    const rows = pick(page.rows)
    count = rows.length
    body = csv([
      ['Name', 'Type', 'Terms', 'Avg volume', 'Competition', 'Growth 30d %', 'Relevance', 'Status', 'Platform', 'Updated', 'Hashtags'],
      ...rows.map(r => [r.name, r.kind, r.term_count, r.avg_volume, r.competition, r.growth_30d, r.relevance_score, r.status, r.platform, date(r.updated_at), (r.hashtags ?? []).join(' ')]),
    ])
  } else {
    const page = await listMedia(supabase, ctx.workspaceId, q, { paginate: false, limit: MAX_ROWS })
    if (page.error) return NextResponse.json({ error: 'Export failed. Reference CF-STUDIO.' }, { status: 500 })
    const rows = pick(page.rows)
    count = rows.length
    body = csv([
      ['Name', 'Type', 'Collection', 'Owner', 'Width', 'Height', 'Size (bytes)', 'Status', 'Tags', 'Updated'],
      ...rows.map(r => [r.file_name, r.file_type, r.collection?.name, r.owner?.full_name, r.width, r.height, r.file_size, r.status, (r.tags ?? []).join(' '), date(r.updated_at)]),
    ])
  }

  await logAudit(supabase, ctx.workspaceId, userId, {
    action: `studio.${kind}.exported`, resourceType: `studio_${kind}`,
    metadata: { rows: count, filters: Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'kind' && k !== 'ids')), selected: ids.length },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(`﻿${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="caption-fox-${kind}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
