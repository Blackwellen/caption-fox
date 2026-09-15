// Client-safe workspace types/constants (no server-only imports like next/headers).

export interface WorkspaceLite {
  id: string
  name: string
  type?: string | null
  logo_url?: string | null
  role?: string | null
}

export const ACTIVE_WORKSPACE_COOKIE = 'cf_workspace'

// Roles allowed to see Workspace + Billing settings. Everyone sees Account settings.
export function canManageWorkspace(role?: string | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

// workspaces.type (DB) -> the type-first route segment used by modules that
// aren't yet ported into the /app/* shell (e.g. /creator/events). Keep this in
// sync with SURFACE_BY_ROUTE-style maps in those route trees.
const WORKSPACE_TYPE_ROUTE_SEGMENT: Record<string, string> = {
  creator: 'creator',
  small_business: 'business',
  brand: 'brand',
  agency: 'agency',
}

export function workspaceRouteSegment(type?: string | null): string | null {
  if (!type) return null
  return WORKSPACE_TYPE_ROUTE_SEGMENT[type] ?? null
}
