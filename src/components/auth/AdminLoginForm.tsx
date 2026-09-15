'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { KeyRound, Lock, Mail, Shield, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, validateEmail } from '@/lib/auth/errors'
import { safeNext } from '@/lib/auth/redirect'
import { recordAdminLogin, recordAdminMfaFailure, verifyAdminEntitlement } from '@/app/admin-login/actions'
import { FormAlert, PasswordField, PrimaryButton, TextField } from './fields'

type Enrollment = { factorId: string; qr: string; secret: string }

const DENIED = 'This account does not have access to the admin console.'

export function AdminLoginForm() {
  const params = useSearchParams()
  const nextParam = safeNext(params.get('next'), '/admin')
  const next = nextParam.startsWith('/admin') ? nextParam : '/admin'
  const reason = params.get('reason')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null; code?: string | null }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  async function finish(supabase: ReturnType<typeof createClient>, factorId: string, otp: string, enrolled: boolean) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: otp })
    if (error) {
      await recordAdminMfaFailure()
      setErrors({ code: 'That code is incorrect or has expired.' })
      setCode('')
      setLoading(false)
      codeRef.current?.focus()
      return
    }
    const logged = await recordAdminLogin(enrolled)
    if (!logged.ok) {
      await supabase.auth.signOut({ scope: 'local' })
      setFormError(DENIED)
      setLoading(false)
      return
    }
    window.location.assign(next)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    const supabase = createClient()
    const otp = code.replace(/\s/g, '')

    if (enrollment) {
      if (!/^\d{6}$/.test(otp)) { setErrors({ code: 'Enter the 6-digit code from your authenticator app.' }); return }
      setLoading(true)
      await finish(supabase, enrollment.factorId, otp, true)
      return
    }

    const emailError = validateEmail(email)
    const passwordError = password ? null : 'Enter your password.'
    const codeError = otp && !/^\d{6}$/.test(otp) ? 'Codes are 6 digits.' : null
    setErrors({ email: emailError, password: passwordError, code: codeError })
    if (emailError || passwordError || codeError) return

    setLoading(true)
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setFormError(mapAuthError(error).message)
      setLoading(false)
      return
    }

    const entitlement = await verifyAdminEntitlement()
    if (!entitlement.ok) {
      await supabase.auth.signOut({ scope: 'local' })
      setFormError(DENIED)
      setLoading(false)
      return
    }

    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = factors?.totp?.find(f => f.status === 'verified')
    if (verified) {
      if (!otp) {
        setErrors({ code: 'Enter the 6-digit code from your authenticator app.' })
        setLoading(false)
        codeRef.current?.focus()
        return
      }
      await finish(supabase, verified.id, otp, false)
      return
    }

    // No authenticator yet: MFA is mandatory for platform admins — enrol now.
    for (const f of factors?.all ?? []) {
      if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Caption Fox admin ${new Date().toISOString().slice(0, 10)}` })
    if (enrollError || !enrolled) {
      await supabase.auth.signOut({ scope: 'local' })
      setFormError('We couldn’t start two-factor setup. Try again.')
      setLoading(false)
      return
    }
    setEnrollment({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret })
    setCode('')
    setErrors({})
    setLoading(false)
  }

  async function cancelEnrollment() {
    const supabase = createClient()
    if (enrollment) await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId })
    await supabase.auth.signOut({ scope: 'local' })
    setEnrollment(null)
    setPassword('')
    setCode('')
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5 sm:mt-9">
      {reason === 'mfa' && !formError && <FormAlert tone="info">For security, sign in again with your authenticator code.</FormAlert>}

      {enrollment ? (
        <div className="rounded-2xl border border-cf-line bg-cf-surface/70 p-5" aria-live="polite">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-cf-ink"><Smartphone size={18} aria-hidden className="text-cf-blue" /> Set up two-factor authentication</p>
          <p className="mt-1.5 text-[14px] leading-snug text-cf-muted">Admin access requires an authenticator app. Scan this code with Google Authenticator, 1Password, Authy or similar, then enter the 6-digit code.</p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* Supabase returns the QR as an SVG data URI. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="QR code for your authenticator app" width={148} height={148} className="rounded-lg border border-cf-line bg-white p-2" />
            <div className="min-w-0 text-[13px] text-cf-muted">
              <p>Can’t scan? Enter this key manually:</p>
              <code className="mt-1 block break-all rounded-md bg-white px-2 py-1.5 font-mono text-[12.5px] text-cf-ink">{enrollment.secret}</code>
            </div>
          </div>
        </div>
      ) : (
        <>
          <TextField label="Work email" type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" icon={<Mail size={21} strokeWidth={1.8} />} value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
          <PasswordField label="Password" autoComplete="current-password" placeholder="Enter your password" icon={<Lock size={21} strokeWidth={1.8} />} value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />
        </>
      )}

      <TextField
        ref={codeRef}
        label="One-time code (MFA)"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        placeholder="Enter 6-digit code"
        icon={<Shield size={21} strokeWidth={1.8} />}
        value={code}
        onChange={e => setCode(e.target.value.replace(/[^\d ]/g, ''))}
        error={errors.code}
        hint={enrollment ? undefined : 'From your authenticator app. First admin sign-in? Leave blank to set it up.'}
      />

      <div className="flex items-center justify-between gap-4">
        {enrollment
          ? <button type="button" onClick={cancelEnrollment} className="min-h-11 text-[15px] font-medium text-cf-body hover:text-cf-ink">Use a different account</button>
          : <span />}
        <Link href="/forgot-password" className="rounded text-[15px] font-medium text-cf-blue hover:underline sm:text-[16px]">Forgot password?</Link>
      </div>

      {formError && <FormAlert>{formError}</FormAlert>}

      <PrimaryButton type="submit" loading={loading} loadingText={enrollment ? 'Verifying…' : 'Signing in…'}>
        {enrollment ? 'Verify and continue' : 'Sign in'}
      </PrimaryButton>

      <div className="border-t border-cf-line pt-7 text-center">
        <p className="flex items-center justify-center gap-2.5 text-[15px] font-medium text-cf-body sm:text-[16px]"><KeyRound size={17} aria-hidden /> Protected access with role-based controls.</p>
        <p className="mt-1.5 text-[14px] text-cf-muted">Only authorised team members can access the admin console.</p>
      </div>
    </form>
  )
}
