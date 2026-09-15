import { NextResponse, type NextRequest } from 'next/server'
import { getSeoSession } from '@/lib/seo/server'
import { canAccessSeoCapability } from '@/lib/seo/entitlements'
import { logAudit } from '@/lib/audit'
import {
  getBacklinks, getBriefs, getKeywords, getLocations, getAiPrompts, getRankingChanges, getSiteDaily,
} from '@/lib/seo/queries'
import { resolveDateRange } from '@/lib/seo/range'
import { readParam, readNumber, type SearchParams } from '@/lib/seo/url-state'
import { humanise } from '@/lib/seo/format'
import type { SeoTabId } from '@/lib/seo/types'

/**
 * Exports respect the CURRENT search, filters, sorting, date range and
 * active site — the same query the screen ran — and are permission-gated per
 * surface. Exports never include provider credentials or cross-workspace
 * records: every query is scoped by workspace_id + site_id resolved from the
 * authenticated session, never from the query string directly.
 */

const SURFACE_CAPABILITY = {
  overview: 'keywords.export',
  keywords: 'keywords.export',
  briefs: 'briefs.export',
  rankings: 'rankings.export',
  local: 'local.export',
  'ai-search': 'aiSearch.export',
  backlinks: 'backlinks.export',
} as const

export async function GET(request: NextRequest) {
  const params: SearchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const surface = (readParam(params, 'surface') ?? 'keywords') as SeoTabId
  if (!(surface in SURFACE_CAPABILITY)) {
    return NextResponse.json({ error: 'Unknown export surface' }, { status: 400 })
  }

  const session = await getSeoSession(params)
  const { ctx, site, supabase, userId } = session
  if (!site) return NextResponse.json({ error: 'No active SEO site' }, { status: 403 })

  const capability = SURFACE_CAPABILITY[surface as keyof typeof SURFACE_CAPABILITY]
  if (!canAccessSeoCapability(ctx, capability)) {
    return NextResponse.json({ error: 'Export is not permitted for your role or plan' }, { status: 403 })
  }

  const scope = { supabase, workspaceId: ctx.workspaceId, siteId: site.id }
  const range = resolveDateRange(params)

  let header: string[] = []
  let rows: (string | number)[][] = []

  switch (surface) {
    case 'overview': {
      const daily = await getSiteDaily(scope, range.from, range.to)
      header = ['Date', 'Clicks', 'Impressions', 'Average Rank', 'Visibility Score', 'Tracked Keywords']
      rows = daily.map(d => [d.date, d.clicks, d.impressions, d.avg_position ?? '', d.visibility_score ?? '', d.tracked_keywords])
      break
    }
    case 'keywords': {
      const { rows: keywords } = await getKeywords(scope, {
        q: readParam(params, 'q'), intent: readParam(params, 'intent'), cluster: readParam(params, 'cluster'),
        status: readParam(params, 'status'), device: readParam(params, 'device'), country: readParam(params, 'country'),
        sort: readParam(params, 'sort'), page: 1, pageSize: 5000,
      })
      header = ['Keyword', 'Cluster', 'Intent', 'Search Volume', 'Difficulty', 'Current Rank', 'Rank Change', 'Landing Page', 'Status']
      rows = keywords.map(k => [k.keyword, k.cluster?.name ?? '', humanise(k.intent), k.search_volume, k.difficulty ?? '', k.current_rank ?? 'Not ranking', k.rank_change ?? '', k.landing_page ?? '', humanise(k.status)])
      break
    }
    case 'briefs': {
      const { rows: briefs } = await getBriefs(scope, {
        q: readParam(params, 'q'), status: readParam(params, 'status'), contentType: readParam(params, 'contentType'),
        priority: readParam(params, 'priority'), sort: readParam(params, 'sort'), page: 1, pageSize: 5000,
      })
      header = ['Title', 'Target Keyword', 'Content Type', 'Priority', 'Status', 'Owner', 'Due Date', 'Completion %', 'Est. Traffic']
      rows = briefs.map(b => [b.title, b.target_keyword, humanise(b.content_type), humanise(b.priority), humanise(b.status), b.owner?.full_name ?? '', b.due_date ?? '', b.completion, b.est_traffic])
      break
    }
    case 'rankings': {
      const direction = (readParam(params, 'direction') as 'all' | 'improved' | 'declined' | undefined) ?? 'all'
      const { rows: changes } = await getRankingChanges(scope, { direction, page: 1, pageSize: 5000 })
      header = ['Keyword', 'Device', 'Country', 'Current Rank', 'Previous Rank', 'Change', 'Landing Page', 'Search Volume']
      rows = changes.map(c => [c.keyword, humanise(c.device), c.country.toUpperCase(), c.current_rank ?? 'Not ranking', c.previous_rank ?? '', c.rank_change ?? '', c.landing_page ?? '', c.search_volume])
      break
    }
    case 'local': {
      const locations = await getLocations(scope, { q: readParam(params, 'q'), status: readParam(params, 'status') })
      header = ['Name', 'Address', 'City', 'Country', 'Status', 'Average Local Rank', 'Map Pack Visibility %', 'Review Score', 'Review Count']
      rows = locations.map(l => [l.name, l.address_line ?? '', l.city ?? '', l.country.toUpperCase(), humanise(l.status), l.avg_local_rank ?? '', l.map_pack_visibility ?? '', l.review_score ?? '', l.review_count])
      break
    }
    case 'ai-search': {
      const { rows: prompts } = await getAiPrompts(scope, {
        q: readParam(params, 'q'), engine: readParam(params, 'engine'), citation: readParam(params, 'citation'),
        sentiment: readParam(params, 'sentiment'), page: 1, pageSize: 5000,
      })
      header = ['Prompt', 'Engine', 'Visibility', 'Citation Status', 'Sentiment', 'Linked Page', 'Last Checked', 'Method']
      rows = prompts.map(p => [p.prompt, humanise(p.engine), p.visibility ?? '', humanise(p.citation_status), p.sentiment ? humanise(p.sentiment) : '', p.linked_page ?? '', p.last_checked_at ?? '', humanise(p.method)])
      break
    }
    case 'backlinks': {
      const { rows: backlinks } = await getBacklinks(scope, {
        q: readParam(params, 'q'), status: readParam(params, 'status'), linkType: readParam(params, 'linkType'),
        sort: readParam(params, 'sort'), page: 1, pageSize: 5000,
      })
      header = ['Referring Domain', 'Linked Page', 'Anchor Text', 'Authority', 'Link Type', 'Status', 'First Seen', 'Traffic Value']
      rows = backlinks.map(b => [b.referring_domain, b.linked_page, b.anchor_text ?? '', b.authority ?? '', humanise(b.link_type), humanise(b.status), b.first_seen ?? '', b.traffic_value])
      break
    }
  }

  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId, action: 'seo.export.created', entityType: 'seo_export',
    metadata: { surface, siteId: site.id, rows: rows.length },
  })

  const csv = [header, ...rows].map(toCsvLine).join('\r\n')
  const filename = `caption-fox-seo-${surface}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function toCsvLine(cells: (string | number)[]): string {
  return cells.map(cell => {
    const value = String(cell ?? '')
    // Neutralise spreadsheet formula injection on untrusted text.
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')
}
