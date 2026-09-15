'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { recordSecurityEvent } from '@/lib/auth/audit'
import { mapAuthError } from '@/lib/auth/errors'
import {
  sanitizeApplication, validateApplication, validateApplicationStep,
  type AffiliateApplicationInput, type ApplicationErrors,
} from '@/lib/affiliate-application'

export type AffiliateStatus = 'none' | 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected' | 'active' | 'suspended'

const OPEN = ['draft', 'pending', 'needs_info']

function toRow(v: AffiliateApplicationInput) {
  return {
    full_name: v.full_name,
    website_url: v.website_url || null,
    primary_channel: v.primary_channel || null,
    promotion_channel: v.primary_channel || null,
    country: v.country || null,
    audience_size: v.audience_size || null,
    platforms: v.platforms,
    content_categories: v.content_categories,
    promotion_method: v.promotion_method || null,
    audience_links: v.audience_links,
    message: v.message || null,
  }
}

/** Entitlement check after sign-in on the affiliate portal. */
export async function checkAffiliateAccess(): Promise<{ status: AffiliateStatus }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'none' }
  const { data: affiliate } = await supabase.from('affiliates').select('status').eq('user_id', user.id).maybeSingle()
  if (affiliate) return { status: affiliate.status === 'active' ? 'active' : 'suspended' }
  const { data: app } = await supabase
    .from('affiliate_applications')
    .select('status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { status: (app?.status as AffiliateStatus | undefined) ?? 'none' }
}

export interface AffiliateDraftState {
  signedIn: boolean
  email: string | null
  status: AffiliateStatus
  reviewNote: string | null
  draft: Partial<AffiliateApplicationInput> | null
}

export async function loadAffiliateApplication(): Promise<AffiliateDraftState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { signedIn: false, email: null, status: 'none', reviewNote: null, draft: null }
  const { status } = await checkAffiliateAccess()
  const { data: app } = await supabase
    .from('affiliate_applications')
    .select('full_name, website_url, primary_channel, country, audience_size, platforms, content_categories, promotion_method, audience_links, message, review_note, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  return {
    signedIn: true,
    email: user.email ?? null,
    status,
    reviewNote: app?.status === 'needs_info' ? (app.review_note as string | null) : null,
    draft: app && OPEN.includes(app.status as string)
      ? { ...(app as Partial<AffiliateApplicationInput>), email: user.email ?? '', message: (app.message as string | null) ?? '' }
      : { full_name: (profile?.full_name as string | null) ?? '', email: user.email ?? '' },
  }
}

/** Signed-in applicants: persist progress between steps. */
export async function saveAffiliateDraft(values: unknown, step: 1 | 2): Promise<{ ok: boolean; message?: string; errors?: ApplicationErrors }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Your session has expired. Sign in again to continue.' }
  const v = { ...sanitizeApplication(values), email: user.email ?? '' }
  const errors = validateApplicationStep(step, v, { needsPassword: false })
  if (Object.keys(errors).length) return { ok: false, message: 'Check the highlighted fields.', errors }

  const { data: open } = await supabase.from('affiliate_applications').select('id, status').eq('user_id', user.id).in('status', OPEN).maybeSingle()
  if (open?.status === 'pending') return { ok: true }
  const { error } = open
    ? await supabase.from('affiliate_applications').update(toRow(v)).eq('id', open.id)
    : await supabase.from('affiliate_applications').insert({ ...toRow(v), user_id: user.id, email: user.email, status: 'draft' })
  if (error) return { ok: false, message: 'We couldn’t save your application. Try again.' }
  return { ok: true }
}

export type SubmitResult =
  | { ok: true; email: string; verifyEmail: boolean }
  | { ok: false; message: string; errors?: ApplicationErrors; step?: 1 | 2 }

export async function submitAffiliateApplication(values: unknown): Promise<SubmitResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const raw = sanitizeApplication(values)

  if (user) {
    const v = { ...raw, email: user.email ?? '' }
    const invalid = validateApplication(v, { needsPassword: false })
    if (invalid) return { ok: false, message: 'Check the highlighted fields.', ...invalid }
    const { data: open } = await supabase.from('affiliate_applications').select('id, status').eq('user_id', user.id).in('status', OPEN).maybeSingle()
    if (open?.status === 'pending') return { ok: true, email: v.email, verifyEmail: false }
    const row = { ...toRow(v), status: 'pending', submitted_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString() }
    const { error } = open
      ? await supabase.from('affiliate_applications').update(row).eq('id', open.id)
      : await supabase.from('affiliate_applications').insert({ ...row, user_id: user.id, email: user.email })
    if (error) return { ok: false, message: 'We couldn’t submit your application. Try again.' }
    await recordSecurityEvent('affiliate.application.submitted', user.id)
    return { ok: true, email: v.email, verifyEmail: false }
  }

  // New applicant: create the partner account, then the application (service
  // role, because the account has no session until the email is verified).
  const invalid = validateApplication(raw, { needsPassword: true })
  if (invalid) return { ok: false, message: 'Check the highlighted fields.', ...invalid }
  const svc = createServiceClient()
  if (!svc) return { ok: false, message: 'Applications are temporarily unavailable. Try again later.' }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await svc.from('affiliate_applications').select('id', { count: 'exact', head: true }).ilike('email', raw.email).gte('created_at', since)
  if ((count ?? 0) >= 3) return { ok: false, message: 'Too many applications for this email today. Try again tomorrow.' }

  const h = await headers()
  const origin = h.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { data, error } = await supabase.auth.signUp({
    email: raw.email,
    password: raw.password,
    options: {
      data: { full_name: raw.full_name, affiliate_applicant: true },
      emailRedirectTo: `${origin}/callback?next=/affiliates/portal`,
    },
  })
  if (error) return { ok: false, message: mapAuthError(error).message, step: 1 }
  if (!data.user || (data.user.identities?.length ?? 0) === 0) {
    return { ok: false, step: 1, message: 'This email already has a Caption Fox account. Sign in first, then apply.' }
  }

  const now = new Date().toISOString()
  const { error: insertError } = await svc.from('affiliate_applications').insert({
    ...toRow(raw), user_id: data.user.id, email: raw.email, status: 'pending', submitted_at: now, terms_accepted_at: now,
  })
  if (insertError) return { ok: false, message: 'Your account was created, but we couldn’t submit the application. Verify your email, sign in and apply again.' }
  await recordSecurityEvent('affiliate.application.submitted', data.user.id)
  return { ok: true, email: raw.email, verifyEmail: !data.session }
}
