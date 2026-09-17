'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, Bot } from 'lucide-react'
import { dateTime } from '@/lib/link-in-bio/format'
import type { Member } from '@/lib/link-in-bio/server/context'
import { Avatar, StatusBadge } from '../ui'

type Item = { id: string; actor: Member | null; summary: string; badge: string | null; createdAt: string; action: string }

const GROUPS: Record<string, (item: Item) => boolean> = {
  all: () => true,
  publishing: item => ['published', 'approved', 'status_changed', 'unpublish', 'archive', 'restore', 'version_restored'].includes(item.action),
  edits: item => item.badge === 'Edited' || item.action.startsWith('block') || item.action.startsWith('link') || item.action === 'settings_updated' || item.action === 'reordered',
  tracking: item => item.action.startsWith('pixel'),
}

export default function ActivityFeed({ items, viewAllHref, title = 'Recent activity' }: { items: Item[]; viewAllHref: string; title?: string }) {
  const [group, setGroup] = useState<keyof typeof GROUPS>('all')
  const visible = items.filter(GROUPS[group]).slice(0, 5)
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        <label className="relative">
          <span className="sr-only">Filter activity</span>
          <select value={group} onChange={e => setGroup(e.target.value as keyof typeof GROUPS)} className="h-7 appearance-none rounded-md border border-slate-200 bg-white pl-2.5 pr-7 text-[10.5px] text-slate-700">
            <option value="all">All events</option>
            <option value="publishing">Publishing</option>
            <option value="edits">Edits</option>
            <option value="tracking">Tracking</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
        </label>
      </div>
      {visible.length === 0 ? <p className="mt-3 text-[12px] text-slate-500">No matching activity.</p> : (
        <ul className="mt-3 divide-y divide-slate-100">
          {visible.map(item => (
            <li key={item.id} className="flex items-center gap-2.5 py-2.5">
              {item.actor ? <Avatar member={item.actor} size={22} /> : <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-slate-200 text-slate-500" aria-hidden><Bot size={12} /></span>}
              <p className="min-w-0 flex-1 truncate text-[10.5px] text-slate-600"><span className="font-semibold text-slate-900">{item.actor?.name ?? 'System'}</span> {item.summary}</p>
              {item.badge && <StatusBadge status={item.badge} label={item.badge} className="hidden sm:inline-flex" />}
              <time dateTime={item.createdAt} className="shrink-0 text-[10px] text-slate-500">{dateTime(item.createdAt)}</time>
            </li>
          ))}
        </ul>
      )}
      <Link href={viewAllHref} className="mt-auto inline-flex items-center justify-center gap-1 pt-3 text-[11px] font-medium text-[#1a5cff] hover:underline">View all activity <ArrowRight size={12} /></Link>
    </section>
  )
}
