'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { createCampaign } from '@/app/app/campaigns/actions'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import {
  BOARD_STAGES, CAMPAIGN_CHANNELS, CHANNEL_LABELS, LIFECYCLE_LABELS,
  PRIORITIES, PRIORITY_LABELS,
} from '@/lib/campaigns/constants'
import type { PersonLite, TemplateRow } from '@/lib/campaigns/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export default function NewCampaignButton({
  members, templates = [], defaultType, label = 'New campaign', className,
}: {
  members: PersonLite[]
  templates?: Pick<TemplateRow, 'id' | 'name'>[]
  defaultType?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)
  const [channels, setChannels] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)

  // `?action=new` deep-links straight into the create flow (quick-create menu).
  useEffect(() => { if (params.get('action') === 'new') setOpen(true) }, [params])
  useEffect(() => { if (open) firstField.current?.focus() }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function requestClose() {
    if (dirty && !window.confirm('Discard this campaign? Your changes will not be saved.')) return
    setOpen(false); setErrors(null); setChannels([]); setDirty(false)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const input = {
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
      campaign_type: String(form.get('campaign_type') ?? 'standard'),
      lifecycle_stage: String(form.get('lifecycle_stage') ?? 'planning'),
      priority: String(form.get('priority') ?? 'medium'),
      owner_id: String(form.get('owner_id') ?? ''),
      start_date: String(form.get('start_date') ?? ''),
      end_date: String(form.get('end_date') ?? ''),
      budget: String(form.get('budget') ?? ''),
      template_id: String(form.get('template_id') ?? ''),
      channels,
    }

    startTransition(async () => {
      const result = await createCampaign(input)
      if (!result.ok) { setErrors(result.error ?? 'Could not create the campaign.'); return }
      notify('success', result.message ?? 'Campaign created.')
      setOpen(false); setErrors(null); setChannels([]); setDirty(false)
      router.refresh()
      if (result.id) router.push(`/app/campaigns/${result.id}`)
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700', className)}
      >
        <Plus size={15} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={requestClose} aria-hidden />
          <div
            role="dialog" aria-modal="true" aria-labelledby="new-campaign-title"
            className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 id="new-campaign-title" className="text-[15px] font-semibold text-slate-900">New campaign</h2>
                <p className="text-xs text-slate-500">Set up the campaign record. You can add content, tasks and budget detail afterwards.</p>
              </div>
              <button
                type="button" onClick={requestClose} aria-label="Close"
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={submit} onChange={() => setDirty(true)} className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {errors && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {errors}
                </p>
              )}

              <label className="block">
                <span className={LABEL}>Campaign name <span className="text-red-500">*</span></span>
                <input ref={firstField} name="name" required maxLength={140} className={FIELD} placeholder="e.g. Summer Launch 2026" />
              </label>

              <label className="block">
                <span className={LABEL}>Description <span className="text-slate-400">(optional)</span></span>
                <textarea
                  name="description" rows={2} maxLength={1000}
                  className={cn(FIELD, 'h-auto py-2')} placeholder="What is this campaign for?"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Campaign type</span>
                  <select name="campaign_type" defaultValue={defaultType ?? 'standard'} className={FIELD}>
                    {CAMPAIGN_TYPES.map(type => (
                      <option key={type} value={type}>{CAMPAIGN_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Owner</span>
                  <select name="owner_id" className={FIELD} defaultValue="">
                    <option value="">Assign to me</option>
                    {members.map(member => (
                      <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Stage</span>
                  <select name="lifecycle_stage" defaultValue="planning" className={FIELD}>
                    {BOARD_STAGES.map(stage => (
                      <option key={stage} value={stage}>{LIFECYCLE_LABELS[stage]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Priority</span>
                  <select name="priority" defaultValue="medium" className={FIELD}>
                    {PRIORITIES.map(priority => (
                      <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Start date</span>
                  <input type="date" name="start_date" className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>End date</span>
                  <input type="date" name="end_date" className={FIELD} />
                </label>
                <label className="block">
                  <span className={LABEL}>Budget (GBP)</span>
                  <input type="number" name="budget" min="0" step="1" className={FIELD} placeholder="0" />
                </label>
                {templates.length > 0 && (
                  <label className="block">
                    <span className={LABEL}>Create from template</span>
                    <select name="template_id" defaultValue="" className={FIELD}>
                      <option value="">No template</option>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <fieldset>
                <legend className={LABEL}>Channels</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CAMPAIGN_CHANNELS.map(channel => {
                    const active = channels.includes(channel)
                    return (
                      <button
                        key={channel} type="button" aria-pressed={active}
                        onClick={() => { setDirty(true); setChannels(list => active ? list.filter(c => c !== channel) : [...list, channel]) }}
                        className={cn(
                          'h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                          active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {CHANNEL_LABELS[channel]}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button" onClick={requestClose}
                  className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Create campaign
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
