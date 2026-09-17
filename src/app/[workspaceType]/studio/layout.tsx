import { requireWorkspaceModule } from '@/lib/navigation/session'
import { ToastProvider } from '@/components/campaigns/Toast'

/**
 * Studio renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Studio 404s here on direct URL. Per-tab gates (plan / role) are
 * enforced again by each page through `requireStudioModule`.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('studio')
  return (
    <ToastProvider>
      <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-8 lg:pt-[12px]">{children}</div>
    </ToastProvider>
  )
}
