import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Pencil } from 'lucide-react'
import { getMessagingSession } from '@/lib/messaging/server'
import { getMessage, listDeliveryEvents, listMessageVersions, messageActivity } from '@/lib/messaging/data'
import {
  APPROVAL_BADGE, APPROVAL_LABELS, CHANNEL_LABELS, MESSAGE_STATUS_BADGE, MESSAGE_STATUS_LABELS,
} from '@/lib/messaging/constants'
import MessageDetailTabs from '@/components/messaging/MessageDetailTabs'
import MessageApprovalActions from '@/components/messaging/MessageApprovalActions'
import ActivityFeed from '@/components/messaging/ActivityFeed'
import { ChannelChip, OwnerChip, Panel, MESSAGING_PAGE, formatNumber, formatPercent, formatShortDate } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Message · Caption Fox' }

const EVENT_LABELS: Record<string, string> = {
  queued: 'Queued', accepted: 'Accepted', sent: 'Sent', delivered: 'Delivered', opened: 'Opened',
  read: 'Read', clicked: 'Clicked', replied: 'Replied', converted: 'Converted', deferred: 'Deferred',
  bounced: 'Bounced', failed: 'Failed', rejected: 'Rejected', complained: 'Complained', opted_out: 'Opted out',
}

export default async function MessageDetailPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const { tab = 'content' } = await searchParams
  const { supabase, ctx, capabilities } = await getMessagingSession()

  const message = await getMessage(supabase, ctx.workspaceId, id)
  if (!message) notFound()

  const content = message.content as Record<string, string>

  return (
    <div className={MESSAGING_PAGE}>
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/messaging" className="hover:text-slate-600">Messaging</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href={`/app/messaging/${message.channel}`} className="hover:text-slate-600">{CHANNEL_LABELS[message.channel]}</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{message.name}</li>
        </ol>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <ChannelChip channel={message.channel} />
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">{message.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <Badge variant={MESSAGE_STATUS_BADGE[message.status as keyof typeof MESSAGE_STATUS_BADGE] ?? 'slate'}>
              {MESSAGE_STATUS_LABELS[message.status as keyof typeof MESSAGE_STATUS_LABELS] ?? message.status}
            </Badge>
            <Badge variant={APPROVAL_BADGE[message.approval_status as keyof typeof APPROVAL_BADGE] ?? 'slate'}>
              {APPROVAL_LABELS[message.approval_status as keyof typeof APPROVAL_LABELS] ?? message.approval_status}
            </Badge>
            <OwnerChip person={message.owner} />
            <span className="text-slate-400">v{message.version}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <MessageApprovalActions id={message.id} status={message.status} approvalStatus={message.approval_status} canEdit={capabilities.edit} canApprove={capabilities.approve} />
          {['draft', 'pending_approval', 'changes_requested'].includes(message.status) && capabilities.edit && (
            <Link
              href={`/app/messaging/${message.channel}/compose?id=${message.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={12} />
              Edit
            </Link>
          )}
        </div>
      </div>

      <MessageDetailTabs />

      {tab === 'content' && (
        <Panel title="Content">
          <dl className="space-y-3 text-[13px]">
            {message.subject && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500">Subject</dt>
                <dd className="text-slate-900">{message.subject}</dd>
              </div>
            )}
            {content.headline && (
              <div>
                <dt className="text-[11px] font-medium text-slate-500">Headline</dt>
                <dd className="text-slate-900">{content.headline}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Body</dt>
              <dd className="whitespace-pre-wrap text-slate-700">{content.body || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-slate-500">Sender</dt>
              <dd className="text-slate-700">{message.sender_id || '—'}</dd>
            </div>
          </dl>
        </Panel>
      )}

      {tab === 'audience' && (
        <Panel title="Audience">
          {message.audience ? (
            <div className="text-[13px] text-slate-700">
              <p className="font-medium text-slate-900">{message.audience.name}</p>
              <p className="text-slate-500">{formatNumber(message.audience.contact_count)} contacts</p>
            </div>
          ) : (
            <p className="text-[13px] text-slate-400">No audience selected yet.</p>
          )}
        </Panel>
      )}

      {tab === 'delivery' && <DeliveryTab messageId={message.id} />}
      {tab === 'performance' && <PerformanceTab message={message} />}
      {tab === 'versions' && <VersionsTab messageId={message.id} />}

      <div className="mt-3">
        <Panel title="Activity">
          <ActivityFeed items={await messageActivity(supabase, ctx.workspaceId, message.id)} />
        </Panel>
      </div>
    </div>
  )
}

async function DeliveryTab({ messageId }: { messageId: string }) {
  const { supabase } = await getMessagingSession()
  const events = await listDeliveryEvents(supabase, messageId, { limit: 100 })

  if (events.length === 0) {
    return <Panel title="Delivery events"><p className="py-6 text-center text-[13px] text-slate-400">No delivery events recorded yet.</p></Panel>
  }

  return (
    <Panel title="Delivery events" bodyClassName="px-0 pb-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2.5 font-medium">Event</th>
              <th className="px-3 py-2.5 font-medium">Contact</th>
              <th className="px-3 py-2.5 font-medium">Provider ID</th>
              <th className="px-3 py-2.5 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2.5"><Badge variant="slate">{EVENT_LABELS[event.event_type] ?? event.event_type}</Badge></td>
                <td className="px-3 py-2.5 text-slate-600">{event.contact?.email ?? event.contact?.phone ?? '—'}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">{event.provider_message_id ?? '—'}</td>
                <td className="px-3 py-2.5 text-slate-500">{formatShortDate(event.occurred_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PerformanceTab({ message }: { message: Awaited<ReturnType<typeof getMessage>> }) {
  if (!message) return null
  const rows = [
    { label: 'Sent', value: formatNumber(message.sent_count) },
    { label: 'Delivered', value: `${formatNumber(message.delivered_count)} (${formatPercent(message.delivered_count, message.sent_count)})` },
    { label: 'Opened', value: `${formatNumber(message.opened_count)} (${formatPercent(message.opened_count, message.delivered_count)})` },
    { label: 'Clicked', value: `${formatNumber(message.clicked_count)} (${formatPercent(message.clicked_count, message.delivered_count)})` },
    { label: 'Converted', value: formatNumber(message.converted_count) },
    { label: 'Opt-outs', value: formatNumber(message.opt_out_count) },
    { label: 'Failed', value: formatNumber(message.failed_count) },
  ]
  return (
    <Panel title="Performance">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {rows.map(row => (
          <div key={row.label}>
            <dt className="text-[11px] font-medium text-slate-500">{row.label}</dt>
            <dd className="text-[16px] font-semibold text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

async function VersionsTab({ messageId }: { messageId: string }) {
  const { supabase } = await getMessagingSession()
  const versions = await listMessageVersions(supabase, messageId)

  return (
    <Panel title="Versions" bodyClassName="px-0 pb-0">
      {versions.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-slate-400">No saved versions yet.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {versions.map(version => (
            <li key={version.id} className="px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Version {version.version_number}</span>
                <span className="text-[11px] text-slate-400">{formatShortDate(version.created_at)}</span>
              </div>
              {version.change_note && <p className="mt-0.5 text-[12px] text-slate-500">{version.change_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
