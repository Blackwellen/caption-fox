// Shared plumbing for the Studio server actions.
//
// This module is deliberately NOT a `'use server'` file: those may only export
// async functions, so the constants, types and synchronous helpers every action
// file needs live here instead of being duplicated six times.

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getStudioSession, type StudioSession } from './server'
import type { StudioCapabilities } from './entitlements'
import { SUPPORT_REFERENCE, captionLimitFor } from './constants'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  id?: string
  message?: string
  data?: T
}

/** Every Studio surface for every workspace type shares one layout segment. */
export function revalidateStudio(): void {
  revalidatePath('/[workspaceType]/studio', 'layout')
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

/** A database failure never reaches the user verbatim — it could leak schema. */
export function dbFail(context: string, error: { message: string }): ActionResult<never> {
  console.error(`[studio] ${context}:`, error.message)
  return { ok: false, error: `We could not complete that action. Reference ${SUPPORT_REFERENCE}.` }
}

/**
 * Re-resolves the session server-side and re-checks one capability. Every
 * mutation starts here: hiding a button is not security, so a hidden action
 * must still be refused when it is called directly.
 */
export async function authorise(
  capability: keyof StudioCapabilities,
): Promise<{ session: StudioSession | null; error?: string }> {
  const session = await getStudioSession()
  if (session.ctx.planStatus === 'cancelled') {
    return { session: null, error: 'This workspace subscription has been cancelled. Reactivate a plan to continue.' }
  }
  if (!session.capabilities[capability]) {
    return { session: null, error: 'Your role does not allow this action.' }
  }
  return { session }
}

/** Confirms a record belongs to the active workspace before it is mutated. */
export async function ownsRecord(
  supabase: SupabaseClient, table: string, id: string, workspaceId: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select('id')
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  return Boolean(data)
}

/** Writes the human-readable Studio feed entry. Never throws — logging is not the work. */
export async function logActivity(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: { entityType: string; entityId?: string | null; action: string; summary: string; link?: string },
): Promise<void> {
  try {
    await supabase.from('studio_activity').insert({
      workspace_id: workspaceId,
      actor_id: actorId,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      action: entry.action,
      summary: entry.summary,
      link: entry.link ?? null,
      surface: 'studio',
    })
  } catch (error) {
    console.error('[studio] activity log failed:', error)
  }
}

/**
 * Audit trail. Uses `actor_id` / `resource_type` / `resource_id` — the column
 * shape `audit_logs` actually has and the rest of the product reads back.
 */
export async function logAudit(
  supabase: SupabaseClient,
  workspaceId: string,
  actorId: string,
  entry: { action: string; resourceType: string; resourceId?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      actor_id: actorId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch (error) {
    console.error('[studio] audit log failed:', error)
  }
}

/** Normalises an untrusted array input: trims, de-dupes, allowlists and caps it. */
export function cleanArray(value: unknown, allowed?: readonly string[], max = 50): string[] {
  if (!Array.isArray(value)) return []
  const out = value
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean)
    .filter(v => !allowed || (allowed as readonly string[]).includes(v))
  return [...new Set(out)].slice(0, max)
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export { scoreContent, type QualityCheck } from './quality'

/** Terms this workspace has explicitly blocked, lower-cased and without the `#`. */
export async function blockedTermSet(
  supabase: SupabaseClient, workspaceId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('studio_blocked_terms').select('term').eq('workspace_id', workspaceId).limit(1000)
  return new Set((data ?? []).map(r => String(r.term).replace(/^#/, '').toLowerCase()))
}
