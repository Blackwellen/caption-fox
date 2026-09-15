import { ToastProvider } from '@/components/campaigns/Toast'
import { requireWorkspaceModule } from '@/lib/navigation/session'

export default async function PartnershipsLayout({ children }: { children: React.ReactNode }) {
  // Plan-gated for Business; absent from Creator. Mirrors the sidebar.
  await requireWorkspaceModule('partnerships')
  return <ToastProvider>{children}</ToastProvider>
}
