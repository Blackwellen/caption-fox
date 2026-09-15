'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { CHANNEL_LABELS, STUDIO_CHANNELS } from '@/lib/studio/constants'
import type { ContentRow } from '@/lib/studio/types'
import { repurposeContent } from '../actions'

export default function RepurposeDialog({ content, onClose }: { content: ContentRow; onClose: () => void }) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const existing = new Set(content.platforms ?? [])
  const [channels, setChannels] = useState<string[]>(
    STUDIO_CHANNELS.filter(c => !existing.has(c)).slice(0, 2),
  )

  function toggle(channel: string) {
    setChannels(list => (list.includes(channel) ? list.filter(c => c !== channel) : [...list, channel]))
  }

  function submit() {
    if (channels.length === 0) { notify('error', 'Choose at least one target channel.'); return }
    startTransition(async () => {
      const result = await repurposeContent({ id: content.id, channels })
      if (!result.ok) { notify('error', result.error ?? 'Could not repurpose.'); return }
      notify('success', result.message ?? 'Drafts created.')
      onClose()
    })
  }

  return (
    <Modal
      open onClose={onClose}
      title="Repurpose content"
      description={`Turn “${content.internal_title || content.title || 'this content'}” into new drafts for other channels.`}
      footer={
        <>
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" disabled={pending} onClick={submit} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? 'Creating…' : `Create ${channels.length || ''} draft${channels.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <p className="mb-2 text-xs font-medium text-slate-500">Target channels</p>
      <div className="flex flex-wrap gap-1.5">
        {STUDIO_CHANNELS.map(channel => (
          <button
            key={channel} type="button" onClick={() => toggle(channel)}
            className={`h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${
              channels.includes(channel)
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {CHANNEL_LABELS[channel] ?? channel}
          </button>
        ))}
      </div>
    </Modal>
  )
}
