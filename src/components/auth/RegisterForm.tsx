'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Building2, Check, Lock, Mail, MailCheck, Truck, User, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError, validateEmail, validateNewPassword } from '@/lib/auth/errors'
import { safeInviteToken } from '@/lib/auth/redirect'
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, isAccountType, type AccountType } from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import { Checkbox, FormAlert, PasswordField, PrimaryButton, SecondaryButton, TextField } from './fields'
import { GoogleSection } from './GoogleButton'

const TYPE_ICON: Record<AccountType, { icon: React.ElementType; className: string }> = {
  brand: { icon: Building2, className: 'text-cf-blue' },
  agency: { icon: Users, className: 'text-[#4F46E5]' },
  business: { icon: Briefcase, className: 'text-[#16A34A]' },
  creator: { icon: User, className: 'text-[#DB2777]' },
  supplier: { icon: Truck, className: 'text-[#475569]' },
}

// Account-type picker shared by registration and the /onboarding chooser.
export function AccountTypePicker({ value, onChange, error, name = 'account_type' }: { value: AccountType | ''; onChange: (t: AccountType) => void; error?: string | null; name?: string }) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-2 text-[15px] font-semibold text-cf-ink">What best describes you?</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ACCOUNT_TYPES.map(t => {
          const { icon: Icon, className } = TYPE_ICON[t]
          const selected = value === t
          return (
            <label
              key={t}
              className={cn(
                'relative flex min-h-[118px] cursor-pointer flex-col items-center rounded-xl border px-1.5 pb-2.5 pt-4 text-center transition-[border-color,background-color,box-shadow] duration-150',
                'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20',
                selected ? 'border-[1.5px] border-cf-blue bg-cf-tint shadow-cf-card' : 'border-cf-line-strong bg-white hover:border-cf-blue/40',
              )}
            >
              <input type="radio" name={name} value={t} checked={selected} onChange={() => onChange(t)} className="sr-only" />
              {selected && (
                <span aria-hidden className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-cf-blue text-white"><Check size={11} strokeWidth={3} /></span>
              )}
              <Icon size={28} strokeWidth={1.9} aria-hidden className={className} />
              <span className="mt-2 text-[15px] font-semibold text-cf-ink">{ACCOUNT_TYPE_META[t].label}</span>
              <span className="mt-0.5 text-[12px] leading-[1.3] text-cf-muted">{ACCOUNT_TYPE_META[t].descriptor}</span>
            </label>
          )
        })}
      </div>
      {error && <p id={`${name}-error`} className="mt-1.5 text-[13px] font-medium text-[#C62828]">{error}</p>}
    </fieldset>
  )
}

type Errors = Partial<Record<'fullName' | 'email' | 'password' | 'confirm' | 'type' | 'terms', string | null>>

