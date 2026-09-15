'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import { saveKeywordSet } from './actions'

export default function NewKeywordSetButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'cluster' | 'set'>('cluster')
  const [platform, setPlatform] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!name.trim()) { notify('error', 'Name this group.'); return }
    startTransition(async () => {
      const result = await saveKeywordSet({ name, kind, platform: platform || undefined })
      if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
      notify('success', result.message ?? 'Created.')
      setOpen(false)
      setName(''); setPlatform('')
      router.push(`/app/studio/hashtags?selected=${result.id}`)
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <Plus size={15} /> New
      </button>

      {open && (
        <Modal
          open onClose={() => setOpen(false)} title="New keyword cluster or hashtag set"
          footer={
            <>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-500">
              Type
              <div className="mt-1 flex gap-2">
                {(['cluster', 'set'] as const).map(k => (
                  <button
                    key={k} type="button" onClick={() => setKind(k)}
                    className={`h-8 flex-1 rounded-lg border text-[13px] font-medium ${kind === k ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                  >
                    {k === 'cluster' ? 'Keyword cluster' : 'Hashtag set'}
                  </button>
                ))}
              </div>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Name
              <input
                value={name} onChange={e => setName(e.target.value)} autoFocus
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Platform
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]">
                <option value="">Any platform</option>
                {STUDIO_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </>
  )
}
