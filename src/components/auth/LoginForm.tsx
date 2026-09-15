'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, validateEmail, type MappedAuthError } from '@/lib/auth/errors'
import { safeInviteToken, safeNext } from '@/lib/auth/redirect'
import { checkAffiliateAccess } from '@/app/affiliates/actions'
import { Checkbox, FormAlert, PasswordField, PrimaryButton, TextField } from './fields'
import { GoogleSection } from './GoogleButton'

const NOTICES: Record<string, { tone: 'info' | 'warning'; text: string }> = {
  link_expired: { tone: 'warning', text: 'That link has expired. Sign in, or request a new verification email.' },
  auth_callback_failed: { tone: 'warning', text: 'We couldn’t complete sign-in from that link. Please try again.' },
  session_ended: { tone: 'info', text: 'You were signed out because “Remember me” was off.' },
}

function setRememberCookies(remember: boolean) {
  const secure = window.location.protocol === 'https:' ? '; secure' : ''
  if (remember) {
    document.cookie = `cf_remember=; path=/; max-age=0; samesite=lax${secure}`
    document.cookie = `cf_alive=; path=/; max-age=0; samesite=lax${secure}`
  } else {
    document.cookie = `cf_remember=0; path=/; max-age=31536000; samesite=lax${secure}`
    document.cookie = `cf_alive=1; path=/; samesite=lax${secure}`
  }
}

export function LoginForm({ variant = 'standard' }: { variant?: 'standard' | 'affiliate' }) {
  const params = useSearchParams()
  const next = safeNext(params.get('next'), null)
  const invite = safeInviteToken(params.get('invite'))
  const notice = NOTICES[params.get('error') ?? params.get('reason') ?? '']

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({})
  const [formError, setFormError] = useState<MappedAuthError | null>(null)
  const [loading, setLoading] = useState(false)
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const continueQs = new URLSearchParams()
  if (next) continueQs.set('next', next)
  if (invite) continueQs.set('invite', invite)
  const continuePath = `/continue${continueQs.size ? `?${continueQs}` : ''}`

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    const emailError = validateEmail(email)
    const passwordError = password ? null : 'Enter your password.'
    setErrors({ email: emailError, password: passwordError })
    if (emailError) return emailRef.current?.focus()
    if (passwordError) return passwordRef.current?.focus()

    setLoading(true)
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setFormError(mapAuthError(error))
      setLoading(false)
      return
    }
    setRememberCookies(remember)

    if (variant === 'affiliate') {
      const access = await checkAffiliateAccess()
      if (['active', 'pending', 'needs_info', 'draft', 'approved'].includes(access.status)) {
        window.location.assign('/affiliates/portal')
        return
      }
      // Local scope: don't revoke the user's other sessions on a denied portal sign-in.
      await supabase.auth.signOut({ scope: 'local' })
      setFormError({
        kind: 'unknown',
        message: access.status === 'suspended'
          ? 'This affiliate account is suspended. Contact support for help.'
          : access.status === 'rejected'
            ? 'Your affiliate application wasn’t approved this time.'
            : 'This account isn’t part of the affiliate program yet. Apply below.',
      })
      setLoading(false)
      return
    }
    window.location.assign(continuePath)
  }

  async function resendVerification() {
    setResend('sending')
    const supabase = createClient()
    await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/callback?next=/continue` },
    })
    setResend('sent')
  }

  const isAffiliate = variant === 'affiliate'

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5 sm:mt-9">
        {notice && !formError && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          icon={<Mail size={21} strokeWidth={1.8} />}
          value={email}
          onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(x => ({ ...x, email: null })) }}
          error={errors.email}
        />
        <PasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          icon={<Lock size={21} strokeWidth={1.8} />}
          value={password}
          onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(x => ({ ...x, password: null })) }}
          error={errors.password}
        />
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <Link href="/forgot-password" className="rounded text-[15px] font-medium text-cf-blue hover:underline sm:text-[16px]">Forgot password?</Link>
        </div>

        {formError && (
          <FormAlert
            action={formError.kind === 'email_not_confirmed' ? (
              resend === 'sent'
                ? <span className="font-medium">Verification email sent — check your inbox.</span>
                : <button type="button" onClick={resendVerification} disabled={resend === 'sending'} className="font-semibold text-cf-blue underline-offset-2 hover:underline">
                    {resend === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
            ) : undefined}
          >
            {formError.message}
          </FormAlert>
        )}

        <PrimaryButton type="submit" loading={loading} loadingText="Signing in…">Sign in</PrimaryButton>
      </form>

      {!isAffiliate && <GoogleSection continuePath={continuePath} onError={m => setFormError({ kind: 'unknown', message: m })} />}

      <div className="mt-8 border-t border-cf-line pt-7 text-center text-[16px] text-cf-body sm:text-[17px] lg:mt-auto">
        {isAffiliate ? 'New to the program?' : 'Don’t have an account?'}
        <Link
          href={isAffiliate ? '/affiliates/signup' : `/signup${invite ? `?invite=${invite}` : ''}`}
          className="ml-2.5 rounded font-semibold text-cf-blue hover:underline"
        >
          {isAffiliate ? 'Apply as an affiliate' : 'Create one'}
        </Link>
      </div>
      <p className="mt-7 flex items-center justify-center gap-2.5 text-[14px] text-cf-muted">
        <Lock size={16} aria-hidden className="text-cf-body" /> Secured with encrypted connections.
      </p>
    </>
  )
}
