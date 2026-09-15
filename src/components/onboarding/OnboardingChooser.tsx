'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccountTypePicker } from '@/components/auth/RegisterForm'
import { FormAlert, PrimaryButton } from '@/components/auth/fields'
import { startOnboarding } from '@/app/onboarding/actions'
import type { AccountType } from '@/lib/onboarding/schema'

export function OnboardingChooser({ current }: { current: AccountType | null }) {
  const router = useRouter()
  const [type, setType] = useState<AccountType | ''>(current ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function go() {
    if (!type) { setError('Choose the option that fits you best.'); return }
    setBusy(true)
    const res = await startOnboarding(type)
    if (!res.ok) { setBusy(false); setError(res.message ?? 'Something went wrong.'); return }
    router.push(`/onboarding/${type}`)
  }

  return (
    <div className="mt-7 space-y-5">
      {current && <FormAlert tone="warning">Switching account type restarts setup — details you entered for the current type won’t carry over.</FormAlert>}
      <AccountTypePicker value={type} onChange={t => { setType(t); setError(null) }} error={error} />
      <PrimaryButton type="button" size="md" onClick={go} loading={busy} loadingText="Starting…">Continue</PrimaryButton>
    </div>
  )
}
