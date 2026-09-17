// Server-safe record renderers shared across the Studio pages.

import Link from 'next/link'
import {
  CalendarCheck, CheckCircle2, FileText, FolderOpen, Hash, Image as ImageIcon, LayoutTemplate, Lightbulb,
  Pencil, Sparkles, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from '@/components/home/brand-icons'
import { CHANNEL_LABELS } from '@/lib/studio/constants'
import type { ActivityRow } from '@/lib/studio/types'
import { IconTile, Pill, fmtAgo, shortName, type Tone } from './ui'

export const CONTENT_TONE: Record<string, Tone> = {
  draft: 'blue', pending_approval: 'amber', approved: 'violet', scheduled: 'green', published: 'green',
  failed: 'red', archived: 'slate', queued: 'sky', publishing: 'sky', cancelled: 'slate',
}
export const CONTENT_LABEL: Record<string, string> = {
  draft: 'Draft', pending_approval: 'In Review', approved: 'Approved', scheduled: 'Scheduled', published: 'Published',
  failed: 'Failed', archived: 'Archived', queued: 'Queued', publishing: 'Publishing', cancelled: 'Cancelled',
}

export function ContentStatus({ status, className }: { status: string; className?: string }) {
  return <Pill tone={CONTENT_TONE[status] ?? 'slate'} className={className}>{CONTENT_LABEL[status] ?? status}</Pill>
}

export function ChannelIcons({ channels, size = 14, max = 4, className }: { channels: string[] | null | undefined; size?: number; max?: number; className?: string }) {
  const list = (channels ?? []).slice(0, max)
  if (list.length === 0) return <span className="text-slate-400">—</span>
  return (
    <span className={cn('inline-flex items-center gap-2 lg:gap-[9px]', className)}>
      {list.map(ch => (
        <span key={ch} title={CHANNEL_LABELS[ch] ?? ch}>
          <ChannelIcon channel={ch} size={size} />
          <span className="sr-only">{CHANNEL_LABELS[ch] ?? ch}</span>
        </span>
      ))}
    </span>
  )
}

const ACTIVITY_ICON: Record<string, { icon: React.ReactNode; tone: Tone }> = {
  content: { icon: <FileText size={14} />, tone: 'blue' },
  ai: { icon: <Sparkles size={14} />, tone: 'violet' },
  asset: { icon: <ImageIcon size={14} />, tone: 'sky' },
  idea: { icon: <Lightbulb size={14} />, tone: 'amber' },
  template: { icon: <LayoutTemplate size={14} />, tone: 'violet' },
  keyword: { icon: <Hash size={14} />, tone: 'blue' },
  collection: { icon: <FolderOpen size={14} />, tone: 'blue' },
}

export function activityIcon(row: ActivityRow): { icon: React.ReactNode; tone: Tone } {
  if (row.entity_type === 'content' && row.action === 'scheduled') return { icon: <ChannelIcon channel="instagram" size={14} />, tone: 'pink' }
  if (row.entity_type === 'content' && row.action === 'approved') return { icon: <CheckCircle2 size={14} />, tone: 'green' }
  if (row.entity_type === 'content' && row.action === 'updated') return { icon: <FolderOpen size={14} />, tone: 'blue' }
  if (row.entity_type === 'content' && row.action === 'published') return { icon: <CalendarCheck size={14} />, tone: 'green' }
  if (row.entity_type === 'asset' && row.action === 'uploaded') return { icon: <Upload size={14} />, tone: 'sky' }
  if (row.action === 'created') return { icon: <Pencil size={14} />, tone: 'blue' }
  return ACTIVITY_ICON[row.entity_type] ?? { icon: <FileText size={14} />, tone: 'slate' }
}

/** Human sentence: "Sarah Williams uploaded 6 assets". */
export function activitySentence(row: ActivityRow): string {
  const who = row.actor?.full_name ?? row.actor?.email ?? 'Someone'
  return `${who} ${row.summary}`
}

export function ActivityList({ rows, now, variant = 'tiles', className }: {
  rows: ActivityRow[]
  now: number
  variant?: 'tiles' | 'avatars'
  className?: string
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-[12px] text-slate-500">No activity yet.</p>
  return (
    <ul className={cn('space-y-4 lg:space-y-[17px]', className)}>
      {rows.map(row => {
        const { icon, tone } = activityIcon(row)
        const body = (
          <>
            <IconTile tone={tone} className="h-8 w-8 rounded-lg lg:h-[29px] lg:w-[29px]">{icon}</IconTile>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-slate-700 lg:text-[9.5px]">{row.summary.charAt(0).toUpperCase() + row.summary.slice(1)}</span>
              <span className="block text-[12px] text-slate-500 lg:mt-[3px] lg:text-[9px]">by {shortName(row.actor)}</span>
            </span>
            <time dateTime={row.created_at} className="shrink-0 whitespace-nowrap text-[12px] text-slate-500 lg:text-[9px]">{fmtAgo(row.created_at, now)}</time>
          </>
        )
        return (
          <li key={row.id}>
            {row.link
              ? <Link href={row.link} className="flex items-start gap-2.5 rounded-md hover:bg-slate-50 lg:gap-[10px]">{body}</Link>
              : <div className="flex items-start gap-2.5 lg:gap-[10px]">{body}</div>}
          </li>
        )
      })}
    </ul>
  )
}
