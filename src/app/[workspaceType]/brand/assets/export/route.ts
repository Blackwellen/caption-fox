import { NextResponse, type NextRequest } from 'next/server'
import { resolveBrandContext } from '@/lib/brand-assets/context'
import { canAccessBrandCapability } from '@/lib/brand-assets/entitlements'
import { parseAssetFilters, type RawParams } from '@/lib/brand-assets/filters'
import { exportAssets } from '@/lib/brand-assets/queries'
import { csvRow } from '@/lib/brand-assets/csv'

/**
 * CSV export of the asset library. Uses exactly the filters, search and sort on
 * screen, is gated by brand.assets.download, and is audit-logged. Metadata
 * only — the files themselves stay behind signed, per-asset download URLs.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceType: string }> }) {
  const { workspaceType } = await params
  const res = await resolveBrandContext(workspaceType)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === 'unauthenticated' ? 401 : 403 })
  const ctx = res.context
  const decision = canAccessBrandCapability(ctx.entitlements, 'brand.assets.download')
  if (!decision.allowed) return NextResponse.json({ error: decision.message }, { status: 403 })

  const raw: RawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const rows = await exportAssets(ctx, parseAssetFilters(raw))

  const uk = (d: string | null) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London' }).format(new Date(d)) : '')
  const header = ['File name', 'Type', 'Kind', 'Size (bytes)', 'Brand', 'Approval', 'Rights', 'Usage scope', 'Owner', 'Tags', 'Version', 'Downloads', 'Added', 'Expires']
  const lines = [csvRow(header)].concat(rows.map(a => csvRow([
    a.file_name, a.file_type, a.asset_kind, a.file_size ?? '', a.brand?.name, a.approval_status, a.rights_state,
    a.usage_scope, a.owner?.full_name, a.tags.join('; '), a.version_no, a.download_count, uk(a.created_at), uk(a.expires_at),
  ])))

  await ctx.supabase.from('brand_activity').insert({
    workspace_id: ctx.workspace.id, actor_id: ctx.userId, entity_type: 'asset', action: 'exported',
    summary: `Exported ${rows.length} asset${rows.length === 1 ? '' : 's'} to CSV`, metadata: { filters: raw },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="brand-assets-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
