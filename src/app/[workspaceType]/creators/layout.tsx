import { ToastProvider } from '@/components/campaigns/Toast'
import { requireWorkspaceModule } from '@/lib/navigation/session'

/**
 * Creators & UGC renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Creators & UGC 404s here on direct URL. Per-module plan and role
 * gates are applied by each page through requireCreatorModule.
 */
export default async function CreatorsLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('creators')
  return (
    <ToastProvider>
      <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-[26px] lg:pb-10">{children}</div>
    </ToastProvider>
  )
}