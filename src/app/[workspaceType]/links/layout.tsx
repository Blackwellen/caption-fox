import { requireWorkspaceModule } from '@/lib/navigation/session'
import { LinksToaster } from '@/components/link-in-bio/feedback'

/**
 * Link in Bio renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Link in Bio 404s here on direct URL.
 */
export default async function LinksLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('links')
  return (
    <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10">
      {children}
      <LinksToaster />
    </div>
  )
}
