import { notFound } from 'next/navigation'
import { requireMessagingModule } from '@/lib/messaging/server'
import { getJourney, listAudiences } from '@/lib/messaging/data'
import { JOURNEY_HEALTH_BADGE, JOURNEY_HEALTH_LABELS, JOURNEY_STATUS_BADGE, JOURNEY_STATUS_LABELS } from '@/lib/messaging/constants'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import JourneyBuilder from '@/components/messaging/journeys/JourneyBuilder'
import JourneyStatusActions from '@/components/messaging/journeys/JourneyStatusActions'
import { AccessBlocked } from '@/components/messaging/states'
import { MESSAGING_PAGE, formatNumber } from '@/components/messaging/primitives'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Journey · Caption Fox' }

export default async function JourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, ctx, capabilities, modules, channels, access } = await requireMessagingModule('journeys')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="journeys" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const [journey, audiences] = await Promise.all([
    getJourney(supabase, ctx.workspaceId, id),
    listAudiences(supabase, ctx.workspaceId),
  ])
  if (!journey) notFound()

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader
        module="journeys" modules={modules}
        actions={<JourneyStatusActions id={journey.id} status={journey.status} canActivate={capabilities.activateJourneys} canManage={capabilities.manageJourneys} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-slate-900">{journey.name}</h2>
        <Badge variant={JOURNEY_STATUS_BADGE[journey.status as keyof typeof JOURNEY_STATUS_BADGE] ?? 'slate'}>
          {JOURNEY_STATUS_LABELS[journey.status as keyof typeof JOURNEY_STATUS_LABELS] ?? journey.status}
        </Badge>
        <Badge variant={JOURNEY_HEALTH_BADGE[journey.health] ?? 'slate'}>{JOURNEY_HEALTH_LABELS[journey.health] ?? journey.health}</Badge>
        <span className="text-[12px] text-slate-400">{formatNumber(journey.contacts_in_flow)} contacts in flow · {journey.conversion_rate}% conversion</span>
      </div>

      <JourneyBuilder audiences={audiences} channels={channels} existing={journey} />
    </div>
  )
}
