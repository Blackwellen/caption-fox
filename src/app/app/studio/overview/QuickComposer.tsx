'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { Panel } from '@/components/studio/primitives'
import { useToast } from '@/components/campaigns/Toast'
import { saveContent, setContentStatus } from '../actions'
import { CHANNEL_LABELS, STUDIO_CHANNELS, captionLimitFor } from '@/lib/studio/constants'

/**
 * A smaller, functional version of the full Compose editor. It writes the same
 * `content_posts` record through the same `saveContent` action, so a draft
 * started here is a real draft, editable in the full Compose page.
 */
export default function QuickComposer({ channels }: { channels: string[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const available = channels.length ? channels : STUDIO_CHANNELS.slice(0, 3)
  const [selected, setSelected] = useState<string[]>(available.slice(0, 1))
  const [caption, setCaption] = useState('')
  const limit = captionLimitFor(selected)

  function toggle(channel: string) {
    setSelected(list => (list.includes(channel) ? list.filter(c => c !== channel) : [...list, channel]))
  }

  function submit(intent: 'draft' | 'review') {
    if (!caption.trim() || selected.length === 0) {
      notify('error', 'Write a caption and select at least one channel first.')
      return
    }
    startTransition(async () => {
      const result = await saveContent({
        caption, platforms: selected, internalTitle: caption.slice(0, 60) || 'Untitled draft', source: 'manual',
      })
      if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
      if (intent === 'review' && result.id) await setContentStatus({ id: result.id, status: 'pending_approval' })
      notify('success', intent === 'review' ? 'Sent for review.' : (result.message ?? 'Draft saved.'))
      router.push(`/app/studio/compose?id=${result.id}`)
    })
  }

  return (
    <Panel title="Compose New Post" viewAllHref="/app/studio/compose" viewAllLabel="Open full editor">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {available.map(channel => (
          <button
            key={channel}
            type="button"
            onClick={() => toggle(channel)}
            className={`h-7 rounded-full border px-2.5 text-xs font-medium transition-colors ${
              selected.includes(channel)
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {CHANNEL_LABELS[channel] ?? channel}
          </button>
        ))}
      </div>

      <textarea
        value={caption}
        onChange={e => setCaption(e.target.value)}
        placeholder="Unlock your brand's full potential with smarter content…"
        rows={6}
        maxLength={limit}
        className="w-full resize-none rounded-lg border border-slate-200 p-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{caption.length} / {limit}</span>
        <div className="flex items-center gap-2">
          <button
            type="button" disabled={pending} onClick={() => submit('draft')}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button" disabled={pending} onClick={() => submit('review')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Sparkles size={13} /> Save &amp; continue
          </button>
        </div>
      </div>
    </Panel>
  )
}
