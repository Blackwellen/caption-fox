'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDays, Check, ChevronDown, Clock, Eye, Info, Link2, Lock, MessageSquare, Monitor, MoreVertical, Play, Plus, Smartphone,
  Upload, X, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { ChannelIcon } from '@/components/home/brand-icons'
import { AI_TONES, CHANNEL_LABELS, captionLimitFor } from '@/lib/studio/constants'
import { scoreContent } from '@/lib/studio/quality'
import { extractHashtags } from '@/lib/studio/text-format'
import type { StudioModule } from '@/lib/studio/constants'
import type { ContentCommentRow, ContentRow, ContentVersionRow } from '@/lib/studio/types'
import {
  addContentComment, archiveContent, deleteContent, queueContent, restoreContentVersion, saveContent,
  scheduleContent, setContentStatus,
} from '@/lib/studio/actions/content'
import CaptionEditor from '../CaptionEditor'
import SocialPreview, { type PreviewAccountLite } from '../SocialPreview'
import StudioPageHeader from '../StudioPageHeader'
import { UploadDialog } from '../MediaUploader'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, Card, CardHeader, EmptyBlock, PersonAvatar, S_FOCUS, btnClass, fmtAgo, personName, type Tone } from '../ui'

export interface PickerAsset { id: string; name: string; url: string | null; type: string }
export interface PickerTemplate { id: string; name: string; url: string | null; caption: string; hashtags: string[] }

export interface ComposeCapabilities {
  save: boolean
  review: boolean
  schedule: boolean
  publish: boolean
  archive: boolean
  remove: boolean
  comment: boolean
  upload: boolean
  assist: boolean
}

const CTA_BUTTONS = [
  { id: 'learn_more', label: 'Learn More' }, { id: 'shop_now', label: 'Shop Now' }, { id: 'sign_up', label: 'Sign Up' },
  { id: 'book_now', label: 'Book Now' }, { id: 'contact_us', label: 'Contact Us' }, { id: 'download', label: 'Download' },
]

type ScheduleMode = 'now' | 'later' | 'queue'

function localParts(iso: string | null | undefined): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: iso ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '10:00' }
}

function timezoneLabel(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch { return '' }
}

