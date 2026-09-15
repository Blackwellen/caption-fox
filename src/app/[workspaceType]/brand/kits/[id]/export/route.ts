import { NextResponse, type NextRequest } from 'next/server'
import { resolveBrandContext } from '@/lib/brand-assets/context'
import { canAccessBrandCapability } from '@/lib/brand-assets/entitlements'
import { isUuid } from '@/lib/brand-assets/detail-queries'
import { KIT_EXPORT_FORMAT } from '@/lib/brand-assets/kit-transfer'

/**
 * Brand kit export (JSON). Gated by brand.kits.export, scoped to the caller's
 * workspace, audit-logged. The file is what Import Kit reads, so a kit can be
 * moved between workspaces or kept as a versioned backup.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceType: string; id: string }> }) {
  const { workspaceType, id } = await params
  const res = await resolveBrandContext(workspaceType)
  if (!res.ok) return NextResponse.json({ error: res.message }, { status: res.kind === 'unauthenticated' ? 401 : 403 })
  const ctx = res.context
  const decision = canAccessBrandCapability(ctx.entitlements, 'brand.kits.export')
  if (!decision.allowed) return NextResponse.json({ error: decision.message }, { status: 403 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Brand kit not found.' }, { status: 404 })

  const ws = ctx.workspace.id
  const { data: kit } = await ctx.supabase.from('brand_kits')
    .select('id, name, description, team_name, current_version, brand:brands(name)')
    .eq('id', id).eq('workspace_id', ws).maybeSingle()
  if (!kit) return NextResponse.json({ error: 'Brand kit not found.' }, { status: 404 })

  const [colours, typography, tone] = await Promise.all([
    ctx.supabase.from('brand_kit_colours').select('name, hex, role').eq('workspace_id', ws).eq('brand_kit_id', id).order('sort_order'),
    ctx.supabase.from('brand_kit_typography').select('style_name, font_family, font_weight, font_size_px, line_height_px').eq('workspace_id', ws).eq('brand_kit_id', id).order('sort_order'),
    ctx.supabase.from('brand_kit_tone').select('statement, traits').eq('workspace_id', ws).eq('brand_kit_id', id).maybeSingle(),
  ])

  const brand = Array.isArray(kit.brand) ? kit.brand[0] : kit.brand
  const body = {
    format: KIT_EXPORT_FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    kit: { name: kit.name, description: kit.description, team_name: kit.team_name, brand: (brand as { name?: string } | null)?.name ?? null, kit_version: kit.current_version },
    colours: colours.data ?? [],
    typography: typography.data ?? [],
    tone: tone.data ?? null,
  }

  await ctx.supabase.from('brand_activity').insert({
    workspace_id: ws, actor_id: ctx.userId, entity_type: 'brand_kit', entity_id: id, action: 'exported',
    summary: `Exported ${kit.name} as a brand kit file`, href: `${ctx.basePath}/brand/kits/${id}?tab=share`,
  })

  const slug = kit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand-kit'
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.brandkit.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
