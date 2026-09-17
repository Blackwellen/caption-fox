'use client'

import { createContext, useContext, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { ChannelIcon } from '@/components/home/brand-icons'
import { CHANNEL_LABELS, captionLimitFor } from '@/lib/studio/constants'
import { extractHashtags } from '@/lib/studio/text-format'
import { saveContent, scheduleContent, setContentStatus } from '@/lib/studio/actions/content'
import CaptionEditor, { type CaptionEditorHandle } from '../CaptionEditor'
import SocialPreview, { type PreviewAccountLite } from '../SocialPreview'
import { Dialog, MenuItem, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { UploadDialog } from '../MediaUploader'
import { Btn, Card, CardHeader, EmptyBlock, S_FOCUS, TextLink, btnClass } from '../ui'

export interface ComposerAsset { id: string; name: string; url: string | null; type: string }

interface ComposerState {
  caption: string
  setCaption: (v: string) => void
  selected: string[]
  toggleAsset: (id: string) => void
  assets: ComposerAsset[]
  channels: string[]
  setChannels: (v: string[]) => void
  editor: React.RefObject<CaptionEditorHandle | null>
  draftId: string | undefined
  setDraftId: (v: string | undefined) => void
  uploadOpen: boolean
  setUploadOpen: (v: boolean) => void
}

const Ctx = createContext<ComposerState | null>(null)
const useComposer = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Overview composer parts must be inside <OverviewComposerProvider>')
  return ctx
}

/** Shares the quick composer's draft between the editor, previews and the assets rail. */
export function OverviewComposerProvider({ children, assets, channels: initialChannels, draft }: {
  children: React.ReactNode
  assets: ComposerAsset[]
  channels: string[]
  /** The user's latest own draft, resumed so saving updates it rather than duplicating it. */
  draft?: { id: string; caption: string; platforms: string[]; assetIds: string[] } | null
}) {
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [selected, setSelected] = useState<string[]>(draft?.assetIds ?? [])
  const [channels, setChannels] = useState(draft?.platforms.length ? [...new Set([...draft.platforms, ...initialChannels])].slice(0, 3) : initialChannels)
  const [draftId, setDraftId] = useState<string | undefined>(draft?.id)
  const [uploadOpen, setUploadOpen] = useState(false)
  const editor = useRef<CaptionEditorHandle | null>(null)
  const value = useMemo<ComposerState>(() => ({
    caption, setCaption, selected, assets, channels, setChannels, editor, uploadOpen, setUploadOpen, draftId, setDraftId,
    toggleAsset: id => setSelected(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id].slice(0, 10))),
  }), [caption, selected, assets, channels, uploadOpen, draftId])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function titleFrom(caption: string): string {
  const first = caption.split('\n').map(l => l.trim()).find(Boolean) ?? ''
  return (first.replace(/#[\p{L}\p{N}_]+/gu, '').trim() || 'Untitled post').slice(0, 80)
}

export function OverviewComposer({ base, canCompose, canSchedule, canAssist, accounts, allChannels }: {
  base: string
  canCompose: boolean
  canSchedule: boolean
  canAssist: boolean
  accounts: Record<string, PreviewAccountLite>
  allChannels: string[]
}) {
  const { caption, setCaption, selected, assets, channels, setChannels, editor, setUploadOpen, draftId, setDraftId } = useComposer()
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [when, setWhen] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [tab, setTab] = useState(channels[0] ?? 'instagram')
  const [slide, setSlide] = useState(0)
  const limit = captionLimitFor(channels)
  const selectedAssets = selected.map(id => assets.find(a => a.id === id)).filter((a): a is ComposerAsset => Boolean(a))
  const current = selectedAssets[Math.min(slide, Math.max(0, selectedAssets.length - 1))] ?? null
  const activeTab = channels.includes(tab) ? tab : channels[0] ?? 'instagram'

  async function persist(): Promise<string | undefined> {
    if (!caption.trim()) { notify('error', 'Write your post before saving.'); return undefined }
    if (channels.length === 0) { notify('error', 'Choose at least one channel in Customize.'); return undefined }
    const result = await saveContent({
      id: draftId, title: titleFrom(caption), internalTitle: titleFrom(caption), caption,
      platforms: channels, hashtags: extractHashtags(caption), assetIds: selected, source: 'manual', origin: 'quick_composer',
    })
    if (!result.ok) {
      notify('error', result.fieldErrors ? Object.values(result.fieldErrors)[0]! : result.error ?? 'Could not save the draft.')
      return undefined
    }
    setDraftId(result.id)
    return result.id
  }

  const saveDraft = () => start(async () => {
    const id = await persist()
    if (id) { notify('success', 'Draft saved to your Content Library.'); router.refresh() }
  })

  const schedule = () => start(async () => {
    if (!when) { notify('error', 'Pick a date and time in “Schedule for later” first.'); return }
    const id = await persist()
    if (!id) return
    const result = await scheduleContent({ id, scheduledAt: new Date(when).toISOString() })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Post scheduled.' : result.error ?? 'Could not schedule.')
    if (result.ok) { setCaption(''); setDraftId(undefined); setWhen(''); router.refresh() }
  })

  const requestReview = () => start(async () => {
    const id = await persist()
    if (!id) return
    const result = await setContentStatus({ id, status: 'pending_approval' })
    notify(result.ok ? 'success' : 'error', result.ok ? 'Sent for review.' : result.error ?? 'Could not request review.')
    if (result.ok) { setCaption(''); setDraftId(undefined); router.refresh() }
  })

  const openInCompose = () => start(async () => {
    const id = await persist()
    if (id) router.push(`${base}/compose?id=${id}`)
  })

  const previewContent = { caption, mediaUrl: current?.url ?? null, mediaType: current?.type === 'video' ? 'video' as const : 'image' as const }
  const accountFor = (channel: string): PreviewAccountLite => accounts[channel] ?? { name: 'Your account', handle: 'your_account', avatar_url: null, followers: null }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,548fr)_minmax(0,376fr)] lg:gap-1">
      <Card className="flex flex-col px-4 pb-4 pt-5 lg:h-[380px] lg:px-[15px] lg:pb-[14px] lg:pt-[19px]" aria-labelledby="quick-compose-title">
        <CardHeader id="quick-compose-title" title="Compose New Post" />
        {canCompose ? (
          <>
            <CaptionEditor ref={editor} value={caption} onChange={setCaption} limit={limit} density="compact"
              label="Post caption" placeholder="Unlock your brand’s full potential with smarter content…"
              canAssist={canAssist} channel={activeTab} onAssistError={m => notify('error', m)}
              onRequestMedia={() => setUploadOpen(true)} className="mt-3 min-h-0 flex-1 lg:mt-[13px]" />
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 lg:mt-[12px] lg:gap-[8px]">
              <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Preview on all channels"
                className={btnClass('secondary', 'sm', 'w-9 px-0 lg:w-[30px] lg:h-[30px]')}><Eye size={14} /></button>
              <Btn size="sm" className="lg:h-[30px] lg:px-3.5" onClick={saveDraft} disabled={pending}>Save Draft</Btn>
              <label className={cn(btnClass('secondary', 'sm', 'relative gap-1.5 lg:h-[30px] lg:min-w-[135px] lg:justify-between lg:text-[10.5px]'), 'cursor-pointer')}>
                <CalendarDays size={13} className="text-slate-500" aria-hidden />
                <span className={cn('truncate', when ? 'text-slate-800' : 'text-slate-600')}>
                  {when ? new Date(when).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Schedule for later'}
                </span>
                <ChevronDown size={12} className="text-slate-400" aria-hidden />
                <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} aria-label="Schedule for later"
                  onFocus={e => { e.currentTarget.min = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16) }}
                  className="absolute inset-0 cursor-pointer opacity-0" disabled={!canSchedule} />
              </label>
              <div className="inline-flex">
                <Btn variant="primary" size="sm" className="rounded-r-none lg:h-[30px] lg:w-[64px]" onClick={schedule} disabled={pending || !canSchedule}
                  title={canSchedule ? undefined : 'Your role cannot schedule content'}>Schedule</Btn>
                <Popover>
                  <PopoverTrigger haspopup="menu" label="More publishing options"
                    className={btnClass('primary', 'sm', 'rounded-l-none border-l border-l-white/25 px-2 lg:h-[30px] lg:w-[26px] lg:px-0')}>
                    <ChevronDown size={13} />
                  </PopoverTrigger>
                  <PopoverContent role="menu" label="Publishing options" width={200} align="end">
                    {close => (<>
                      <MenuItem close={close} onSelect={requestReview}>Request review</MenuItem>
                      <MenuItem close={close} onSelect={openInCompose}>Open in Compose</MenuItem>
                      <MenuItem close={close} onSelect={saveDraft}>Save as draft</MenuItem>
                    </>)}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </>
        ) : (
          <EmptyBlock title="You don’t have compose access" message="Ask a workspace admin for the Studio compose permission." />
        )}
      </Card>

      <Card className="flex flex-col pb-3 pt-5 lg:h-[380px] lg:pb-[10px] lg:pt-[19px]" aria-labelledby="channel-previews-title">
        <CardHeader id="channel-previews-title" title="Channel Previews" className="px-4 lg:px-[17px]"
          action={(
            <Popover>
              <PopoverTrigger label="Customize preview channels" className={cn('text-[13px] font-medium text-[#1a5cff] hover:underline lg:text-[11px]', S_FOCUS)}>
                Customize
              </PopoverTrigger>
              <PopoverContent label="Channels" width={220} align="end" className="p-2">
                <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Publish to</p>
                {allChannels.map(ch => (
                  <label key={ch} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={channels.includes(ch)} className="accent-[#1a5cff]"
                      onChange={e => setChannels(e.target.checked ? [...channels, ch] : channels.filter(c => c !== ch))} />
                    <ChannelIcon channel={ch} size={15} />{CHANNEL_LABELS[ch] ?? ch}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          )} />
        <div role="tablist" aria-label="Preview channel" className="mt-3 flex border-b border-[#eceff4] px-2 lg:mt-[12px] lg:px-[8px]">
          {channels.slice(0, 4).map(ch => (
            <button key={ch} type="button" role="tab" aria-selected={activeTab === ch} onClick={() => setTab(ch)}
              className={cn('relative inline-flex h-10 items-center gap-1.5 rounded-t-md px-3 text-[13px] font-medium lg:h-[32px] lg:w-[106px] lg:justify-center lg:text-[10.5px]', S_FOCUS,
                activeTab === ch ? 'bg-[#f5f8ff] text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-700 hover:text-slate-900')}>
              <ChannelIcon channel={ch} size={14} />{CHANNEL_LABELS[ch] ?? ch}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="flex min-h-0 flex-1 flex-col items-center px-4 pt-3 lg:px-[25px] lg:pt-[10px]">
          <SocialPreview channel={activeTab} account={accountFor(activeTab)} content={previewContent} size="sm" className="w-full" />
          <div className="mt-auto flex items-center gap-4 pt-2 lg:gap-[26px]">
            <button type="button" aria-label="Previous media" disabled={selectedAssets.length < 2} onClick={() => setSlide(s => Math.max(0, s - 1))}
              className={cn('rounded p-1 text-slate-600 disabled:opacity-40', S_FOCUS)}><ChevronLeft size={14} /></button>
            <span className="flex gap-1.5" aria-label={`Media ${Math.min(slide + 1, Math.max(1, selectedAssets.length))} of ${Math.max(1, selectedAssets.length)}`}>
              {Array.from({ length: Math.max(1, selectedAssets.length) }).map((_, i) => (
                <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === Math.min(slide, Math.max(0, selectedAssets.length - 1)) ? 'bg-[#1a5cff]' : 'bg-slate-200')} />
              ))}
            </span>
            <button type="button" aria-label="Next media" disabled={selectedAssets.length < 2} onClick={() => setSlide(s => Math.min(selectedAssets.length - 1, s + 1))}
              className={cn('rounded p-1 text-slate-600 disabled:opacity-40', S_FOCUS)}><ChevronRight size={14} /></button>
          </div>
        </div>
      </Card>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview on every channel" size="xl"
        description="Previews update from your draft. Engagement appears only once a post is published.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map(ch => <SocialPreview key={ch} channel={ch} account={accountFor(ch)} content={previewContent} />)}
        </div>
      </Dialog>
    </div>
  )
}

export function OverviewAssets({ base, canUpload, collections }: { base: string; canUpload: boolean; collections: { id: string; name: string }[] }) {
  const { assets, selected, toggleAsset, uploadOpen, setUploadOpen } = useComposer()
  return (
    <section aria-labelledby="overview-assets-title" className="border-t border-[#e6e9f0] px-4 pb-4 pt-4 lg:px-[16px] lg:pb-[12px] lg:pt-[12px]">
      <CardHeader id="overview-assets-title" title="Assets" action={<TextLink href={`${base}/media`}>View all</TextLink>} />
      {assets.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-slate-500">No ready assets yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 lg:mt-[10px] lg:gap-[11px]">
          {assets.map(asset => {
            const on = selected.includes(asset.id)
            return (
              <li key={asset.id}>
                <button type="button" onClick={() => toggleAsset(asset.id)} aria-pressed={on}
                  aria-label={`${on ? 'Remove' : 'Attach'} ${asset.name} ${on ? 'from' : 'to'} the draft`}
                  className={cn('relative block aspect-square w-full overflow-hidden rounded-[6px] bg-slate-100 lg:aspect-[74/71]', S_FOCUS, on && 'ring-2 ring-[#1a5cff] ring-offset-1')}>
                  {asset.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {on && <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-bl-md bg-[#1a5cff] text-white"><Check size={12} strokeWidth={3} /></span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {canUpload && (
        <button type="button" onClick={() => setUploadOpen(true)}
          className={cn('mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[7px] border border-dashed border-[#bcd0ff] bg-[#f7f9ff] text-[13px] font-medium text-[#1a5cff] hover:bg-[#eef3ff] lg:mt-[11px] lg:h-[36px] lg:text-[11px]', S_FOCUS)}>
          <Upload size={14} aria-hidden /> Upload Asset
        </button>
      )}
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} collections={collections}
        onComplete={() => undefined} />
      <Link href={`${base}/media`} className="sr-only">Open the Media library</Link>
    </section>
  )
}
