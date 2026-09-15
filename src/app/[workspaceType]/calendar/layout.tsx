import { requireWorkspaceModule } from '@/lib/navigation/session'

/** Calendar renders inside the canonical shell from app/[workspaceType]/layout.tsx. */
export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceModule('calendar')
  return <div className="px-4 pb-24 pt-5 sm:px-6 sm:pt-7 lg:pb-10">{children}</div>
}
