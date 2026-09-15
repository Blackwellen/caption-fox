'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { schedulePost } from '@/lib/social/actions'
import { validateDraft } from '@/lib/social/providers'
import { ProviderLabel } from './primitives'
import type { SocialChannelRow } from '@/types/social'

const POST_TYPES = [
  { id: 'post', label: 'Post' },
  { id: 'reel', label: 'Reel' },
  { id: 'story', label: 'Story' },
  { id: 'carousel', label: 'Carousel' },
]

export function PostComposer({ channels, onClose }: { channels: SocialChannelRow[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [postType, setPostType] = useState('post')
  const [selected, setSelected] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [requireApproval, setRequireApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedChannels = channels.filter(channel => selected.includes(channel.id))
  const previewIssues = selectedChannels.flatMap(channel => validateDraft(channel.platform, {
    caption, mediaCount: 0, hashtagCount: 0, postType: postType as never,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  }))

  function toggleChannel(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await schedulePost({
        title, caption, channelIds: selected, postType,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        requireApproval,
      })
      if (!result.ok) { setError(result.message); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Schedule post">
      <div className="w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">Schedule Post</h2>
            <p className="text-xs text-slate-500">Choose channels, write your copy, and pick a time.</p>
          </div>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {channels.length === 0 ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Connect a channel first — there is nothing to publish to yet.</p>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</label>
              <div className="flex flex-wrap gap-2">
                {channels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => toggleChannel(channel.id)}
                    disabled={channel.health === 'disconnected' || channel.health === 'error' || channel.health === 'expired'}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40',
                      selected.includes(channel.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white',
                    )}
                  >
                    <ProviderLabel provider={channel.platform} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title (internal)</label>
            <input value={title} onChange={event => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="For your team, not shown on the post" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Caption</label>
            <textarea value={caption} onChange={event => setCaption(event.target.value)} rows={5} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Write your caption…" />
            <p className="mt-1 text-right text-xs text-slate-400">{caption.length} characters</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Format</label>
              <select value={postType} onChange={event => setPostType(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {POST_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule for</label>
              <input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={requireApproval} onChange={event => setRequireApproval(event.target.checked)} />
            Require approval before this can be sent
          </label>

          {previewIssues.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {previewIssues.map((issue, index) => <p key={index}>{issue.provider}: {issue.message}</p>)}
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-between border-t border-slate-100 p-5">
          <button onClick={onClose} className="text-sm text-slate-600">Cancel</button>
          <button
            onClick={submit}
            disabled={pending || selected.length === 0 || !caption.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : scheduledAt ? 'Schedule post' : 'Save as draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