export default function ComposeWorkspace({
  base, modules, content, versions, comments, attached, assets, templates, accounts, channels: connected,
  labelSuggestions, capabilities, kpis, recentDrafts, now,
}: {
  base: string
  modules: StudioModule[]
  content: ContentRow | null
  versions: ContentVersionRow[]
  comments: ContentCommentRow[]
  attached: PickerAsset[]
  assets: { images: PickerAsset[]; videos: PickerAsset[]; gifs: PickerAsset[] }
  templates: PickerTemplate[]
  accounts: Record<string, PreviewAccountLite>
  channels: string[]
  labelSuggestions: string[]
  capabilities: ComposeCapabilities
  kpis: React.ReactNode
  recentDrafts: React.ReactNode
  now: number
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const available = connected.length ? connected : ['instagram', 'linkedin', 'tiktok', 'facebook', 'x']
  const meta = (content?.metadata ?? {}) as Record<string, unknown>

  const [id, setId] = useState(content?.id)
  const [platforms, setPlatforms] = useState<string[]>(content?.platforms?.length ? content.platforms : available.slice(0, 3))
  const [title, setTitle] = useState(content?.internal_title ?? content?.title ?? '')
  const [caption, setCaption] = useState(() => {
    const base = content?.caption ?? ''
    const missing = (content?.hashtags ?? []).filter(tag => !base.toLowerCase().includes(tag.toLowerCase()))
    return missing.length ? `${base.trimEnd()}\n\n${missing.join(' ')}` : base
  })
  const [ctaLabel, setCtaLabel] = useState(content?.cta_label ?? '')
  const [ctaUrl, setCtaUrl] = useState(content?.cta_url ?? '')
  const [ctaButton, setCtaButton] = useState(typeof meta.cta_button === 'string' ? meta.cta_button : 'learn_more')
  const [utm, setUtm] = useState(content?.utm_enabled ?? false)
  const [tone, setTone] = useState(content?.tone ?? 'professional')
  const [labels, setLabels] = useState<string[]>(content?.tags ?? [])
  const [labelInput, setLabelInput] = useState('')
  const [selected, setSelected] = useState<PickerAsset[]>(attached)
  const [mode, setMode] = useState<ScheduleMode>(content?.scheduled_at ? 'later' : 'later')
  const [queuePos, setQueuePos] = useState<'top' | 'bottom'>('top')
  const initial = localParts(content?.scheduled_at)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [tz, setTz] = useState('')
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [assetTab, setAssetTab] = useState<'images' | 'videos' | 'gifs' | 'templates'>('images')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reply, setReply] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const replyRef = useRef<HTMLInputElement>(null)
  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saving = useRef(false)

  // The timezone label depends on the viewer's browser, so it is resolved after hydration.
  useEffect(() => { const label = timezoneLabel(); if (label) queueMicrotask(() => setTz(label)) }, [])
  useEffect(() => () => { if (autosave.current) clearTimeout(autosave.current) }, [])

  const limit = captionLimitFor(platforms)
  const hashtags = useMemo(() => extractHashtags(caption), [caption])
  const quality = useMemo(
    () => scoreContent({ caption, platforms, hashtags, ctaLabel, assetCount: selected.length }),
    [caption, platforms, hashtags, ctaLabel, selected.length],
  )
  const readOnly = !capabilities.save || content?.status === 'published'

  function payload(overrides: Partial<{ id: string | undefined }> = {}) {
    return {
      id: 'id' in overrides ? overrides.id : id,
      title: title.trim(), internalTitle: title.trim(), caption, platforms, hashtags, tags: labels, tone,
      ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined, ctaButton, utmEnabled: utm,
      campaignId: content?.campaign_id ?? null, assetIds: selected.map(a => a.id), origin: 'compose' as const,
    }
  }

  async function persist(opts: { silent?: boolean } = {}): Promise<string | undefined> {
    if (saving.current) return id
    if (!title.trim()) { setErrors({ title: 'Give this post an internal title so your team can find it.' }); if (!opts.silent) notify('error', 'Add an internal title first.'); return undefined }
    if (platforms.length === 0) { setErrors({ platforms: 'Select at least one channel.' }); if (!opts.silent) notify('error', 'Select at least one channel.'); return undefined }
    saving.current = true
    setSaveState('saving')
    try {
      const result = await saveContent(payload())
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        setSaveState('error')
        if (!opts.silent) notify('error', result.error ?? 'Could not save.')
        return undefined
      }
      setErrors({})
      setSaveState('saved')
      if (!id && result.id) {
        setId(result.id)
        router.replace(`${base}/compose?id=${result.id}`, { scroll: false })
      }
      return result.id
    } finally {
      saving.current = false
    }
  }

  /** Every edit marks the draft dirty and schedules a debounced autosave once it has been saved once. */
  function edit<T>(setter: (value: T) => void, value: T) {
    setter(value)
    if (readOnly) return
    setSaveState('dirty')
    if (autosave.current) clearTimeout(autosave.current)
    if (id) autosave.current = setTimeout(() => { void persist({ silent: true }) }, 2500)
  }

  const act = (fn: () => Promise<void>) => start(async () => { if (autosave.current) clearTimeout(autosave.current); await fn() })

  const saveDraft = () => act(async () => {
    const saved = await persist()
    if (saved) { notify('success', 'Draft saved.'); router.refresh() }
  })

  const requestReview = () => act(async () => {
    const saved = await persist()
    if (!saved) return
    const result = await setContentStatus({ id: saved, status: 'pending_approval' })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Sent for review. Approvers have been notified in the activity feed.' : result.error ?? 'Could not request review.')
    if (result.ok) router.refresh()
  })

  const schedule = () => act(async () => {
    const saved = await persist()
    if (!saved) return
    let result
    if (mode === 'queue') result = await queueContent({ id: saved, position: queuePos })
    else if (mode === 'now') result = await scheduleContent({ id: saved, scheduledAt: new Date(Date.now() + 60_000).toISOString() })
    else {
      const at = new Date(`${date}T${time}`)
      if (Number.isNaN(at.getTime())) { setErrors({ schedule: 'Enter a valid date and time.' }); return }
      if (at.getTime() < Date.now()) { setErrors({ schedule: 'Choose a time in the future.' }); notify('error', 'Choose a time in the future.'); return }
      result = await scheduleContent({ id: saved, scheduledAt: at.toISOString() })
    }
    notify(result.ok ? 'success' : 'error', result.ok ? (mode === 'now' ? 'Queued to publish now.' : result.message ?? 'Scheduled.') : result.error ?? 'Could not schedule.')
    if (result.ok) router.refresh()
  })

  const duplicate = () => act(async () => {
    const result = await saveContent({ ...payload({ id: undefined }), title: `${title} (copy)`, internalTitle: `${title} (copy)` })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Duplicated as a new draft.' : result.error ?? 'Could not duplicate.')
    if (result.ok && result.id) router.push(`${base}/compose?id=${result.id}`)
  })

  const archive = () => act(async () => {
    if (!id) return
    const result = await archiveContent({ id })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Archived. Restore it from the Content Library.' : result.error ?? 'Could not archive.')
    if (result.ok) router.push(`${base}/content`)
  })

  const remove = () => act(async () => {
    if (!id) return
    const result = await deleteContent({ id })
    setConfirmDelete(false)
    notify(result.ok ? 'success' : 'error', result.ok ? 'Draft deleted.' : result.error ?? 'Could not delete.')
    if (result.ok) router.push(`${base}/compose?new=1`)
  })

  const restore = (versionId: string, number: number) => act(async () => {
    if (!id) return
    if (!confirm(`Restore version ${number}? Your current text is kept in history first.`)) return
    await persist({ silent: true })
    const result = await restoreContentVersion({ id, versionId })
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Restored.' : result.error ?? 'Could not restore.')
    if (result.ok) { setHistoryOpen(false); router.refresh() }
  })

  const postComment = () => act(async () => {
    const body = reply.trim()
    if (!body) return
    const saved = id ?? await persist()
    if (!saved) return
    const result = await addContentComment({ id: saved, body, parentId: replyTo ?? undefined })
    if (!result.ok) { notify('error', result.error ?? 'Could not post the comment.'); return }
    setReply('')
    setReplyTo(null)
    router.refresh()
  })

  function toggleAsset(asset: PickerAsset) {
    const on = selected.some(a => a.id === asset.id)
    if (!on && selected.length >= 10) { notify('error', 'Posts can include up to 10 media items.'); return }
    edit(setSelected, on ? selected.filter(a => a.id !== asset.id) : [...selected, asset])
  }

  function applyTemplate(template: PickerTemplate) {
    if (caption.trim() && !confirm(`Replace the current caption with “${template.name}”?`)) return
    const tags = template.hashtags.filter(t => !template.caption.includes(t))
    edit(setCaption, tags.length ? `${template.caption}\n\n${tags.join(' ')}` : template.caption)
    notify('success', `Applied “${template.name}”. Replace the {{placeholders}} before publishing.`)
  }

  function addLabel(value: string) {
    const label = value.trim().slice(0, 30)
    if (!label || labels.includes(label)) { setLabelInput(''); return }
    if (labels.length >= 20) { notify('error', 'Up to 20 labels per post.'); return }
    edit(setLabels, [...labels, label])
    setLabelInput('')
  }

  const media = selected[0] ?? null
  const previewContent = {
    caption, mediaUrl: media?.url ?? null, mediaType: media?.type === 'video' ? 'video' as const : 'image' as const,
    ctaLabel: ctaLabel || null, engagement: content?.status === 'published' ? content.engagement : null,
  }
  const accountFor = (ch: string): PreviewAccountLite => accounts[ch] ?? { name: 'Your account', handle: '@your_account', avatar_url: null, followers: null }
  const scoreLabel = quality.score >= 85 ? 'Excellent' : quality.score >= 70 ? 'Good' : quality.score >= 50 ? 'Fair' : 'Needs work'
  const pickerRows = assetTab === 'templates' ? [] : assets[assetTab]
  const currentVersion = (versions[0]?.version_number ?? 0) + 1
  const statusLabel = saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'dirty' ? (id ? 'Unsaved changes' : 'Not saved yet') : saveState === 'error' ? 'Save failed' : ''

  const label = 'mb-1.5 block text-[12px] font-medium text-slate-600 lg:mb-[5px] lg:text-[9.5px]'
  const field = 'h-10 w-full rounded-[6px] border border-[#e3e7ee] bg-white px-2.5 text-[13px] text-slate-800 outline-none focus:border-[#9db8ff] disabled:bg-slate-50 lg:h-[26px] lg:px-2 lg:text-[10px]'

  const actions = (
    <>
      <Btn size="md" className="lg:h-[33px] lg:px-4 lg:text-[11.5px]" onClick={saveDraft} disabled={pending || readOnly}>Save draft</Btn>
      <Btn size="md" variant="soft" className="lg:h-[33px] lg:px-4 lg:text-[11.5px]" onClick={requestReview}
        disabled={pending || readOnly || !capabilities.review || content?.status === 'pending_approval'}
        title={content?.status === 'pending_approval' ? 'Already waiting for review' : undefined}>
        Request review
      </Btn>
      <Btn size="md" className="lg:h-[33px] lg:px-4 lg:text-[11.5px]" onClick={schedule} disabled={pending || readOnly || !capabilities.schedule}
        title={capabilities.schedule ? undefined : 'Your role cannot schedule content'}>
        <Clock size={14} className="text-slate-500" /> Schedule
      </Btn>
      <div className="inline-flex">
        <Btn variant="primary" size="md" className="rounded-r-none lg:h-[33px] lg:px-4 lg:text-[11.5px]" onClick={() => setPreviewOpen(true)}>
          <Eye size={14} /> Preview
        </Btn>
        <Popover>
          <PopoverTrigger haspopup="menu" label="Preview options" className={btnClass('primary', 'md', 'rounded-l-none border-l-white/25 px-2 lg:h-[33px] lg:w-[30px] lg:px-0')}>
            <ChevronDown size={14} />
          </PopoverTrigger>
          <PopoverContent role="menu" label="Preview options" width={210} align="end">
            {close => (<>
              <MenuItem close={close} icon={<Smartphone size={12} />} onSelect={() => { setDevice('mobile'); setPreviewOpen(true) }}>Preview on mobile</MenuItem>
              <MenuItem close={close} icon={<Monitor size={12} />} onSelect={() => { setDevice('desktop'); setPreviewOpen(true) }}>Preview on desktop</MenuItem>
              <MenuItem close={close} icon={<Link2 size={12} />} onSelect={() => { void navigator.clipboard?.writeText(caption); notify('success', 'Caption copied.') }}>Copy caption</MenuItem>
            </>)}
          </PopoverContent>
        </Popover>
      </div>
      <Popover>
        <PopoverTrigger haspopup="menu" label="More post actions" className={btnClass('secondary', 'md', 'w-10 px-0 lg:h-[33px] lg:w-[33px]')}>
          <MoreVertical size={15} />
        </PopoverTrigger>
        <PopoverContent role="menu" label="More post actions" width={210} align="end">
          {close => (<>
            <MenuItem close={close} onSelect={() => router.push(`${base}/compose?new=1`)}>New post</MenuItem>
            <MenuItem close={close} onSelect={duplicate} disabled={!capabilities.save || !title.trim()}>Duplicate as new draft</MenuItem>
            {id && <MenuItem close={close} onSelect={() => router.push(`${base}/content?selected=${id}`)}>View in Content Library</MenuItem>}
            <MenuSeparator />
            <MenuItem close={close} onSelect={archive} disabled={!id || !capabilities.archive} hint="Save the post first">Archive</MenuItem>
            <MenuItem close={close} danger onSelect={() => setConfirmDelete(true)} disabled={!id || !capabilities.remove || content?.status === 'published'}
              hint={content?.status === 'published' ? 'Published posts are archived, not deleted' : 'Your role cannot delete content'}>
              Delete draft
            </MenuItem>
          </>)}
        </PopoverContent>
      </Popover>
    </>
  )

  return (
    <>
      <StudioPageHeader layout="bar" base={base} modules={modules} title={title ? `Compose: ${title}` : 'Compose'} actions={actions} />
      {kpis}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-[10px] lg:gap-[10px] xl:grid-cols-[minmax(0,403fr)_minmax(0,555fr)_minmax(0,286fr)]">
        {/* ── Editor ─────────────────────────────────────────────────────── */}
        <Card className="flex flex-col px-3.5 pb-4 pt-3 lg:h-[625px] lg:px-[11px] lg:pb-[12px] lg:pt-[10px]" aria-label="Post editor">
          <div className="flex items-center">
            <span className={label} id="compose-channels">Select channels</span>
            <span className="ml-auto text-[11px] text-slate-400 lg:text-[9px]" aria-live="polite">{statusLabel}</span>
          </div>
          <div role="group" aria-labelledby="compose-channels" className="flex flex-wrap items-center gap-1.5 lg:gap-[5px]">
            {platforms.map(ch => (
              <span key={ch} className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#e3e7ee] bg-white pl-2 pr-1 text-[12px] text-slate-700 lg:h-[24px] lg:gap-[6px] lg:pl-[7px] lg:text-[10px]">
                <ChannelIcon channel={ch} size={13} />{CHANNEL_LABELS[ch] ?? ch}
                <button type="button" aria-label={`Remove ${CHANNEL_LABELS[ch] ?? ch}`} disabled={readOnly}
                  onClick={() => edit(setPlatforms, platforms.filter(p => p !== ch))}
                  className={cn('ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700', S_FOCUS)}><X size={11} /></button>
              </span>
            ))}
            {!readOnly && available.some(ch => !platforms.includes(ch)) && (
              <Popover>
                <PopoverTrigger label="Add channel" className={cn('inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#e3e7ee] bg-white text-slate-500 hover:bg-slate-50 lg:h-[24px] lg:w-[24px]', S_FOCUS)}>
                  <Plus size={13} />
                </PopoverTrigger>
                <PopoverContent role="menu" label="Add channel" width={190}>
                  {close => available.filter(ch => !platforms.includes(ch)).map(ch => (
                    <MenuItem key={ch} close={close} icon={<ChannelIcon channel={ch} size={13} />} onSelect={() => edit(setPlatforms, [...platforms, ch])}>
                      {CHANNEL_LABELS[ch] ?? ch}
                    </MenuItem>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
          {errors.platforms && <p className="mt-1 text-[11px] text-red-600">{errors.platforms}</p>}

          <label className={cn(label, 'mt-3 lg:mt-[10px]')} htmlFor="compose-title">Title (Internal)</label>
          <input id="compose-title" value={title} onChange={e => edit(setTitle, e.target.value)} maxLength={200} disabled={readOnly}
            placeholder="e.g. Product launch announcement" aria-invalid={Boolean(errors.title) || undefined}
            className={cn(field, 'lg:h-[26px]', errors.title && 'border-red-300')} />
          {errors.title && <p className="mt-1 text-[11px] text-red-600">{errors.title}</p>}

          <CaptionEditor value={caption} onChange={v => edit(setCaption, v)} limit={limit} density="large" label="Caption"
            readOnly={readOnly} canAssist={capabilities.assist} channel={platforms[0] ?? 'instagram'}
            onAssistError={m => notify('error', m)} placeholder="Write your caption…"
            className="mt-3 min-h-[280px] lg:mt-[10px] lg:min-h-0 lg:flex-1" />
          {errors.caption && <p className="mt-1 text-[11px] text-red-600">{errors.caption}</p>}

          <span className={cn(label, 'mt-3 lg:mt-[12px]')} id="compose-cta">Call to action (CTA)</span>
          <div role="group" aria-labelledby="compose-cta" className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap lg:gap-[6px]">
            <input value={ctaLabel} onChange={e => edit(setCtaLabel, e.target.value)} maxLength={80} disabled={readOnly}
              aria-label="CTA text" placeholder="Button text" className={cn(field, 'min-w-0 lg:w-[146px] lg:px-[8px] lg:text-[9px]!')} />
            <span className="relative inline-flex shrink-0">
              <select value={ctaButton} onChange={e => edit(setCtaButton, e.target.value)} aria-label="CTA button" disabled={readOnly}
                className={cn(field, 'w-auto appearance-none pr-6 lg:w-[80px] lg:pl-[9px] lg:pr-[18px] lg:text-[9.5px]')}>
                {CTA_BUTTONS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            </span>
            <Popover>
              <PopoverTrigger label={ctaUrl ? `CTA link: ${ctaUrl}` : 'Add CTA link'} disabled={readOnly}
                className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-[#e3e7ee] bg-white hover:bg-slate-50 lg:h-[26px] lg:w-[26px]', ctaUrl ? 'text-[#1a5cff]' : 'text-slate-500', S_FOCUS)}>
                <Link2 size={13} />
              </PopoverTrigger>
              <PopoverContent label="CTA link" width={280} className="p-2.5">
                <label className="block text-[12px] font-medium text-slate-600" htmlFor="compose-cta-url">Destination URL</label>
                <input id="compose-cta-url" value={ctaUrl} onChange={e => edit(setCtaUrl, e.target.value)} placeholder="https://"
                  className="mt-1 h-8 w-full rounded-md border border-[#dfe3ea] px-2 text-[12px] outline-none focus:border-blue-400" />
                {errors.ctaUrl && <p className="mt-1 text-[11px] text-red-600">{errors.ctaUrl}</p>}
              </PopoverContent>
            </Popover>
            <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-[12px] text-slate-700 lg:ml-[4px] lg:gap-[6px] lg:text-[8.5px]">
              Add UTM parameters
              <button type="button" role="switch" aria-checked={utm} disabled={readOnly} onClick={() => edit(setUtm, !utm)}
                className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors lg:h-[15px] lg:w-[26px]', utm ? 'bg-[#1a5cff]' : 'bg-slate-300', S_FOCUS)}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all lg:top-[2px] lg:h-[11px] lg:w-[11px]', utm ? 'left-[18px] lg:left-[12px]' : 'left-0.5')} />
                <span className="sr-only">Add UTM parameters</span>
              </button>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[134fr_235fr] lg:mt-[12px] lg:gap-[12px]">
            <div className="min-w-0">
              <label className={label} htmlFor="compose-tone">Tone of voice</label>
              <select id="compose-tone" value={tone} onChange={e => edit(setTone, e.target.value)} disabled={readOnly} className={field}>
                {AI_TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <span className={label} id="compose-labels">Labels</span>
              <div role="group" aria-labelledby="compose-labels"
                className="flex min-h-10 flex-wrap items-center gap-1 rounded-[6px] border border-[#e3e7ee] bg-white px-1.5 py-1 lg:min-h-[26px] lg:flex-nowrap lg:gap-[3px] lg:overflow-hidden lg:px-[4px] lg:py-0">
                {labels.map(l => (
                  <span key={l} className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] bg-[#f1f3f7] px-1.5 text-[11px] text-slate-600 lg:h-[17px] lg:gap-[3px] lg:px-[4px] lg:text-[8px]">
                    {l}
                    <button type="button" aria-label={`Remove label ${l}`} disabled={readOnly} onClick={() => edit(setLabels, labels.filter(x => x !== l))} className={cn('text-slate-400 hover:text-slate-700', S_FOCUS)}><X size={9} /></button>
                  </span>
                ))}
                <input value={labelInput} onChange={e => setLabelInput(e.target.value)} disabled={readOnly}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addLabel(labelInput) } }}
                  aria-label="Add label" placeholder={labels.length ? '' : 'Add label'} list="compose-label-suggestions"
                  className="min-w-[40px] flex-1 bg-transparent text-[12px] outline-none lg:min-w-0 lg:text-[9.5px]" />
                <datalist id="compose-label-suggestions">
                  {labelSuggestions.filter(s => !labels.includes(s)).map(s => <option key={s} value={s} />)}
                </datalist>
                <ChevronDown size={11} className="shrink-0 text-slate-500" aria-hidden />
              </div>
            </div>
          </div>

          <fieldset className="mt-3 lg:mt-[12px]" disabled={readOnly || !capabilities.schedule}>
            <legend className={label}>Schedule</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-slate-700 lg:gap-x-[8px] lg:gap-y-[6px] lg:text-[9px]">
              {(['now', 'later'] as ScheduleMode[]).map(m => (
                <label key={m} className="flex cursor-pointer items-center gap-2 lg:gap-[7px]">
                  <input type="radio" name="compose-schedule" checked={mode === m} onChange={() => setMode(m)} className="h-3.5 w-3.5 accent-[#1a5cff]" />
                  <span className="whitespace-nowrap">{m === 'now' ? 'Publish now' : 'Schedule for later'}</span>
                </label>
              ))}
              <div className="flex items-center gap-1.5 lg:gap-[5px]">
                {/* Native inputs keep the picker and keyboard entry; a formatted label is
                    drawn over them so the compact field reads "22 Sept 2026" / "6:51 PM". */}
                <span className={cn(field, 'relative flex w-[140px]! items-center justify-between gap-1 focus-within:border-[#9db8ff] lg:w-[86px]! lg:gap-[3px] lg:px-[6px] lg:text-[8.5px]!')}>
                  <span aria-hidden className="truncate">{date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pick a date'}</span>
                  <CalendarDays size={11} className="shrink-0 text-slate-500" aria-hidden />
                  <input type="date" value={date} onChange={e => { setDate(e.target.value); setMode('later') }} aria-label="Schedule date"
                    onClick={e => { try { e.currentTarget.showPicker() } catch { /* unsupported */ } }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
                <span className={cn(field, 'relative flex w-[110px]! items-center justify-between gap-1 focus-within:border-[#9db8ff] lg:w-[60px]! lg:gap-[3px] lg:px-[6px] lg:text-[8.5px]!')}>
                  <span aria-hidden className="truncate">{time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase() : '--:--'}</span>
                  <Clock size={10} className="shrink-0 text-slate-500" aria-hidden />
                  <input type="time" value={time} onChange={e => { setTime(e.target.value); setMode('later') }} aria-label="Schedule time"
                    onClick={e => { try { e.currentTarget.showPicker() } catch { /* unsupported */ } }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
                <span className="text-[11px] text-slate-500 lg:text-[9px]" suppressHydrationWarning>{tz}</span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 lg:ml-[172px] lg:gap-[7px]">
                <input type="radio" name="compose-schedule" checked={mode === 'queue'} onChange={() => setMode('queue')} className="h-3.5 w-3.5 accent-[#1a5cff]" />
                Add to queue
              </label>
              <select value={queuePos} onChange={e => { setQueuePos(e.target.value as 'top' | 'bottom'); setMode('queue') }} aria-label="Queue position"
                className={cn(field, 'w-auto! border-transparent lg:h-[20px] lg:w-[80px]! lg:px-1 lg:text-[8.5px]')}>
                <option value="top">Top of queue</option>
                <option value="bottom">End of queue</option>
              </select>
            </div>
            {errors.schedule && <p className="mt-1 text-[11px] text-red-600">{errors.schedule}</p>}
            {!capabilities.schedule && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Lock size={11} /> Your role can draft but not schedule.</p>}
          </fieldset>
        </Card>

        {/* ── Live preview ───────────────────────────────────────────────── */}
        <Card className="flex flex-col px-3.5 pb-3 pt-3 lg:h-[625px] lg:px-[10px] lg:pb-[10px] lg:pt-[13px]" aria-labelledby="compose-preview-title">
          <div className="flex items-center gap-2 px-1">
            <h2 id="compose-preview-title" className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">Live preview</h2>
            <span title="Previews update as you type. Engagement figures appear only once a post is published."><Info size={12} className="text-slate-400" aria-hidden /></span>
            <div role="radiogroup" aria-label="Preview device" className="ml-auto inline-flex rounded-[6px] border border-[#e3e7ee] bg-white p-0.5 lg:mr-[138px]">
              {([['mobile', Smartphone], ['desktop', Monitor]] as const).map(([d, Icon]) => (
                <button key={d} type="button" role="radio" aria-checked={device === d} aria-label={`${d} preview`} onClick={() => setDevice(d)}
                  className={cn('flex h-8 w-9 items-center justify-center rounded-[4px] lg:h-[22px] lg:w-[28px]', S_FOCUS, device === d ? 'bg-[#eef3ff] text-[#1a5cff] ring-1 ring-inset ring-[#c9d8ff]' : 'text-slate-500')}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>
          {platforms.length === 0 ? (
            <EmptyBlock title="No channels selected" message="Add a channel on the left to see how the post will look." />
          ) : (
            <div className={cn('mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto lg:mt-[16px] lg:gap-[8px]', device === 'mobile' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
              {platforms.slice(0, device === 'mobile' ? 3 : 2).map(ch => (
                <div key={ch} className="min-w-0 rounded-[8px] border border-[#eceff4] px-1.5 pb-1.5 pt-2 lg:px-[4px]">
                  <p className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-medium text-slate-800 lg:mb-[12px] lg:text-[10px]"><ChannelIcon channel={ch} size={14} />{CHANNEL_LABELS[ch] ?? ch}</p>
                  <SocialPreview channel={ch} account={accountFor(ch)} content={previewContent} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Right rail ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-3 lg:gap-[10px] xl:row-span-2">
          <Card className="px-3.5 pb-3 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[15px]" aria-labelledby="compose-assets-title">
            <CardHeader id="compose-assets-title" title="Asset picker" titleClassName="lg:text-[12px]" action={<Link href={`${base}/media`} className="text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[10px]">See all</Link>} />
            <div role="tablist" aria-label="Asset type" className="mt-2 flex border-b border-[#eceff4] lg:mt-[9px]">
              {(['images', 'videos', 'gifs', 'templates'] as const).map(t => (
                <button key={t} type="button" role="tab" aria-selected={assetTab === t} onClick={() => setAssetTab(t)}
                  className={cn('relative h-9 flex-1 rounded-t-md text-[12px] font-medium lg:h-[28px] lg:text-[9.5px]', S_FOCUS,
                    assetTab === t ? 'bg-[#f3f6ff] text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-600 hover:text-slate-900')}>
                  {t === 'gifs' ? 'GIFs' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="mt-2 lg:mt-[9px]">
              {assetTab === 'templates' ? (
                templates.length === 0 ? <p className="py-6 text-center text-[12px] text-slate-500">No approved templates yet.</p> : (
                  <ul className="grid grid-cols-3 gap-1.5 lg:gap-[4px]">
                    {templates.map(t => (
                      <li key={t.id}>
                        <button type="button" onClick={() => applyTemplate(t)} disabled={readOnly} title={`Use ${t.name}`} aria-label={`Use template ${t.name}`}
                          className={cn('relative block aspect-[86/78] w-full overflow-hidden rounded-[5px] bg-slate-100', S_FOCUS)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {t.url && <img src={t.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : pickerRows.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-slate-500">No {assetTab === 'gifs' ? 'GIFs' : assetTab} in the library yet.</p>
              ) : (
                <ul className="grid grid-cols-3 gap-1.5 lg:gap-[4px]">
                  {pickerRows.map(asset => {
                    const on = selected.some(a => a.id === asset.id)
                    return (
                      <li key={asset.id}>
                        <button type="button" onClick={() => toggleAsset(asset)} aria-pressed={on} disabled={readOnly}
                          aria-label={`${on ? 'Remove' : 'Attach'} ${asset.name}`}
                          className={cn('relative block aspect-[86/78] w-full overflow-hidden rounded-[5px] bg-slate-100', S_FOCUS, on && 'ring-2 ring-[#1a5cff]')}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {asset.url && <img src={asset.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                          {asset.type === 'video' && <span className="absolute inset-0 flex items-center justify-center"><Play className="h-5 w-5 fill-white text-white drop-shadow" aria-hidden /></span>}
                          {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#1a5cff] text-white"><Check size={10} strokeWidth={3} /></span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {capabilities.upload && (
              <button type="button" onClick={() => setUploadOpen(true)}
                className={cn('mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#f3f6fc] text-[12px] font-medium text-[#1a5cff] hover:bg-[#eaf0ff] lg:mt-[9px] lg:h-[30px] lg:text-[10px]', S_FOCUS)}>
                <Upload size={12} /> Upload media
              </button>
            )}
          </Card>

          <Card className="px-3.5 pb-3 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[13px]" aria-labelledby="compose-quality-title">
            <h2 id="compose-quality-title" className="text-[14px] font-semibold text-slate-900 lg:text-[12px]">Content quality</h2>
            <div className="mt-2 flex items-center gap-4 lg:mt-[8px] lg:gap-[18px]">
              <ScoreRing score={quality.score} label={scoreLabel} />
              <ul className="min-w-0 flex-1 space-y-2 lg:space-y-[9px]">
                {(['readability', 'engagement', 'hashtags', 'cta', 'length'] as const).map(key => {
                  const check = quality.checks[key]!
                  return (
                    <li key={key} className="flex items-center gap-1.5 text-[12px] lg:text-[9px]">
                      <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded-full', check.pass ? 'bg-[#e8f7ee] text-[#1c9b52]' : 'bg-[#fff4e0] text-[#d98a06]')} aria-hidden>
                        {check.pass ? <Check size={9} strokeWidth={3} /> : '!'}
                      </span>
                      <span className="text-slate-600">{check.label}</span>
                      <span className={cn('ml-auto truncate pl-2 font-medium', check.pass ? 'text-[#1c9b52]' : 'text-[#c77a05]')} title={check.detail}>{check.pass ? check.detail : 'Improve'}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <button type="button" onClick={() => setTipsOpen(true)}
              className={cn('mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#f3f6fc] text-[12px] font-medium text-[#1a5cff] hover:bg-[#eaf0ff] lg:mt-[12px] lg:h-[30px] lg:text-[10px]', S_FOCUS)}>
              <Sparkles size={12} /> View optimisation tips
            </button>
          </Card>

          <Card className="px-3.5 pb-3 pt-3 lg:px-[13px] lg:pb-[10px] lg:pt-[12px]" aria-labelledby="compose-history-title">
            <CardHeader id="compose-history-title" title="Version history" titleClassName="lg:text-[12px]"
              action={versions.length > 2 ? <button type="button" onClick={() => setHistoryOpen(true)} className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[10px]', S_FOCUS)}>See all</button> : undefined} />
            {!id ? <p className="py-3 text-[12px] text-slate-500 lg:text-[10px]">Versions appear once the draft is saved.</p> : (
              <ul className="mt-2 space-y-2 lg:mt-[9px] lg:space-y-[9px]">
                <VersionItem number={currentVersion} at={content?.updated_at ?? new Date(now).toISOString()} by={personName(content?.owner)} current />
                {versions.slice(0, 2).map(v => (
                  <VersionItem key={v.id} number={v.version_number} at={v.created_at} by={personName(v.author)}
                    onRestore={readOnly ? undefined : () => restore(v.id, v.version_number)} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col px-3.5 pb-3 pt-3 lg:px-[13px] lg:pb-[12px] lg:pt-[13px]" aria-labelledby="compose-comments-title">
            <CardHeader id="compose-comments-title" title="Comments" titleClassName="lg:text-[12px]"
              action={capabilities.comment ? <button type="button" onClick={() => { setReplyTo(null); replyRef.current?.focus() }} className={cn('text-[12px] font-medium text-[#1a5cff] hover:underline lg:text-[10px]', S_FOCUS)}>Add comment</button> : undefined} />
            {comments.length === 0 ? (
              <p className="py-3 text-[12px] text-slate-500 lg:text-[10px]">No comments yet. Ask a teammate for feedback.</p>
            ) : (
              <ul className="mt-2 max-h-[240px] space-y-2 overflow-y-auto lg:mt-[10px] lg:max-h-[100px]">
                {comments.filter(c => !c.parent_id).map(c => (
                  <li key={c.id}>
                    <Comment row={c} now={now} onReply={capabilities.comment ? () => { setReplyTo(c.id); replyRef.current?.focus() } : undefined} />
                    {comments.filter(r => r.parent_id === c.id).map(r => (
                      <div key={r.id} className="ml-6 mt-2 lg:ml-[22px] lg:mt-[8px]"><Comment row={r} now={now} /></div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {capabilities.comment && (
              <form onSubmit={e => { e.preventDefault(); postComment() }} className="mt-3 flex items-center gap-2 lg:mt-[10px]">
                <MessageSquare size={14} className="shrink-0 text-slate-400" aria-hidden />
                <input ref={replyRef} value={reply} onChange={e => setReply(e.target.value)} maxLength={4000}
                  aria-label={replyTo ? 'Reply to comment' : 'Add a comment'} placeholder={replyTo ? 'Add a reply…' : 'Add a comment…'}
                  className="h-10 min-w-0 flex-1 rounded-[6px] border border-[#e3e7ee] px-2.5 text-[13px] outline-none focus:border-[#9db8ff] lg:h-[28px] lg:text-[10px]" />
                {reply.trim() && <Btn type="submit" variant="primary" size="sm" disabled={pending}>Post</Btn>}
              </form>
            )}
          </Card>
        </div>

        {/* ── Recent drafts (server-rendered) ────────────────────────────── */}
        <div className="min-w-0 xl:col-span-2">{recentDrafts}</div>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)}
        onComplete={ids => notify('success', `${ids.length} file${ids.length === 1 ? '' : 's'} uploaded. Select ${ids.length === 1 ? 'it' : 'them'} in the picker to attach.`)} />

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" size="xl"
        description="How this post will appear on each selected channel.">
        <div className={cn('grid gap-4', device === 'mobile' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
          {platforms.map(ch => <SocialPreview key={ch} channel={ch} account={accountFor(ch)} content={previewContent} />)}
        </div>
      </Dialog>

      <Dialog open={tipsOpen} onClose={() => setTipsOpen(false)} title="Optimisation tips" size="md"
        description={`Score ${quality.score}/100. Each check is worth an equal share of the score.`}>
        <ul className="space-y-2.5">
          {Object.entries(quality.checks).map(([key, check]) => (
            <li key={key} className="flex items-start gap-2.5 rounded-lg border border-[#eceff4] px-3 py-2.5">
              <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', check.pass ? 'bg-[#e8f7ee] text-[#1c9b52]' : 'bg-[#fff4e0] text-[#d98a06]')} aria-hidden>
                {check.pass ? <Check size={10} strokeWidth={3} /> : '!'}
              </span>
              <span>
                <span className="block text-[13px] font-medium text-slate-800">{check.label}</span>
                <span className="block text-[12px] text-slate-500">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Version history" size="md"
        description="Restoring a version keeps your current text as a new entry in history.">
        <ul className="space-y-2">
          {versions.map(v => (
            <li key={v.id} className="rounded-lg border border-[#eceff4] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#f1f3f7] px-2 py-0.5 text-[11px] font-medium text-slate-600">V{v.version_number}</span>
                <span className="text-[12px] text-slate-600">{new Date(v.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {personName(v.author)}</span>
                {!readOnly && <Btn size="xs" className="ml-auto" onClick={() => restore(v.id, v.version_number)}>Restore</Btn>}
              </div>
              {v.change_note && <p className="mt-1 text-[12px] text-slate-500">{v.change_note}</p>}
              <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12px] text-slate-700">{v.caption}</p>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this draft?" size="sm"
        description="The draft, its versions and comments are removed permanently. This cannot be undone."
        footer={<><Btn size="md" onClick={() => setConfirmDelete(false)}>Cancel</Btn><Btn size="md" variant="danger" onClick={remove} disabled={pending}>Delete draft</Btn></>}>
        <p className="text-[13px] text-slate-600">“{title || 'Untitled'}”</p>
      </Dialog>
    </>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 34
  const c = 2 * Math.PI * r
  const tone: Tone = score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red'
  const stroke = tone === 'green' ? '#22a55b' : tone === 'amber' ? '#e59a0b' : '#e04848'
  return (
    <div className="relative h-[92px] w-[92px] shrink-0 lg:h-[80px] lg:w-[80px]" role="img" aria-label={`Content quality ${score} out of 100, ${label}`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#edf0f4" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-semibold leading-none text-slate-900 lg:text-[19px]">{score}</span>
        <span className="mt-0.5 text-[10px] text-slate-500 lg:text-[8.5px]">{label}</span>
      </span>
    </div>
  )
}

function VersionItem({ number, at, by, current, onRestore }: { number: number; at: string; by: string; current?: boolean; onRestore?: () => void }) {
  return (
    <li className="flex items-center gap-2.5 lg:gap-[10px]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f1f3f7] text-[10px] font-semibold text-slate-600 lg:h-[22px] lg:w-[22px] lg:text-[8px]">V{number}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[12px] text-slate-700 lg:text-[9px]">{new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
        <span className="block text-[11px] text-slate-500 lg:text-[8.5px]">{by}</span>
      </span>
      {current
        ? <span className="rounded-[4px] bg-[#e8f7ee] px-2 py-0.5 text-[11px] font-medium text-[#1c9b52] lg:px-[8px] lg:text-[8.5px]">Current</span>
        : onRestore && <button type="button" onClick={onRestore} className={cn('text-[11px] font-medium text-[#1a5cff] hover:underline lg:text-[9px]', S_FOCUS)}>Restore</button>}
    </li>
  )
}

function Comment({ row, now, onReply }: { row: ContentCommentRow; now: number; onReply?: () => void }) {
  return (
    <div className="flex items-start gap-2 lg:gap-[8px]">
      <PersonAvatar person={row.author} size={20} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] lg:text-[9px]"><span className="font-semibold text-slate-800">{personName(row.author)}</span> <span className="text-slate-400">{fmtAgo(row.created_at, now)}</span></p>
        <p className="whitespace-pre-line break-words text-[12px] text-slate-700 lg:text-[9.5px]">{row.body}</p>
        {onReply && <button type="button" onClick={onReply} className={cn('mt-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 lg:text-[8.5px]', S_FOCUS)}>Reply</button>}
      </div>
    </div>
  )
}
