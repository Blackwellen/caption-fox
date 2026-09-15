import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isAccountType, type AccountType } from '@/lib/onboarding/schema'
import { safeInviteToken, safeNext } from './redirect'

export interface OnboardingState {
  complete: boolean
  accountType: AccountType | null
  hasWorkspace: boolean
  hasSupplier: boolean
}

// Completion is derived from real records (a workspace membership or a
// supplier profile), not only from profiles.onboarding_completed — that flag is
// user-writable, and trusting it alone could strand a user with no workspace.
export async function getOnboardingState(supabase: SupabaseClient, user: User, typeHint?: string | null): Promise<OnboardingState> {
  const [draftRes, memberRes, supplierRes, profileRes] = await Promise.all([
    supabase.from('onboarding_drafts').select('account_type, status').eq('user_id', user.id).maybeSingle(),
    supabase.from('workspace_members').select('workspace_id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('marketplace_suppliers').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
  ])
  const hasWorkspace = (memberRes.count ?? 0) > 0
  const hasSupplier = !!supplierRes.data
  const candidates: unknown[] = [draftRes.data?.account_type, typeHint, profileRes.data?.account_type, user.user_metadata?.account_type]
  const accountType = (candidates.find(isAccountType) as AccountType | undefined) ?? null
  return {
    complete: hasWorkspace || hasSupplier || draftRes.data?.status === 'completed',
    accountType,
    hasWorkspace,
    hasSupplier,
  }
}

export async function resolvePostAuthDestination(
  supabase: SupabaseClient,
  user: User,
  params: { next?: string | null; invite?: string | null; type?: string | null },
): Promise<string> {
  const invite = safeInviteToken(params.invite)
  if (invite) return `/invite/${invite}`

  const state = await getOnboardingState(supabase, user, params.type)
  if (!state.complete) return state.accountType ? `/onboarding/${state.accountType}` : '/onboarding'

  const next = safeNext(params.next ?? null, null)
  if (next) return next
  if (!state.hasWorkspace && state.hasSupplier) return '/supplier'
  return '/app/home'
}
