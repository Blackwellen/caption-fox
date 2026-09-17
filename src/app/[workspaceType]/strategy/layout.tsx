import { requireWorkspaceModule } from '@/lib/navigation/session'
import { StrategyToastProvider } from '@/components/strategy/client/toast'

/**
 * Strategy renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar, so a workspace without Strategy in its
 * navigation 404s on direct URL; each page then checks its own sub-module.
 */
export default async function StrategyLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('strategy')
  return (
    <StrategyToastProvider>
      <div className="min-w-0 bg-sg-canvas px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-[22px] lg:pb-10">
        {children}
      </div>
    </StrategyToastProvider>
  )
}
