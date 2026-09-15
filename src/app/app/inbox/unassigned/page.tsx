import { PageHeader } from '@/components/ui/PageHeader'
import { InboxSubNav } from '@/components/inbox/InboxSubNav'
import { InboxThreePane } from '@/components/inbox/InboxThreePane'
import { getInboxSession } from '@/lib/inbox/server'
import { getInboxKpis } from '@/lib/inbox/queries'
import { AccessBlocked } from '@/components/inbox/states'

export const metadata = { title: 'Unassigned Conversations · Caption Fox' }

export default async function UnassignedInboxPage() {
  const session = await getInboxSession()
  if (!session.canView) return <div className="p-6"><PageHeader title="Unassigned" /><AccessBlocked /></div>

  const kpis = await getInboxKpis(session.supabase, session.workspaceId)

  return (
    <div className="p-6">
      <PageHeader title="Unassigned Conversations" subtitle="Triage and route conversations that don't have an owner yet. New and reopened conversations land here first." />
      <InboxSubNav counts={{ unassigned: kpis.unassigned }} />
      <InboxThreePane
        workspaceId={session.workspaceId}
        currentUserId={session.userId}
        canReply={session.canReply}
        canAssign={session.canAssign}
        scope="unassigned"
        baseFilters={{ assignedTo: 'unassigned', status: ['open'] }}
      />
    </div>
  )
}