export function RegisterForm() {
  const params = useSearchParams()
  const invite = safeInviteToken(params.get('invite'))
  const presetType = params.get('type')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [type, setType] = useState<AccountType | ''>(isAccountType(presetType) ? presetType : 'brand')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const firstInvalid = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const continueQs = new URLSearchParams()
  if (invite) continueQs.set('invite', invite)
  else if (type) continueQs.set('type', type)
  const continuePath = `/continue?${continueQs}`

  function validate(): Errors {
    return {
      fullName: fullName.trim().length < 2 ? 'Enter your full name.' : fullName.trim().length > 80 ? 'Use 80 characters or fewer.' : null,
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirm: !confirm ? 'Confirm your password.' : confirm !== password ? 'Passwords don’t match.' : null,
      type: invite || type ? null : 'Choose the option that fits you best.',
      terms: terms ? null : 'Please accept the Terms of Service and Privacy Policy.',
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    const next = validate()
    setErrors(next)
    if (Object.values(next).some(Boolean)) {
      requestAnimationFrame(() => firstInvalid.current?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset input')?.focus())
      return
    }
    setLoading(true)
    setFormError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), account_type: type || null },
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(continuePath)}`,
      },
    })
    if (error) {
      setFormError(mapAuthError(error).message)
      setLoading(false)
      return
    }
    // Supabase returns an obfuscated user with no identities for an existing email.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setFormError('This email is already associated with an account. Sign in instead.')
      setLoading(false)
      return
    }
    if (data.session) {
      window.location.assign(continuePath)
      return
    }
    setSentTo(email.trim())
    setCooldown(60)
    setLoading(false)
  }

  async function resend() {
    if (!sentTo || cooldown > 0) return
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: sentTo,
      options: { emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(continuePath)}` },
    })
    if (error) setFormError(mapAuthError(error).message)
    setCooldown(60)
  }

  if (sentTo) {
    return (
      <div className="mt-8 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue"><MailCheck size={30} aria-hidden /></span>
        <h2 className="mt-5 text-[24px] font-bold tracking-tight text-cf-ink">Check your email</h2>
        <p className="mx-auto mt-2 max-w-[380px] text-[16px] leading-snug text-cf-muted">
          We sent a verification link to <strong className="font-semibold text-cf-ink">{sentTo}</strong>. Open it to verify your account and continue setting up your {type ? ACCOUNT_TYPE_META[type as AccountType].label.toLowerCase() : ''} workspace.
        </p>
        {formError && <div className="mt-5 text-left"><FormAlert>{formError}</FormAlert></div>}
        <div className="mt-7 grid gap-3">
          <SecondaryButton type="button" onClick={resend} disabled={cooldown > 0} className="w-full">
            {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
          </SecondaryButton>
          <button type="button" onClick={() => { setSentTo(null); setFormError(null) }} className="min-h-11 text-[15px] font-medium text-cf-blue hover:underline">Use a different email</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="mt-3 space-y-3" aria-describedby={formError ? 'register-error' : undefined}>
        <div ref={firstInvalid} className="space-y-2.5">
          <TextField size="md" label="Full name" name="name" autoComplete="name" placeholder="Enter your full name" icon={<User size={20} strokeWidth={1.8} />} value={fullName} onChange={e => setFullName(e.target.value)} error={errors.fullName} />
          <TextField size="md" label="Work email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@company.com" icon={<Mail size={20} strokeWidth={1.8} />} value={email} onChange={e => setEmail(e.target.value)} error={errors.email} />
          <PasswordField size="md" label="Password" name="new-password" autoComplete="new-password" placeholder="Create a password" icon={<Lock size={20} strokeWidth={1.8} />} value={password} onChange={e => setPassword(e.target.value)} error={errors.password} />
          <PasswordField size="md" label="Confirm password" name="confirm-password" autoComplete="new-password" placeholder="Confirm your password" icon={<Lock size={20} strokeWidth={1.8} />} value={confirm} onChange={e => setConfirm(e.target.value)} error={errors.confirm} />
          {invite ? (
            <FormAlert tone="info">You’re joining a workspace you were invited to — no workspace type needed.</FormAlert>
          ) : (
            <AccountTypePicker value={type} onChange={setType} error={errors.type} />
          )}
          <div>
            <Checkbox
              checked={terms}
              onChange={e => setTerms(e.target.checked)}
              aria-invalid={!!errors.terms || undefined}
              label={<>I agree to the <Link href="/legal/terms" target="_blank" className="text-cf-blue hover:underline">Terms of Service</Link> and <Link href="/legal/privacy" target="_blank" className="text-cf-blue hover:underline">Privacy Policy</Link>.</>}
            />
            {errors.terms && <p className="mt-1.5 text-[13px] font-medium text-[#C62828]">{errors.terms}</p>}
          </div>
        </div>
        {formError && (
          <div id="register-error">
            <FormAlert action={formError.includes('already associated') ? <Link href="/login" className="font-semibold text-cf-blue hover:underline">Sign in</Link> : undefined}>{formError}</FormAlert>
          </div>
        )}
        <PrimaryButton type="submit" size="md" loading={loading} loadingText="Creating account…" className="!mt-4">Continue</PrimaryButton>
      </form>
      <GoogleSection continuePath={continuePath} onError={setFormError} />
      <p className="mt-5 text-center text-[16px] text-cf-body">
        Already have an account?
        <Link href={`/login${invite ? `?invite=${invite}` : ''}`} className="ml-2.5 rounded font-semibold text-cf-blue hover:underline">Sign in</Link>
      </p>
    </>
  )
}
