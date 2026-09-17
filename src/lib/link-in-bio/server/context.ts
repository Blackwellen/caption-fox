import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace, type WorkspaceLite } from '@/lib/workspace'
import { getDefaultPermissions } from '@/lib/permissions'
import {
  canAccessLinks, canAccessLinkCapability, normaliseLinksPlan, resolveLinkCapabilities,
  type LinkCapability, type LinkDenial, type LinksContext,
} from '../entitlements'

// One resolver every Link in Bio route and server action calls first. It
// authenticates, resolves the active workspace, plan, role and flags, and
// returns a precomputed capability map so a gate cannot drift between the
// sidebar, the page and the mutation.

export type Member = { id: string; name: string; avatarUrl: string | null; title: string | null }

export type LinksSession = {
  supabase: SupabaseClient
  userId: string
  workspace: WorkspaceLite
  workspaceType: string
  basePath: string
  role: string
  plan: ReturnType<typeof normaliseLinksPlan>
  capabilities: Record<LinkCapability, boolean>
  context: LinksContext
  members: Member[]
}

export type LinksGate =
  | { ok: true; session: LinksSession }
  | { ok: false; denial: LinkDenial; workspaceType: string }

export const getLinksGate = cache(async (workspaceType: string): Promise<LinksGate> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const basePath = `/${workspaceType}/links`
  if (!user) redirect(`/login?next=${encodeURIComponent(basePath)}`)

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) {
    return { ok: false, workspaceType, denial: { allowed: false, reason: 'workspace_status', message: 'You do not have access to a workspace yet.' } }
  }

  const [{ data: workspaceRow }, { data: memberRows }] = await Promise.all([
    supabase.from('workspaces').select('plan, plan_status, settings').eq('id', active.id).maybeSingle(),
    supabase.from('workspace_members')
      .select('user_id, role, permissions, profiles!workspace_members_user_id_fkey(full_name, avatar_url, job_title, email)')
      .eq('workspace_id', active.id),
  ])

  const settings = (workspaceRow?.settings ?? {}) as Record<string, unknown>
  const flags = (settings.feature_flags ?? {}) as Record<string, boolean>
  const self = (memberRows ?? []).find(row => row.user_id === user.id)
  const role = (self?.role as string | undefined) ?? active.role ?? 'member'
  const explicit = Array.isArray(self?.permissions) ? (self?.permissions as string[]) : null

  const context: LinksContext = {
    workspaceType,
    plan: workspaceRow?.plan as string | null,
    planStatus: (workspaceRow?.plan_status as string | null) ?? 'active',
    role,
    permissions: explicit && explicit.length ? explicit : getDefaultPermissions(role),
    flags,
  }

  const access = canAccessLinks(context)
  if (!access.allowed) return { ok: false, workspaceType, denial: access }

  const members: Member[] = (memberRows ?? []).map(row => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { full_name?: string | null; avatar_url?: string | null; job_title?: string | null; email?: string | null } | null
    return {
      id: row.user_id as string,
      name: profile?.full_name || profile?.email?.split('@')[0] || 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      title: profile?.job_title ?? null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return {
    ok: true,
    session: {
      supabase, userId: user.id, workspace: active, workspaceType, basePath, role,
      plan: normaliseLinksPlan(context.plan), capabilities: resolveLinkCapabilities(context), context, members,
    },
  }
})

/** For server actions: resolves the gate and asserts one capability. */
export async function requireLinkCapability(workspaceType: string, capability: LinkCapability): Promise<
  { ok: true; session: LinksSession } | { ok: false; error: string }
> {
  const gate = await getLinksGate(workspaceType)
  if (!gate.ok) return { ok: false, error: gate.denial.message }
  const check = canAccessLinkCapability(gate.session.context, capability)
  if (!check.allowed) return { ok: false, error: check.message }
  return { ok: true, session: gate.session }
}

export function memberById(session: LinksSession, id: string | null | undefined): Member | null {
  if (!id) return null
  return session.members.find(member => member.id === id) ?? null
}
