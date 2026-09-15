import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '@/lib/permissions'

export interface InboxSession {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  workspace: WorkspaceLite
  role: string
  canView: boolean
  canReply: boolean
  canAssign: boolean
}

/**
 * Resolves the authenticated session and active workspace for every Inbox
 * surface (the four full-page routes and the Fox AI Copilot Inbox/Contacts
 * states). Redirects unauthenticated users to login and users with no
 * workspace to onboarding, matching the Campaigns module convention.
 */
export async function getInboxSession(): Promise<InboxSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const role = active.role ?? 'member'
  const perms = ROLE_PERMISSIONS[role] ?? []

  return {
    supabase,
    userId: user.id,
    workspaceId: active.id,
    workspace: active,
    role,
    canView: hasPermission(perms, PERMISSIONS.VIEW_INBOX),
    canReply: hasPermission(perms, PERMISSIONS.REPLY_INBOX),
    canAssign: hasPermission(perms, PERMISSIONS.ASSIGN_INBOX),
  }
}
