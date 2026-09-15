import Link from 'next/link'
import { requireMessagingModule } from '@/lib/messaging/server'
import { channelHealth, listMessages, listTemplates, messagingAggregates, recentActivity } from '@/lib/messaging/data'
import { parseMessagingQuery, type RawParams } from '@/lib/messaging/query'
import {
  CHANNEL_CONFIG_BADGE, CHANNEL_CONFIG_LABELS, CHANNEL_LABELS, TEMPLATE_STATUS_BADGE, TEMPLATE_STATUS_LABELS,
  type MessagingChannel, type MessagingModule,
} from '@/lib/messaging/constants'
import MessagingHeader from './MessagingHeader'
import KpiStrip from './KpiStrip'
import CampaignFilters from '@/components/campaigns/CampaignFilters'
import ActivityFeed from './ActivityFeed'
import NewMessageButton from './NewMessageButton'
import NewJourneyButton from './NewJourneyButton'
import ImportAudienceButton from './ImportAudienceButton'
import ExportButton, { HeaderOverflow } from './ExportButton'
import MessagingProgramsTable from './MessagingProgramsTable'
import { AccessBlocked, LoadError } from './states'
import { Panel, MESSAGING_PAGE, formatPercent } from './primitives'
import { Badge } from '@/components/ui/Badge'
import type { KpiValue } from '@/lib/messaging/types'

const MODULE_CHANNEL: Partial<Record<MessagingModule, MessagingChannel>> = {
  email: 'email', sms: 'sms', whatsapp: 'whatsapp', rcs: 'rcs', push: 'push',
}

/** Right rail width matches the approved design's fixed-width panel column. */
const RIGHT_RAIL = 'w-full shrink-0 space-y-3 xl:w-[292px]'

/**
 * Shared render for the five single-channel Messaging surfaces (Email, SMS,
 * WhatsApp, RCS, Push). Each route's page.tsx sets its own `metadata` and
 * renders this with its module id — the header, KPI logic, filters, table,
 * template-approval queue and channel-health panel are identical in shape,
 * only the channel scope differs. Layout is a fixed-width right rail beside
 * the main content column, matching the approved design's proportions.
 *
 * The rich per-channel composer, live preview and journey canvas shown in the
 * approved designs are a later Messaging phase — this phase wires the route,
 * entitlements, schema and every metric to real data so the surface is
 * truthful rather than decorative while that composer is built.
 */
