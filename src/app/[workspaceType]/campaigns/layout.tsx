import { requireWorkspaceModule } from '@/lib/navigation/session'
import { ToastProvider } from '@/components/campaigns/Toast'

/**
 * Campaigns renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Campaigns 404s here on direct URL. Sub-tab gates (plan / type / role)
 * are enforced per page by requireCampaignModule().
 */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('campaigns')
  return (
    <ToastProvider>
      <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</div>
    </ToastProvider>
  )
}
