'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Quote, Smile,
  MessageSquare, Image as ImageIcon, Sparkles, Send,
} from 'lucide-react'
import { CARD, CARD_SHADOW, Panel, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import {
  AI_TONES, CHANNEL_LABELS, CHANNEL_TINT, STUDIO_CHANNELS, captionLimitFor,
} from '@/lib/studio/constants'
import type {
  ContentCommentRow, ContentRow, ContentVersionRow, MediaRow,
} from '@/lib/studio/types'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import {
  addContentComment, archiveContent, deleteContent, restoreContentVersion,
  saveContent, scheduleContent, setContentStatus,
} from '../actions'
import AssetPicker from './AssetPicker'
import ChannelPreview from './ChannelPreview'

export default function ComposeEditor({
  capabilities, content, versions, comments, assets, campaigns, channels,
}: {
  capabilities: StudioCapabilities
  content: ContentRow | null
  versions: ContentVersionRow[]
  comments: ContentCommentRow[]
  assets: MediaRow[]
  campaigns: { id: string; name: string }[]
  channels: string[]
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const available = channels.length ? channels : STUDIO_CHANNELS.slice(0, 3)
  const [id, setId] = useState(content?.id)
  const [platforms, setPlatforms] = useState<string[]>(content?.platforms ?? available.slice(0, 1))
  const [title, setTitle] = useState(content?.internal_title ?? content?.title ?? '')
  const [caption, setCaption] = useState(content?.caption ?? '')
  const [tone, setTone] = useState(content?.tone ?? '')
  const [ctaLabel, setCtaLabel] = useState(content?.cta_label ?? '')
  const [ctaUrl, setCtaUrl] = useState(content?.cta_url ?? '')
  const [utmEnabled, setUtmEnabled] = useState(content?.utm_enabled ?? false)
  const [campaignId, setCampaignId] = useState(content?.campaign_id ?? '')
  const [scheduledAt, setScheduledAt] = useState(content?.scheduled_at?.slice(0, 16) ?? '')
  const [selectedAssets, setSelectedAssets] = useState<MediaRow[]>(assets)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [quality, setQuality] = useState<number | null>(content?.quality_score ?? null)
  const [commentBody, setCommentBody] = useState('')

  const limit = captionLimitFor(platforms)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup only — never sets state, so this stays outside the "external sync"
  // pattern the setState-in-effect rule warns about.
  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }, [])

  async function autosave() {
    if (!capabilities.compose) return
    const result = await saveContent({
      id, title, internalTitle: title, caption, platforms, tone: tone || undefined,
      ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined, utmEnabled,
      campaignId: campaignId || null, assetIds: selectedAssets.map(a => a.id),
    })
    if (!result.ok) { setSaveState('error'); notify('error', result.error ?? 'Autosave failed.'); return }
    setId(result.id)
    if (result.data) setQuality(result.data.score)
    setSaveState('saved')
    if (!content && result.id) router.replace(`/app/studio/compose?id=${result.id}`)
  }

  /** Every field setter routes through here so an edit both updates state and
   * schedules the debounced autosave — no separate effect watching every field. */
  function markDirty<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value)
      setSaveState('saving')
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(() => { void autosave() }, 1500)
    }
  }

  function saveDraft() {
    startTransition(async () => {
      const result = await saveContent({
        id, title, internalTitle: title, caption, platforms, tone: tone || undefined,
        ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined, utmEnabled,
        campaignId: campaignId || null, assetIds: selectedAssets.map(a => a.id),
      })
      if (!result.ok) { notify('error', result.error ?? 'Could not save.'); return }
      setId(result.id)
      if (result.data) setQuality(result.data.score)
      notify('success', result.message ?? 'Draft saved.')
      setSaveState('saved')
      if (!content && result.id) router.replace(`/app/studio/compose?id=${result.id}`)
      else router.refresh()
    })
  }

  function requestReview() {
    if (!id) { notify('error', 'Save the draft before requesting review.'); return }
    startTransition(async () => {
      const result = await setContentStatus({ id, status: 'pending_approval' })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Sent for review.' : (result.error ?? 'Failed.'))
      if (result.ok) router.refresh()
    })
  }

  function schedule() {
    if (!id) { notify('error', 'Save the draft first.'); return }
    if (!scheduledAt) { notify('error', 'Pick a date and time.'); return }
    startTransition(async () => {
      const result = await scheduleContent({ id, scheduledAt: new Date(scheduledAt).toISOString() })
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Scheduled.') : (result.error ?? 'Failed.'))
      if (result.ok) router.refresh()
    })
  }

  function archive() {
    if (!id) return
    startTransition(async () => {
      const result = await archiveContent({ id })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Archived.' : (result.error ?? 'Failed.'))
      if (result.ok) router.push('/app/studio/content')
    })
  }

  function remove() {
    if (!id) return
    if (!confirm('Delete this draft permanently?')) return
    startTransition(async () => {
      const result = await deleteContent({ id })
      notify(result.ok ? 'success' : 'error', result.ok ? 'Deleted.' : (result.error ?? 'Failed.'))
      if (result.ok) router.push('/app/studio/content')
    })
  }

  function restoreVersion(versionId: string) {
    if (!id) return
    startTransition(async () => {
      const result = await restoreContentVersion({ id, versionId })
      if (!result.ok) { notify('error', result.error ?? 'Could not restore.'); return }
      notify('success', result.message ?? 'Restored.')
      router.refresh()
    })
  }

  function postComment() {
    if (!id || !commentBody.trim()) return
    startTransition(async () => {
      const result = await addContentComment({ id, body: commentBody })
      if (!result.ok) { notify('error', result.error ?? 'Could not comment.'); return }
      setCommentBody('')
      router.refresh()
    })
  }

  function toggleChannel(channel: string) {
    markDirty(setPlatforms)(platforms.includes(channel) ? platforms.filter(c => c !== channel) : [...platforms, channel])
  }

  function insertFormat(before: string, after = before) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = caption.slice(0, start) + before + caption.slice(start, end) + after + caption.slice(end)
    markDirty(setCaption)(next)
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + before.length, end + before.length) })
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.9fr)]">
      {/* ── Editor column ─────────────────────────────────────────────── */}
      <div className={`${CARD} ${CARD_SHADOW} flex flex-col`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {available.map(channel => (
              <button
                key={channel} type="button" onClick={() => toggleChannel(channel)}
                className={`h-7 rounded-full border px-2.5 text-xs font-medium transition-colors ${platforms.includes(channel) ? `${CHANNEL_TINT[channel] ?? 'bg-blue-50 text-blue-700 ring-blue-100'} ring-1` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                {CHANNEL_LABELS[channel] ?? channel}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed' : ''}
          </span>
        </div>

        <div className="px-4 pt-3">
          <input
            value={title} onChange={e => markDirty(setTitle)(e.target.value)}
            placeholder="Internal title — not shown to your audience"
            className="w-full border-0 border-b border-transparent pb-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-slate-200 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2">
          <ToolbarButton icon={Bold} onClick={() => insertFormat('**')} label="Bold" />
          <ToolbarButton icon={Italic} onClick={() => insertFormat('_')} label="Italic" />
          <ToolbarButton icon={Underline} onClick={() => insertFormat('__')} label="Underline" />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarButton icon={List} onClick={() => insertFormat('\n• ', '')} label="Bulleted list" />
          <ToolbarButton icon={ListOrdered} onClick={() => insertFormat('\n1. ', '')} label="Numbered list" />
          <ToolbarButton icon={Quote} onClick={() => insertFormat('\n> ', '')} label="Quote" />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarButton icon={Link2} onClick={() => insertFormat('[', '](https://)')} label="Link" />
          <ToolbarButton icon={Smile} onClick={() => insertFormat('🙂', '')} label="Emoji" />
          <div className="ml-auto">
            <button
              type="button" onClick={() => setPickerOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              <Sparkles size={13} /> AI Assist
            </button>
          </div>
        </div>

        {/* Large primary editing surface — the composer is the point of this page. */}
        <textarea
          ref={textareaRef}
          value={caption}
          onChange={e => markDirty(setCaption)(e.target.value)}
          maxLength={limit}
          placeholder="Big news! 🚀 We're thrilled to introduce your next post…"
          className="min-h-[380px] flex-1 resize-none border-0 px-4 py-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          <span className={caption.length > limit * 0.9 ? 'text-amber-600' : ''}>{caption.length} / {limit}</span>
          {quality !== null && (
            <span className="flex items-center gap-1">
              Quality
              <Badge variant={quality >= 80 ? 'green' : quality >= 50 ? 'amber' : 'red'}>{quality}</Badge>
            </span>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Call to action
              <input value={ctaLabel} onChange={e => markDirty(setCtaLabel)(e.target.value)} placeholder="Learn more"
                className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              CTA link
              <div className="flex items-center gap-1.5">
                <input value={ctaUrl} onChange={e => markDirty(setCtaUrl)(e.target.value)} placeholder="https://…"
                  className="h-9 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="checkbox" checked={utmEnabled} onChange={e => markDirty(setUtmEnabled)(e.target.checked)} />
                  UTM
                </label>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Tone of voice
              <select value={tone} onChange={e => markDirty(setTone)(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-[13px]">
                <option value="">Default</option>
                {AI_TONES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </label>
            {campaigns.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                Campaign
                <select value={campaignId} onChange={e => markDirty(setCampaignId)(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-[13px]">
                  <option value="">No campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Schedule</label>
            <input
              type="datetime-local" value={scheduledAt} onChange={e => markDirty(setScheduledAt)(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-[13px]"
            />
            {capabilities.scheduleContent && (
              <button type="button" disabled={pending} onClick={schedule} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Schedule
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-4">
          {capabilities.compose && (
            <button type="button" disabled={pending} onClick={saveDraft} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Save draft
            </button>
          )}
          {capabilities.editContent && id && content?.status === 'draft' && (
            <button type="button" disabled={pending} onClick={requestReview} className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
              Request review
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {id && capabilities.editContent && content?.status !== 'published' && (
              <button type="button" disabled={pending} onClick={archive} className="text-[13px] font-medium text-slate-500 hover:text-slate-700">Archive</button>
            )}
            {id && capabilities.deleteContent && content?.status !== 'published' && (
              <button type="button" disabled={pending} onClick={remove} className="text-[13px] font-medium text-red-500 hover:text-red-700">Delete</button>
            )}
            <button
              type="button" disabled={pending || !caption.trim()} onClick={saveDraft}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={14} /> Save
            </button>
          </div>
        </div>
      </div>

      {/* ── Live preview column ──────────────────────────────────────── */}
      <div className="space-y-4">
        <Panel title="Live preview">
          {platforms.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-slate-400">Select a channel to preview your content.</p>
          ) : (
            <div className="space-y-3">
              {platforms.map(channel => (
                <ChannelPreview key={channel} channel={channel} caption={caption} asset={selectedAssets[0]} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Asset picker" action={
          capabilities.uploadMedia
            ? <button type="button" onClick={() => setPickerOpen(true)} className="text-xs font-medium text-blue-600 hover:text-blue-700">Browse</button>
            : undefined
        }>
          {selectedAssets.length === 0 ? (
            <button type="button" onClick={() => setPickerOpen(true)} className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 py-8 text-slate-400 hover:border-blue-300 hover:text-blue-500">
              <ImageIcon size={20} />
              <span className="text-[13px]">Add media</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {selectedAssets.map(asset => (
                <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {asset.file_type === 'image'
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={asset.file_url} alt="" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-[10px] text-slate-400">{asset.file_type}</div>}
                  <button
                    type="button" onClick={() => markDirty(setSelectedAssets)(selectedAssets.filter(a => a.id !== asset.id))}
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPickerOpen(true)} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500">
                +
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Content quality">
          {quality === null ? (
            <p className="py-3 text-center text-[13px] text-slate-400">Save a draft to see quality checks.</p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-emerald-400 text-lg font-bold text-emerald-600">{quality}</span>
              <p className="text-[13px] text-slate-500">{quality >= 80 ? 'Excellent' : quality >= 50 ? 'Good, room to improve' : 'Needs work before publishing'}</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── History / comments / drafts column ──────────────────────── */}
      <div className="space-y-4">
        <Panel title="Version history">
          {!id || versions.length === 0 ? (
            <p className="py-3 text-center text-[13px] text-slate-400">No saved versions yet.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map(v => (
                <li key={v.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-slate-600">
                    V{v.version_number} · {v.author?.full_name ?? v.author?.email ?? 'Unknown'}
                    <span className="block text-[11px] text-slate-400">{formatShortDate(v.created_at)}</span>
                  </span>
                  {capabilities.editContent && (
                    <button type="button" onClick={() => restoreVersion(v.id)} className="shrink-0 text-[11px] font-medium text-blue-600 hover:text-blue-700">Restore</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Comments">
          {!id ? (
            <p className="py-3 text-center text-[13px] text-slate-400">Save a draft to start a discussion.</p>
          ) : (
            <>
              {comments.length === 0 ? (
                <p className="py-2 text-center text-[13px] text-slate-400">No comments yet.</p>
              ) : (
                <ul className="mb-3 space-y-3">
                  {comments.map(c => (
                    <li key={c.id} className="text-[13px]">
                      <span className="font-medium text-slate-700">{c.author?.full_name ?? c.author?.email ?? 'Someone'}</span>
                      <span className="ml-1 text-[11px] text-slate-400">{formatShortDate(c.created_at)}</span>
                      <p className="mt-0.5 text-slate-600">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  value={commentBody} onChange={e => setCommentBody(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && postComment()}
                  placeholder="Add a comment…"
                  className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button type="button" onClick={postComment} className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">
                  <MessageSquare size={13} />
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>

      {pickerOpen && (
        <AssetPicker
          onClose={() => setPickerOpen(false)}
          onSelect={selected => { markDirty(setSelectedAssets)([...selectedAssets, ...selected.filter(s => !selectedAssets.some(a => a.id === s.id))]); setPickerOpen(false) }}
        />
      )}
    </div>
  )
}

function ToolbarButton({
  icon: Icon, onClick, label,
}: { icon: React.ComponentType<{ size?: number }>; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700">
      <Icon size={14} />
    </button>
  )
}
