'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Download, MoreHorizontal, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createEvent } from '@/lib/events/actions'

/**
 * Header actions shared by all six Events routes.
 *
 * Export builds a real download from the CURRENT search, filters, sorting and
 * view — it never dumps an unfiltered table — and Create opens the real
 * creation wizard, not a toast.
 */

export function ExportButton({
  routeSegment, resource, disabledReason,
}: { routeSegment: string; resource: string; disabledReason?: string | null }) {
  const params = useSearchParams()
  const [pending, setPending] = useState(false)

  if (disabledReason) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[13.5px] font-semibold text-slate-400"
      >
        <Download size={15} aria-hidden />
        Export
        <span className="sr-only">— {disabledReason}</span>
      </button>
    )
  }

  const href = `/api/events/export?resource=${resource}&workspaceType=${routeSegment}&${params.toString()}`

  return (
    <a
      href={href}
      onClick={() => { setPending(true); setTimeout(() => setPending(false), 1500) }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-[13.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      download
    >
      <Download size={15} aria-hidden className={cn(pending && 'animate-pulse')} />
      Export
    </a>
  )
}

export interface CreateOption {
  id: string
  label: string
  description?: string
  eventType?: string
  href?: string
}

export function CreateButton({
  label, options, routeSegment, disabledReason, defaultEventType = 'in_person',
}: {
  label: string
  options: CreateOption[]
  routeSegment: string
  disabledReason?: string | null
  defaultEventType?: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [wizardType, setWizardType] = useState<string | null>(null)

  if (disabledReason) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-blue-300 px-4 text-[13.5px] font-semibold text-white"
      >
        <Plus size={16} aria-hidden />
        {label}
        <span className="sr-only">— {disabledReason}</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <div className="inline-flex overflow-hidden rounded-lg bg-blue-600">
        <button
          type="button"
          onClick={() => setWizardType(defaultEventType)}
          className="inline-flex h-10 items-center gap-2 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} aria-hidden />
          {label}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`${label} options`}
          className="border-l border-white/20 px-2.5 text-white transition-colors hover:bg-blue-700"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {menuOpen && (
        <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
          <ul
            role="menu"
            className="absolute right-0 top-full z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {options.map(option => (
              <li key={option.id} role="none">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    if (option.href) window.location.href = option.href
                    else setWizardType(option.eventType ?? defaultEventType)
                  }}
                  className="block w-full px-3.5 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-[13px] font-semibold text-slate-900">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block text-[11.5px] text-slate-500">{option.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {wizardType && (
        <CreateEventWizard
          routeSegment={routeSegment}
          initialType={wizardType}
          onClose={() => setWizardType(null)}
        />
      )}
    </div>
  )
}

