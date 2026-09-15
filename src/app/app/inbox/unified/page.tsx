import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { InboxSubNav } from '@/components/inbox/InboxSubNav'
import { InboxKpiStrip } from '@/components/inbox/InboxKpiStrip'
import { InboxThreePane } from '@/components/inbox/InboxThreePane'
import { getInboxSession } from '@/lib/inbox/server'
import { getInboxKpis } from '@/lib/inbox/queries'
import { AccessBlocked } from '@/components/inbox/states'

export const metadata = { title: 'Unified Inbox · Caption Fox' }

export default async function UnifiedInboxPage() {
  const session = await getInboxSession()
  if (!session.canView) return <div className="p-6"><PageHeader title="Unified Inbox" /><AccessBlocked /></div>

  const kpis = await getInboxKpis(session.supabase, session.workspaceId)

  return (
    <div className="p-6">
      <PageHeader title="Unified Inbox" subtitle="Manage all conversations across channels in one place. Respond faster and keep every customer happy.">
        <Link href="/app/settings?tab=channels"><Button variant="secondary" size="sm">Connect channels</Button></Link>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}>Refresh</Button>
      </PageHeader>
      <InboxSubNav counts={{ unassigned: kpis.unassigned }} />
      <InboxKpiStrip kpis={kpis} />
      <InboxThreePane
        workspaceId={session.workspaceId}
        currentUserId={session.userId}
        canReply={session.canReply}
        canAssign={session.canAssign}
        scope="unified"
        baseFilters={{}}
      />
    </div>
  )
}
