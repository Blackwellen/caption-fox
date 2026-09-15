'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { createTemplate } from '@/app/app/campaigns/actions'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import { CAMPAIGN_CHANNELS, CHANNEL_LABELS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@/lib/campaigns/constants'
import type { PersonLite } from '@/lib/campaigns/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

export default function NewTemplateButton({ members, className }: { members: PersonLite[]; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  function requestClose() {
    if (dirty && !window.confirm('Discard this template? Your changes will not be saved.')) return
    setOpen(false); setError(null); setChannels([]); setDirty(false)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createTemplate({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? ''),
        category: String(form.get('category') ?? 'standard'),
        template_type: String(form.get('template_type') ?? 'multi_channel'),
        default_budget: String(form.get('default_budget') ?? ''),
        default_duration_days: String(form.get('default_duration_days') ?? ''),
        owner_id: String(form.get('owner_id') ?? ''),
        channels,
      })

      if (!result.ok) { setError(result.error ?? 'Could not create the template.'); return }
      notify('success', result.message ?? 'Template created.')
      setOpen(false); setError(null); setChannels([]); setDirty(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700', className)}
      >
        <Plus size={15} />
        New template
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={requestClose} aria-hidden />
          <div
            role="dialog" aria-modal="true" aria-labelledby="new-template-title"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 id="new-template-title" className="text-[15px] font-semibold text-slate-900">New campaign template</h2>
                <p className="text-xs text-slate-500">
                  Templates are created as drafts. Publish one to make it available for new campaigns.
                </p>
              </div>
              <button
                type="button" onClick={requestClose} aria-label="Close"
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-3 px-5 py-4">
              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
              )}

              <label className="block">
                <span className={LABEL}>Template name <span className="text-red-500">*</span></span>
                <input name="name" required maxLength={140} autoFocus className={FIELD} placeholder="e.g. Product launch playbook" />
              </label>

              <label className="block">
                <span className={LABEL}>Description</span>
                <textarea
                  name="description" rows={2} maxLength={1000}
                  className={cn(FIELD, 'h-auto py-2')}
                  placeholder="What kind of campaign is this template for?"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Category</span>
                  <select name="category" defaultValue="standard" className={FIELD}>
                    {CAMPAIGN_TYPES.map(type => (
                      <option key={type} value={type}>{CAMPAIGN_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Template type</span>
                  <select name="template_type" defaultValue="multi_channel" className={FIELD}>
                    {TEMPLATE_TYPES.map(type => (
                      <option key={type} value={type}>{TEMPLATE_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Owner</span>
                  <select name="owner_id" defaultValue="" className={FIELD}>
                    <option value="">Assign to me</option>
                    {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Default duration (days)</span>
                  <input type="number" name="default_duration_days" min="1" max="730" className={FIELD} placeholder="30" />
                </label>
                <label className="block">
                  <span className={LABEL}>Default budget (GBP)</span>
                  <input type="number" name="default_budget" min="0" className={FIELD} placeholder="0" />
                </label>
              </div>

              <fieldset>
                <legend className={LABEL}>Default channels</legend>
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
                  Create template
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
