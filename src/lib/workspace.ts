import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_WORKSPACE_COOKIE, type WorkspaceLite } from './workspace-shared'

export { ACTIVE_WORKSPACE_COOKIE, canManageWorkspace } from './workspace-shared'
export type { WorkspaceLite }

// All workspaces the user can access (memberships + owned), de-duped.
export async function getUserWorkspaces(supabase: SupabaseClient, userId: string): Promise<WorkspaceLite[]> {
  const map = new Map<string, WorkspaceLite>()

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, type, logo_url)')
    .eq('user_id', userId)

  for (const row of memberships ?? []) {
    const w = (row as { workspaces?: WorkspaceLite | WorkspaceLite[] }).workspaces
    const ws = Array.isArray(w) ? w[0] : w
    if (ws?.id) map.set(ws.id, { ...ws, role: (row as { role?: string }).role ?? null })
  }

  const { data: owned } = await supabase
    .from('workspaces')
    .select('id, name, type, logo_url')
    .eq('owner_id', userId)

  for (const w of owned ?? []) {
    if (!map.has(w.id)) map.set(w.id, { ...w, role: 'owner' })
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// The active workspace = cookie preference if still valid, else the first available.
export async function getActiveWorkspace(supabase: SupabaseClient, userId: string): Promise<{
  active: WorkspaceLite | null
  workspaces: WorkspaceLite[]
}> {
  const workspaces = await getUserWorkspaces(supabase, userId)
  if (workspaces.length === 0) return { active: null, workspaces }
  const cookieStore = await cookies()
  const preferred = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value
  const active = workspaces.find(w => w.id === preferred) ?? workspaces[0]
  return { active, workspaces }
}
