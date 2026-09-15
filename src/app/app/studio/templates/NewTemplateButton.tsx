'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import { saveTemplate } from './actions'

export default function NewTemplateButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState('')
  const [captionTemplate, setCaptionTemplate] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) { notify('error', 'Name the template.'); return }
    startTransition(async () => {
      const result = await saveTemplate({
        name, channel: channel || undefined, captionTemplate,
        platforms: channel ? [channel] : [],
      })
      if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
      notify('success', result.message ?? 'Template created.')
      setOpen(false)
      setName(''); setChannel(''); setCaptionTemplate('')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Plus size={15} /> New Template
      </button>

      {open && (
        <Modal
          open onClose={() => setOpen(false)} title="New template"
          footer={
            <>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Creating…' : 'Create template'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              Name
              <input
                value={name} onChange={e => setName(e.target.value)} autoFocus
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Primary channel
              <select
                value={channel} onChange={e => setChannel(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
              >
                <option value="">No specific channel</option>
                {STUDIO_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Caption template
              <textarea
                value={captionTemplate} onChange={e => setCaptionTemplate(e.target.value)} rows={5}
                placeholder="Use {{variable}} for text that changes each time."
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </Modal>
      )}
    </>
  )
}
