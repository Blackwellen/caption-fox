'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, ShieldCheck, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader, Atmosphere } from '@/components/auth/AuthShell'
import { FormAlert, PrimaryButton, TextField } from '@/components/auth/fields'

// Real authenticator-app (TOTP) enrolment for the signed-in user, reached from
// Settings › Security. Platform admins are also required to enrol at
// /admin-login before the admin console will open.
export default function MFAPage() {
  const [phase, setPhase] = useState<'loading' | 'enrol' | 'enabled' | 'signed-out'>('loading')
  const [enrollment, setEnrollment] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPhase('signed-out'); return }
      const { data } = await supabase.auth.mfa.listFactors()
      if (data?.totp?.some(f => f.status === 'verified')) { setPhase('enabled'); return }
      for (const f of data?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` })
      if (enrollError || !enrolled) { setError('We couldn’t start two-factor setup. Refresh and try again.'); setPhase('enrol'); return }
      setEnrollment({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret })
      setPhase('enrol')
    })()
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrollment || busy) return
    const otp = code.replace(/\s/g, '')
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: otp })
    if (verifyError) { setBusy(false); setCode(''); setError('That code is incorrect or has expired.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ mfa_enabled: true }).eq('id', user.id)
    setBusy(false)
    setPhase('enabled')
  }

  return (
    <div className="min-h-screen bg-white">
      <AuthHeader />
      <main id="main" className="relative flex justify-center px-4 py-12 sm:py-16">
        <Atmosphere />
        <section className="cf-pop relative w-full max-w-[520px] rounded-[28px] border border-cf-line-strong/80 bg-white px-6 py-10 shadow-cf-float sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue"><ShieldCheck size={28} aria-hidden /></span>
          <h1 className="mt-5 text-center text-[28px] font-bold tracking-tight text-cf-ink">Two-factor authentication</h1>

          {phase === 'loading' && <div className="mt-8 h-40 animate-pulse rounded-2xl bg-cf-surface" aria-busy="true" aria-label="Loading" />}

          {phase === 'signed-out' && (
            <div className="mt-6 text-center">
              <p className="text-[16px] text-cf-muted">Sign in to set up two-factor authentication.</p>
              <Link href="/login?next=/mfa" className="mt-6 inline-flex h-12 items-center rounded-[10px] bg-cf-blue px-6 font-medium text-white">Sign in</Link>
            </div>
          )}

          {phase === 'enabled' && (
            <div className="mt-6 text-center" role="status">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#E7F8EF] px-3 py-1 text-[14px] font-medium text-[#15803D]"><CircleCheck size={16} aria-hidden /> Authenticator app is on</p>
              <p className="mt-4 text-[16px] text-cf-muted">You’ll be asked for a code from your authenticator app where Caption Fox requires extra verification.</p>
              <Link href="/app/settings" className="mt-6 inline-flex h-12 items-center rounded-[10px] bg-cf-blue px-6 font-medium text-white">Back to settings</Link>
            </div>
          )}

          {phase === 'enrol' && (
            <form onSubmit={verify} noValidate className="mt-6 space-y-5">
              <p className="flex items-start gap-2 text-center text-[15px] leading-snug text-cf-muted"><Smartphone size={18} aria-hidden className="mt-0.5 shrink-0 text-cf-blue" /> Scan this QR code with Google Authenticator, 1Password, Authy or a similar app, then enter the 6-digit code it shows.</p>
              {enrollment && (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qr} alt="QR code for your authenticator app" width={168} height={168} className="rounded-xl border border-cf-line bg-white p-2" />
                  <p className="text-[13px] text-cf-muted">Or enter this key manually:</p>
                  <code className="break-all rounded-md bg-cf-surface px-3 py-1.5 font-mono text-[13px] text-cf-ink">{enrollment.secret}</code>
                </div>
              )}
              <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123 456" value={code} onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))} />
              {error && <FormAlert>{error}</FormAlert>}
              <PrimaryButton type="submit" size="md" loading={busy} loadingText="Verifying…" disabled={!enrollment}>Turn on two-factor</PrimaryButton>
              <p className="text-center"><Link href="/app/settings" className="text-[15px] font-medium text-cf-body hover:text-cf-ink">Cancel</Link></p>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
