import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import {
  canAccessSocialCapability, canAccessSocialSurface, hasSocialPermission,
  visibleSocialSurfaces, type AccessResult, type SocialContextInput, type SocialSurface,
} from './entitlements'

export interface SocialSession {
  supabase: SupabaseClient
  userId: string
  ctx: SocialContextInput
  workspace: WorkspaceLite & { plan?: string | null; plan_status?: string | null }
  surfaces: SocialSurface[]
  can: (permission: Permission) => boolean
}

/**
 * Resolves the authenticated session, active workspace, plan, role and feature
 * flags for the Social module. Every Social route and server action funnels
 * through this — the workspace is never taken from a client-supplied value.
 */
export async function getSocialSession(): Promise<SocialSession> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/app/social')

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: workspace }, { data: profile }, { count: channelCount }] = await Promise.all([
    supabase.from('workspaces').select('id, name, type, plan, plan_status, logo_url, settings').eq('id', active.id).single(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single(),
    supabase.from('social_channels').select('id', { count: 'exact', head: true })
      .eq('workspace_id', active.id).eq('is_active', true),
  ])

  const settings = (workspace?.settings ?? {}) as { feature_flags?: Record<string, boolean> }

  const ctx: SocialContextInput = {
    workspaceId: active.id,
    workspaceType: workspace?.type ?? active.type,
    plan: workspace?.plan,
    planStatus: workspace?.plan_status,
    role: active.role,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    flags: settings.feature_flags ?? {},
    connectedChannels: channelCount ?? 0,
  }

  return {
    supabase,
    userId: user.id,
    ctx,
    workspace: { ...active, plan: workspace?.plan, plan_status: workspace?.plan_status },
    surfaces: visibleSocialSurfaces(ctx),
    can: (permission: Permission) => hasSocialPermission(ctx, permission),
  }
}

/**
 * Session plus a hard route-level gate for one Social surface. Returns the
 * block reason rather than throwing so the page renders the canonical
 * no-access / upgrade state instead of a white screen.
 */
export async function requireSocialSurface(surface: SocialSurface) {
  const session = await getSocialSession()
  const access = canAccessSocialSurface(session.ctx, surface)
  return { ...session, access }
}

/**
 * Server-side capability guard for mutations. Throws a plain Error whose
 * message is safe to show — never leaks record identifiers or internals.
 */
export function assertCapability(session: SocialSession, capability: Permission): void {
  const access: AccessResult = canAccessSocialCapability(session.ctx, capability)
  if (!access.allowed) throw new Error(access.message)
}

/** Confirms a record belongs to the caller's active workspace before mutating. */
export async function assertOwnedRecord(
  session: SocialSession,
  table: string,
  id: string,
): Promise<void> {
  const { data, error } = await session.supabase
    .from(table).select('id').eq('id', id).eq('workspace_id', session.ctx.workspaceId).maybeSingle()
  if (error || !data) throw new Error('That record is not available in this workspace.')
}

export interface SocialActivityInput {
  action: string
  entityType: string
  entityId?: string | null
  channelId?: string | null
  /** One line, written for a teammate to read in the activity feed. */
  summary: string
  detail?: string | null
  href?: string | null
  severity?: 'info' | 'success' | 'warning' | 'error'
  metadata?: Record<string, unknown>
}

/**
 * Writes both records for one Social event: the member-visible activity feed
 * entry and the owner/admin-only audit row. Never records tokens, refresh
 * tokens, provider secrets or raw message bodies.
 */
export async function logSocialActivity(
  session: SocialSession,
  input: SocialActivityInput,
): Promise<void> {
  const workspace_id = session.ctx.workspaceId
  await Promise.all([
    session.supabase.from('social_activity').insert({
      workspace_id,
      actor_id: session.userId,
      actor_kind: 'user',
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      channel_id: input.channelId ?? null,
      summary: input.summary,
      detail: input.detail ?? null,
      href: input.href ?? null,
      severity: input.severity ?? 'info',
      metadata: input.metadata ?? {},
    }),
    session.supabase.from('audit_logs').insert({
      workspace_id,
      actor_id: session.userId,
      action: input.action,
      resource_type: input.entityType,
      resource_id: input.entityId ?? null,
      metadata: { summary: input.summary, ...(input.metadata ?? {}) },
    }),
  ])
}

export { PERMISSIONS }
