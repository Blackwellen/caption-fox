'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, RefreshCw, X } from 'lucide-react'
import { createDraftAudienceAction, refreshAudienceAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'

// Header actions for Audiences: "Sync Segments" refreshes every audience from
// its platform one at a time (and says exactly how many failed), and "Create
// Audience" saves a draft definition. Both disable while running so a double
// click cannot start a second run or create a duplicate.

export function SyncSegmentsButton({
  workspaceId, workspaceType, audienceIds, disabledReason,
}: { workspaceId: string; workspaceType: string; audienceIds: string[]; disabledReason?: string | null }) {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)

  function run() {
    setNotice(null)
    startTransition(async () => {
      let failed = 0
      let firstError = ''
      for (const audienceId of audienceIds) {
        const result = await refreshAudienceAction({ workspaceId, workspaceType, audienceId })
        if (!result.ok) { failed += 1; firstError ||= result.error }
      }
      setNotice(failed === 0
        ? { text: `${audienceIds.length} audience${audienceIds.length === 1 ? '' : 's'} refreshed.`, ok: true }
        : { text: `${failed} of ${audienceIds.length} could not refresh — ${firstError}`, ok: false })
      setTimeout(() => setNotice(null), 6000)
    })
  }

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={run} disabled={pending || !!disabledReason || audienceIds.length === 0}
        title={disabledReason ?? (audienceIds.length === 0 ? 'No audiences to sync.' : undefined)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55">
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
        {pending ? 'Syncing…' : 'Sync Segments'}
      </button>
      {notice && (
        <span role="status" className={cn('absolute right-0 top-full z-20 mt-1 w-72 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-white shadow-lg', notice.ok ? 'bg-emerald-600' : 'bg-red-600')}>{notice.text}</span>
      )}
    </span>
  )
}

const TYPES = [
  ['custom', 'Custom Audience'], ['lookalike', 'Lookalike'], ['website_visitors', 'Website Visitors'], ['engagers', 'Engagers'],
  ['crm_list', 'CRM List'], ['interest', 'Interest Based'], ['video_viewers', 'Video Viewers'], ['app_users', 'App Users'],
] as const

export function CreateAudienceButton({
  workspaceId, workspaceType, basePath, accounts, audiences, disabledReason,
}: {
  workspaceId: string; workspaceType: string; basePath: string
  accounts: { id: string; name: string; providerName: string }[]; audiences: { id: string; name: string }[]; disabledReason?: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55">
        <Plus size={15} aria-hidden /> Create Audience
      </button>
      {open && <Dialog {...{ workspaceId, workspaceType, basePath, accounts, audiences }} onClose={() => setOpen(false)} />}
    </>
  )
}

function Dialog({ workspaceId, workspaceType, basePath, accounts, audiences, onClose }: {
  workspaceId: string; workspaceType: string; basePath: string
  accounts: { id: string; name: string; providerName: string }[]; audiences: { id: string; name: string }[]; onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({ accountId: accounts[0]?.id ?? '', name: '', audienceType: 'custom', description: '', recencyDays: '30', refreshSchedule: 'weekly', excludedAudienceId: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  const set = (key: keyof typeof form, value: string) => { setForm(prev => ({ ...prev, [key]: value })); setErrors(prev => ({ ...prev, [key]: '' })) }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.'
    const recency = form.recencyDays ? Number(form.recencyDays) : null
    if (recency !== null && (!Number.isInteger(recency) || recency < 1 || recency > 540)) next.recencyDays = 'Enter 1–540 days.'
    if (Object.keys(next).length) { setErrors(next); return }
    setServerError(null)
    startTransition(async () => {
      const result = await createDraftAudienceAction({
        workspaceId, workspaceType, accountId: form.accountId, name: form.name, audienceType: form.audienceType,
        description: form.description, recencyDays: recency, refreshSchedule: form.refreshSchedule as 'weekly',
        excludedAudienceId: form.excludedAudienceId || null,
      })
      if (!result.ok) { if (result.field) setErrors({ [result.field]: result.error }); else setServerError(result.error); return }
      router.push(`${basePath}/audiences/${result.id}`)
    })
  }

  const field = (key: string) => cn('mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] focus:outline-none focus:ring-2', errors[key] ? 'border-red-300 focus:ring-red-500/15' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500/15')

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="create-audience-title">
      <form onSubmit={submit} noValidate className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 id="create-audience-title" className="text-[15px] font-semibold text-slate-900">Create audience</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Saved as a draft for review. Size and match rate appear once the platform builds it.</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16} /></button>
        </div>
        {accounts.length === 0 ? <p className="p-4 text-[13px] text-slate-600">Connect an ad account first.</p> : (
          <div className="space-y-3 p-4">
            <label className="block text-[12px] font-medium text-slate-600">Name
              <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={120} placeholder="e.g. Purchasers 60D" className={field('name')} aria-invalid={!!errors.name} />
              {errors.name && <span className="mt-1 block text-[11.5px] text-red-600">{errors.name}</span>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-medium text-slate-600">Ad account
                <select value={form.accountId} onChange={e => set('accountId', e.target.value)} className={field('accountId')}>
                  {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.providerName}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Type
                <select value={form.audienceType} onChange={e => set('audienceType', e.target.value)} className={field('audienceType')}>
                  {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Recency window (days)
                <input type="number" min={1} max={540} value={form.recencyDays} onChange={e => set('recencyDays', e.target.value)} className={field('recencyDays')} aria-invalid={!!errors.recencyDays} />
                {errors.recencyDays && <span className="mt-1 block text-[11.5px] text-red-600">{errors.recencyDays}</span>}
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Refresh
                <select value={form.refreshSchedule} onChange={e => set('refreshSchedule', e.target.value)} className={field('refreshSchedule')}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="manual">Manual</option>
                </select>
              </label>
            </div>
            <label className="block text-[12px] font-medium text-slate-600">Exclude audience <span className="font-normal text-slate-400">(optional)</span>
              <select value={form.excludedAudienceId} onChange={e => set('excludedAudienceId', e.target.value)} className={field('excludedAudienceId')}>
                <option value="">No exclusion</option>
                {audiences.map(audience => <option key={audience.id} value={audience.id}>{audience.name}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Description <span className="font-normal text-slate-400">(optional)</span>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15" />
            </label>
            <p className="text-[11px] text-slate-500">Customer-list audiences are hashed and uploaded by the platform integration; individual identities are never shown in Caption Fox.</p>
            {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{serverError}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} disabled={pending} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600 hover:bg-slate-50">Cancel</button>
          {accounts.length > 0 && (
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}{pending ? 'Creating…' : 'Create draft'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
