import 'server-only'

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AffiliateGrantRecord {
  id: string
  code: string
  status: string
  payout_email: string | null
  created_at: string
}

export interface ResolvedAffiliateGrant {
  state: 'active' | 'revoked'
  affiliate: AffiliateGrantRecord
  userId: string
  email: string | null
  fullName: string | null
  supabase: Awaited<ReturnType<typeof createClient>>
}

export type AffiliateGrant = { state: 'signed-out' } | { state: 'not-found' } | ResolvedAffiliateGrant

/**
 * Validates an affiliate-portal grant. The grant id is the affiliate record id
 * and is only honoured for its own user — RLS also lets an affiliate read the
 * rows of sub-affiliates they recruited, so ownership is checked explicitly.
 * A suspended programme membership resolves to `revoked`.
 */
export const loadAffiliateGrant = cache(async (grantId: string): Promise<AffiliateGrant> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { state: 'signed-out' }
  if (!UUID.test(grantId)) return { state: 'not-found' }

  const { data } = await supabase
    .from('affiliates')
    .select('id, user_id, code, status, payout_email, created_at')
    .eq('id', grantId)
    .maybeSingle()
  if (!data || data.user_id !== user.id) return { state: 'not-found' }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

  return {
    state: data.status === 'active' ? 'active' : 'revoked',
    affiliate: { id: data.id, code: data.code, status: data.status, payout_email: data.payout_email, created_at: data.created_at },
    userId: user.id,
    email: user.email ?? null,
    fullName: (profile?.full_name as string | null) ?? null,
    supabase,
  }
})

/** Active grant or 404 — used by every affiliate portal page. */
export async function requireActiveGrant(grantId: string): Promise<ResolvedAffiliateGrant> {
  const grant = await loadAffiliateGrant(grantId)
  if (grant.state !== 'active') notFound()
  return grant
}

export function maskEmail(email: string | null): string {
  if (!email) return 'Referral'
  const [local, domain] = email.split('@')
  if (!domain) return 'Referral'
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`
}
