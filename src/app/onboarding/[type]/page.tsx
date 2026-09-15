import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { getOnboardingState, resolvePostAuthDestination } from '@/lib/auth/post-auth'
import { ACCOUNT_TYPE_META, firstIncompleteStep, isAccountType, sanitizeAll } from '@/lib/onboarding/schema'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

// Handwritten accent used by the supplier flow (same face as the homepage).
const caveat = Caveat({ subsets: ['latin'], weight: '500', variable: '--font-caveat', display: 'swap', preload: false })

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params
  return { title: isAccountType(type) ? `${ACCOUNT_TYPE_META[type].label} onboarding — Caption Fox` : 'Onboarding — Caption Fox' }
}

export default async function OnboardingTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!isAccountType(type)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/onboarding/${type}`)

  let { data: draft } = await supabase.from('onboarding_drafts').select('account_type, data, current_step, status').eq('user_id', user.id).maybeSingle()
  // An in-progress draft always renders (first setup, or an additional
  // workspace started from the switcher); otherwise finished users move on.
  if (draft?.status !== 'in_progress') {
    const state = await getOnboardingState(supabase, user)
    if (state.complete) redirect(await resolvePostAuthDestination(supabase, user, {}))
  }
  if (draft && draft.status === 'in_progress' && draft.account_type !== type) redirect(`/onboarding/${draft.account_type}`)
  if (!draft || draft.status !== 'in_progress') {
    const { error } = await supabase.rpc('restart_onboarding', { p_type: type })
    if (error) throw new Error('Could not start onboarding')
    await supabase.from('profiles').update({ account_type: type }).eq('id', user.id)
    draft = { account_type: type, data: {}, current_step: 1, status: 'in_progress' }
  }

  const data = sanitizeAll(type, draft.data, user.id)
  // Sensible, user-owned defaults (never demo values).
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? ''
  if (type === 'creator' && !data.display_name && fullName) data.display_name = fullName
  if (type === 'brand' && (!Array.isArray(data.brand_colors) || data.brand_colors.length === 0)) data.brand_colors = ['#1769FF', '#0A1630']
  if (type === 'supplier' && data.available_now === false && !draft.data?.['available_now']) data.available_now = true

  return (
    <div className={caveat.variable}>
      <OnboardingFlow
        type={type}
        userId={user.id}
        initialData={data}
        maxStep={firstIncompleteStep(type, data)}
        resumeStep={Math.min(draft.current_step ?? 1, firstIncompleteStep(type, data))}
      />
    </div>
  )
}
