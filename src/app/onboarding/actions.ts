'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/workspace-shared'
import {
  ACCOUNT_TYPE_META, firstIncompleteStep, isAccountType, sanitizeAll, sanitizeStep, validateAll, validateStep,
  type AccountType, type FieldErrors, type OnboardingData, type UploadRef,
} from '@/lib/onboarding/schema'

type Failure = { ok: false; message: string; errors?: FieldErrors; step?: number }
export type SaveResult = { ok: true; data: OnboardingData; currentStep: number } | Failure
export type CompleteResult = { ok: true; destination: string } | Failure

const SESSION_EXPIRED: Failure = { ok: false, message: 'Your session has expired. Sign in again to continue.' }
const SAVE_FAILED: Failure = { ok: false, message: 'We couldn’t save your changes. Try again.' }

async function context(type: string) {
  if (!isAccountType(type)) return { failure: { ok: false, message: 'Unknown account type.' } as Failure }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { failure: SESSION_EXPIRED }
  const { data: draft, error } = await supabase
    .from('onboarding_drafts')
    .select('account_type, current_step, data, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return { failure: SAVE_FAILED }
  if (!draft || draft.account_type !== type) return { failure: { ok: false, message: 'This setup session has changed. Refresh the page to continue.' } as Failure }
  if (draft.status === 'completed') return { failure: { ok: false, message: 'Setup is already complete.' } as Failure }
  return { supabase, user, draft, type: type as AccountType }
}

/** Creates (or switches) the caller's onboarding draft. */
export async function startOnboarding(type: string): Promise<{ ok: boolean; message?: string }> {
  if (!isAccountType(type)) return { ok: false, message: 'Choose an account type.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return SESSION_EXPIRED
  const { data: draft } = await supabase.from('onboarding_drafts').select('account_type, status').eq('user_id', user.id).maybeSingle()
  if (draft?.account_type === type && draft.status === 'in_progress') return { ok: true }
  // New type, a switch mid-setup, or an additional workspace after a completed setup.
  const { error } = await supabase.rpc('restart_onboarding', { p_type: type })
  if (error) return SAVE_FAILED
  await supabase.from('profiles').update({ account_type: type }).eq('id', user.id)
  return { ok: true }
}

/**
 * Saves one step. `advance` = the user pressed Continue: the step is validated
 * server-side and the furthest reachable step moves forward. Back/autosave
 * persists partial input without validation.
 */
export async function saveOnboardingStep(type: string, step: number, values: unknown, advance: boolean): Promise<SaveResult> {
  const ctx = await context(type)
  if ('failure' in ctx) return ctx.failure as Failure
  if (!Number.isInteger(step) || step < 1 || step > 4) return { ok: false, message: 'Unknown step.' }

  const previous = sanitizeAll(ctx.type, ctx.draft.data, ctx.user.id)
  const merged = { ...previous, ...sanitizeStep(ctx.type, step, values, ctx.user.id) }

  if (advance) {
    if (step > firstIncompleteStep(ctx.type, merged)) {
      return { ok: false, message: 'Complete the earlier steps first.', step: firstIncompleteStep(ctx.type, merged) }
    }
    const errors = validateStep(ctx.type, step, merged)
    if (Object.keys(errors).length > 0) return { ok: false, message: 'Check the highlighted fields.', errors, step }
  }

  const reachable = firstIncompleteStep(ctx.type, merged)
  const currentStep = advance ? Math.min(4, Math.max(ctx.draft.current_step, step + 1), reachable) : Math.min(ctx.draft.current_step, reachable)

  // Select the row back: an update blocked by RLS returns no error, just no rows.
  const { data: saved, error } = await ctx.supabase
    .from('onboarding_drafts')
    .update({ data: merged, current_step: currentStep })
    .eq('user_id', ctx.user.id)
    .select('user_id')
  if (error || !saved?.length) {
    console.error('[onboarding] save failed', { step, code: error?.code, message: error?.message, rows: saved?.length ?? 0 })
    return SAVE_FAILED
  }
  return { ok: true, data: merged, currentStep }
}

type PublishTarget = { field: string; bucket: string; prefix: (uid: string) => string; outKey: string; multiple: boolean }
const PUBLISH_TARGETS: PublishTarget[] = [
  { field: 'avatar', bucket: 'avatars', prefix: uid => uid, outKey: 'avatar_public_url', multiple: false },
  { field: 'logo', bucket: 'brand-assets', prefix: uid => `onboarding/${uid}`, outKey: 'logo_public_url', multiple: false },
  { field: 'brand_assets', bucket: 'brand-assets', prefix: uid => `onboarding/${uid}`, outKey: 'brand_asset_public_urls', multiple: true },
  { field: 'portfolio', bucket: 'media', prefix: uid => `suppliers/${uid}`, outKey: 'portfolio_public_urls', multiple: true },
]

// Copies private onboarding uploads into the buckets the rest of the product
// already reads from. Deterministic destinations + upsert keep retries safe.
async function publishUploads(userId: string, data: OnboardingData): Promise<OnboardingData | null> {
  const svc = createServiceClient()
  const out: OnboardingData = {}
  for (const target of PUBLISH_TARGETS) {
    const items = Array.isArray(data[target.field]) ? (data[target.field] as UploadRef[]) : []
    if (items.length === 0) continue
    if (!svc) return null
    const urls: string[] = []
    for (const item of items) {
      if (!item.path.startsWith(`${userId}/`)) continue
      const { data: blob, error } = await svc.storage.from('onboarding-uploads').download(item.path)
      if (error || !blob) continue
      const dest = `${target.prefix(userId)}/${item.path.split('/').pop()}`
      const { error: upErr } = await svc.storage.from(target.bucket).upload(dest, blob, { contentType: item.type, upsert: true })
      if (upErr) return null
      urls.push(svc.storage.from(target.bucket).getPublicUrl(dest).data.publicUrl)
    }
    out[target.outKey] = target.multiple ? urls : (urls[0] ?? null)
  }
  return out
}

export async function completeOnboarding(type: string, finalValues: unknown): Promise<CompleteResult> {
  const ctx = await context(type)
  if ('failure' in ctx) {
    // A double-submit after success lands here; send them on rather than erroring.
    if ((ctx.failure as Failure).message === 'Setup is already complete.' && isAccountType(type)) {
      return { ok: true, destination: ACCOUNT_TYPE_META[type].destination }
    }
    return ctx.failure as Failure
  }

  const merged = { ...sanitizeAll(ctx.type, ctx.draft.data, ctx.user.id), ...sanitizeStep(ctx.type, 4, finalValues, ctx.user.id) }
  const invalid = validateAll(ctx.type, merged)
  if (invalid) return { ok: false, message: 'Some required details are missing.', errors: invalid.errors, step: invalid.step }

  const published = await publishUploads(ctx.user.id, merged)
  if (!published) return { ok: false, message: 'We couldn’t process your uploads. Remove them or try again.' }

  const { error: saveError } = await ctx.supabase
    .from('onboarding_drafts')
    .update({ data: { ...merged, ...published }, current_step: 4 })
    .eq('user_id', ctx.user.id)
  if (saveError) return SAVE_FAILED

  const { data: result, error } = await ctx.supabase.rpc('complete_onboarding')
  if (error || !result) {
    return { ok: false, message: ctx.type === 'supplier' ? 'We couldn’t create your supplier profile. Try again.' : 'We couldn’t create your workspace. Try again.' }
  }

  const workspaceId = (result as { workspace_id?: string | null }).workspace_id
  if (workspaceId) {
    const store = await cookies()
    store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }
  return { ok: true, destination: ACCOUNT_TYPE_META[ctx.type].destination }
}
