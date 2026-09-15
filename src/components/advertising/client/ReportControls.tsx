'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Bookmark, CalendarClock, Check, ChevronDown, FilePlus2, Loader2, Star, Trash2, X } from 'lucide-react'
import { deletePresetAction, savePresetAction, scheduleReportAction, setDefaultPresetAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'

// Reports controls: the staged filter bar (changes apply on "Apply Filters"),
// Save as Preset / My Saved Reports, Schedule Report and Create Report. Filter
// state lives in the URL, so a preset is simply a saved set of URL params.

type Option = { value: string; label: string }
export const REPORT_PARAMS = ['range', 'compare', 'platform', 'attribution', 'group', 'groupBy', 'grain', 'view'] as const

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div><h2 className="text-[15px] font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const fieldClass = 'mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

/** The labelled filter bar. Edits are local until "Apply Filters". */
export function ReportFilterBar({ fields }: { fields: { key: string; label: string; options: Option[]; allLabel: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = () => Object.fromEntries(fields.map(field => [field.key, searchParams.get(field.key) ?? '']))
  const [draft, setDraft] = useState<Record<string, string>>(initial)
  const [pending, startTransition] = useTransition()
  // When the URL changes elsewhere (preset applied, back/forward), reset the
  // draft to match. Done during render so there is no extra effect pass.
  const urlKey = searchParams.toString()
  const [syncedKey, setSyncedKey] = useState(urlKey)
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey)
    setDraft(initial())
  }

  const dirty = fields.some(field => (searchParams.get(field.key) ?? '') !== draft[field.key])

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const field of fields) { if (next[field.key]) params.set(field.key, next[field.key]); else params.delete(field.key) }
    params.delete('preset')
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }))
  }

  return (
    <form onSubmit={event => { event.preventDefault(); apply(draft) }} className="flex flex-wrap items-end gap-2.5">
      {fields.map(field => (
        <label key={field.key} className="min-w-[150px] flex-1 text-[11px] text-slate-500 sm:max-w-[190px]">
          {field.label}
          <span className="relative mt-1 block">
            <select value={draft[field.key]} onChange={event => setDraft(prev => ({ ...prev, [field.key]: event.target.value }))}
              className="h-[30px] w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[12.5px] font-normal text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15">
              <option value="">{field.allLabel}</option>
              {field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          </span>
        </label>
      ))}
      <div className="ml-auto flex items-center gap-3 pb-0.5">
        <button type="button" onClick={() => { const cleared = Object.fromEntries(fields.map(field => [field.key, ''])); setDraft(cleared); apply(cleared) }} className="text-[12.5px] font-medium text-blue-600 hover:underline">Clear all</button>
        <button type="submit" disabled={!dirty || pending} className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}Apply Filters
        </button>
      </div>
    </form>
  )
}

