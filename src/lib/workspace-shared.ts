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
