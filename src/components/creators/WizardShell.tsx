'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WizardStepDef {
  id: string
  label: string
  /** Short description shown under the label in the stepper. */
  description?: string
  /** Renders the step body. Receives nothing — steps own their own field state. */
  render: () => React.ReactNode
  /** Returns an error message if this step is not valid yet, or null if it can proceed. */
  validate?: () => string | null
  /** Marks a step as optional — the stepper shows "Optional" and it never blocks Next. */
  optional?: boolean
}

interface WizardShellProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  steps: WizardStepDef[]
  /** Called on the final step's primary action. Returning false keeps the wizard open. */
  onSubmit: () => Promise<boolean> | boolean
  submitLabel?: string
  submitting?: boolean
  /** Shown once, above the footer, when a submit attempt fails. */
  submitError?: string | null
  /** Confirms before closing if the user has made changes. */
  dirty?: boolean
}

/**
 * The multi-step wizard shell shared by Creators & UGC's create flows.
 *
 * The stepper follows the project-wide responsive tab rule: a vertical side
 * list on desktop, a sliding segmented tray on tablet, and a dropdown
 * selector on mobile — never one layout squeezed into all three. Each step
 * validates independently before Next is enabled, so a user can never reach
 * the review step with invalid data silently carried forward.
 */
