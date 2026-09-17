'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ImageIcon, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { schedulePost } from '@/lib/social/actions'
import { capabilitiesFor, PROVIDER_CONSTRAINTS, validateDraft } from '@/lib/social/providers'
import type { ComposerData } from '@/lib/social/composer'
import type { PostType } from '@/types/social'
import { Dialog, FormError, fieldInput, fieldLabel, primaryButton, secondaryButton, useParamDialog } from './Dialog'
import { ProviderIcon } from './kit'

// The shared post composer, opened by `?compose=1` (new) or `?compose=<postId>`
// (edit) from Create Post, Schedule Post, empty calendar slots and post menus.
// Channel choices, formats and limits come from the provider capability matrix,
// so an unsupported option is never offered.

const TYPE_LABELS: Record<PostType, string> = {
  post: 'Post', reel: 'Reel', story: 'Story', carousel: 'Carousel', short: 'Short video', thread: 'Thread', pin: 'Pin',
}

const TIMEZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Australia/Sydney']

/** `datetime-local` value in UTC for an ISO string (the page shows all times in UTC). */
function toLocalInput(iso: string | null | undefined): string {
  return iso ? new Date(iso).toISOString().slice(0, 16) : ''
}

export function ComposerDialog({ data, canApproveOwn, brandHref }: { data: ComposerData; canApproveOwn: boolean; brandHref: string }) {
  const { open, value, close } = useParamDialog('compose')
  const router = useRouter()
  const editing = data.post && value === data.post.id ? data.post : null
  // Keyed on the post so reopening for a different post resets the form.
  if (!open) return null
  return <ComposerForm key={editing?.id ?? `new-${value}`} data={data} editing={editing} close={close} router={router} canApproveOwn={canApproveOwn} brandHref={brandHref} presetTime={value && value.startsWith('at:') ? value.slice(3) : null} />
}

