'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Hourglass, Link2, Lock, Mail, MailCheck, MapPin, MonitorPlay, Pencil, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AFFILIATE_CATEGORIES, AFFILIATE_COUNTRIES, AFFILIATE_PLATFORMS, AFFILIATE_PRIMARY_CHANNELS, AUDIENCE_SIZES, EMPTY_APPLICATION, PROMOTION_METHODS,
  sanitizeApplication, validateApplicationStep, type AffiliateApplicationInput, type ApplicationErrors,
} from '@/lib/affiliate-application'
import { loadAffiliateApplication, saveAffiliateDraft, submitAffiliateApplication, type AffiliateStatus } from '@/app/affiliates/actions'
import { Checkbox, FormAlert, PasswordField, PrimaryButton, SecondaryButton, SelectField, TextField } from './fields'

const STORAGE_KEY = 'cf_affiliate_application'
const STEPS = ['Account', 'Audience', 'Review'] as const
const toOptions = (list: string[]) => list.map(v => ({ value: v, label: v }))

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mx-auto mt-6 flex w-full max-w-[400px] items-start justify-between" aria-label="Application progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < step ? 'done' : n === step ? 'current' : 'todo'
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className="relative flex flex-1 flex-col items-center">
            {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-[18px] h-px w-[calc(100%-44px)] -translate-x-[22px]', n <= step ? 'bg-cf-blue' : 'bg-cf-line-strong')} />}
            <span className={cn('relative flex h-9 w-9 items-center justify-center rounded-full border text-[15px] font-semibold', state === 'todo' ? 'border-cf-line-strong bg-white text-cf-body' : 'border-cf-blue bg-cf-blue text-white shadow-cf-button')}>
              {state === 'done' ? <Check size={16} strokeWidth={3} aria-hidden /> : n}
            </span>
            <span className={cn('mt-1.5 text-[14px]', state === 'current' ? 'font-semibold text-cf-ink' : 'text-cf-body')}>{label}<span className="sr-only">{state === 'done' ? ' (complete)' : ''}</span></span>
          </li>
        )
      })}
    </ol>
  )
}

function ChipGroup({ legend, options, value, onChange, error }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[14px] font-semibold text-cf-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = value.includes(o)
          return (
            <label key={o} className={cn('inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[14px] transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20', on ? 'border-cf-blue bg-cf-tint font-medium text-cf-blue' : 'border-cf-line-strong text-cf-body hover:border-cf-blue/40')}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onChange(on ? value.filter(x => x !== o) : [...value, o])} />
              {on && <Check size={14} strokeWidth={3} aria-hidden />}{o}
            </label>
          )
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-[#C62828]">{error}</p>}
    </fieldset>
  )
}

type Phase = 'loading' | 'form' | 'submitted' | 'status'