export default function WizardShell({
  open, onClose, title, subtitle, steps, onSubmit, submitLabel = 'Create', submitting, submitError, dirty,
}: WizardShellProps) {
  const [index, setIndex] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<number>>(new Set([0]))
  const [mobileStepMenu, setMobileStepMenu] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset wizard state when it closes — adjusted during render rather than in
  // an effect, per React's "adjusting state when a prop changes" guidance.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) { setIndex(0); setStepError(null); setVisited(new Set([0])); setMobileStepMenu(false) }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const step = steps[index]
  const isLast = index === steps.length - 1
  const isFirst = index === 0

  function requestClose() {
    if (dirty && !window.confirm('Discard this? Your changes will not be saved.')) return
    onClose()
  }

  function goNext() {
    const error = step.validate?.() ?? null
    if (error) { setStepError(error); return }
    setStepError(null)
    if (isLast) {
      void handleSubmit()
      return
    }
    setIndex(current => { const next = current + 1; setVisited(v => new Set(v).add(next)); return next })
    panelRef.current?.scrollTo({ top: 0 })
  }

  function goBack() {
    setStepError(null)
    setIndex(current => Math.max(0, current - 1))
    panelRef.current?.scrollTo({ top: 0 })
  }

  function goToStep(target: number) {
    if (target === index) return
    if (target > index) {
      const error = step.validate?.() ?? null
      if (error) { setStepError(error); return }
    }
    setStepError(null)
    setIndex(target)
    setVisited(v => new Set(v).add(target))
    panelRef.current?.scrollTo({ top: 0 })
  }

  async function handleSubmit() {
    const ok = await onSubmit()
    if (!ok) {
      // Submission failed — stay on the review step so the error is visible.
      setIndex(steps.length - 1)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:p-6"
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(720px,92vh)] sm:max-w-4xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button" onClick={requestClose} aria-label="Close"
            className="ml-4 shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile: dropdown step selector (never a squeezed side list) */}
        <div className="relative border-b border-slate-100 px-5 py-3 sm:hidden">
          <button
            type="button" onClick={() => setMobileStepMenu(v => !v)} aria-expanded={mobileStepMenu} aria-haspopup="listbox"
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-blue-600">Step {index + 1} of {steps.length}</span>
              <span className="block truncate text-[13px] font-medium text-slate-900">{step.label}</span>
            </span>
            <ChevronRight size={15} className={cn('shrink-0 text-slate-400 transition-transform', mobileStepMenu && 'rotate-90')} />
          </button>
          <div className="mt-2 flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span key={s.id} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= index ? 'bg-blue-500' : 'bg-slate-100')} />
            ))}
          </div>
          {mobileStepMenu && (
            <>
              <button type="button" className="fixed inset-0 z-20 cursor-default" aria-label="Close" onClick={() => setMobileStepMenu(false)} />
              <div role="listbox" aria-label="Wizard steps" className="absolute left-5 right-5 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {steps.map((s, i) => {
                  const reachable = visited.has(i) || i <= index
                  return (
                    <button
                      key={s.id} type="button" role="option" aria-selected={i === index} disabled={!reachable}
                      onClick={() => { setMobileStepMenu(false); if (reachable) goToStep(i) }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]',
                        i === index ? 'bg-blue-50 font-medium text-blue-700' : reachable ? 'text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed text-slate-300',
                      )}
                    >
                      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', i < index ? 'bg-blue-600 text-white' : i === index ? 'border-2 border-blue-600 text-blue-600' : 'border border-slate-300')}>
                        {i < index ? <Check size={10} /> : i + 1}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Tablet: sliding segmented step tray */}
        <nav aria-label="Wizard steps" className="hidden overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:block lg:hidden">
          <ol className="flex min-w-max snap-x gap-1.5">
            {steps.map((s, i) => {
              const completed = i < index
              const active = i === index
              const reachable = visited.has(i) || i <= index
              return (
                <li key={s.id} className="snap-start">
                  <button
                    type="button" onClick={() => { if (reachable) goToStep(i) }} disabled={!reachable}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                      active ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : reachable ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'cursor-not-allowed border-slate-100 bg-white text-slate-300',
                    )}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', completed ? 'bg-blue-600 text-white' : active ? 'border-2 border-blue-600 text-blue-600' : 'border border-slate-300 text-slate-400')}>
                      {completed ? <Check size={10} /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="flex min-h-0 flex-1">
          {/* Desktop: vertical side stepper */}
          <nav aria-label="Wizard steps" className="hidden w-56 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/60 p-4 lg:block">
            <ol className="space-y-1">
              {steps.map((s, i) => {
                const completed = i < index
                const active = i === index
                const reachable = visited.has(i) || i <= index
                return (
                  <li key={s.id}>
                    <button
                      type="button" onClick={() => { if (reachable) goToStep(i) }} disabled={!reachable}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-white shadow-sm ring-1 ring-slate-200' : reachable ? 'hover:bg-white/70' : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                          completed ? 'bg-blue-600 text-white' : active ? 'border-2 border-blue-600 text-blue-600' : 'border border-slate-300 text-slate-400',
                        )}
                      >
                        {completed ? <Check size={12} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn('block truncate text-[13px] font-medium', active ? 'text-slate-900' : 'text-slate-600')}>{s.label}</span>
                        {s.description && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{s.description}</span>}
                        {s.optional && <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Optional</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Step content */}
          <div ref={panelRef} className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {stepError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{stepError}</p>
            )}
            {isLast && submitError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</p>
            )}
            {step.render()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 sm:px-6">
          <button type="button" onClick={requestClose} className="text-[13px] font-medium text-slate-500 hover:text-slate-700">
            {dirty ? 'Save draft & close' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button" onClick={goBack}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <ChevronLeft size={14} />Back
              </button>
            )}
            <button
              type="button" onClick={goNext} disabled={submitting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {isLast ? submitLabel : 'Next'}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared field chrome for wizard steps ─────────────────────────────────────

export function WizardSection({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {(title || description) && (
        <div>
          {title && <h4 className="text-[13px] font-semibold text-slate-800">{title}</h4>}
          {description && <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}

export function WizardChipToggle({
  options, selected, onToggle, getLabel,
}: { options: readonly string[]; selected: string[]; onToggle: (value: string) => void; getLabel?: (value: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(option => (
        <button
          key={option} type="button" onClick={() => onToggle(option)}
          aria-pressed={selected.includes(option)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            selected.includes(option) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          {getLabel ? getLabel(option) : option}
        </button>
      ))}
    </div>
  )
}

/** Review-step summary row — label/value pairs with an optional edit jump. */
export function WizardSummaryRow({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 last:border-0">
      <span className="shrink-0 text-[12px] text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 text-right text-[13px] font-medium text-slate-800">{value}</span>
      {onEdit && (
        <button type="button" onClick={onEdit} className="shrink-0 text-[11px] font-medium text-blue-600 hover:underline">Edit</button>
      )}
    </div>
  )
}
