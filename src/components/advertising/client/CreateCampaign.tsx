'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { createDraftCampaignAction } from '@/lib/advertising/actions'
import { cn } from '@/lib/utils'

// "Create Campaign" button + dialog. Creates a DRAFT on one of the workspace's
// connected ad accounts; nothing is published to a platform from here. Opens
// automatically for ?create=1 (Overview's Create Campaign link). Validates on
// the client for fast feedback; the server action re-validates everything.

type AccountOption = { id: string; name: string; providerName: string }

const OBJECTIVES = [
  ['sales', 'Sales'], ['conversions', 'Conversions'], ['leads', 'Lead generation'], ['traffic', 'Traffic'],
  ['awareness', 'Brand awareness'], ['engagement', 'Engagement'], ['video_views', 'Video views'], ['app_installs', 'App installs'],
] as const

export default function CreateCampaign({
  workspaceId, workspaceType, basePath, accounts, disabledReason,
}: { workspaceId: string; workspaceType: string; basePath: string; accounts: AccountOption[]; disabledReason?: string | null }) {
  const [clicked, setOpen] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // ?create=1 (Overview's Create Campaign, the board's Add Campaign) opens the dialog.
  const open = clicked || (searchParams.get('create') === '1' && !disabledReason)

  function close() {
    setOpen(false)
    if (searchParams.get('create')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('create')
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false })
    }
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} disabled={!!disabledReason} title={disabledReason ?? undefined}
        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <Plus size={15} aria-hidden /> Create Campaign
      </button>
      {open && <Dialog workspaceId={workspaceId} workspaceType={workspaceType} basePath={basePath} accounts={accounts} onClose={close} />}
    </>
  )
}

function Dialog({ workspaceId, workspaceType, basePath, accounts, onClose }: {
  workspaceId: string; workspaceType: string; basePath: string; accounts: AccountOption[]; onClose: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ accountId: accounts[0]?.id ?? '', name: '', objective: 'sales', budgetAmount: '', budgetType: 'lifetime', startsAt: today, endsAt: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const firstField = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    firstField.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  const update = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.accountId) next.accountId = 'Choose an ad account.'
    if (form.name.trim().length < 3) next.name = 'Name must be at least 3 characters.'
    const budget = Number(form.budgetAmount)
    if (!form.budgetAmount || !Number.isFinite(budget) || budget <= 0) next.budgetAmount = 'Enter a budget greater than £0.'
    if (!form.startsAt) next.startsAt = 'Choose a start date.'
    if (form.endsAt && form.endsAt < form.startsAt) next.endsAt = 'End date must be on or after the start date.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)
    if (!validate() || pending) return
    startTransition(async () => {
      const result = await createDraftCampaignAction({
        workspaceId, workspaceType, accountId: form.accountId, name: form.name, objective: form.objective,
        budgetAmount: Number(form.budgetAmount), budgetType: form.budgetType as 'daily' | 'lifetime',
        startsAt: form.startsAt, endsAt: form.endsAt || null,
      })
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error })
        else setServerError(result.error)
        return
      }
      router.push(`${basePath}/campaigns/${result.id}`)
    })
  }

  const fieldClass = (key: string) => cn(
    'mt-1 h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2',
    errors[key] ? 'border-red-300 focus:ring-red-500/15' : 'border-slate-200 focus:border-blue-400 focus:ring-blue-500/15',
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="create-campaign-title">
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" noValidate>
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <h2 id="create-campaign-title" className="text-[15px] font-semibold text-slate-900">Create campaign</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">Saved as a draft in Caption Fox. Nothing is published to the ad platform until you publish it.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={16} /></button>
        </div>

        {accounts.length === 0 ? (
          <p className="p-4 text-[13px] text-slate-600">Connect an ad account first — campaigns are created on a connected account.</p>
        ) : (
          <div className="space-y-3 p-4">
            <label className="block text-[12px] font-medium text-slate-600">Ad account
              <select ref={firstField} value={form.accountId} onChange={event => update('accountId', event.target.value)} className={fieldClass('accountId')} aria-invalid={!!errors.accountId}>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.providerName}</option>)}
              </select>
              {errors.accountId && <span className="mt-1 block text-[11.5px] text-red-600">{errors.accountId}</span>}
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Campaign name
              <input value={form.name} onChange={event => update('name', event.target.value)} maxLength={120} placeholder="e.g. Autumn Launch | Prospecting" className={fieldClass('name')} aria-invalid={!!errors.name} />
              {errors.name && <span className="mt-1 block text-[11.5px] text-red-600">{errors.name}</span>}
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Objective
              <select value={form.objective} onChange={event => update('objective', event.target.value)} className={fieldClass('objective')}>
                {OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-medium text-slate-600">Budget (£)
                <input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.budgetAmount} onChange={event => update('budgetAmount', event.target.value)} className={fieldClass('budgetAmount')} aria-invalid={!!errors.budgetAmount} />
                {errors.budgetAmount && <span className="mt-1 block text-[11.5px] text-red-600">{errors.budgetAmount}</span>}
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Budget type
                <select value={form.budgetType} onChange={event => update('budgetType', event.target.value)} className={fieldClass('budgetType')}>
                  <option value="lifetime">Lifetime</option>
                  <option value="daily">Daily</option>
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">Start date
                <input type="date" value={form.startsAt} onChange={event => update('startsAt', event.target.value)} className={fieldClass('startsAt')} aria-invalid={!!errors.startsAt} />
                {errors.startsAt && <span className="mt-1 block text-[11.5px] text-red-600">{errors.startsAt}</span>}
              </label>
              <label className="block text-[12px] font-medium text-slate-600">End date <span className="font-normal text-slate-400">(optional)</span>
                <input type="date" value={form.endsAt} min={form.startsAt} onChange={event => update('endsAt', event.target.value)} className={fieldClass('endsAt')} aria-invalid={!!errors.endsAt} />
                {errors.endsAt && <span className="mt-1 block text-[11.5px] text-red-600">{errors.endsAt}</span>}
              </label>
            </div>
            {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{serverError}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button type="button" onClick={onClose} disabled={pending} className="h-9 rounded-lg border border-slate-200 px-3 text-[13px] text-slate-600 hover:bg-slate-50">Cancel</button>
          {accounts.length > 0 && (
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} {pending ? 'Creating…' : 'Create draft'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