/** "Save as Preset" + "My Saved Reports" (apply / set default / delete). */
export function PresetControls({
  workspaceId, workspaceType, presets, canManage,
}: { workspaceId: string; workspaceType: string; presets: { id: string; name: string; isDefault: boolean; config: Record<string, unknown> }[]; canManage: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [shared, setShared] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const activeId = searchParams.get('preset')

  function applyPreset(preset: { id: string; config: Record<string, unknown> }) {
    const params = new URLSearchParams()
    const saved = (preset.config.params ?? {}) as Record<string, string>
    for (const key of REPORT_PARAMS) if (saved[key]) params.set(key, saved[key])
    params.set('preset', preset.id)
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) { setError('Name the preset.'); return }
    const params = Object.fromEntries(REPORT_PARAMS.map(key => [key, searchParams.get(key) ?? '']).filter(([, value]) => value))
    startTransition(async () => {
      const result = await savePresetAction({ workspaceId, workspaceType, name, config: { params }, isShared: shared })
      if (!result.ok) { setError(result.error); return }
      setSaving(false); setName('')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setSaving(true)} disabled={!canManage} title={canManage ? undefined : 'Saved presets are included from the Agency plan, or your role cannot manage them.'}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55">
        <Bookmark size={14} aria-hidden /> Save as Preset
      </button>
      <details className="relative">
        <summary className="inline-flex h-8 min-w-[180px] cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <span className="truncate">{presets.find(preset => preset.id === activeId)?.name ?? 'My Saved Reports'}</span><ChevronDown size={14} className="text-slate-400" aria-hidden />
        </summary>
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {presets.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-slate-500">No saved reports yet. Set filters, then Save as Preset.</p> : presets.map(preset => (
            <div key={preset.id} className="group flex items-center gap-1 rounded-md hover:bg-slate-50">
              <button type="button" onClick={() => applyPreset(preset)} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-slate-700">
                {preset.id === activeId ? <Check size={13} className="text-blue-600" aria-hidden /> : <span className="w-[13px]" />}
                <span className="truncate">{preset.name}</span>
                {preset.isDefault && <span className="rounded bg-blue-50 px-1 text-[10px] font-medium text-blue-700">Default</span>}
              </button>
              {canManage && (
                <>
                  <button type="button" aria-label={`Make ${preset.name} the default`} title="Set as default" onClick={() => startTransition(async () => { await setDefaultPresetAction({ workspaceId, workspaceType, presetId: preset.id }) })} className="rounded p-1 text-slate-400 hover:text-amber-500"><Star size={13} /></button>
                  <button type="button" aria-label={`Delete ${preset.name}`} title="Delete" onClick={() => { if (confirm(`Delete the "${preset.name}" preset?`)) startTransition(async () => { await deletePresetAction({ workspaceId, workspaceType, presetId: preset.id }) }) }} className="mr-1 rounded p-1 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </details>
      {saving && (
        <Modal title="Save as preset" subtitle="Saves the current filters, grouping and view so you can reopen this report in one click." onClose={() => setSaving(false)}>
          <form onSubmit={save} className="space-y-3 p-4">
            <label className="block text-[12px] font-medium text-slate-600">Preset name
              <input autoFocus value={name} onChange={event => { setName(event.target.value); setError(null) }} maxLength={80} className={fieldClass} />
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700"><input type="checkbox" checked={shared} onChange={event => setShared(event.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600" /> Share with the workspace</label>
            {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setSaving(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600">Cancel</button>
              <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white disabled:opacity-60">{pending && <Loader2 size={14} className="animate-spin" />}Save preset</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function ScheduleReportButton({
  workspaceId, workspaceType, presets, disabledReason,
}: { workspaceId: string; workspaceType: string; presets: { id: string; name: string }[]; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', cadence: 'weekly', format: 'pdf', recipients: '', presetId: presets[0]?.id ?? '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const recipients = form.recipients.split(/[,;\s]+/).map(value => value.trim()).filter(Boolean)
    const invalid = recipients.filter(value => !EMAIL.test(value))
    if (!form.name.trim()) { setError('Name the schedule.'); return }
    if (recipients.length === 0) { setError('Add at least one recipient email.'); return }
    if (invalid.length) { setError(`Not a valid email: ${invalid.join(', ')}`); return }
    if (recipients.length > 25) { setError('Up to 25 recipients per schedule.'); return }
    startTransition(async () => {
      const result = await scheduleReportAction({ workspaceId, workspaceType, name: form.name.trim(), cadence: form.cadence as 'weekly', recipients, format: form.format as 'pdf', presetId: form.presetId || null })
      if (!result.ok) { setError(result.error); return }
      setDone(result.message ?? 'Scheduled.'); setOpen(false)
      setTimeout(() => setDone(null), 4000)
    })
  }

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => { setOpen(true); setError(null) }} disabled={!!disabledReason} title={disabledReason ?? undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-55">
        <CalendarClock size={15} aria-hidden /> Schedule Report
      </button>
      {done && <span role="status" className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white shadow-lg">{done}</span>}
      {open && (
        <Modal title="Schedule report" subtitle="Emails this report on a schedule. Times use the workspace time zone (Europe/London)." onClose={() => setOpen(false)}>
          <form onSubmit={submit} noValidate className="space-y-3 p-4">
            <label className="block text-[12px] font-medium text-slate-600">Name
              <input autoFocus value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} maxLength={120} className={fieldClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-medium text-slate-600">Frequency
                <select value={form.cadence} onChange={event => setForm(prev => ({ ...prev, cadence: event.target.value }))} className={fieldClass}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Format
                <select value={form.format} onChange={event => setForm(prev => ({ ...prev, format: event.target.value }))} className={fieldClass}>
                  <option value="pdf">PDF</option><option value="csv">CSV</option><option value="xlsx">XLSX</option>
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-medium text-slate-600">Report preset
              <select value={form.presetId} onChange={event => setForm(prev => ({ ...prev, presetId: event.target.value }))} className={fieldClass}>
                <option value="">Default view</option>
                {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Recipients
              <textarea value={form.recipients} onChange={event => setForm(prev => ({ ...prev, recipients: event.target.value }))} rows={2} placeholder="name@company.com, team@company.com" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
            </label>
            {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600">Cancel</button>
              <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white disabled:opacity-60">{pending && <Loader2 size={14} className="animate-spin" />}Create schedule</button>
            </div>
          </form>
        </Modal>
      )}
    </span>
  )
}

/** "Create Report": names the current view and downloads it as a recorded CSV report. */
export function CreateReportButton({ exportHref, disabledReason }: { exportHref: string; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [dataset, setDataset] = useState('campaigns')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55">
        <FilePlus2 size={15} aria-hidden /> Create Report
      </button>
      {open && (
        <Modal title="Create report" subtitle="Generates a CSV of the current filters and records it under Recent Exports." onClose={() => setOpen(false)}>
          <div className="space-y-3 p-4">
            <label className="block text-[12px] font-medium text-slate-600">Report name
              <input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={120} placeholder="e.g. Monthly Performance Report" className={fieldClass} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Contents
              <select value={dataset} onChange={event => setDataset(event.target.value)} className={fieldClass}>
                <option value="campaigns">Campaign performance</option><option value="accounts">Account performance</option>
                <option value="creatives">Creative performance</option><option value="audiences">Audience performance</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600">Cancel</button>
              <a href={`${exportHref}&dataset=${dataset}&name=${encodeURIComponent(name.trim())}`} onClick={() => setTimeout(() => setOpen(false), 300)}
                className={cn('inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700', !name.trim() && 'pointer-events-none opacity-50')} aria-disabled={!name.trim()}>
                Generate report
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
