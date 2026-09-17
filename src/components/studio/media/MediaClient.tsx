'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Check, ChevronDown, Crop, Download, FileText, FolderUp, Info, Maximize2, MoreHorizontal, PenLine, Play, Plus, RefreshCw, Search,
  Star, Tag, User, X, Layers, Link2, Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import {
  bulkMediaAction, createMediaCollection, deleteMediaAsset, downloadMediaAsset, setMediaStatus, toggleMediaFavourite,
  updateMediaAsset,
} from '@/lib/studio/actions/media'
import type { ActivityRow, AssetVersionRow, MediaRow } from '@/lib/studio/types'
import { DropZone, UploadDialog, UploadQueue, openFolderPicker, useMediaUpload } from '../MediaUploader'
import { Dialog, MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from '../overlays'
import { Btn, PersonAvatar, S_FOCUS, btnClass, fmtAgo, fmtBytes, fmtDate, fmtDateTime, personName } from '../ui'
import { STATUS_PILL, kindLabel, statusLabel } from './media-kind'
import { CROPPABLE_MIME, CropDialog } from './CropDialog'

export interface MediaPerms { upload: boolean; edit: boolean; approve: boolean; remove: boolean }
export interface CollectionOption { id: string; name: string }

function useQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
}

function Thumb({ asset, className, big = false, duration = true }: { asset: MediaRow; className?: string; big?: boolean; duration?: boolean }) {
  const src = asset.thumbnail_path ?? (asset.mime_type?.startsWith('image/') ? asset.file_url : null)
  const isVideo = asset.mime_type?.startsWith('video/')
  return (
    <span className={cn('relative block overflow-hidden bg-[#f1f3f7]', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={asset.alt_text ?? ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        : <span className="absolute inset-0 flex items-center justify-center text-slate-400"><FileText size={big ? 40 : 22} aria-hidden /></span>}
      {isVideo && duration && asset.duration_seconds ? (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white lg:text-[8.5px]">
          {String(Math.floor(asset.duration_seconds / 60)).padStart(2, '0')}:{String(Math.round(asset.duration_seconds % 60)).padStart(2, '0')}
        </span>
      ) : null}
      {isVideo && big && <span className="absolute inset-0 flex items-center justify-center"><Play className="h-10 w-10 fill-white text-white drop-shadow" aria-hidden /></span>}
    </span>
  )
}

// ── Grid card ────────────────────────────────────────────────────────────────
export function MediaCard({ asset, selected, perms }: { asset: MediaRow; selected: boolean; perms: MediaPerms }) {
  const set = useQuery()
  return (
    <article className={cn('relative rounded-[8px] border bg-white p-1.5 lg:p-[5px]', selected ? 'border-[#1a5cff] ring-1 ring-[#1a5cff]' : 'border-[#e6e9f0] hover:border-[#c9d8ff]')}>
      <button type="button" onClick={() => set({ selected: selected ? 'none' : asset.id })} aria-pressed={selected} aria-label={`${selected ? 'Close' : 'Open'} ${asset.file_name}`}
        className={cn('block w-full text-left', S_FOCUS)}>
        <Thumb asset={asset} className="aspect-[126/84] rounded-[5px] lg:aspect-auto lg:h-[84px]" />
      </button>
      <span className={cn('absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border lg:h-[15px] lg:w-[15px]', selected ? 'border-[#1a5cff] bg-[#1a5cff] text-white' : 'border-white bg-white/70')} aria-hidden>
        {selected && <Check size={10} strokeWidth={3} />}
      </span>
      <div className="flex items-end gap-1 px-1 pb-0.5 pt-2 lg:pt-[12px]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[9.5px]" title={asset.file_name}>{asset.file_name}</span>
          <span className="block text-[11px] text-slate-500 lg:mt-[2px] lg:text-[8.5px]">{kindLabel(asset.mime_type, asset.file_name)} • {fmtBytes(asset.file_size ?? 0)}</span>
        </span>
        <AssetMenu asset={asset} perms={perms} />
      </div>
    </article>
  )
}

// ── Row / card menu ──────────────────────────────────────────────────────────
export function AssetMenu({ asset, perms, icon, triggerClassName }: { asset: MediaRow; perms: MediaPerms; icon?: React.ReactNode; triggerClassName?: string }) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [changes, setChanges] = useState(false)
  const [note, setNote] = useState('')
  const [replace, setReplace] = useState(false)

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) => start(async () => {
    const result = await fn()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) { after?.(); router.refresh() }
  })
  const download = () => start(async () => {
    const result = await downloadMediaAsset({ id: asset.id })
    if (!result.ok || !result.data) { notify('error', result.error ?? 'Download unavailable.'); return }
    window.open(result.data.url, '_blank', 'noopener')
  })

  return (
    <>
      <Popover>
        <PopoverTrigger haspopup="menu" label={`Actions for ${asset.file_name}`} disabled={pending}
          className={triggerClassName ?? cn('shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800', S_FOCUS)}>
          {icon ?? <MoreHorizontal size={14} />}
        </PopoverTrigger>
        <PopoverContent role="menu" label="Asset actions" width={200} align="end">
          {close => (<>
            <MenuItem close={close} onSelect={() => set({ selected: asset.id })}>Open details</MenuItem>
            <MenuItem close={close} icon={<Download size={12} />} onSelect={download}>Download</MenuItem>
            <MenuItem close={close} icon={<RefreshCw size={12} />} disabled={!perms.upload} hint="Your role cannot upload media" onSelect={() => setReplace(true)}>Replace file</MenuItem>
            <MenuSeparator />
            {asset.status !== 'ready' && asset.status !== 'archived' && <MenuItem close={close} disabled={!perms.approve} hint="Only approvers can approve media" onSelect={() => run(() => setMediaStatus({ id: asset.id, status: 'ready' }))}>Approve</MenuItem>}
            {asset.status !== 'changes_requested' && asset.status !== 'archived' && <MenuItem close={close} disabled={!perms.approve} hint="Only approvers can request changes" onSelect={() => setChanges(true)}>Request changes</MenuItem>}
            {asset.status !== 'needs_review' && asset.status !== 'archived' && <MenuItem close={close} disabled={!perms.edit} hint="Your role cannot edit media" onSelect={() => run(() => setMediaStatus({ id: asset.id, status: 'needs_review' }))}>Send for review</MenuItem>}
            {asset.status === 'archived'
              ? <MenuItem close={close} disabled={!perms.edit} onSelect={() => run(() => setMediaStatus({ id: asset.id, status: 'ready' }))}>Restore</MenuItem>
              : <MenuItem close={close} disabled={!perms.edit} hint="Your role cannot edit media" onSelect={() => run(() => setMediaStatus({ id: asset.id, status: 'archived' }), () => set({ selected: 'none' }))}>Archive</MenuItem>}
            <MenuItem close={close} danger disabled={!perms.remove} hint="Your role cannot delete media"
              onSelect={() => { if (confirm(`Delete “${asset.file_name}” permanently? This cannot be undone.`)) run(() => deleteMediaAsset({ id: asset.id }), () => set({ selected: 'none' })) }}>
              Delete
            </MenuItem>
          </>)}
        </PopoverContent>
      </Popover>
      <Dialog open={changes} onClose={() => setChanges(false)} title="Request changes" size="sm" description="The uploader sees this note on the asset."
        footer={<><Btn size="md" onClick={() => setChanges(false)}>Cancel</Btn><Btn size="md" variant="primary" disabled={!note.trim() || pending} onClick={() => run(() => setMediaStatus({ id: asset.id, status: 'changes_requested', note }), () => { setChanges(false); setNote('') })}>Send</Btn></>}>
        <textarea data-autofocus value={note} onChange={e => setNote(e.target.value.slice(0, 500))} rows={4} aria-label="What needs to change"
          className="block w-full resize-none rounded-lg border border-[#dfe3ea] p-2.5 text-[13px] outline-none focus:border-blue-400" />
      </Dialog>
      {replace && <UploadDialog open onClose={() => setReplace(false)} replaceAssetId={asset.id} onComplete={() => notify('success', 'File replaced. The previous file is kept as a version.')} />}
    </>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────
export function AssetDetail({ asset, versions, history, collections, perms, now }: {
  asset: MediaRow
  versions: AssetVersionRow[]
  history: ActivityRow[]
  collections: CollectionOption[]
  perms: MediaPerms
  now: number
}) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<'details' | 'metadata' | 'history' | 'versions'>('details')
  const [fav, setFav] = useState(Boolean(asset.is_favourite))
  const [preview, setPreview] = useState(false)
  const [replace, setReplace] = useState(false)
  const [cropping, setCropping] = useState(false)
  const [form, setForm] = useState({
    fileName: asset.file_name, altText: asset.alt_text ?? '', description: asset.description ?? '',
    tags: (asset.tags ?? []).join(', '), collectionId: asset.collection_id ?? '',
  })

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const result = await fn()
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Something went wrong.')
    if (result.ok) router.refresh()
  })
  const download = () => start(async () => {
    const result = await downloadMediaAsset({ id: asset.id })
    if (!result.ok || !result.data) { notify('error', result.error ?? 'Download unavailable.'); return }
    window.open(result.data.url, '_blank', 'noopener')
  })

  const tags = asset.tags ?? []
  const row = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-2 py-1.5 lg:gap-[8px] lg:py-[5px]">
      <dt className="flex w-[110px] shrink-0 items-center gap-2 text-[12px] text-slate-600 lg:w-[100px] lg:gap-[10px] lg:text-[9.5px]"><span className="text-slate-500" aria-hidden>{icon}</span>{label}</dt>
      <dd className="min-w-0 flex-1 text-[12px] text-slate-800 lg:text-[9.5px]">{value}</dd>
    </div>
  )
  const input = 'mt-1 block w-full rounded-md border border-[#dfe3ea] px-2 text-[12px] outline-none focus:border-blue-400 disabled:bg-slate-50 lg:text-[10px]'

  return (
    <section aria-labelledby="asset-detail-title" className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-3 pt-3 lg:px-[12px] lg:pt-[10px]">
        <Circle size={12} className="text-slate-400" aria-hidden />
        <h2 id="asset-detail-title" className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900 lg:text-[11.5px]">{asset.file_name}</h2>
        <button type="button" aria-pressed={fav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} disabled={pending}
          onClick={() => start(async () => { setFav(v => !v); const r = await toggleMediaFavourite({ id: asset.id }); if (!r.ok) { setFav(Boolean(asset.is_favourite)); notify('error', r.error ?? 'Could not update.') } })}
          className={cn('rounded p-1 hover:bg-slate-100', S_FOCUS)}><Star size={14} className={fav ? 'fill-[#f5a524] text-[#f5a524]' : 'text-slate-500'} /></button>
        <button type="button" aria-label="Open large preview" onClick={() => setPreview(true)} className={cn('rounded p-1 text-slate-500 hover:bg-slate-100', S_FOCUS)}><Maximize2 size={13} /></button>
        <button type="button" aria-label="Close details" onClick={() => set({ selected: 'none' })} className={cn('rounded p-1 text-slate-500 hover:bg-slate-100', S_FOCUS)}><X size={15} /></button>
      </header>
      <button type="button" onClick={() => setPreview(true)} className={cn('mx-3 mt-2 block lg:mx-[12px] lg:mt-[10px]', S_FOCUS)} aria-label="Open large preview">
        <Thumb asset={asset} big className="aspect-[16/6] rounded-[6px] lg:aspect-auto lg:h-[124px]" />
      </button>
      <div role="tablist" aria-label="Asset information" className="mx-3 mt-3 flex gap-4 border-b border-[#eceff4] lg:mx-[12px] lg:mt-[12px] lg:gap-[8px]">
        {([['details', 'Details'], ['metadata', 'Metadata'], ['history', 'History'], ['versions', `Versions (${versions.length + 1})`]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('relative h-9 px-1.5 text-[12px] lg:h-[26px] lg:px-[8px] lg:text-[9.5px]', S_FOCUS,
              tab === id ? 'font-medium text-[#1a5cff] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#1a5cff]' : 'text-slate-600 hover:text-slate-900')}>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-3 py-2 lg:px-[14px] lg:py-[8px]">
        {tab === 'details' && (
          <dl>
            {row(<Layers size={12} />, 'Collection', asset.collection?.name ?? <span className="text-slate-400">None</span>)}
            {row(<User size={12} />, 'Uploaded by', <span className="flex items-center gap-2"><PersonAvatar person={asset.owner} size={14} />{personName(asset.owner)}<span className="text-slate-500 lg:ml-[14px]">{fmtDateTime(asset.created_at)}</span></span>)}
            {row(<Info size={12} />, 'Status', <span className={cn('rounded-[4px] px-2 py-0.5 text-[11px] font-medium lg:text-[8.5px]', STATUS_PILL[asset.status] ?? 'bg-slate-100')}>{statusLabel(asset.status)}</span>)}
            {asset.review_note && row(<PenLine size={12} />, 'Review note', <span className="text-[#c53030]">{asset.review_note}</span>)}
            {row(<Tag size={12} />, 'Tags', tags.length ? (
              <span className="flex flex-wrap gap-1">
                {tags.slice(0, 4).map(t => <button key={t} type="button" onClick={() => set({ tag: t, page: null })} className={cn('rounded-[4px] bg-[#f1ebff] px-1.5 py-0.5 text-[11px] text-[#6d3fd6] hover:bg-[#e6dcff] lg:text-[8.5px]', S_FOCUS)}>{t}</button>)}
                {tags.length > 4 && <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 lg:text-[8.5px]">+{tags.length - 4}</span>}
              </span>
            ) : <span className="text-slate-400">No tags</span>)}
            {row(<Link2 size={12} />, 'Usage', asset.usage_count > 0 ? `Used in ${asset.usage_count} post${asset.usage_count === 1 ? '' : 's'}` : 'Not used yet')}
            {row(<FileText size={12} />, 'Description', asset.description ?? <span className="text-slate-400">No description</span>)}
            {row(<Info size={12} />, 'File info', [kindLabel(asset.mime_type, asset.file_name).toUpperCase(), asset.width && asset.height ? `${asset.width} x ${asset.height}` : null, fmtBytes(asset.file_size ?? 0), asset.colour_profile].filter(Boolean).join(' • '))}
          </dl>
        )}

        {tab === 'metadata' && (
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); run(() => updateMediaAsset({ id: asset.id, fileName: form.fileName, altText: form.altText, description: form.description, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), collectionId: form.collectionId || null })) }}>
            <fieldset disabled={!perms.edit} className="space-y-2">
              <label className="block text-[12px] font-medium text-slate-700 lg:text-[9.5px]">File name<input value={form.fileName} maxLength={200} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className={cn(input, 'h-8 lg:h-[26px]')} /></label>
              <label className="block text-[12px] font-medium text-slate-700 lg:text-[9.5px]">Alt text<input value={form.altText} maxLength={500} onChange={e => setForm(f => ({ ...f, altText: e.target.value }))} className={cn(input, 'h-8 lg:h-[26px]')} /></label>
              <label className="block text-[12px] font-medium text-slate-700 lg:text-[9.5px]">Description<textarea value={form.description} maxLength={1000} rows={2} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={cn(input, 'resize-none py-1.5')} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[12px] font-medium text-slate-700 lg:text-[9.5px]">Tags<input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className={cn(input, 'h-8 lg:h-[26px]')} /></label>
                <label className="block text-[12px] font-medium text-slate-700 lg:text-[9.5px]">Collection
                  <select value={form.collectionId} onChange={e => setForm(f => ({ ...f, collectionId: e.target.value }))} className={cn(input, 'h-8 bg-white lg:h-[26px]')}>
                    <option value="">None</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-slate-500 lg:text-[8.5px]">{asset.mime_type ?? 'Unknown type'}{asset.width && asset.height ? ` · ${asset.width} x ${asset.height}px` : ''}{asset.duration_seconds ? ` · ${Math.round(asset.duration_seconds)}s` : ''}</p>
              {perms.edit ? <Btn type="submit" size="sm" variant="primary" disabled={pending}>Save metadata</Btn> : <p className="text-[11px] text-slate-500">Your role cannot edit media.</p>}
            </fieldset>
          </form>
        )}

        {tab === 'history' && (history.length === 0 ? <p className="py-6 text-center text-[12px] text-slate-500 lg:text-[9.5px]">No recorded activity for this asset yet.</p> : (
          <ul className="space-y-2">
            {history.map(h => (
              <li key={h.id} className="flex items-center gap-2 text-[12px] lg:text-[9.5px]">
                <PersonAvatar person={h.actor} size={16} />
                <span className="min-w-0 flex-1 truncate text-slate-700"><b className="font-semibold">{personName(h.actor)}</b> {h.summary}</span>
                <time className="shrink-0 text-slate-500" dateTime={h.created_at}>{fmtAgo(h.created_at, now)}</time>
              </li>
            ))}
          </ul>
        ))}

        {tab === 'versions' && (
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-[12px] lg:text-[9.5px]">
              <span className="rounded-full bg-[#e9f0ff] px-2 py-0.5 font-medium text-[#1a5cff]">v{asset.version}</span>
              <span className="flex-1 text-slate-700">Current file · {fmtBytes(asset.file_size ?? 0)}</span>
              <span className="text-slate-500">{fmtDate(asset.updated_at)}</span>
            </li>
            {versions.map(v => (
              <li key={v.id} className="flex items-center gap-2 text-[12px] lg:text-[9.5px]">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">v{v.version}</span>
                <span className="min-w-0 flex-1 truncate text-slate-700">{v.note ?? 'Replaced'} · {personName(v.author)} · {fmtBytes(v.file_size ?? 0)}</span>
                <span className="text-slate-500">{fmtDate(v.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1.35fr] px-3 pb-3 pt-2 lg:gap-[8px] lg:px-[12px] lg:pb-[12px]">
        <button type="button" onClick={() => setCropping(true)} disabled={!perms.edit || !CROPPABLE_MIME.includes(asset.mime_type ?? '') || asset.status === 'archived'}
          title={!perms.edit ? 'Your role cannot edit media' : !CROPPABLE_MIME.includes(asset.mime_type ?? '') ? 'Only JPEG, PNG, WebP and AVIF images can be cropped' : asset.status === 'archived' ? 'Restore the asset first' : 'Crop or rotate this image'} className={btnClass('secondary', 'sm', 'lg:h-[30px] lg:text-[10px]')}><Crop size={12} /> Crop</button>
        <button type="button" onClick={() => setReplace(true)} disabled={!perms.upload} title={perms.upload ? undefined : 'Your role cannot upload media'}
          className={btnClass('secondary', 'sm', 'lg:h-[30px] lg:text-[10px]')}><RefreshCw size={12} /> Replace</button>
        <button type="button" onClick={download} disabled={pending} className={btnClass('secondary', 'sm', 'lg:h-[30px] lg:text-[10px]')}><Download size={12} /> Download</button>
        <div className="flex">
          <button type="button" disabled={!perms.approve || pending || asset.status === 'ready' || asset.status === 'archived'}
            title={!perms.approve ? 'Only approvers can approve media' : asset.status === 'ready' ? 'Already approved' : undefined}
            onClick={() => run(() => setMediaStatus({ id: asset.id, status: 'ready' }))}
            className={btnClass('primary', 'sm', 'flex-1 rounded-r-none lg:h-[30px] lg:text-[10px]')}>
            {asset.status === 'ready' ? 'Approved' : 'Approve'}
          </button>
          <AssetMenu asset={asset} perms={perms} icon={<ChevronDown size={13} />}
            triggerClassName={btnClass('primary', 'sm', 'rounded-l-none border-l-white/25 px-2 lg:h-[30px] lg:w-[30px] lg:px-0')} />
        </div>
      </footer>

      <Dialog open={preview} onClose={() => setPreview(false)} size="xl" title={asset.file_name} description={asset.alt_text ?? undefined}>
        {asset.mime_type?.startsWith('video/') && asset.file_url
          ? <video src={asset.file_url} controls className="max-h-[70vh] w-full rounded-lg bg-black" />
          : asset.mime_type?.startsWith('image/') && asset.file_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={asset.file_url} alt={asset.alt_text ?? ''} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
            : <p className="py-10 text-center text-[13px] text-slate-500">No inline preview for this file type. Use Download to open it.</p>}
      </Dialog>
      {replace && <UploadDialog open onClose={() => setReplace(false)} replaceAssetId={asset.id} onComplete={() => notify('success', 'File replaced. The previous file is kept as a version.')} />}
      {cropping && <CropDialog asset={asset} open onClose={() => setCropping(false)} />}
    </section>
  )
}

// ── All-assets table with bulk actions ───────────────────────────────────────
export function AssetsTable({ rows, selectedId, collections, perms, children }: {
  rows: MediaRow[]
  selectedId: string | null
  collections: CollectionOption[]
  perms: MediaPerms
  children?: React.ReactNode
}) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [picked, setPicked] = useState<string[]>([])
  const [pending, start] = useTransition()
  const all = rows.length > 0 && picked.length === rows.length
  const bulk = (action: 'approve' | 'archive' | 'move', collectionId?: string | null) => start(async () => {
    if (action === 'archive' && !confirm(`Archive ${picked.length} asset${picked.length === 1 ? '' : 's'}?`)) return
    const result = await bulkMediaAction({ ids: picked, action, collectionId })
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Updated.' : result.error ?? 'Could not update.')
    if (result.ok) { setPicked([]); router.refresh() }
  })
  const th = 'h-9 whitespace-nowrap px-2 text-left text-[12px] font-medium text-slate-600 lg:h-[30px] lg:text-[9.5px]'
  const td = 'px-2 text-[12px] text-slate-700 lg:text-[9.5px]'
  return (
    <>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-[#dbe5ff] bg-[#f5f8ff] px-3 py-2 text-[12px]" role="region" aria-label="Bulk actions">
          <span className="font-medium text-slate-800">{picked.length} selected</span>
          <Btn size="xs" disabled={!perms.approve || pending} onClick={() => bulk('approve')}>Approve</Btn>
          <Popover>
            <PopoverTrigger haspopup="menu" label="Move to collection" disabled={!perms.edit || pending} className={btnClass('secondary', 'xs')}>Move to <ChevronDown size={11} /></PopoverTrigger>
            <PopoverContent role="menu" label="Collections" width={200}>
              {close => (<>
                {collections.map(c => <MenuItem key={c.id} close={close} onSelect={() => bulk('move', c.id)}>{c.name}</MenuItem>)}
                <MenuSeparator /><MenuItem close={close} onSelect={() => bulk('move', null)}>Remove from collection</MenuItem>
              </>)}
            </PopoverContent>
          </Popover>
          <Btn size="xs" variant="danger" disabled={!perms.edit || pending} onClick={() => bulk('archive')}>Archive</Btn>
          <button type="button" onClick={() => setPicked([])} className={cn('ml-auto text-[12px] text-slate-500 hover:text-slate-800', S_FOCUS)}>Clear selection</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <caption className="sr-only">All assets</caption>
          <thead><tr className="border-b border-[#eef0f4]">
            <th scope="col" className={cn(th, 'w-8 pl-3 lg:pl-[12px]')}><input type="checkbox" checked={all} onChange={e => setPicked(e.target.checked ? rows.map(r => r.id) : [])} aria-label="Select all assets on this page" className="h-3.5 w-3.5 accent-[#1a5cff]" /></th>
            {[['Name', 'lg:w-[222px]'], ['Type', 'lg:w-[85px]'], ['Collection', 'lg:w-[145px]'], ['Owner', 'lg:w-[100px]'], ['Dimensions', 'lg:w-[108px]'], ['Size', 'lg:w-[68px]'], ['Updated', 'lg:w-[80px]'], ['Status', '']].map(([h, c]) => <th key={h} scope="col" className={cn(th, c)}>{h}</th>)}
            <th scope="col" className={th}><span className="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className={cn('border-b border-[#f0f2f5] last:border-0 hover:bg-slate-50/60', r.id === selectedId && 'bg-[#f7f9ff]')}>
                <td className={cn(td, 'pl-3 lg:pl-[12px]')}><input type="checkbox" checked={picked.includes(r.id)} onChange={e => setPicked(p => (e.target.checked ? [...p, r.id] : p.filter(x => x !== r.id)))} aria-label={`Select ${r.file_name}`} className="h-3.5 w-3.5 accent-[#1a5cff]" /></td>
                <td className={cn(td, 'h-11 lg:h-[33px]')}>
                  <button type="button" onClick={() => set({ selected: r.id })} className={cn('flex max-w-full items-center gap-2.5 text-left text-slate-800 hover:text-[#1a5cff] lg:gap-[12px]', S_FOCUS)}>
                    <Thumb asset={r} duration={false} className="h-7 w-10 shrink-0 rounded-[3px] lg:h-[22px] lg:w-[30px]" /><span className="truncate">{r.file_name}</span>
                  </button>
                </td>
                <td className={td}>{kindLabel(r.mime_type, r.file_name, true)}</td>
                <td className={cn(td, 'truncate')}>{r.collection?.name ?? '—'}</td>
                <td className={cn(td, 'truncate')}>{personName(r.owner)}</td>
                <td className={cn(td, 'tabular-nums')}>{r.width && r.height ? `${r.width} x ${r.height}` : '—'}</td>
                <td className={cn(td, 'tabular-nums')}>{fmtBytes(r.file_size ?? 0)}</td>
                <td className={cn(td, 'whitespace-nowrap')}>{fmtDate(r.updated_at)}</td>
                <td className={td}><span className={cn('whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium lg:text-[8.5px]', STATUS_PILL[r.status] ?? 'bg-slate-100')}>{statusLabel(r.status)}</span></td>
                <td className={cn(td, 'pr-3 text-right')}><AssetMenu asset={r} perms={perms} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
    </>
  )
}

// ── Right rail: upload + picker ──────────────────────────────────────────────
export function UploadRail({ collections, perms, storageNote }: { collections: CollectionOption[]; perms: MediaPerms; storageNote: string }) {
  const params = useSearchParams()
  const { notify } = useToast()
  const collectionId = collections.some(c => c.id === params.get('collection')) ? params.get('collection') : null
  const upload = useMediaUpload({ collectionId, onComplete: ids => notify('success', `${ids.length} file${ids.length === 1 ? '' : 's'} uploaded.`) })
  if (!perms.upload) return <p className="mt-3 text-[12px] text-slate-500 lg:text-[9.5px]">Your role can view media but not upload it.</p>
  return (
    <>
      <DropZone compact onFiles={files => void upload.add(files)} storageNote={storageNote} className="mt-3 lg:mt-[16px] lg:h-[108px]" />
      <button type="button" onClick={() => openFolderPicker(files => void upload.add(files))}
        className={btnClass('secondary', 'sm', 'mt-2 w-full lg:mt-[10px] lg:h-[24px] lg:text-[9.5px]')}>
        <FolderUp size={12} /> Upload folder
      </button>
      <UploadQueue items={upload.items} onCancel={upload.cancel} onRetry={(k, d) => void upload.retry(k, d)} className="mt-2" />
    </>
  )
}

export function AssetPickerRail({ assets }: { assets: MediaRow[] }) {
  const set = useQuery()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const n = term.trim().toLowerCase()
    return n ? assets.filter(a => a.file_name.toLowerCase().includes(n) || (a.tags ?? []).some(t => t.includes(n))) : assets
  }, [assets, term])
  const list = (rows: MediaRow[], big: boolean) => rows.map(a => (
    <li key={a.id}>
      <button type="button" onClick={() => { set({ selected: a.id }); setOpen(false) }} className={cn('flex w-full items-center gap-3 rounded-md text-left hover:bg-slate-50 lg:gap-[12px]', S_FOCUS)}>
        <Thumb asset={a} className={cn('shrink-0 rounded-[5px]', big ? 'h-14 w-20' : 'h-12 w-16 lg:h-[56px] lg:w-[62px]')} />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-slate-800 lg:text-[9.5px]">{a.file_name}</span>
          <span className="block text-[11px] text-slate-500 lg:text-[8.5px]">{kindLabel(a.mime_type, a.file_name)} • {fmtBytes(a.file_size ?? 0)}</span>
        </span>
      </button>
    </li>
  ))
  return (
    <>
      <label className="relative mt-3 flex items-center lg:mt-[12px]">
        <span className="sr-only">Search assets</span>
        <Search size={12} className="pointer-events-none absolute left-2.5 text-slate-400" aria-hidden />
        <input type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Search assets…" maxLength={80}
          className="h-10 w-full rounded-[7px] border border-[#e3e7ee] pl-7 pr-2 text-[13px] outline-none focus:border-[#9db8ff] lg:h-[26px] lg:text-[9.5px]" />
      </label>
      {filtered.length === 0 ? <p className="py-5 text-center text-[12px] text-slate-500 lg:text-[9.5px]">No assets match.</p> : (
        <ul className="mt-3 space-y-2.5 lg:mt-[10px] lg:space-y-[12px]">{list(filtered.slice(0, 3), false)}</ul>
      )}
      <button type="button" onClick={() => setOpen(true)} className={btnClass('secondary', 'sm', 'mt-3 w-full lg:mt-[16px] lg:h-[26px] lg:text-[9.5px]')}>Open full picker</button>
      <Dialog open={open} onClose={() => setOpen(false)} size="lg" title="Asset picker" description="Choose an asset to open its details.">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{list(filtered, true)}</ul>
      </Dialog>
    </>
  )
}

export function NewCollectionButton({ perms }: { perms: MediaPerms }) {
  const router = useRouter()
  const set = useQuery()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState('campaign')
  const [pending, start] = useTransition()
  if (!perms.upload) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('flex h-full items-center gap-1 whitespace-nowrap px-3 text-[12px] font-medium text-[#1a5cff] hover:bg-slate-50 lg:text-[10px]', S_FOCUS)}>
        <Plus size={12} /> New collection
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="New collection"
        footer={<><Btn size="md" onClick={() => setOpen(false)}>Cancel</Btn><Btn size="md" variant="primary" disabled={!name.trim() || pending} onClick={() => start(async () => {
          const result = await createMediaCollection({ name, kind })
          notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Created.' : result.error ?? 'Could not create.')
          if (result.ok) { setOpen(false); setName(''); if (result.id) set({ collection: result.id, page: null }); router.refresh() }
        })}>Create</Btn></>}>
        <div className="space-y-3">
          <label className="block text-[12px] font-medium text-slate-700">Name
            <input data-autofocus value={name} maxLength={120} onChange={e => setName(e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] px-2.5 text-[13px] font-normal outline-none focus:border-blue-400" />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">Type
            <select value={kind} onChange={e => setKind(e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-[#dfe3ea] bg-white px-2 text-[13px] font-normal outline-none focus:border-blue-400">
              {['campaign', 'brand', 'social', 'team', 'custom'].map(k => <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
            </select>
          </label>
        </div>
      </Dialog>
    </>
  )
}

export function PageSizeSelect({ size }: { size: number }) {
  const set = useQuery()
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Assets per page</span>
      <select value={size} onChange={e => set({ size: e.target.value, page: null })}
        className="h-9 appearance-none rounded-[7px] border border-[#e3e7ee] bg-white pl-3 pr-8 text-[12px] text-slate-700 outline-none focus:border-[#9db8ff] lg:h-[30px] lg:w-[92px] lg:text-[10px]">
        {[10, 24, 48, 96].map(n => <option key={n} value={n}>{n} / page</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-slate-500" aria-hidden />
    </label>
  )
}
