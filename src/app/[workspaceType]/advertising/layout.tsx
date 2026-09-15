import { requireWorkspaceModule } from '@/lib/navigation/session'

/**
 * Advertising renders inside the canonical shell from app/[workspaceType]/layout.tsx.
 * The module gate mirrors the sidebar: a workspace whose navigation does not
 * include Advertising 404s here on direct URL.
 */
export default async function AdvertisingLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('advertising')
  return <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</div>
}
