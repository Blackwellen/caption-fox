import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { APPROVAL_BADGE, APPROVAL_LABELS, CHANNEL_LABELS, MESSAGE_STATUS_BADGE, MESSAGE_STATUS_LABELS } from '@/lib/messaging/constants'
import { ChannelChip, OwnerChip, formatCompactNumber, formatPercent, formatShortDate } from './primitives'
import MessageApprovalActions from './MessageApprovalActions'
import type { MessageRow } from '@/lib/messaging/types'
import { MessagingEmpty } from './states'

/**
 * The messaging programs table shared by Overview and every channel page.
 * Rows link to the real message detail route; approval controls are shown
 * only for the states/roles where they are meaningful.
 */
export default function MessagingProgramsTable({
  rows, compact = false, bare = false, emptyMessage, canEdit = false, canApprove = false,
}: {
  rows: MessageRow[]; compact?: boolean; bare?: boolean; emptyMessage?: string
  canEdit?: boolean; canApprove?: boolean
}) {
  if (rows.length === 0) {
    return (
      <MessagingEmpty
        bare
        title="No messaging programs yet"
        message={emptyMessage ?? 'Create your first message to start tracking delivery, engagement and conversions here.'}
      />
    )
  }

  return (
    <div className={cn('overflow-x-auto', !bare && 'rounded-xl border border-slate-200')}>
      <table className="w-full min-w-[960px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2.5 font-medium">Program</th>
            <th className="px-3 py-2.5 font-medium">Audience</th>
            <th className="px-3 py-2.5 font-medium">Sent</th>
            <th className="px-3 py-2.5 font-medium">Delivery rate</th>
            <th className="px-3 py-2.5 font-medium">Open rate</th>
            <th className="px-3 py-2.5 font-medium">Click rate</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Approval</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Last sent</th>
            <th className="px-3 py-2.5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, compact ? 6 : rows.length).map(row => (
            <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <ChannelChip channel={row.channel} />
                  <div className="min-w-0">
                    <Link href={`/app/messaging/messages/${row.id}`} className="block truncate font-medium text-slate-900 hover:text-blue-600">{row.name}</Link>
                    <p className="truncate text-[11px] text-slate-400">{CHANNEL_LABELS[row.channel]} · {row.message_type}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-slate-600">
                {row.audience ? (
                  <>
                    <p className="truncate">{row.audience.name}</p>
                    <p className="text-[11px] text-slate-400">{formatCompactNumber(row.audience.contact_count)}</p>
                  </>
                ) : '—'}
              </td>
              <td className="px-3 py-2.5 font-medium text-slate-900">{formatCompactNumber(row.sent_count)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercent(row.delivered_count, row.sent_count)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercent(row.opened_count, row.delivered_count)}</td>
              <td className="px-3 py-2.5 text-slate-600">{formatPercent(row.clicked_count, row.delivered_count)}</td>
              <td className="px-3 py-2.5">
                <Badge variant={MESSAGE_STATUS_BADGE[row.status as keyof typeof MESSAGE_STATUS_BADGE] ?? 'slate'}>
                  {MESSAGE_STATUS_LABELS[row.status as keyof typeof MESSAGE_STATUS_LABELS] ?? row.status}
                </Badge>
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={APPROVAL_BADGE[row.approval_status as keyof typeof APPROVAL_BADGE] ?? 'slate'}>
                  {APPROVAL_LABELS[row.approval_status as keyof typeof APPROVAL_LABELS] ?? row.approval_status}
                </Badge>
              </td>
              <td className="px-3 py-2.5"><OwnerChip person={row.owner} /></td>
              <td className="px-3 py-2.5 text-slate-500">{formatShortDate(row.sent_at ?? row.updated_at)}</td>
              <td className="px-3 py-2.5">
                <MessageApprovalActions id={row.id} status={row.status} approvalStatus={row.approval_status} canEdit={canEdit} canApprove={canApprove} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
