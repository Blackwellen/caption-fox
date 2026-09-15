import { PageHeader } from '@/components/ui/PageHeader'
import { InboxSubNav } from '@/components/inbox/InboxSubNav'
import { InboxThreePane } from '@/components/inbox/InboxThreePane'
import { AssignmentsWorkload } from '@/components/inbox/AssignmentsWorkload'
import { getInboxSession } from '@/lib/inbox/server'
import { getInboxKpis } from '@/lib/inbox/queries'
import { AccessBlocked } from '@/components/inbox/states'

export const metadata = { title: 'Inbox Assignments · Caption Fox' }

export default async function AssignmentsPage() {
  const session = await getInboxSession()
  if (!session.canView) return <div className="p-6"><PageHeader title="Assignments" /><AccessBlocked /></div>

  const kpis = await getInboxKpis(session.supabase, session.workspaceId)

  return (
    <div className="p-6">
      <PageHeader title="Assignments" subtitle="See who owns what, balance workload across the team and keep every conversation on track." />
      <InboxSubNav counts={{ unassigned: kpis.unassigned }} />
      <AssignmentsWorkload workspaceId={session.workspaceId} />
      <InboxThreePane
        workspaceId={session.workspaceId}
        currentUserId={session.userId}
        canReply={session.canReply}
        canAssign={session.canAssign}
        scope="assignments"
        baseFilters={{ assignedTo: session.canAssign ? 'assigned' : 'me' }}
      />
    </div>
  )
}
