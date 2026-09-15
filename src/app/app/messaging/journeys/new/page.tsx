import { requireMessagingModule } from '@/lib/messaging/server'
import { listAudiences } from '@/lib/messaging/data'
import MessagingHeader from '@/components/messaging/MessagingHeader'
import JourneyBuilder from '@/components/messaging/journeys/JourneyBuilder'
import { AccessBlocked } from '@/components/messaging/states'
import { MESSAGING_PAGE } from '@/components/messaging/primitives'

export const metadata = { title: 'New Journey · Caption Fox' }

export default async function NewJourneyPage() {
  const { supabase, ctx, modules, channels, access } = await requireMessagingModule('journeys')

  if (!access.allowed) {
    return (
      <div className={MESSAGING_PAGE}>
        <MessagingHeader module="journeys" modules={modules} />
        <AccessBlocked access={access} />
      </div>
    )
  }

  const audiences = await listAudiences(supabase, ctx.workspaceId)

  return (
    <div className={MESSAGING_PAGE}>
      <MessagingHeader module="journeys" modules={modules} />
      <h2 className="mb-3 text-[15px] font-semibold text-slate-900">New journey</h2>
      <JourneyBuilder audiences={audiences} channels={channels} />
    </div>
  )
}
