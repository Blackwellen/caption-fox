import { requireMessagingModule } from '@/lib/messaging/server'
import { activeJourneyCount, channelHealth, listJourneys, recentActivity } from '@/lib/messaging/data'
import { CHANNEL_CONFIG_BADGE, CHANNEL_CONFIG_LABELS, CHANNEL_LABELS, JOURNEY_HEALTH_BADGE, JOURNEY_HEALTH_LABELS, JOURNEY_STATUS_BADGE, JOURNEY_STATUS_LABELS } from '@/lib/messaging/constants'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import KpiStrip from '@/components/messaging/KpiStrip'
import ActivityFeed from '@/components/messaging/ActivityFeed'
import NewJourneyButton from '@/components/messaging/NewJourneyButton'
import ExportButton, { HeaderOverflow } from '@/components/messaging/ExportButton'
import { AccessBlocked, MessagingEmpty } from '@/components/messaging/states'
import { OwnerChip, Panel, MESSAGING_PAGE, formatCompactNumber, formatNumber } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { KpiValue } from '@/lib/messaging/types'

export const metadata = {
  title: 'Messaging Journeys · Caption Fox',
  description: 'Orchestrate automated cross-channel lifecycle automations to drive engagement, retention and revenue.',
}

const RIGHT_RAIL = 'w-full shrink-0 space-y-3 xl:w-[292px]'

export default async function MessagingJourneysPage() {
  const { supabase, ctx, capabilities, modules, access } = await requireMessagingModule('journeys')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="journeys" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const [{ rows: journeys, total }, activeCount, activity, health] = await Promise.all([
    listJourneys(supabase, ctx.workspaceId, { limit: 25 }),
    activeJourneyCount(supabase, ctx.workspaceId),
    recentActivity(supabase, ctx.workspaceId, { limit: 6 }),
    channelHealth(supabase, ctx.workspaceId),
  ])

  const contactsInFlow = journeys.reduce((sum, j) => sum + j.contacts_in_flow, 0)
  const avgOnTrack = journeys.length > 0 ? Math.round(journeys.reduce((sum, j) => sum + j.on_track_rate, 0) / journeys.length) : 0
  const avgConversion = journeys.length > 0 ? Math.round(journeys.reduce((sum, j) => sum + j.conversion_rate, 0) / journeys.length) : 0
  const atRiskJourneys = journeys.filter(j => j.health !== 'good')

  const kpis: KpiValue[] = [
    { id: 'active', label: 'Active journeys', value: String(activeCount), hint: `${total} in total`, icon: 'workflow', tone: 'blue' },
    { id: 'contacts', label: 'Contacts in flow', value: formatCompactNumber(contactsInFlow), icon: 'users', tone: 'violet' },
    { id: 'ontrack', label: 'On-track rate', value: `${avgOnTrack}%`, icon: 'check', tone: 'green' },
    { id: 'conversion', label: 'Conversion rate', value: `${avgConversion}%`, icon: 'trend', tone: 'green' },
    {
      id: 'risk', label: 'Journeys at risk', value: String(atRiskJourneys.length),
      hint: atRiskJourneys.length > 0 ? 'Needs attention' : 'All healthy', icon: 'alert', tone: atRiskJourneys.length > 0 ? 'amber' : 'slate',
    },
  ]

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader
        module="journeys" modules={modules}
        actions={
          <>
            <NewJourneyButton />
            <ExportButton entity="journeys" allowed={capabilities.export} />
            <HeaderOverflow items={[{ label: 'Refresh data' }, { label: 'Messaging overview', href: '/app/messaging' }]} />
          </>
        }
      />

      <KpiStrip items={kpis} className="mb-3" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <Panel title="Journeys" bodyClassName="px-0 pb-0">
            {journeys.length === 0 ? (
              <MessagingEmpty
                bare title="No journeys yet"
                message="Build your first automated journey to guide contacts through email, SMS, WhatsApp, RCS and push based on their behaviour."
                action={<NewJourneyButton />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2.5 font-medium">Journey</th>
                      <th className="px-3 py-2.5 font-medium">Audience</th>
                      <th className="px-3 py-2.5 font-medium">Contacts in flow</th>
                      <th className="px-3 py-2.5 font-medium">Conversion rate</th>
                      <th className="px-3 py-2.5 font-medium">Health</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map(journey => (
                      <tr key={journey.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-2.5">
                          <Link href={`/app/messaging/journeys/${journey.id}`} className="truncate font-medium text-slate-900 hover:text-blue-600">{journey.name}</Link>
                          <p className="truncate text-[11px] text-slate-400">{journey.journey_type.replace('_', ' ')}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{journey.audience?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-900">{formatNumber(journey.contacts_in_flow)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{journey.conversion_rate}%</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={JOURNEY_HEALTH_BADGE[journey.health] ?? 'slate'}>{JOURNEY_HEALTH_LABELS[journey.health] ?? journey.health}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={JOURNEY_STATUS_BADGE[journey.status as keyof typeof JOURNEY_STATUS_BADGE] ?? 'slate'}>
                            {JOURNEY_STATUS_LABELS[journey.status as keyof typeof JOURNEY_STATUS_LABELS] ?? journey.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5"><OwnerChip person={journey.owner} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-[12px] text-blue-800">
            Journeys use a real step-based builder (trigger → message/wait/condition → end) with a working execution engine —
            entry, waits and sends all run for real. The drag-and-drop visual canvas from the approved designs is a later visual pass.
          </div>
        </div>

        <div className={RIGHT_RAIL}>
          <Panel title="Recent activity" viewAllHref="/app/messaging/journeys">
            <ActivityFeed items={activity} />
          </Panel>

          <Panel title="Bottleneck alerts" viewAllHref="/app/messaging/journeys" viewAllLabel="View all">
            {atRiskJourneys.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-slate-400">No journeys need attention.</p>
            ) : (
              <ul className="space-y-2">
                {atRiskJourneys.slice(0, 5).map(journey => (
                  <li key={journey.id} className="flex items-center justify-between gap-2">
                    <Link href={`/app/messaging/journeys/${journey.id}`} className="min-w-0 truncate text-[12px] font-medium text-slate-900 hover:text-blue-600">{journey.name}</Link>
                    <Badge variant={JOURNEY_HEALTH_BADGE[journey.health] ?? 'slate'}>{JOURNEY_HEALTH_LABELS[journey.health] ?? journey.health}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Integration health" viewAllHref="/app/messaging/channels" viewAllLabel="View all">
            <ul className="space-y-2">
              {health.map(row => (
                <li key={row.channel} className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-700">{CHANNEL_LABELS[row.channel]}</span>
                  <Badge variant={CHANNEL_CONFIG_BADGE[row.status as keyof typeof CHANNEL_CONFIG_BADGE] ?? 'slate'}>
                    {CHANNEL_CONFIG_LABELS[row.status as keyof typeof CHANNEL_CONFIG_LABELS] ?? row.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
