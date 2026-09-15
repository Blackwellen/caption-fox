import { requireWorkspaceModule } from '@/lib/navigation/session'

/** Brand & Assets renders inside the canonical shell from app/[workspaceType]/layout.tsx. */
export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('brand')
  return <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</div>
}
