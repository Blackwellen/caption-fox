'use server'

import { createClient } from '@/lib/supabase/server'
import { recordSecurityEvent } from '@/lib/auth/audit'

// Server-side entitlement: is_platform_admin is read with the caller's own
// session (the column is now client-immutable), never from the browser.
export async function verifyAdminEntitlement(): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_platform_admin) {
    await recordSecurityEvent('admin.login.denied', user.id, { reason: 'not_platform_admin' })
    return { ok: false }
  }
  return { ok: true }
}

export async function recordAdminMfaFailure(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await recordSecurityEvent('admin.login.mfa_failed', user.id)
}

export async function recordAdminLogin(enrolled: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const [{ data: aal }, { data: profile }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
  ])
  const ok = aal?.currentLevel === 'aal2' && !!profile?.is_platform_admin
  await recordSecurityEvent(ok ? 'admin.login.success' : 'admin.login.denied', user.id, { mfa_enrolled_now: enrolled, aal: aal?.currentLevel ?? null })
  return { ok }
}
