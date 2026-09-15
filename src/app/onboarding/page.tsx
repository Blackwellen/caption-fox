import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getOnboardingState, resolvePostAuthDestination } from '@/lib/auth/post-auth'
import { isAccountType } from '@/lib/onboarding/schema'
import { AuthHeader, Atmosphere } from '@/components/auth/AuthShell'
import { OnboardingChooser } from '@/components/onboarding/OnboardingChooser'

export const metadata: Metadata = { title: 'Set up Caption Fox' }

// Resolver: sends users to their account type's flow. Only shows the chooser
// when no type is known yet (OAuth sign-ups, legacy accounts) or ?change=1.
export default async function OnboardingIndex({ searchParams }: { searchParams: Promise<{ change?: string; new?: string }> }) {
  const { change, new: isNew } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/onboarding')

  // ?new=1 = "Create workspace" from the switcher: always show the chooser.
  const state = await getOnboardingState(supabase, user)
  if (isNew !== '1') {
    if (state.complete) redirect(await resolvePostAuthDestination(supabase, user, {}))
    if (state.accountType && change !== '1') redirect(`/onboarding/${state.accountType}`)
  }

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader />
      <main id="main" className="relative flex justify-center px-4 py-10 sm:py-16">
        <Atmosphere />
        <section className="cf-pop relative w-full max-w-[640px] rounded-[28px] border border-cf-line-strong/80 bg-white px-5 py-9 shadow-cf-float sm:px-10">
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.22em] text-cf-blue">Get started</p>
          <h1 className="mt-2 text-center text-[32px] font-bold tracking-[-0.03em] text-cf-ink sm:text-[40px]">Choose your workspace</h1>
          <p className="mx-auto mt-2 max-w-[420px] text-center text-[16px] text-cf-muted">Pick the option that fits how you work. We’ll tailor your setup to it.</p>
          <OnboardingChooser current={isNew !== '1' && isAccountType(state.accountType) ? state.accountType : null} />
        </section>
      </main>
    </div>
  )
}
