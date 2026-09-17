import { NextResponse, type NextRequest } from 'next/server'
import { resolveBrandContext } from '@/lib/brand-assets/context'
import { canAccessBrandCapability } from '@/lib/brand-assets/entitlements'
import { parseProductFilters, type RawParams } from '@/lib/brand-assets/filters'
import { exportProducts } from '@/lib/brand-assets/queries'
import { csvRow } from '@/lib/brand-assets/csv'

/**
 * CSV export of the product catalogue. Uses exactly the filters, search and
 * sort on screen, is gated by brand.products.export, and is audit-logged.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ workspaceType: string }> }) {
  const { workspaceType } = await params
  const res = await resolveBrandContext(workspaceType)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === 'unauthenticated' ? 401 : 403 })
  const ctx = res.context
  const decision = canAccessBrandCapability(ctx.entitlements, 'brand.products.export')
  if (!decision.allowed) return NextResponse.json({ error: decision.message }, { status: 403 })

  const raw: RawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
  const rows = await exportProducts(ctx, parseProductFilters(raw))

  const uk = (d: string | null) => (d ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London' }).format(new Date(d)) : '')
  const header = ['Name', 'SKU', 'Brand', 'Category', 'Product line', 'Status', 'Readiness', 'Readiness score', 'Linked assets', 'Markets', 'Owner', 'Created', 'Updated']
  const lines = [csvRow(header)].concat(rows.map(p => csvRow([
    p.name, p.sku, p.brand?.name, p.category_name, p.product_line, p.status, p.readiness_state,
    Math.round(Number(p.readiness_score)), p.linked_asset_count, p.markets.join('; '), p.owner?.full_name,
    uk(p.created_at), uk(p.updated_at),
  ])))

  await ctx.supabase.from('brand_activity').insert({
    workspace_id: ctx.workspace.id, actor_id: ctx.userId, entity_type: 'product', action: 'exported',
    summary: `Exported ${rows.length} product${rows.length === 1 ? '' : 's'} to CSV`, metadata: { filters: raw },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="product-library-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
