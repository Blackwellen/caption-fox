// Server-only: imports next/headers, so it can never be pulled into a client
// bundle. (`server-only` is not a dependency of this project, hence the note
// rather than the guard package.)
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  ROUTE_SEGMENT_TO_WORKSPACE_TYPE,
  type BrandEntitlementContext,
  type WorkspaceRole,
} from './entitlements'
import type { BrandLite, WorkspaceStorage } from '@/types/brand-assets'

export const ACTIVE_BRAND_COOKIE = 'cf_brand'

export interface BrandContext {
  supabase: SupabaseClient
  userId: string
  workspace: {
    id: string
    name: string
    type: string
    plan: string
    plan_status: string
    logo_url: string | null
    settings: Record<string, unknown>
  }
  role: WorkspaceRole
  /** Brands the caller may see in this workspace. */
  brands: BrandLite[]
  /** Selected brand, or null when the caller is viewing all brands. */
  activeBrand: BrandLite | null
  storage: WorkspaceStorage
  entitlements: BrandEntitlementContext
  /** `/business`, `/brand`, `/agency`, `/creator` — the module's base path. */
  basePath: string
}

export type BrandContextResult =
  | { ok: true; context: BrandContext }
  | { ok: false; kind: 'unauthenticated' | 'no_workspace' | 'wrong_type' | 'forbidden'; message: string }

/**
 * Resolves everything the module needs in one place: auth, workspace membership,
 * role, plan, feature flags, brand scope and storage headroom.
 *
 * Workspace and brand identity are derived server-side from the session and the
 * route segment — never from a client-supplied id — so a forged cookie or query
 * parameter cannot widen access.
 */
export async function resolveBrandContext(routeSegment: string): Promise<BrandContextResult> {
  const expectedType = ROUTE_SEGMENT_TO_WORKSPACE_TYPE[routeSegment]
  if (!expectedType) {
    return { ok: false, kind: 'wrong_type', message: 'Unknown workspace type.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, kind: 'unauthenticated', message: 'Sign in to continue.' }

  const cookieStore = await cookies()
  const preferredWorkspace = cookieStore.get('cf_workspace')?.value

  // Memberships drive access. RLS also enforces this, but resolving the role
  // here lets the UI explain a denial instead of rendering an empty page.
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspace_id, workspaces(id, name, type, plan, plan_status, logo_url, settings)')
    .eq('user_id', user.id)

  type Row = {
    role: string
    workspace_id: string
    workspaces: BrandContext['workspace'] | BrandContext['workspace'][] | null
  }

  const rows = (memberships ?? []) as unknown as Row[]
  const candidates = rows
    .map(r => ({ role: r.role, ws: Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces }))
    .filter((r): r is { role: string; ws: BrandContext['workspace'] } => Boolean(r.ws))

  if (candidates.length === 0) {
    return { ok: false, kind: 'no_workspace', message: 'You are not a member of any workspace.' }
  }

  // Honour the active-workspace cookie only when that workspace matches the
  // route segment; otherwise fall back to the first workspace of the right type.
  const ofType = candidates.filter(c => c.ws.type === expectedType)
  if (ofType.length === 0) {
    return {
      ok: false,
      kind: 'wrong_type',
      message: `You have no ${routeSegment} workspace.`,
    }
  }
  const selected = ofType.find(c => c.ws.id === preferredWorkspace) ?? ofType[0]

  const workspace = {
    ...selected.ws,
    settings: (selected.ws.settings ?? {}) as Record<string, unknown>,
  }

  // Brands in scope. Agency workspaces may hold many client brands; a Brand
  // workspace may hold a family. Either way the caller only sees this workspace.
  const { data: brandRows } = await supabase
    .from('brands')
    .select('id, name, slug, logo_url, primary_color, status, family_id')
    .eq('workspace_id', workspace.id)
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('name')

  const brands = (brandRows ?? []) as BrandLite[]
  const preferredBrand = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value
  // A brand id from a cookie is only honoured if it is in this workspace's list.
  const activeBrand = brands.find(b => b.id === preferredBrand) ?? null

  const storage = await loadStorage(supabase, workspace.id)

  const flags = readFlags(workspace.settings)

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      workspace,
      role: selected.role as WorkspaceRole,
      brands,
      activeBrand,
      storage,
      basePath: `/${routeSegment}`,
      entitlements: {
        workspaceType: workspace.type,
        plan: workspace.plan,
        planStatus: workspace.plan_status,
        role: selected.role as WorkspaceRole,
        flags,
        storage: { bytesUsed: storage.bytes_used, bytesQuota: storage.bytes_quota },
      },
    },
  }
}

/** Feature flags live under workspaces.settings.feature_flags; unknown = on. */
function readFlags(settings: Record<string, unknown>): Record<string, boolean> {
  const raw = settings.feature_flags
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

async function loadStorage(supabase: SupabaseClient, workspaceId: string): Promise<WorkspaceStorage> {
  const { data } = await supabase
    .from('workspace_storage')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (data) return data as WorkspaceStorage
  return {
    workspace_id: workspaceId,
    bytes_used: 0,
    bytes_quota: 2199023255552,
    asset_count: 0,
    recalculated_at: new Date().toISOString(),
  }
}

/** Applies the active-brand filter to a query when one brand is selected. */
export function scopeToBrand<T extends { eq: (c: string, v: string) => T }>(
  query: T,
  activeBrand: BrandLite | null,
  column = 'brand_id',
): T {
  return activeBrand ? query.eq(column, activeBrand.id) : query
}
