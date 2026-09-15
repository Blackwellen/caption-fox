import { NextResponse, type NextRequest } from 'next/server'
import { resolveBrandContext } from '@/lib/brand-assets/context'
import { canAccessBrandCapability } from '@/lib/brand-assets/entitlements'
import { parseRightsFilters, type RawParams } from '@/lib/brand-assets/filters'
import { exportRights } from '@/lib/brand-assets/queries'
import { CSV_BOM, csvRow } from '@/lib/brand-assets/csv'

/**
 * CSV export of the rights register. Uses exactly the filters, search and sort
 * on screen, is gated by brand.rights.export, and is audit-logged.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceType: string }> }) {
  const { workspaceType } = await params
  const res = await resolveBrandContext(workspaceType)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === 'unauthenticated' ? 401 : 403 })
  const ctx = res.context
  const decision = canAccessBrandCapability(ctx.entitlements, 'brand.rights.export')
  if (!decision.allowed) return NextResponse.json({ error: decision.message }, { status: 403 })

  const raw: RawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const rows = await exportRights(ctx, parseRightsFilters(raw))

  const uk =(d: string | null) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London' }).format(new Date(d)) : '')
  const header = ['Licence', 'Reference', 'Type', 'Status', 'Asset', 'Product', 'Territories', 'Channels', 'Start', 'Expiry', 'Days remaining', 'Usage scope', 'Exclusive', 'Risk', 'Owner']
  const lines = [csvRow(header)].concat(rows.map(r => csvRow([
    r.name, r.reference, r.license_type, r.status, r.asset?.file_name, r.product ? `${r.product.name} (${r.product.sku})` : '',
    r.territories.map(t => t.name).join('; '), r.channels.map(c => c.name).join('; '), uk(r.starts_on), uk(r.expires_on),
    r.days_remaining ?? '', r.usage_scope, r.exclusivity ? 'Yes' : 'No', r.risk_level, r.owner?.full_name,
  ])))

  await ctx.supabase.from('brand_activity').insert({
    workspace_id: ctx.workspace.id, actor_id: ctx.userId, entity_type: 'license', action: 'exported',
    summary: `Exported ${rows.length} licence${rows.length === 1 ? '' : 's'} to CSV`, metadata: { filters: raw },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rights-register-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
