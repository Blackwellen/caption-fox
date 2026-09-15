'use client'

import { useState, useTransition, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore, Repeat2, Trash2 } from 'lucide-react'
import { CARD, CARD_SHADOW, OwnerChip, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/campaigns/Toast'
import {
  CONTENT_STATUS_BADGE, CONTENT_STATUS_LABELS, CHANNEL_LABELS, CHANNEL_TINT, type ContentStatus,
} from '@/lib/studio/constants'
import type { ContentRow } from '@/lib/studio/types'
import type { ViewMode } from '@/lib/studio/query'
import type { StudioCapabilities } from '@/lib/studio/entitlements'
import { archiveContent, deleteContent } from '../actions'
import RepurposeDialog from './RepurposeDialog'

// Content Library opens the same editor Compose uses (`?id=`), rather than the
// pre-redesign `/studio/posts/[id]` route — one editor for every entry point.
function contentHref(id: string): string {
  return `/app/studio/compose?id=${id}`
}

function StatusBadge({ status }: { status: string }) {
  const key = status as ContentStatus
  return <Badge variant={CONTENT_STATUS_BADGE[key] ?? 'slate'}>{CONTENT_STATUS_LABELS[key] ?? status}</Badge>
}

function PlatformChips({ platforms }: { platforms: string[] | null }) {
  if (!platforms?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.slice(0, 3).map(p => (
        <span key={p} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${CHANNEL_TINT[p] ?? 'bg-slate-50 text-slate-500 ring-slate-100'}`}>
          {CHANNEL_LABELS[p] ?? p}
        </span>
      ))}
      {platforms.length > 3 && <span className="text-[10px] text-slate-400">+{platforms.length - 3}</span>}
    </div>
  )
}

function RowActions({
  row, capabilities, onRepurpose,
}: { row: ContentRow; capabilities: StudioCapabilities; onRepurpose: (row: ContentRow) => void }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const archived = !!row.archived_at

  if (!capabilities.deleteContent && !capabilities.editContent && !capabilities.repurpose) return null

  function toggleArchive(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    startTransition(async () => {
      const result = await archiveContent({ id: row.id, restore: archived })
      if (!result.ok) notify('error', result.error ?? 'Could not update this item.')
      else { notify('success', archived ? 'Restored.' : 'Archived.'); router.refresh() }
    })
  }

  function remove(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!window.confirm(`Delete “${row.title ?? 'Untitled'}”? This cannot be undone.`)) return
    startTransition(async () => {
      const result = await deleteContent({ id: row.id })
      if (!result.ok) notify('error', result.error ?? 'Could not delete this item.')
      else { notify('success', 'Deleted.'); router.refresh() }
    })
  }

  function repurpose(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    onRepurpose(row)
  }

  return (
    <div className="flex items-center gap-1">
      {capabilities.repurpose && (
        <button
          type="button" onClick={repurpose} title="Repurpose"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <Repeat2 size={13} />
        </button>
      )}
      {capabilities.editContent && (
        <button
          type="button" disabled={pending} onClick={toggleArchive}
          title={archived ? 'Restore' : 'Archive'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
        </button>
      )}
      {capabilities.deleteContent && (
        <button
          type="button" disabled={pending} onClick={remove} title="Delete"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

export default function ContentGrid({
  rows, view, capabilities,
}: { rows: ContentRow[]; view: ViewMode; capabilities: StudioCapabilities }) {
  const [repurposing, setRepurposing] = useState<ContentRow | null>(null)

  return (
    <>
      {view === 'table'
        ? <ContentTable rows={rows} capabilities={capabilities} onRepurpose={setRepurposing} />
        : <ContentCards rows={rows} capabilities={capabilities} onRepurpose={setRepurposing} />}
      {repurposing && <RepurposeDialog content={repurposing} onClose={() => setRepurposing(null)} />}
    </>
  )
}

function ContentCards({
  rows, capabilities, onRepurpose,
}: { rows: ContentRow[]; capabilities: StudioCapabilities; onRepurpose: (row: ContentRow) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => (
        <Link
          key={row.id} href={contentHref(row.id)}
          className={`${CARD} ${CARD_SHADOW} flex flex-col gap-2 p-3.5 transition-shadow hover:shadow-md`}
        >
          {row.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.thumbnail_url} alt="" className="aspect-video w-full rounded-lg object-cover" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-300">No preview</div>
          )}
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 flex-1 text-[13px] font-semibold text-slate-800">{row.title ?? row.internal_title ?? 'Untitled'}</p>
            <StatusBadge status={row.status} />
          </div>
          {row.caption && <p className="line-clamp-2 text-xs text-slate-500">{row.caption}</p>}
          <PlatformChips platforms={row.platforms} />
          <div className="mt-auto flex items-center justify-between pt-1">
            <OwnerChip person={row.owner} />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {row.status === 'scheduled' && row.scheduled_at ? formatShortDate(row.scheduled_at) : formatShortDate(row.updated_at)}
              </span>
              <RowActions row={row} capabilities={capabilities} onRepurpose={onRepurpose} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function ContentTable({
  rows, capabilities, onRepurpose,
}: { rows: ContentRow[]; capabilities: StudioCapabilities; onRepurpose: (row: ContentRow) => void }) {
  const router = useRouter()
  return (
    <div className={`${CARD} ${CARD_SHADOW} overflow-hidden`}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5 font-medium">Title</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Channels</th>
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Campaign</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map(row => (
            <tr key={row.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => router.push(contentHref(row.id))}>
              <td className="max-w-64 truncate px-4 py-2.5 font-medium text-slate-800">{row.title ?? row.internal_title ?? 'Untitled'}</td>
              <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
              <td className="px-4 py-2.5"><PlatformChips platforms={row.platforms} /></td>
              <td className="px-4 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="max-w-40 truncate px-4 py-2.5 text-xs text-slate-500">{row.campaign?.name ?? '—'}</td>
              <td className="px-4 py-2.5 text-xs text-slate-400">{formatShortDate(row.updated_at)}</td>
              <td className="px-4 py-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                <RowActions row={row} capabilities={capabilities} onRepurpose={onRepurpose} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
