import 'server-only'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { logAudit } from '@/lib/audit'
import {
  canAccessStrategyModule, strategyCapabilities,
  type StrategyCapabilities, type StrategyContext,
} from './entitlements'
import type { StrategyModule } from './constants'
import type { ActionResult } from './action-types'
import { FieldErrors } from './validation'

/**
 * Session for Strategy server actions and API routes. Unlike page rendering it
 * never redirects: an expired session or a missing workspace comes back as a
 * structured error the client can show.
 */
export interface StrategyActionSession {
  supabase: SupabaseClient
  userId: string
  ctx: StrategyContext
  capabilities: StrategyCapabilities
}

export async function getStrategyActionSession(): Promise<StrategyActionSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { active } = await getActiveWorkspace(supabase, user.id)
  if (!active) return null

  const [{ data: workspace }, { data: profile }] = await Promise.all([
    supabase.from('workspaces').select('type, plan, plan_status, settings').eq('id', active.id).maybeSingle(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
  ])
  const settings = (workspace?.settings ?? {}) as Record<string, unknown>

  const ctx: StrategyContext = {
    workspaceId: active.id,
    workspaceType: workspace?.type ?? active.type,
    plan: workspace?.plan,
    planStatus: workspace?.plan_status,
    role: active.role,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    flags: (settings.feature_flags ?? {}) as Record<string, boolean>,
  }
  return { supabase, userId: user.id, ctx, capabilities: strategyCapabilities(ctx) }
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult {
  return { ok: false, error, fieldErrors }
}

export function invalid(errors: FieldErrors): ActionResult {
  return { ok: false, error: errors.first ?? 'Please check the highlighted fields.', fieldErrors: errors.errors }
}

/**
 * Resolves the session and asserts module entitlement + one capability.
 * Hidden buttons are UX only — this is the enforcement point.
 */
export async function authorise(
  module: StrategyModule,
  capability: keyof StrategyCapabilities,
): Promise<{ session: StrategyActionSession; error: null } | { session: null; error: string }> {
  const session = await getStrategyActionSession()
  if (!session) return { session: null, error: 'Your session has expired. Sign in again to continue.' }
  if (!canAccessStrategyModule(session.ctx, module).allowed) {
    return { session: null, error: 'This area is not available for your workspace.' }
  }
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' }
  }
  return { session, error: null }
}

/** Confirms a record belongs to the active workspace before touching it. */
export async function ownsRecord(supabase: SupabaseClient, table: string, id: string | null | undefined, workspaceId: string): Promise<boolean> {
  if (!id) return false
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

/**
 * Fixed-window rate limit backed by the activity log, so it holds across
 * serverless instances without extra infrastructure. Counts the actor's own
 * rows for `action` inside the window.
 */
export async function rateLimited(
  supabase: SupabaseClient, workspaceId: string, userId: string,
  action: string, limit: number, windowMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { count } = await supabase.from('strategy_activity')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('actor_id', userId).eq('action', action).gte('created_at', since)
  return (count ?? 0) >= limit
}

export type ActivityEntity =
  | 'strategy' | 'objective' | 'audience' | 'research' | 'framework' | 'proof_point' | 'claim'
  | 'competitor' | 'plan' | 'plan_item' | 'forecast' | 'scenario' | 'assumption' | 'approval' | 'system'

/**
 * Activity feed + audit trail in one call. The feed row is human-readable;
 * the audit row carries the structured change. Neither may break the action.
 */
export async function record(
  session: StrategyActionSession,
  entry: {
    entityType: ActivityEntity
    entityId?: string | null
    action: string
    summary: string
    surface: StrategyModule
    audit?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { supabase, ctx, userId } = session
  const { error } = await supabase.from('strategy_activity').insert({
    workspace_id: ctx.workspaceId,
    actor_id: userId,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    action: entry.action,
    summary: entry.summary.slice(0, 300),
    surface: entry.surface,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[strategy] activity write failed', { action: entry.action, code: error.code })
  await logAudit(supabase, userId, {
    workspaceId: ctx.workspaceId,
    action: entry.audit ?? `strategy.${entry.entityType}.${entry.action.replace(/\s+/g, '_')}`,
    entityType: `strategy_${entry.entityType}`,
    entityId: entry.entityId ?? null,
    metadata: { surface: entry.surface, ...(entry.metadata ?? {}) },
  })
}

/** Every Strategy route shares one layout, so one revalidation refreshes them all. */
export function revalidateStrategy() {
  revalidatePath('/[workspaceType]/strategy', 'layout')
}

/** Maps a Postgres/PostgREST error to user copy without leaking internals. */
export function dbError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback
  if (error.code === '42501') return 'You do not have permission to change this record.'
  if (error.code === '23505') return 'A record with these details already exists.'
  if (error.code === '23514') return error.message?.includes('circular') ? 'That dependency would create a circular chain.' : 'Some values are outside the allowed range.'
  if (error.code === '23503') return 'A linked record no longer exists.'
  console.error('[strategy] database error', { code: error.code })
  return fallback
}