export function AffiliateApplicationForm() {
  const router = useRouter()
  const params = useSearchParams()
  const step = Math.min(3, Math.max(1, Number(params.get('step')) || 1)) as 1 | 2 | 3

  const [phase, setPhase] = useState<Phase>('loading')
  const [signedIn, setSignedIn] = useState(false)
  const [status, setStatus] = useState<AffiliateStatus>('none')
  const [reviewNote, setReviewNote] = useState<string | null>(null)
  const [values, setValues] = useState<AffiliateApplicationInput>(EMPTY_APPLICATION)
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ email: string; verifyEmail: boolean } | null>(null)
  const [maxStep, setMaxStep] = useState(1)

  useEffect(() => {
    let cancelled = false
    loadAffiliateApplication().then(state => {
      if (cancelled) return
      setSignedIn(state.signedIn)
      setStatus(state.status)
      setReviewNote(state.reviewNote)
      if (state.signedIn && ['pending', 'approved', 'active', 'suspended', 'rejected'].includes(state.status)) {
        setPhase('status')
        return
      }
      let draft: Partial<AffiliateApplicationInput> = state.draft ?? {}
      if (!state.signedIn) {
        try { draft = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') } catch { draft = {} }
      }
      const merged = { ...EMPTY_APPLICATION, ...sanitizeApplication({ ...EMPTY_APPLICATION, ...draft }), password: '', terms: false }
      setValues(merged)
      const needsPassword = !state.signedIn
      const step1ok = Object.keys(validateApplicationStep(1, { ...merged, terms: true, password: needsPassword ? 'placeholder-ok' : '' }, { needsPassword: false })).length === 0
      const step2ok = step1ok && Object.keys(validateApplicationStep(2, merged, { needsPassword: false })).length === 0
      setMaxStep(step2ok ? 3 : step1ok ? 2 : 1)
      setPhase('form')
    })
    return () => { cancelled = true }
  }, [])

  // Keep URL step within what's been completed (no skipping via ?step=3).
  useEffect(() => {
    if (phase === 'form' && step > maxStep) router.replace(`/affiliates/signup${maxStep > 1 ? `?step=${maxStep}` : ''}`, { scroll: false })
  }, [phase, step, maxStep, router])

  const set = <K extends keyof AffiliateApplicationInput>(key: K, v: AffiliateApplicationInput[K]) => {
    setValues(prev => ({ ...prev, [key]: v }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const persistLocal = (v: AffiliateApplicationInput) => {
    if (signedIn) return
    const { password: _pw, terms: _t, ...safe } = v
    void _pw; void _t
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safe)) } catch { /* storage unavailable */ }
  }

  const goTo = (n: number) => router.push(n > 1 ? `/affiliates/signup?step=${n}` : '/affiliates/signup', { scroll: false })

  async function next() {
    if (busy) return
    const s = step as 1 | 2
    const errs = validateApplicationStep(s, values, { needsPassword: !signedIn })
    setErrors(errs)
    setFormError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    if (signedIn) {
      const res = await saveAffiliateDraft(values, s)
      if (!res.ok) { setBusy(false); setErrors(res.errors ?? {}); setFormError(res.message ?? null); return }
    } else {
      persistLocal(values)
    }
    setBusy(false)
    setMaxStep(m => Math.max(m, s + 1))
    goTo(s + 1)
  }

  async function submit() {
    if (busy) return
    setBusy(true)
    setFormError(null)
    const res = await submitAffiliateApplication(values)
    setBusy(false)
    if (!res.ok) {
      setFormError(res.message)
      if (res.errors) setErrors(res.errors)
      if (res.step) goTo(res.step)
      return
    }
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setResult({ email: res.email, verifyEmail: res.verifyEmail })
    setPhase('submitted')
  }

  const summary = useMemo(() => [
    { label: 'Full name', value: values.full_name, step: 1 },
    { label: 'Email', value: values.email, step: 1 },
    { label: 'Website or audience link', value: values.website_url, step: 1 },
    { label: 'Primary channel', value: values.primary_channel, step: 1 },
    { label: 'Country / region', value: values.country, step: 1 },
    { label: 'Audience size', value: values.audience_size, step: 2 },
    { label: 'Platforms', value: values.platforms.join(', '), step: 2 },
    { label: 'Topics', value: values.content_categories.join(', '), step: 2 },
    { label: 'Promotion method', value: values.promotion_method, step: 2 },
  ], [values])

  if (phase === 'loading') {
    return <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading application">{[0, 1, 2, 3].map(i => <div key={i} className="h-[70px] animate-pulse rounded-xl bg-cf-surface" />)}</div>
  }

  if (phase === 'submitted' || phase === 'status') {
    const pending = phase === 'submitted' || status === 'pending'
    const copy = pending
      ? { title: 'Application submitted', body: result?.verifyEmail ? `We’ve sent a verification link to ${result.email}. Verify your email, and our partnerships team will review your application — you’ll hear from us once it’s decided.` : 'Our partnerships team reviews every application by hand. You’ll be able to access the affiliate portal once you’re approved.' }
      : status === 'active' || status === 'approved'
        ? { title: 'You’re already an affiliate', body: 'Your application has been approved. Head to the affiliate portal to get your referral link.' }
        : status === 'suspended'
          ? { title: 'Affiliate account suspended', body: 'Your affiliate account is currently suspended. Contact support if you think this is a mistake.' }
          : { title: 'Application not approved', body: 'Your previous application wasn’t approved. Contact support if your circumstances have changed.' }
    return (
      <div className="mt-8 text-center" role="status" aria-live="polite">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue">
          {pending ? (result?.verifyEmail ? <MailCheck size={30} aria-hidden /> : <Hourglass size={30} aria-hidden />) : <Check size={30} aria-hidden />}
        </span>
        <h2 className="mt-5 text-[24px] font-bold tracking-tight text-cf-ink">{copy.title}</h2>
        <p className="mx-auto mt-2 max-w-[400px] text-[16px] leading-snug text-cf-muted">{copy.body}</p>
        {pending && <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FFF4E0] px-3 py-1 text-[13px] font-medium text-[#B45309]"><Hourglass size={13} aria-hidden /> Pending review</p>}
        <div className="mt-7">
          {status === 'active' || status === 'approved'
            ? <Link href="/affiliates/portal" className="inline-flex h-12 items-center rounded-[10px] bg-cf-blue px-6 font-medium text-white">Go to affiliate portal</Link>
            : <Link href="/" className="text-[15px] font-medium text-cf-blue hover:underline">Back to home</Link>}
        </div>
      </div>
    )
  }

  return (
    <>
      <Stepper step={step} />
      <div className="mt-5 space-y-3">
        {reviewNote && <FormAlert tone="warning">Our team asked for more information: {reviewNote}</FormAlert>}
        {step === 1 && (
          <>
            <TextField size="sm" label="Full name" autoComplete="name" placeholder="Enter your full name" icon={<User size={19} strokeWidth={1.8} />} value={values.full_name} onChange={e => set('full_name', e.target.value)} error={errors.full_name} />
            {signedIn ? (
              <TextField size="sm" label="Work email" type="email" value={values.email} readOnly disabled icon={<Mail size={19} strokeWidth={1.8} />} hint="Applying with your signed-in Caption Fox account." />
            ) : (
              <TextField size="sm" label="Work email" type="email" autoComplete="email" inputMode="email" placeholder="you@company.com" icon={<Mail size={19} strokeWidth={1.8} />} value={values.email} onChange={e => set('email', e.target.value)} error={errors.email} />
            )}
            <TextField size="sm" label="Website or audience link" type="url" autoComplete="url" inputMode="url" placeholder="https://yourlink.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={values.website_url} onChange={e => set('website_url', e.target.value)} error={errors.website_url} />
            <SelectField size="sm" label="Primary channel" placeholder="Select your primary channel" icon={<MonitorPlay size={19} strokeWidth={1.8} />} options={toOptions(AFFILIATE_PRIMARY_CHANNELS)} value={values.primary_channel} onChange={e => set('primary_channel', e.target.value)} error={errors.primary_channel} />
            <SelectField size="sm" label="Country / region" placeholder="Select your country or region" autoComplete="country-name" icon={<MapPin size={19} strokeWidth={1.8} />} options={toOptions(AFFILIATE_COUNTRIES)} value={values.country} onChange={e => set('country', e.target.value)} error={errors.country} />
            {!signedIn && (
              <PasswordField size="sm" label="Create a password" autoComplete="new-password" placeholder="8+ characters for your partner account" icon={<Lock size={19} strokeWidth={1.8} />} value={values.password} onChange={e => set('password', e.target.value)} error={errors.password} />
            )}
            <div>
              <Checkbox
                checked={values.terms}
                onChange={e => set('terms', e.target.checked)}
                aria-invalid={!!errors.terms || undefined}
                label={<>I agree to the <Link href="/legal/affiliate-terms" target="_blank" className="text-cf-blue hover:underline">Affiliate Program Terms</Link> and acknowledge that I have read the <Link href="/legal/privacy" target="_blank" className="text-cf-blue hover:underline">Privacy Policy</Link>.</>}
              />
              {errors.terms && <p className="mt-1.5 text-[13px] font-medium text-[#C62828]">{errors.terms}</p>}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <SelectField size="sm" label="Audience size" placeholder="Select your total audience size" options={toOptions(AUDIENCE_SIZES)} value={values.audience_size} onChange={e => set('audience_size', e.target.value)} error={errors.audience_size} />
            <ChipGroup legend="Platforms you promote on" options={AFFILIATE_PLATFORMS} value={values.platforms} onChange={v => set('platforms', v)} error={errors.platforms} />
            <ChipGroup legend="Topics your audience cares about" options={AFFILIATE_CATEGORIES} value={values.content_categories} onChange={v => set('content_categories', v)} error={errors.content_categories} />
            <SelectField size="sm" label="How will you promote Caption Fox?" placeholder="Select your main promotion method" options={toOptions(PROMOTION_METHODS)} value={values.promotion_method} onChange={e => set('promotion_method', e.target.value)} error={errors.promotion_method} />
            <TextField size="sm" label="Other links (optional)" placeholder="Comma-separated, up to 3" value={values.audience_links.join(', ')} onChange={e => set('audience_links', e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3))} error={errors.audience_links} />
            <div>
              <label htmlFor="aff-message" className="mb-1.5 block text-[14px] font-semibold text-cf-ink">Anything else we should know? (optional)</label>
              <textarea id="aff-message" rows={3} maxLength={500} value={values.message} onChange={e => set('message', e.target.value)} className="w-full resize-none rounded-[10px] border border-cf-line-strong px-4 py-3 text-[15px] text-cf-ink placeholder:text-[#8593A8] focus:border-cf-blue focus:outline-none focus:ring-4 focus:ring-cf-blue/12" placeholder="Tell us about your audience or partnership ideas." />
            </div>
          </>
        )}
        {step === 3 && (
          <div className="rounded-2xl border border-cf-line bg-cf-surface/60 p-4">
            <p className="text-[15px] font-semibold text-cf-ink">Review your application</p>
            <dl className="mt-3 divide-y divide-cf-line">
              {summary.map(row => (
                <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0"><dt className="text-[12px] text-cf-muted">{row.label}</dt><dd className="break-words text-[14px] font-medium text-cf-ink">{row.value || '—'}</dd></div>
                  <button type="button" onClick={() => goTo(row.step)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-cf-blue hover:bg-cf-tint" aria-label={`Edit ${row.label}`}><Pencil size={13} aria-hidden /> Edit</button>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[13px] leading-snug text-cf-muted">Submitting sends your application to our partnerships team. Affiliate access is granted only after approval.</p>
          </div>
        )}
        {formError && <FormAlert>{formError}</FormAlert>}
        <div className={cn('flex gap-3 pt-1', step > 1 ? 'justify-between' : '')}>
          {step > 1 && <SecondaryButton type="button" onClick={() => goTo(step - 1)} className="sm:!h-[56px]">Back</SecondaryButton>}
          <PrimaryButton type="button" size="md" onClick={step === 3 ? submit : next} loading={busy} loadingText={step === 3 ? 'Submitting…' : 'Saving…'} className={cn(step > 1 && 'flex-1', 'sm:!h-[56px]')}>
            {step === 3 ? 'Submit application' : 'Continue'}
          </PrimaryButton>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4 text-[16px] text-cf-body">
        <span className="h-px flex-1 bg-cf-line-strong" />
        <span>Already an affiliate?<Link href="/affiliates/login" className="ml-2 font-semibold text-cf-blue hover:underline">Sign in</Link></span>
        <span className="h-px flex-1 bg-cf-line-strong" />
      </div>
    </>
  )
}