function ComposerForm({ data, editing, close, router, canApproveOwn, presetTime, brandHref }: {
  brandHref: string
  data: ComposerData
  editing: ComposerData['post']
  close: () => void
  router: ReturnType<typeof useRouter>
  canApproveOwn: boolean
  presetTime: string | null
}) {
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [caption, setCaption] = useState(editing?.caption ?? '')
  const [channelIds, setChannelIds] = useState<string[]>(() => {
    if (!editing) return []
    // The post's own channel, plus the first connected channel for each other platform it lists.
    const own = data.channels.find(channel => channel.id === editing.channel_id)
    const ids = own ? [own.id] : []
    for (const platform of editing.platforms ?? []) {
      if (platform === own?.platform) continue
      const match = data.channels.find(channel => channel.platform === platform)
      if (match) ids.push(match.id)
    }
    return ids
  })
  const [postType, setPostType] = useState<PostType>((editing?.post_type as PostType) ?? 'post')
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(editing?.scheduled_at ?? presetTime))
  const [timezone, setTimezone] = useState(editing?.timezone ?? 'UTC')
  const [campaignId, setCampaignId] = useState(editing?.campaign_id ?? '')
  const [media, setMedia] = useState<string[]>(editing?.media_urls ?? [])
  const [requireApproval, setRequireApproval] = useState(Boolean(editing?.approval_required) || !canApproveOwn)
  const [error, setError] = useState<{ message: string; reference?: string } | null>(null)

  const selected = data.channels.filter(channel => channelIds.includes(channel.id))
  const allowedTypes = useMemo(() => {
    if (selected.length === 0) return Object.keys(TYPE_LABELS) as PostType[]
    return (Object.keys(TYPE_LABELS) as PostType[]).filter(type => selected.every(channel => capabilitiesFor(channel.platform).postTypes.includes(type)))
  }, [selected])
  const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? []
  const when = scheduledAt ? new Date(`${scheduledAt}:00Z`) : null
  const issues = selected.flatMap(channel => validateDraft(channel.platform, { caption, mediaCount: media.length, hashtagCount: hashtags.length, postType, scheduledAt: when }))
  const blocking = when || requireApproval ? issues : issues.filter(issue => issue.field !== 'media')

  const toggleChannel = (id: string) => setChannelIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const toggleMedia = (path: string) => setMedia(current => current.includes(path) ? current.filter(item => item !== path) : [...current, path])

  function submit() {
    if (pending) return
    setError(null)
    startTransition(async () => {
      const result = await schedulePost({
        postId: editing?.id, title: title.trim(), caption, channelIds, postType,
        scheduledAt: when ? when.toISOString() : null, timezone,
        campaignId: campaignId || null, mediaUrls: media, hashtags, requireApproval,
      })
      if (!result.ok) { setError({ message: result.message, reference: result.reference }); return }
      close()
      router.refresh()
    })
  }

  const actionLabel = pending ? 'Saving…' : requireApproval ? 'Submit for approval' : when ? (editing ? 'Save schedule' : 'Schedule post') : 'Save draft'

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      title={editing ? 'Edit post' : 'Create post'}
      description="Choose channels, write once, and publish or schedule. All times are in UTC."
      footer={(
        <>
          <p className="mr-auto text-[12px] text-slate-500">{selected.length} channel{selected.length === 1 ? '' : 's'} · {caption.length} characters</p>
          <button type="button" onClick={close} className={secondaryButton}>Cancel</button>
          <button type="button" onClick={submit} disabled={pending || channelIds.length === 0 || !caption.trim() || blocking.length > 0} className={primaryButton}>{actionLabel}</button>
        </>
      )}
    >
      {data.channels.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
          Connect a channel first — there is nowhere to publish yet.
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className={fieldLabel}>Channels</legend>
            <div className="flex flex-wrap gap-2">
              {data.channels.map(channel => {
                const caps = capabilitiesFor(channel.platform)
                const blockedReason = !caps.createPost ? 'Publishing is not supported for this platform'
                  : ['error', 'expired', 'disconnected'].includes(channel.health) ? 'Reconnect this channel to publish'
                  : channel.permission_mode === 'read_only' ? 'Connected read-only — grant publish permission to post'
                  : null
                const on = channelIds.includes(channel.id)
                return (
                  <button
                    key={channel.id} type="button" onClick={() => toggleChannel(channel.id)} disabled={Boolean(blockedReason)} title={blockedReason ?? undefined} aria-pressed={on}
                    className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-45', on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}
                  >
                    <ProviderIcon provider={channel.platform} size={16} decorative />
                    {channel.handle ?? channel.account_name}
                    {on && <Check size={14} aria-hidden />}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="composer-title" className={fieldLabel}>Internal title</label>
              <input id="composer-title" data-autofocus value={title} maxLength={200} onChange={event => setTitle(event.target.value)} className={fieldInput} placeholder="For your team — not published" />
            </div>
            <div>
              <label htmlFor="composer-campaign" className={fieldLabel}>Campaign</label>
              <select id="composer-campaign" value={campaignId} onChange={event => setCampaignId(event.target.value)} className={fieldInput}>
                <option value="">No campaign</option>
                {data.campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="composer-caption" className={fieldLabel}>Caption</label>
            <textarea id="composer-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={5} className={fieldInput} placeholder="Write your caption. Use #hashtags and @mentions." />
            {selected.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                {[...new Set(selected.map(channel => channel.platform))].map(platform => {
                  const limit = PROVIDER_CONSTRAINTS[platform].captionMax
                  return (
                    <li key={platform} className={cn('flex items-center gap-1.5 tabular-nums', caption.length > limit ? 'text-red-600' : 'text-slate-500')}>
                      <ProviderIcon provider={platform} size={12} decorative />{caption.length.toLocaleString('en-GB')} / {limit.toLocaleString('en-GB')}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="composer-type" className={fieldLabel}>Format</label>
              <select id="composer-type" value={postType} onChange={event => setPostType(event.target.value as PostType)} className={fieldInput}>
                {(Object.keys(TYPE_LABELS) as PostType[]).map(type => <option key={type} value={type} disabled={!allowedTypes.includes(type)}>{TYPE_LABELS[type]}{allowedTypes.includes(type) ? '' : ' (not supported)'}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="composer-when" className={fieldLabel}>Schedule (UTC)</label>
              <input id="composer-when" type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} className={fieldInput} />
            </div>
            <div>
              <label htmlFor="composer-tz" className={fieldLabel}>Audience timezone</label>
              <select id="composer-tz" value={timezone} onChange={event => setTimezone(event.target.value)} className={fieldInput}>
                {TIMEZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className={fieldLabel}>Media from Brand &amp; Assets</legend>
            {data.assets.length === 0 ? (
              <p className="text-[12.5px] text-slate-500">No approved media yet. <Link href={brandHref} className="font-medium text-blue-600 hover:underline">Upload to Brand &amp; Assets</Link> — posts only use storage-backed files.</p>
            ) : (
              <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {data.assets.map(asset => {
                  const on = media.includes(asset.storedPath)
                  return (
                    <button key={asset.id} type="button" onClick={() => toggleMedia(asset.storedPath)} aria-pressed={on} title={asset.name}
                      className={cn('relative aspect-square overflow-hidden rounded-lg border bg-slate-50', on ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200')}>
                      {asset.thumb
                        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed thumbnail
                        ? <img src={asset.thumb} alt="" className="h-full w-full object-cover" />
                        : (
                          <span className="flex h-full flex-col items-center justify-center gap-1 p-1.5 text-slate-400">
                            {asset.kind === 'video' ? <Video size={18} aria-hidden /> : <ImageIcon size={18} aria-hidden />}
                            <span className="line-clamp-2 break-all text-center text-[10px] leading-tight text-slate-500" aria-hidden>{asset.name}</span>
                          </span>
                        )}
                      <span className="sr-only">{asset.name}</span>
                      {on && <span className="absolute right-1 top-1 rounded-full bg-blue-600 p-0.5 text-white"><Check size={11} aria-hidden /></span>}
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          <label className="flex items-start gap-2.5 text-[13px] text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={requireApproval} disabled={!canApproveOwn} onChange={event => setRequireApproval(event.target.checked)} />
            <span>Require approval before this can publish{!canApproveOwn && <span className="block text-[12px] text-slate-500">Your role needs a reviewer to approve posts.</span>}</span>
          </label>

          {issues.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800" aria-live="polite">
              {issues.map((issue, index) => (
                <li key={index} className={cn(!blocking.includes(issue) && 'text-amber-700/80')}>
                  <strong className="font-semibold capitalize">{issue.provider}:</strong> {issue.message}{!blocking.includes(issue) && ' (needed before scheduling)'}
                </li>
              ))}
            </ul>
          )}
          {error && <FormError message={error.message} reference={error.reference} />}
        </div>
      )}
    </Dialog>
  )
}
