'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Loader2, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createRequest, type RequestInput } from '@/lib/marketplace/actions'
import type { MarketplaceCategory, MarketplaceProfile } from '@/lib/marketplace/module'
import { ProfileAvatar } from './primitives'

const STEPS = ['Request type', 'Project brief', 'Budget and timeline', 'Invite suppliers', 'Review'] as const

const EMPTY: RequestInput = {
  kind: 'discovery',
  title: '',
  category: '',
  description: '',
  deliverables: [''],
  budgetMin: '',
  budgetMax: '',
  deadline: '',
  proposalsRequested: '5',
  supplierIds: [],
  publish: true,
}

/**
 * Marketplace request / RFQ wizard.
 *
 * Every step validates before advancing, the submit button is disabled while
 * in flight so a double-click cannot create two requests, and server-side field
 * errors are mapped back onto the step that owns them.
 */
export default function NewRequestWizard({
  open, onClose, categories, suppliers, canInvite, defaultKind,
}: {
  open: boolean
  onClose: () => void
  categories: MarketplaceCategory[]
  suppliers: MarketplaceProfile[]
  canInvite: boolean
  defaultKind?: 'discovery' | 'rfq'
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<RequestInput>({ ...EMPTY, kind: defaultKind ?? 'discovery' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)

  if (!open) return null

  function patch(next: Partial<RequestInput>) {
    setForm(current => ({ ...current, ...next }))
  }

  function validateStep(index: number): boolean {
    const next: Record<string, string> = {}
    if (index === 1) {
      if (!form.title.trim()) next.title = 'Add a project title.'
      if (!form.category) next.category = 'Choose a category.'
      if (form.description.trim().length < 20) next.description = 'Describe the project in at least 20 characters.'
    }
    if (index === 2) {
      const min = Number.parseFloat(form.budgetMin)
      const max = Number.parseFloat(form.budgetMax)
      if (form.budgetMin && Number.isNaN(min)) next.budgetMin = 'Enter a number.'
      if (form.budgetMax && Number.isNaN(max)) next.budgetMax = 'Enter a number.'
      if (!Number.isNaN(min) && !Number.isNaN(max) && max < min) next.budgetMax = 'Maximum must be at least the minimum.'
      if (form.deadline && new Date(form.deadline) < new Date(new Date().toDateString())) {
        next.deadline = 'The deadline must be in the future.'
      }
    }
    if (index === 3 && form.kind === 'rfq' && form.supplierIds.length === 0) {
      next.supplierIds = 'Invite at least one supplier to an RFQ.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function next() {
    if (!validateStep(step)) return
    setStep(current => Math.min(current + 1, STEPS.length - 1))
  }

  function submit(publish: boolean) {
    for (let index = 1; index <= 3; index += 1) {
      if (!validateStep(index)) { setStep(index); return }
    }
    setFormError(null)
    start(async () => {
      const result = await createRequest({ ...form, publish })
      if (result.ok) {
        setDone(true)
        router.refresh()
        setTimeout(() => { setDone(false); onClose(); setForm({ ...EMPTY }); setStep(0) }, 900)
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors)
        setStep(result.fieldErrors.supplierIds ? 3 : result.fieldErrors.deadline || result.fieldErrors.budgetMax ? 2 : 1)
      } else {
        setFormError(result.error ?? 'Could not create that request.')
      }
    })
  }

  const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-700'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Create marketplace request">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {form.kind === 'rfq' ? 'New RFQ' : 'New discovery request'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Brief suppliers once and compare their proposals side by side.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>

        <ol className="flex gap-1 overflow-x-auto border-b border-slate-100 px-5 py-3" aria-label="Wizard steps">
          {STEPS.map((label, index) => (
            <li key={label} className="min-w-[7.5rem] flex-1">
              <div className={cn('border-t-2 pt-2 text-[11px] font-medium',
                index < step ? 'border-emerald-500 text-emerald-700'
                  : index === step ? 'border-blue-600 text-blue-700'
                    : 'border-slate-200 text-slate-400')}>
                {index + 1}. {label}
              </div>
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 0 && (
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-900">What kind of request is this?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { id: 'discovery', title: 'Discovery request', note: 'Open brief — suppliers can find and respond to it.' },
                  { id: 'rfq', title: 'RFQ', note: 'Private quote request sent to suppliers you invite.' },
                ] as const).map(option => (
                  <label
                    key={option.id}
                    className={cn('cursor-pointer rounded-xl border p-4 transition',
                      form.kind === option.id ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300')}
                  >
                    <input
                      type="radio" name="kind" value={option.id} checked={form.kind === option.id}
                      onChange={() => patch({ kind: option.id })}
                      className="sr-only"
                    />
                    <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{option.note}</p>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="req-title" className={labelCls}>Project title</label>
                <input
                  id="req-title" value={form.title} maxLength={160}
                  onChange={event => patch({ title: event.target.value })}
                  aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'req-title-error' : undefined}
                  placeholder="e.g. Explainer video series for product launch"
                  className={field}
                />
                {errors.title && <p id="req-title-error" className="mt-1 text-xs text-red-600">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="req-category" className={labelCls}>Category</label>
                <select
                  id="req-category" value={form.category}
                  onChange={event => patch({ category: event.target.value })}
                  aria-invalid={Boolean(errors.category)}
                  className={field}
                >
                  <option value="">Choose a category…</option>
                  {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
              </div>

              <div>
                <label htmlFor="req-description" className={labelCls}>Project brief</label>
                <textarea
                  id="req-description" rows={5} value={form.description} maxLength={4000}
                  onChange={event => patch({ description: event.target.value })}
                  aria-invalid={Boolean(errors.description)}
                  placeholder="What do you need, who is it for, and what does success look like?"
                  className={field}
                />
                <p className="mt-1 text-[11px] text-slate-400">{form.description.length}/4000 characters</p>
                {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
              </div>

              <div>
                <span className={labelCls}>Deliverables</span>
                <div className="space-y-2">
                  {form.deliverables.map((deliverable, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={deliverable}
                        aria-label={`Deliverable ${index + 1}`}
                        onChange={event => {
                          const next = [...form.deliverables]
                          next[index] = event.target.value
                          patch({ deliverables: next })
                        }}
                        placeholder="e.g. 3 × 30s vertical videos"
                        className={field}
                      />
                      {form.deliverables.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove deliverable ${index + 1}`}
                          onClick={() => patch({ deliverables: form.deliverables.filter((_, i) => i !== index) })}
                          className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => patch({ deliverables: [...form.deliverables, ''] })}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus size={13} />Add deliverable
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-budget-min" className={labelCls}>Budget from (£)</label>
                  <input
                    id="req-budget-min" inputMode="decimal" value={form.budgetMin}
                    onChange={event => patch({ budgetMin: event.target.value })}
                    aria-invalid={Boolean(errors.budgetMin)} placeholder="1500" className={field}
                  />
                  {errors.budgetMin && <p className="mt-1 text-xs text-red-600">{errors.budgetMin}</p>}
                </div>
                <div>
                  <label htmlFor="req-budget-max" className={labelCls}>Budget to (£)</label>
                  <input
                    id="req-budget-max" inputMode="decimal" value={form.budgetMax}
                    onChange={event => patch({ budgetMax: event.target.value })}
                    aria-invalid={Boolean(errors.budgetMax)} placeholder="2500" className={field}
                  />
                  {errors.budgetMax && <p className="mt-1 text-xs text-red-600">{errors.budgetMax}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-deadline" className={labelCls}>Response deadline</label>
                  <input
                    id="req-deadline" type="date" value={form.deadline}
                    onChange={event => patch({ deadline: event.target.value })}
                    aria-invalid={Boolean(errors.deadline)} className={field}
                  />
                  {errors.deadline && <p className="mt-1 text-xs text-red-600">{errors.deadline}</p>}
                </div>
                <div>
                  <label htmlFor="req-proposals" className={labelCls}>Proposals wanted</label>
                  <select
                    id="req-proposals" value={form.proposalsRequested}
                    onChange={event => patch({ proposalsRequested: event.target.value })}
                    className={field}
                  >
                    {['3', '5', '8', '12'].map(count => <option key={count} value={count}>{count} proposals</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Invite suppliers
                  <span className="ml-2 text-xs font-normal text-slate-500">{form.supplierIds.length} selected</span>
                </p>
                {form.supplierIds.length > 0 && (
                  <button type="button" onClick={() => patch({ supplierIds: [] })} className="text-xs font-medium text-blue-600">
                    Clear
                  </button>
                )}
              </div>
              {!canInvite ? (
                <p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                  Your role cannot invite suppliers. The request will be created as an open brief.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {suppliers.map(supplier => {
                    const checked = form.supplierIds.includes(supplier.id)
                    return (
                      <li key={supplier.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50">
                          <input
                            type="checkbox" checked={checked}
                            onChange={() => patch({
                              supplierIds: checked
                                ? form.supplierIds.filter(id => id !== supplier.id)
                                : [...form.supplierIds, supplier.id],
                            })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <ProfileAvatar profile={supplier} size={28} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-800">{supplier.display_name}</span>
                            <span className="block truncate text-[11px] text-slate-400">{supplier.headline}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">{Number(supplier.rating).toFixed(1)} ★</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
              {errors.supplierIds && <p className="mt-2 text-xs text-red-600">{errors.supplierIds}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Review and submit</h3>
              <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                {[
                  ['Type', form.kind === 'rfq' ? 'RFQ' : 'Discovery request'],
                  ['Title', form.title || '—'],
                  ['Category', form.category || '—'],
                  ['Deliverables', form.deliverables.filter(Boolean).join(', ') || '—'],
                  ['Budget', form.budgetMin || form.budgetMax ? `£${form.budgetMin || '0'} – £${form.budgetMax || form.budgetMin}` : 'Not specified'],
                  ['Deadline', form.deadline || 'No deadline'],
                  ['Proposals wanted', form.proposalsRequested],
                  ['Suppliers invited', String(form.supplierIds.length)],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 px-4 py-2.5">
                    <dt className="w-40 shrink-0 text-xs text-slate-500">{label}</dt>
                    <dd className="min-w-0 flex-1 text-xs font-medium text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-slate-500">{form.description}</p>
              {formError && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{formError}</p>}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 p-5">
          <button
            type="button" disabled={pending}
            onClick={() => submit(false)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Save as draft
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button" disabled={step === 0 || pending}
              onClick={() => setStep(current => Math.max(0, current - 1))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft size={15} />Previous
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button" onClick={next}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Next<ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button" disabled={pending} onClick={() => submit(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? <Loader2 size={15} className="animate-spin" /> : done ? <Check size={15} /> : null}
                {done ? 'Request created' : 'Submit request'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