export default async function MessagingChannelPage({
  module, searchParams,
}: { module: MessagingModule; searchParams: Promise<RawParams> }) {
  const channel = MODULE_CHANNEL[module]
  if (!channel) throw new Error(`MessagingChannelPage called with a non-channel module: ${module}`)

  const params = await searchParams
  const { supabase, ctx, capabilities, modules, channels, access } = await requireMessagingModule(module)

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module={module} modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const query = parseMessagingQuery(params)

  const [aggregates, programs, activity, health, members, templates] = await Promise.all([
    messagingAggregates(supabase, ctx.workspaceId, { channels: [channel] }),
    listMessages(supabase, ctx.workspaceId, query, { channels: [channel], limit: 25 }),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
    channelHealth(supabase, ctx.workspaceId),
    supabase.from('workspace_members').select('user_id, profiles(id, full_name, email, avatar_url)').eq('workspace_id', ctx.workspaceId),
    listTemplates(supabase, ctx.workspaceId, { channels: [channel], limit: 25 }),
  ])

  const channelStatus = health.find(row => row.channel === channel)
  const memberList = (members.data ?? [])
    .map(row => { const p = row.profiles; return Array.isArray(p) ? p[0] : p })
    .filter((p): p is { id: string; full_name: string | null; email: string | null; avatar_url: string | null } => Boolean(p?.id))
  const pendingTemplates = templates.rows.filter(t => t.status === 'in_review' || t.status === 'draft').slice(0, 5)

  const kpis: KpiValue[] = [
    {
      id: 'sent', label: `${CHANNEL_LABELS[channel]} messages sent`,
      value: new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(aggregates.totalSent),
      hint: `${aggregates.totalPrograms} programs`, icon: 'mail', tone: 'blue',
    },
    { id: 'delivery', label: 'Delivery rate', value: formatPercent(aggregates.totalDelivered, aggregates.totalSent), icon: 'check', tone: 'green' },
    { id: 'open', label: 'Open / read rate', value: formatPercent(aggregates.totalOpened, aggregates.totalDelivered), icon: 'gauge', tone: 'blue' },
    { id: 'click', label: 'Click rate', value: formatPercent(aggregates.totalClicked, aggregates.totalDelivered), icon: 'click', tone: 'violet' },
    { id: 'conversion', label: 'Conversion rate', value: formatPercent(aggregates.totalConverted, aggregates.totalDelivered), icon: 'trend', tone: 'green' },
    {
      id: 'review', label: 'Needing review', value: String(aggregates.pendingApproval),
      hint: aggregates.pendingApproval > 0 ? 'Awaiting approval' : 'All clear', icon: 'alert',
      tone: aggregates.pendingApproval > 0 ? 'amber' : 'slate',
    },
  ]

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader
        module={module} modules={modules}
        actions={
          <>
            {channels.includes(channel) && <NewMessageButton channels={[channel]} />}
            <NewJourneyButton href="/app/messaging/journeys/new" />
            <ImportAudienceButton allowed={capabilities.import} />
            <ExportButton entity="messages" allowed={capabilities.export} />
            <HeaderOverflow items={[
              { label: 'Refresh data' },
              { label: 'Messaging overview', href: '/app/messaging' },
              { label: 'Templates', href: '/app/messaging/templates' },
            ]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <CampaignFilters
            filters={[
              { key: 'owner', label: 'Owner', options: memberList.map(m => ({ value: m.id, label: m.full_name ?? m.email ?? 'Member' })) },
              { key: 'status', label: 'Status', options: [
                { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Pending approval' },
                { value: 'scheduled', label: 'Scheduled' }, { value: 'sending', label: 'Sending' },
                { value: 'sent', label: 'Sent' }, { value: 'paused', label: 'Paused' },
              ] },
            ]}
          />

          {programs.error && <LoadError message={programs.error} />}

          <Panel
            title={`${CHANNEL_LABELS[channel]} programs`} info="Delivery and engagement for every program on this channel"
            bodyClassName="px-0 pb-0"
          >
            <MessagingProgramsTable
              rows={programs.rows} bare canEdit={capabilities.edit} canApprove={capabilities.approve}
              emptyMessage={`Create your first ${CHANNEL_LABELS[channel]} message to start tracking delivery, engagement and conversions here.`}
            />
          </Panel>
        </div>

        <div className={RIGHT_RAIL}>
          <Panel title="Recent activity" viewAllHref={`/app/messaging/${channel}`}>
            <ActivityFeed items={activity} />
          </Panel>

          <Panel title="Template approvals" viewAllHref="/app/messaging/templates" viewAllLabel="View all">
            {pendingTemplates.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">Nothing needs review.</p>
            ) : (
              <ul className="space-y-2">
                {pendingTemplates.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] font-medium text-slate-900">{t.name}</span>
                    <Badge variant={TEMPLATE_STATUS_BADGE[t.status as keyof typeof TEMPLATE_STATUS_BADGE] ?? 'slate'}>
                      {TEMPLATE_STATUS_LABELS[t.status as keyof typeof TEMPLATE_STATUS_LABELS] ?? t.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`${CHANNEL_LABELS[channel]} channel health`} viewAllHref="/app/messaging/channels" viewAllLabel="Manage">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
              <span className="text-[12px] font-medium text-slate-700">{CHANNEL_LABELS[channel]} connection</span>
              <Badge variant={CHANNEL_CONFIG_BADGE[(channelStatus?.status ?? 'not_connected') as keyof typeof CHANNEL_CONFIG_BADGE]}>
                {CHANNEL_CONFIG_LABELS[(channelStatus?.status ?? 'not_connected') as keyof typeof CHANNEL_CONFIG_LABELS]}
              </Badge>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              {channelStatus?.status === 'connected'
                ? `Connected via ${channelStatus.provider ?? 'a configured provider'}.`
                : (
                  <>Connect a {CHANNEL_LABELS[channel]} provider in <Link href="/app/messaging/channels" className="font-medium text-blue-600 hover:text-blue-700">Messaging → Channels</Link> using your own account credentials to start sending.</>
                )}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
