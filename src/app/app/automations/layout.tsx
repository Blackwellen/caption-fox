import { ToastProvider } from '@/components/campaigns/Toast'
import { requireWorkspaceModule } from '@/lib/navigation/session'

export default async function AutomationsLayout({ children }: { children: React.ReactNode }) {
  // Plan-gated for Business; absent from Creator. Mirrors the sidebar.
  await requireWorkspaceModule('automations')
  return <ToastProvider>{children}</ToastProvider>
}
