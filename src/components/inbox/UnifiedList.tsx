'use client'

import Link from 'next/link'
import { Inbox, ListFilter, Search, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHANNEL_LABEL, formatClock } from '@/lib/inbox/format'
import type { ConversationRow, MemberLite } from '@/lib/inbox/types'
import { Avatar, ChannelTile, EmptyState, Pagination, Pill } from './ui'
import { useDebouncedSearch, useInboxRealtime, useInboxUrl } from './hooks'

const CHANNEL_OPTIONS = ['email', 'sms', 'whatsapp', 'rcs', 'instagram', 'facebook', 'live_chat', 'x', 'tiktok', 'youtube', 'linkedin']

export function statusPillFor(row: ConversationRow) {
  if (row.lane === 'closed') return <Pill tone="slate">Closed</Pill>
  if (row.lane === 'snoozed') return <Pill tone="slate">Snoozed</Pill>
  if (row.sla_status === 'at_risk' || row.sla_status === 'breached') return <Pill tone="orange">{row.sla_status === 'breached' ? 'Overdue' : 'SLA at risk'}</Pill>
  if (row.requires_reply) return <Pill tone="purple">Awaiting reply</Pill>
  return <Pill tone="green">Open</Pill>
}

export default function UnifiedList({
  workspaceId, rows, total, page, pageSize, lane, laneCounts, selectedId, members, timezone, error,
}: {
  workspaceId: string
  rows: ConversationRow[]
  total: number
  page: number
  pageSize: number
  lane: 'open' | 'snoozed' | 'closed'
  laneCounts: { open: number; snoozed: number; closed: number }
  selectedId: string | null
  members: MemberLite[]
  timezone: string
  error: string | null
}) {
  const { get, set, hrefWith } = useInboxUrl()
  const [search, setSearch] = useDebouncedSearch()
  useInboxRealtime(workspaceId)
  const filtersActive = Boolean(get('channel') || get('status') || get('priority') || get('assignee') || get('q'))

  const selectCls = 'h-9 w-full appearance-none rounded-lg border border-[#e6ebf2] bg-white pl-2.5 pr-6 text-[12px] text-slate-700 focus:border-blue-500 focus:outline-none lg:h-[29px] lg:text-[10px]'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Conversation state" className="flex gap-1 border-b border-[#eef1f6] px-3">
        {(['open', 'snoozed', 'closed'] as const).map(l => (
          <Link key={l} role="tab" aria-selected={lane === l} href={hrefWith({ lane: l === 'open' ? null : l, c: null })} scroll={false}
            className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-[13px] lg:py-[13px] lg:text-[10.5px]', lane === l ? 'border-[#1769ff] font-semibold text-[#1769ff]' : 'border-transparent font-medium text-slate-500 hover:text-slate-800')}>
            {l[0].toUpperCase() + l.slice(1)}
            {l !== 'closed' ? <span className="rounded-md bg-slate-100 px-1.5 text-[10px] leading-[16px] text-slate-600 lg:text-[9px]">{laneCounts[l]}</span> : null}
          </Link>
        ))}
      </div>

      <div className="space-y-2.5 px-3 pt-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search conversations</span>
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." maxLength={120}
              className="h-9 w-full rounded-lg border border-[#e6ebf2] bg-[#f7f9fc] pl-8 pr-2 text-[12px] placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none lg:h-[31px] lg:text-[10.5px]" />
          </label>
          <Link href={hrefWith({ channel: null, status: null, priority: null, assignee: null, q: null, sort: null })} aria-label={filtersActive ? 'Clear filters' : 'Filters'} title={filtersActive ? 'Clear filters' : 'Filters'}
            className={cn('flex h-9 w-9 items-center justify-center rounded-lg border lg:h-[31px] lg:w-[31px]', filtersActive ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-[#e6ebf2] text-slate-500')}>
            <ListFilter size={14} aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select label="Channel" value={get('channel') ?? ''} onChange={v => set({ channel: v || null, c: null })} className={selectCls}
            options={[['', 'All channels'], ...CHANNEL_OPTIONS.map(ch => [ch, CHANNEL_LABEL[ch]] as [string, string])]} />
          <Select label="Status" value={get('status') ?? ''} onChange={v => set({ status: v || null, c: null })} className={selectCls}
            options={[['', 'All status'], ['awaiting', 'Awaiting reply'], ['waiting', 'Waiting on customer'], ['open', 'Open'], ['escalated', 'Escalated']]} />
          <Select label="Priority" value={get('priority') ?? ''} onChange={v => set({ priority: v || null, c: null })} className={selectCls}
            options={[['', 'All priority'], ['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']]} />
        </div>
        <div className="flex items-center justify-between pb-1">
          <Select label="Sort" value={get('sort') ?? 'newest'} onChange={v => set({ sort: v === 'newest' ? null : v })}
            className="h-8 appearance-none bg-transparent pr-5 text-[12px] text-slate-600 focus:outline-none lg:h-6 lg:text-[10px]"
            options={[['newest', 'Sort: Newest'], ['oldest', 'Sort: Oldest'], ['priority', 'Sort: Priority'], ['sla', 'Sort: SLA due']]} />
          <div className="flex items-center gap-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e6ebf2] text-slate-500 lg:h-[23px] lg:w-[23px]" aria-hidden><UserRound size={12} /></span>
            <Select label="Assignee" value={get('assignee') ?? ''} onChange={v => set({ assignee: v || null, c: null })}
              className="h-8 appearance-none bg-transparent pr-5 text-[12px] text-slate-600 focus:outline-none lg:h-6 lg:text-[10px]"
              options={[['', 'Assign: All'], ['me', 'Assigned to me'], ['unassigned', 'Unassigned'], ...members.map(m => [m.id, m.name] as [string, string])]} />
          </div>
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversations">
        {error ? <li className="p-6 text-center text-[12px] text-rose-600" role="alert">{error}</li> : null}
        {!error && !rows.length ? (
          <li>
            {filtersActive
              ? <EmptyState icon={Search} title="No matching conversations" body="Try a different search or clear your filters." action={<Link className="text-[12px] font-semibold text-blue-600" href={hrefWith({ channel: null, status: null, priority: null, assignee: null, q: null })}>Clear filters</Link>} />
              : <EmptyState icon={Inbox} title={lane === 'open' ? 'No open conversations' : `No ${lane} conversations`} body={lane === 'open' ? 'New messages from your connected channels will appear here.' : 'Nothing here right now.'} />}
          </li>
        ) : null}
        {rows.map(row => {
          const active = row.id === selectedId
          const name = row.contact_name ?? row.sender_name ?? 'Unknown contact'
          return (
            <li key={row.id}>
              <Link href={hrefWith({ c: row.id })} scroll={false} aria-current={active ? 'true' : undefined}
                className={cn('relative flex gap-2.5 border-b border-[#f0f2f6] px-3 py-3 transition-colors lg:min-h-[65px] lg:py-2.5',
                  active ? 'bg-[#f1f6ff] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#1769ff]' : 'hover:bg-slate-50')}>
                <ChannelTile channel={row.platform} className="mt-0.5" />
                <Avatar name={name} src={row.contact_avatar ?? row.sender_avatar} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-[13px] text-slate-900 lg:text-[11px]', row.unread_count ? 'font-semibold' : 'font-medium')}>{name}</p>
                    <span className="shrink-0 text-[11px] text-slate-500 lg:text-[9px]">{formatClock(row.last_message_at, timezone)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] text-slate-500 lg:text-[10px]">{row.last_message_preview ?? row.content}</p>
                    {row.lane === 'open' && row.requires_reply && row.sla_status !== 'at_risk' && row.sla_status !== 'breached' && row.unread_count ? null : <span className="shrink-0">{statusPillFor(row)}</span>}
                  </div>
                  {row.lane === 'open' && row.requires_reply && row.sla_status !== 'at_risk' && row.sla_status !== 'breached' && row.unread_count ? (
                    <div className="mt-1 flex items-center justify-between">
                      {statusPillFor(row)}
                      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-blue-100 bg-white px-1 text-[10px] font-semibold text-blue-600 lg:text-[9px]" aria-label={`${row.unread_count} unread`}>{row.unread_count}</span>
                    </div>
                  ) : row.unread_count && row.lane === 'open' ? (
                    <div className="mt-1 flex justify-end"><span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md border border-blue-100 px-1 text-[10px] font-semibold text-blue-600 lg:text-[9px]" aria-label={`${row.unread_count} unread`}>{row.unread_count}</span></div>
                  ) : null}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-[#eef1f6] px-4 py-3">
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={p => hrefWith({ page: String(p), c: null })} stacked />
      </div>
    </div>
  )
}

export function Select({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; className?: string }) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={className}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" width="9" height="9" viewBox="0 0 12 12" aria-hidden>
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
