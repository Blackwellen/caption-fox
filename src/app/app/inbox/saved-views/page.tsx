import { PageHeader } from '@/components/ui/PageHeader'
import { InboxSubNav } from '@/components/inbox/InboxSubNav'
import { SavedViewsManager } from '@/components/inbox/SavedViewsManager'
import { getInboxSession } from '@/lib/inbox/server'
import { getInboxKpis, listSavedViews } from '@/lib/inbox/queries'
import { AccessBlocked } from '@/components/inbox/states'

export const metadata = { title: 'Inbox Saved Views · Caption Fox' }

export default async function SavedViewsPage() {
  const session = await getInboxSession()
  if (!session.canView) return <div className="p-6"><PageHeader title="Saved Views" /><AccessBlocked /></div>

  const [kpis, { views }] = await Promise.all([
    getInboxKpis(session.supabase, session.workspaceId),
    listSavedViews(session.supabase, session.workspaceId),
  ])

  return (
    <div className="p-6">
      <PageHeader title="Saved Views" subtitle="Save and share reusable Inbox filters so your team can jump straight to the conversations that matter." />
      <InboxSubNav counts={{ unassigned: kpis.unassigned }} />
      <SavedViewsManager workspaceId={session.workspaceId} currentUserId={session.userId} canReply={session.canReply} canAssign={session.canAssign} initialViews={views} />
    </div>
  )
}
