'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { completeOnboarding, saveOnboardingStep } from '@/app/onboarding/actions'
import {
  FLOWS, completionPercent, validateStep,
  type AccountType, type FieldErrors, type OnboardingData, type UploadRef,
} from '@/lib/onboarding/schema'

export interface FlowProps {
  type: AccountType
  userId: string
  initialData: OnboardingData
  maxStep: number
  resumeStep: number
}

export function useOnboardingFlow({ type, userId, initialData, maxStep: initialMax, resumeStep }: FlowProps) {
  const router = useRouter()
  const params = useSearchParams()
  const flow = FLOWS[type]
  const [data, setData] = useState<OnboardingData>(initialData)
  const [maxStep, setMaxStep] = useState(initialMax)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})

  const requested = Number(params.get('step')) || resumeStep
  const step = Math.min(Math.max(1, requested), maxStep)

  // Direct ?step= beyond what's been completed snaps back (no skipping).
  useEffect(() => {
    if (requested !== step) router.replace(`?step=${step}`, { scroll: false })
  }, [requested, step, router])

  // Move focus to the step heading after navigation (keyboard/screen readers).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    document.getElementById('onboarding-step-title')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [step])

  // Signed preview URLs for uploads restored from the saved draft.
  useEffect(() => {
    const paths = ['avatar', 'logo', 'brand_assets', 'portfolio']
      .flatMap(k => (Array.isArray(initialData[k]) ? (initialData[k] as UploadRef[]).map(u => u.path) : []))
    if (paths.length === 0) return
    createClient().storage.from('onboarding-uploads').createSignedUrls(paths, 3600).then(({ data: signed }) => {
      if (!signed) return
      const entries = signed.flatMap(s => (s.signedUrl && s.path ? [[s.path, s.signedUrl] as [string, string]] : []))
      setPreviews(p => ({ ...p, ...Object.fromEntries(entries) }))
    })
  }, [initialData])

  const set = useCallback((key: string, value: unknown) => {
    setData(d => ({ ...d, [key]: value }))
    setErrors(e => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }, [])

  const stepValues = useCallback((s: number) => Object.fromEntries(flow.steps[s - 1].fields.map(f => [f, data[f]])), [data, flow])

  const focusFirstError = (errs: FieldErrors) => {
    const key = Object.keys(errs)[0]?.split('.')[0]
    if (!key) return
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${key}"] input:not([type=hidden]), [data-field="${key}"] select, [data-field="${key}"] textarea, [data-field="${key}"] button`)
      el?.focus()
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  const goTo = useCallback((n: number) => {
    if (n < 1 || n > maxStep || n === step) return
    void saveOnboardingStep(type, step, stepValues(step), false)
    setErrors({})
    setFormError(null)
    router.push(`?step=${n}`, { scroll: false })
  }, [maxStep, step, type, stepValues, router])

  const back = useCallback(() => goTo(step - 1), [goTo, step])

  const next = useCallback(async () => {
    if (busy) return
    const local = validateStep(type, step, data)
    setErrors(local)
    setFormError(null)
    if (Object.keys(local).length) { focusFirstError(local); return }
    setBusy(true)

    if (step === 4) {
      const res = await completeOnboarding(type, stepValues(4))
      if (res.ok) { window.location.assign(res.destination); return }
      setBusy(false)
      setFormError(res.message)
      if (res.errors) setErrors(res.errors)
      if (res.step && res.step !== 4) router.push(`?step=${res.step}`, { scroll: false })
      return
    }

    const res = await saveOnboardingStep(type, step, stepValues(step), true)
    setBusy(false)
    if (!res.ok) {
      setFormError(res.message)
      if (res.errors) { setErrors(res.errors); focusFirstError(res.errors) }
      return
    }
    setMaxStep(m => Math.max(m, res.currentStep))
    router.push(`?step=${step + 1}`, { scroll: false })
  }, [busy, type, step, data, stepValues, router])

  const percent = useMemo(() => completionPercent(type, data), [type, data])
  const str = useCallback((k: string) => (typeof data[k] === 'string' ? (data[k] as string) : ''), [data])
  const arr = useCallback((k: string) => (Array.isArray(data[k]) ? (data[k] as string[]) : []), [data])

  return { type, flow, step, maxStep, data, set, str, arr, errors, formError, busy, next, back, goTo, percent, userId, previews, setPreviews }
}

export type FlowApi = ReturnType<typeof useOnboardingFlow>
