import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import {
  canAccessInboxCapability, inboxCapabilityBlocker, PLAN_MAP, surfaceForWorkspaceType,
  type InboxCapability, type InboxContext,
} from './entitlements'

export interface InboxWorkspace {
  id: string
  name: string
  type: string
  plan: string
  timezone: string
}

export interface ResolvedInbox {
  supabase: SupabaseClient
  userId: string
  workspace: InboxWorkspace
  ctx: InboxContext
  can: (capability: InboxCapability) => boolean
}

/**
 * Resolves user, active workspace, membership, plan, role and flags from the
 * session only — never from anything the browser sends. Returns null when the
 * user is signed out, has no workspace, or is not a member of it.
 */
export async function resolveInbox(): Promise<ResolvedInbox | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) return null

  const [{ data: workspace }, { data: membership }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, settings, owner_id').eq('id', active.id).maybeSingle(),
    supabase.from('workspace_members').select('role, permissions').eq('workspace_id', active.id).eq('user_id', user.id).maybeSingle(),
  ])
  if (!workspace) return null
  const isOwner = workspace.owner_id === user.id
  if (!membership && !isOwner) return null

  const settings = (workspace.settings ?? {}) as Record<string, unknown>
  const overrides = membership?.permissions as unknown
  const ctx: InboxContext = {
    surface: surfaceForWorkspaceType(workspace.type),
    plan: PLAN_MAP[workspace.plan] ?? 'free',
    role: isOwner ? 'owner' : (membership?.role ?? 'viewer'),
    permissions: Array.isArray(overrides) ? (overrides as string[]) : null,
    featureFlags: (settings.feature_flags ?? null) as Record<string, boolean> | null,
    workspaceStatus: workspace.plan_status,
  }
  return {
    supabase,
    userId: user.id,
    workspace: {
      id: workspace.id, name: workspace.name, type: workspace.type, plan: workspace.plan,
      timezone: (settings.timezone as string) ?? 'Europe/London',
    },
    ctx,
    can: capability => canAccessInboxCapability(ctx, capability),
  }
}

export type GuardResult =
  | { ok: false; error: string; status: number }
  | ({ ok: true } & ResolvedInbox)

/** The single guard every Inbox/Fox AI mutation and API route calls. */
export async function guardInbox(capability: InboxCapability): Promise<GuardResult> {
  const resolved = await resolveInbox()
  if (!resolved) return { ok: false, error: 'You need to be signed in to a workspace.', status: 401 }
  const blocker = inboxCapabilityBlocker(resolved.ctx, capability)
  if (blocker === 'plan') return { ok: false, error: 'Your plan does not include this feature. Upgrade to continue.', status: 402 }
  if (blocker === 'feature-flag') return { ok: false, error: 'This feature is turned off for your workspace.', status: 403 }
  if (blocker === 'workspace-status') return { ok: false, error: 'This workspace is suspended, so changes are paused.', status: 403 }
  if (blocker) return { ok: false, error: 'You do not have permission to do that.', status: 403 }
  return { ok: true, ...resolved }
}