export function MoreActionsButton({ items }: { items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More actions"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-30 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <ul role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map(item => (
              <li key={item.label} role="none">
                <a role="menuitem" href={item.href} className="block px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ create wizard */

const STEPS = ['Event type', 'Details', 'Date & place', 'Review'] as const

const TYPE_OPTIONS = [
  { value: 'conference', label: 'Conference', format: 'in_person' },
  { value: 'in_person', label: 'In-person event', format: 'in_person' },
  { value: 'webinar', label: 'Webinar', format: 'virtual' },
  { value: 'podcast', label: 'Podcast recording', format: 'virtual' },
  { value: 'workshop', label: 'Workshop', format: 'in_person' },
  { value: 'roundtable', label: 'Roundtable', format: 'hybrid' },
  { value: 'product_launch', label: 'Product launch', format: 'hybrid' },
  { value: 'networking', label: 'Networking', format: 'in_person' },
]

export function CreateEventWizard({
  routeSegment, initialType, onClose,
}: { routeSegment: string; initialType: string; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    eventType: initialType,
    format: TYPE_OPTIONS.find(option => option.value === initialType)?.format ?? 'in_person',
    name: '',
    summary: '',
    startAt: '',
    endAt: '',
    locationCity: '',
    onlinePlatform: '',
    capacity: '',
  })

  function update(patch: Partial<typeof form>) {
    setForm(current => ({ ...current, ...patch }))
    setError(null)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createEvent(routeSegment, {
        name: form.name,
        eventType: form.eventType,
        format: form.format,
        summary: form.summary || null,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        locationCity: form.locationCity || null,
        onlinePlatform: form.onlinePlatform || null,
        capacity: form.capacity ? Number(form.capacity) : null,
      })
      if (!result.ok) { setError(result.error); return }
      onClose()
      router.push(`/${routeSegment}/events/events`)
      router.refresh()
    })
  }

  const canAdvance =
    step === 0 ? Boolean(form.eventType)
      : step === 1 ? form.name.trim().length > 1
        : true

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-event-title"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 id="create-event-title" className="text-[17px] font-bold text-slate-900">Create event</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Marketing operations only — venue, staffing and production live in Gala Dock.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <ol className="flex gap-1 px-5 pt-4">
          {STEPS.map((label, index) => (
            <li key={label} className="flex-1">
              <div className={cn('h-1 rounded-full', index <= step ? 'bg-blue-600' : 'bg-slate-200')} />
              <p className={cn('mt-1.5 text-[11px] font-medium', index <= step ? 'text-blue-700' : 'text-slate-400')}>
                {label}
              </p>
            </li>
          ))}
        </ol>

        <div className="space-y-4 p-5">
          {step === 0 && (
            <fieldset>
              <legend className="text-[13px] font-semibold text-slate-900">What are you running?</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TYPE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => update({ eventType: option.value, format: option.format })}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                      form.eventType === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                    )}
                    aria-pressed={form.eventType === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <>
              <Field label="Event name" required>
                <input
                  value={form.name}
                  onChange={event => update({ name: event.target.value })}
                  maxLength={160}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </Field>
              <Field label="Summary">
                <textarea
                  value={form.summary}
                  onChange={event => update({ summary: event.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </Field>
              <Field label="Format">
                <select
                  value={form.format}
                  onChange={event => update({ format: event.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                >
                  <option value="in_person">In-person</option>
                  <option value="virtual">Virtual</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Starts">
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={event => update({ startAt: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={event => update({ endAt: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                  />
                </Field>
              </div>
              {/* A virtual event is never asked for a venue, and an in-person one
                  is never asked for a platform. */}
              {form.format !== 'virtual' && (
                <Field label="City" required={form.format === 'in_person'}>
                  <input
                    value={form.locationCity}
                    onChange={event => update({ locationCity: event.target.value })}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                  />
                </Field>
              )}
              {form.format !== 'in_person' && (
                <Field label="Online platform" required={form.format === 'virtual'}>
                  <input
                    value={form.onlinePlatform}
                    onChange={event => update({ onlinePlatform: event.target.value })}
                    placeholder="Zoom, Teams, YouTube Live…"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                  />
                </Field>
              )}
              <Field label="Capacity">
                <input
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={event => update({ capacity: event.target.value })}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px]"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-[13px]">
              <Row label="Name" value={form.name || '—'} />
              <Row label="Type" value={TYPE_OPTIONS.find(o => o.value === form.eventType)?.label ?? form.eventType} />
              <Row label="Format" value={form.format.replaceAll('_', '-')} />
              <Row label="Starts" value={form.startAt || 'Not scheduled (saves as draft)'} />
              <Row label={form.format === 'virtual' ? 'Platform' : 'City'} value={(form.format === 'virtual' ? form.onlinePlatform : form.locationCity) || '—'} />
            </dl>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-5">
          <button type="button" onClick={onClose} className="text-[13px] font-medium text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep(current => Math.max(0, current - 1))}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] font-semibold text-slate-700 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={() => setStep(current => current + 1)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-45"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {pending ? 'Creating…' : 'Create event'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-slate-700">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  )
}
