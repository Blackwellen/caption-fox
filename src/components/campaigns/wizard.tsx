'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const WIZARD_FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
export const WIZARD_LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export interface WizardStep {
  id: string
  label: string
  /** Returns an error message when the step cannot be left, or null when valid. */
  validate?: () => string | null
  render: () => React.ReactNode
}

/**
 * Shared wizard shell for the Campaigns creation flows.
 *
 * Steps validate on Next as well as on submit, the stepper shows completed and
 * errored states, and closing with unsaved input asks for confirmation.
 */
export default function WizardDialog({
  open, title, description, steps, submitLabel, pending, error, onClose, onSubmit, dirty,
}: {
  open: boolean
  title: string
  description: string
  steps: WizardStep[]
  submitLabel: string
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
  dirty: boolean
}) {
  const [index, setIndex] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)

  useEffect(() => { if (open) { setIndex(0); setStepError(null) } }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      // Escape closes; Enter must never submit a multi-step form implicitly.
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  function requestClose() {
    if (dirty && !window.confirm('Discard this draft? Your changes will not be saved.')) return
    onClose()
  }

  const step = steps[index]
  const isLast = index === steps.length - 1

  function next() {
    const problem = step.validate?.() ?? null
    setStepError(problem)
    if (problem) return
    setIndex(i => Math.min(i + 1, steps.length - 1))
  }

  function submit() {
    for (let i = 0; i <= index; i++) {
      const problem = steps[i].validate?.() ?? null
      if (problem) { setIndex(i); setStepError(problem); return }
    }
    setStepError(null)
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
      <div className="fixed inset-0" onClick={requestClose} aria-hidden />
      <div
        role="dialog" aria-modal="true" aria-labelledby="wizard-title"
        className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 id="wizard-title" className="text-[15px] font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
          <button
            type="button" onClick={requestClose} aria-label="Close"
            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </header>

        <ol className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-2.5" aria-label="Steps">
          {steps.map((entry, i) => {
            const done = i < index
            const active = i === index
            return (
              <li key={entry.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { if (i <= index) { setIndex(i); setStepError(null) } }}
                  disabled={i > index}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors',
                    active ? 'bg-blue-50 text-blue-700'
                      : done ? 'text-slate-600 hover:bg-slate-100'
                      : 'cursor-not-allowed text-slate-300',
                  )}
                >
                  <span className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                    active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500',
                  )}>
                    {done ? <Check size={9} /> : i + 1}
                  </span>
                  {entry.label}
                </button>
                {i < steps.length - 1 && <span aria-hidden className="text-slate-300">›</span>}
              </li>
            )
          })}
        </ol>

        <div className="max-h-[58vh] space-y-3 overflow-y-auto px-5 py-4">
          {(stepError || error) && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertTriangle size={14} className="mt-px shrink-0" />
              {stepError ?? error}
            </p>
          )}
          {step.render()}
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
          {index > 0 && (
            <button
              type="button" onClick={() => { setIndex(i => i - 1); setStepError(null) }}
              className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button" onClick={requestClose}
              className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            {isLast ? (
              <button
                type="button" onClick={submit} disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {submitLabel}
              </button>
            ) : (
              <button
                type="button" onClick={next}
                className="h-9 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700"
              >
                Next
              </button>
            )}
          </span>
        </footer>
      </div>
    </div>
  )
}

/** Multi-select chip group used across the campaign wizards. */
export function ChipGroup({
  legend, options, value, onChange,
}: {
  legend: string
  options: { value: string; label: string }[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset>
      <legend className={WIZARD_LABEL}>{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const active = value.includes(option.value)
          return (
            <button
              key={option.value} type="button" aria-pressed={active}
              onClick={() => onChange(active ? value.filter(v => v !== option.value) : [...value, option.value])}
              className={cn(
                'h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
