import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MessagingChannel } from '@/lib/messaging/constants'
import type { ProgramRow } from '@/lib/messaging/dashboard'
import { fmtDay, fmtInt, fmtPct, fmtRelative, fmtTime, rate } from '@/lib/messaging/metrics'
import { ChannelIcon, IconTile, OwnerCell, RateCell, StatusPill } from './kit'
import type { Column } from './Table'
import MoreMenu from './MoreMenu'

// Column builders for the programme tables on each Messaging page. Rates are
// computed from the stored delivery counters; deltas compare against the
// programme's previous send window (prior_rates).

export const CATEGORY_LABEL: Record<string, string> = {
  lifecycle: 'Lifecycle', transactional: 'Transactional', promotional: 'Promotional', re_engagement: 'Re-engagement',
  retention: 'Retention', engagement: 'Engagement', behavioral: 'Behavioral', trigger_based: 'Trigger-based',
}

const TILE: Record<string, string> = {
  lifecycle: 'bg-blue-50 text-blue-600', transactional: 'bg-violet-50 text-violet-600', promotional: 'bg-blue-50 text-blue-600',
  re_engagement: 'bg-violet-50 text-violet-600', behavioral: 'bg-blue-50 text-blue-600', trigger_based: 'bg-blue-50 text-blue-600',
}

export const detailHref = (row: { id: string }) => `/app/messaging/messages/${row.id}`

export function rates(row: ProgramRow) {
  const delivery = rate(row.delivered_count, row.sent_count)
  const open = rate(row.opened_count, row.delivered_count)
  const click = rate(row.clicked_count, row.delivered_count)
  const conversion = rate(row.converted_count, row.delivered_count)
  const optOut = rate(row.opt_out_count, row.sent_count)
  const d = (now: number | null, before?: number) => now === null || before === undefined || before === null ? null : now - before
  return {
    delivery, open, click, conversion, optOut,
    deltaDelivery: d(delivery, row.prior_rates?.delivery), deltaOpen: d(open, row.prior_rates?.open),
    deltaClick: d(click, row.prior_rates?.click), deltaConversion: d(conversion, row.prior_rates?.conversion),
    deltaOptOut: d(optOut, row.prior_rates?.opt_out),
  }
}

export function NameCell({ row, tile = true, sub }: { row: ProgramRow; tile?: boolean; sub?: string }) {
  return (
    <Link href={detailHref(row)} className="flex min-w-0 items-center gap-2 hover:underline lg:gap-[9px]">
      {tile && (
        <IconTile size="md" className={cn('lg:h-[14px] lg:w-[14px]', TILE[row.category] ?? 'bg-blue-50 text-blue-600')}>
          <ChannelIcon channel={row.channel} className="lg:h-[9px] lg:w-[9px]" />
        </IconTile>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12px] font-medium text-slate-900 lg:text-[8.5px]">{row.name}</span>
        <span className="block truncate text-[11px] text-slate-400 lg:text-[7.5px]">{sub ?? CATEGORY_LABEL[row.category] ?? row.category}</span>
      </span>
    </Link>
  )
}

export function ChannelMix({ channels }: { channels: MessagingChannel[] }) {
  const tone: Record<MessagingChannel, string> = { email: 'text-violet-500', sms: 'text-blue-500', whatsapp: 'text-emerald-600', rcs: 'text-violet-500', push: 'text-violet-500' }
  return (
    <span className="flex items-center gap-1.5 lg:gap-[5px]" aria-label={channels.join(', ')}>
      {channels.map(c => <ChannelIcon key={c} channel={c} className={cn('lg:h-[10px] lg:w-[10px]', tone[c])} />)}
    </span>
  )
}

export function LastSent({ row, withTime }: { row: ProgramRow; withTime?: boolean }) {
  if (row.content?.noLastSent) return <span className="text-slate-400">—</span>
  if (!row.sent_at && row.scheduled_at) return <span className="whitespace-nowrap text-slate-500">{fmtDay(row.scheduled_at)}</span>
  if (!row.sent_at) return <span className="text-slate-400">—</span>
  if (withTime) return <span className="flex flex-col whitespace-nowrap leading-tight text-slate-500"><span>{fmtDay(row.sent_at)}</span><span className="text-[11px] lg:text-[7.5px]">{fmtTime(row.sent_at)}</span></span>
  const relative = fmtRelative(row.sent_at)
  return <span className="whitespace-nowrap text-slate-500">{relative}</span>
}

export function RowActions({ row, canEdit }: { row: ProgramRow; canEdit: boolean }) {
  return (
    <MoreMenu compact label={`Actions for ${row.name}`} className="lg:rounded-[4px] lg:border lg:border-slate-200" items={[
      { label: 'Open', href: detailHref(row) },
      { label: 'Performance', href: `${detailHref(row)}?tab=performance` },
      { label: 'Delivery log', href: `${detailHref(row)}?tab=delivery` },
      canEdit && ['draft', 'pending_approval'].includes(row.status)
        ? { label: 'Edit content', href: `/app/messaging/${row.channel}/compose?id=${row.id}` }
        : { label: 'Edit content', disabledReason: canEdit ? 'Sent or active messages cannot be edited; duplicate it instead.' : 'Your role cannot edit messages.' },
    ]} />
  )
}

export function AudienceCell({ row, showCount = true }: { row: ProgramRow; showCount?: boolean }) {
  if (!row.audience) return <span className="text-slate-400">No audience</span>
  if (!showCount) return <span className="truncate text-slate-600">{row.audience.name}</span>
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-slate-800">{fmtInt(row.audience.contact_count)}</span>
      <span className="truncate text-[11px] text-slate-400 lg:text-[7.5px]">{row.audience.name}</span>
    </span>
  )
}

export const cols = {
  status: (): Column<ProgramRow> => ({ key: 'status', header: 'Status', cell: r => <StatusPill status={r.status} /> }),
  owner: (): Column<ProgramRow> => ({ key: 'owner', header: 'Owner', cell: r => <OwnerCell person={r.owner} /> }),
  sent: (): Column<ProgramRow> => ({ key: 'sent', header: 'Sent', cell: r => <span className="tabular-nums text-slate-800">{fmtInt(r.sent_count)}</span> }),
  delivered: (): Column<ProgramRow> => ({ key: 'delivered', header: 'Delivered', cell: r => <span className="tabular-nums text-slate-800">{fmtInt(r.delivered_count)}</span> }),
  rate: (key: 'delivery' | 'open' | 'click' | 'conversion' | 'optOut', header: string, withDelta = true): Column<ProgramRow> => ({
    key, header,
    cell: r => {
      const x = rates(r)
      const deltaKey = `delta${key[0].toUpperCase()}${key.slice(1)}` as keyof typeof x
      const value = fmtPct(x[key], key === 'optOut' ? 2 : 1)
      return withDelta ? <RateCell value={value} delta={x[deltaKey] as number | null} inverse={key === 'optOut'} /> : <span className="tabular-nums text-slate-800">{value}</span>
    },
  }),
  actions: (canEdit: boolean): Column<ProgramRow> => ({ key: 'actions', header: 'Actions', headClassName: 'text-center', className: 'text-center', cell: r => <span className="inline-flex"><RowActions row={r} canEdit={canEdit} /></span> }),
}
