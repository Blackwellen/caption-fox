'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { createMilestone } from '@/app/app/campaigns/actions'
import type { CampaignRow, PersonLite } from '@/lib/campaigns/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

const TYPES = [
  { value: 'brief', label: 'Brief' }, { value: 'assets', label: 'Assets' },
  { value: 'review', label: 'Review' }, { value: 'approval', label: 'Approval' },
  { value: 'launch', label: 'Launch' }, { value: 'report', label: 'Report' },
  { value: 'checkpoint', label: 'Checkpoint' },
]

export default function AddMilestoneButton({
  campaigns, members, className,
}: { campaigns: Pick<CampaignRow, 'id' | 'name'>[]; members: PersonLite[]; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const campaignId = String(form.get('campaign_id') ?? '')
    if (!campaignId) { setError('Choose which campaign this milestone belongs to.'); return }

    startTransition(async () => {
      const result = await createMilestone({
        campaign_id: campaignId,
        title: String(form.get('title') ?? ''),
        due_date: String(form.get('due_date') ?? ''),
        milestone_type: String(form.get('milestone_type') ?? 'checkpoint'),
        owner_id: String(form.get('owner_id') ?? ''),
        notes: String(form.get('notes') ?? ''),
      })
      if (!result.ok) { setError(result.error ?? 'Could not create the milestone.'); return }
      notify('success', result.message ?? 'Milestone added.')
      setOpen(false); setError(null)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50', className)}
      >
        <CalendarPlus size={14} />
        Add milestone
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-labelledby="add-milestone-title" className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <h2 id="add-milestone-title" className="text-[15px] font-semibold text-slate-900">Add milestone</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={16} />
              </button>
            </header>

            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

              <label className="block">
                <span className={LABEL}>Campaign <span className="text-red-500">*</span></span>
                <select name="campaign_id" required className={FIELD} disabled={campaigns.length === 0}>
                  <option value="">Choose a campaign…</option>
                  {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                </select>
                {campaigns.length === 0 && <span className="mt-1 block text-xs text-amber-700">Create a campaign first.</span>}
              </label>

              <label className="block">
                <span className={LABEL}>Milestone title <span className="text-red-500">*</span></span>
                <input name="title" required maxLength={140} className={FIELD} placeholder="e.g. Assets ready for review" autoFocus />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Due date <span className="text-red-500">*</span></span>
                  <input type="date" name="due_date" required className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Type</span>
                  <select name="milestone_type" defaultValue="checkpoint" className={FIELD}>
                    {TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className={LABEL}>Owner</span>
                <select name="owner_id" defaultValue="" className={FIELD}>
                  <option value="">Assign to me</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
                </select>
              </label>

              <label className="block">
                <span className={LABEL}>Notes</span>
                <textarea name="notes" rows={2} maxLength={1000} className={cn(FIELD, 'h-auto py-2')} />
              </label>

              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit" disabled={pending || campaigns.length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Add milestone
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
