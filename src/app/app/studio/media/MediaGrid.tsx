'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, Music, Video as VideoIcon, File as FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW, formatShortDate } from '@/components/studio/primitives'
import { Badge } from '@/components/ui/Badge'
import { MEDIA_STATUS_BADGE, MEDIA_STATUS_LABELS, type MediaStatus } from '@/lib/studio/constants'
import type { MediaRow } from '@/lib/studio/types'
import type { ViewMode } from '@/lib/studio/query'
import type { StudioCapabilities } from '@/lib/studio/entitlements'

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'video') return <VideoIcon size={20} />
  if (type === 'audio') return <Music size={20} />
  if (type === 'document') return <FileText size={20} />
  return <FileIcon size={20} />
}

export default function MediaGrid({
  rows, view, selectedId,
}: { rows: MediaRow[]; view: ViewMode; selectedId: string; capabilities: StudioCapabilities }) {
  const pathname = usePathname()
  const params = useSearchParams()

  function href(id: string): string {
    const next = new URLSearchParams(params.toString())
    next.set('selected', id)
    return `${pathname}?${next.toString()}`
  }

  if (view === 'table') {
    return (
      <div className={`${CARD} ${CARD_SHADOW} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(row => (
              <tr key={row.id} className={cn('hover:bg-slate-50/60', selectedId === row.id && 'bg-blue-50/50')}>
                <td className="px-4 py-2.5"><Link href={href(row.id)} className="font-medium text-slate-800 hover:text-blue-600">{row.file_name}</Link></td>
                <td className="px-4 py-2.5 text-slate-500">{row.file_type}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatSize(row.file_size)}</td>
                <td className="px-4 py-2.5"><Badge variant={MEDIA_STATUS_BADGE[row.status as MediaStatus] ?? 'slate'}>{MEDIA_STATUS_LABELS[row.status as MediaStatus] ?? row.status}</Badge></td>
                <td className="px-4 py-2.5 text-slate-400">{formatShortDate(row.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (view === 'list') {
    return (
      <div className={`${CARD} ${CARD_SHADOW} divide-y divide-slate-50`}>
        {rows.map(row => (
          <Link key={row.id} href={href(row.id)} className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60', selectedId === row.id && 'bg-blue-50/50')}>
            {row.file_type === 'image'
              ? // eslint-disable-next-line @next/next/no-img-element
                <img src={row.file_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
              : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400"><TypeIcon type={row.file_type} /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-800">{row.file_name}</p>
              <p className="text-[11px] text-slate-400">{formatSize(row.file_size)}</p>
            </div>
            <Badge variant={MEDIA_STATUS_BADGE[row.status as MediaStatus] ?? 'slate'}>{MEDIA_STATUS_LABELS[row.status as MediaStatus] ?? row.status}</Badge>
          </Link>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map(row => (
        <Link
          key={row.id} href={href(row.id)}
          className={cn(CARD, CARD_SHADOW, 'group relative flex flex-col overflow-hidden', selectedId === row.id && 'ring-2 ring-blue-400')}
        >
          <div className="flex aspect-square w-full items-center justify-center bg-slate-50">
            {row.file_type === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={row.file_url} alt={row.alt_text ?? ''} className="h-full w-full object-cover" />
              : <span className="text-slate-300"><TypeIcon type={row.file_type} /></span>}
          </div>
          <div className="flex items-center justify-between gap-1 p-2">
            <p className="truncate text-[11px] font-medium text-slate-600">{row.file_name}</p>
          </div>
          <span className="absolute right-1.5 top-1.5">
            <Badge variant={MEDIA_STATUS_BADGE[row.status as MediaStatus] ?? 'slate'}>{MEDIA_STATUS_LABELS[row.status as MediaStatus] ?? row.status}</Badge>
          </span>
        </Link>
      ))}
    </div>
  )
}
