import { requireWorkspaceModule } from '@/lib/navigation/session'

/**
 * Social renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Social 404s here on direct URL. Per-surface plan, flag and role
 * gates are resolved inside SocialRoute.
 */
export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('social')
  return <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</div>
}
