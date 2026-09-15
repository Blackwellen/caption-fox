import { redirect } from 'next/navigation'
import { loadWorkspaceShell } from '@/lib/navigation/session'
import { getNavigationForContext } from '@/lib/navigation/resolver'
import CaptionFoxAppShell from '@/components/shell/app-shell/CaptionFoxAppShell'

// Standalone supplier/seller WORKSPACE (a supplier logs into their own
// workspace — not a portal controlled from a marketer workspace). Requires a
// marketplace_suppliers row; otherwise routes the user to onboarding.
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await loadWorkspaceShell()
  if (!session) redirect('/login?next=/supplier')
  if (!session.supplier) redirect('/marketplace/sell')

  const nav = getNavigationForContext({
    context: 'supplier',
    isPlatformAdmin: session.isPlatformAdmin,
    hasWorkspaces: session.workspaces.length > 0,
  })

  return (
    <CaptionFoxAppShell
      nav={nav}
      user={{ ...session.shellUser, secondary: `${session.supplier.display_name} · Supplier workspace` }}
      context={{ kind: 'supplier', label: session.supplier.display_name }}
      userId={session.user.id}
      workspaces={session.workspaces}
      activeWorkspaceId={session.active?.id ?? null}
      supplier={session.supplier}
      defaultWorkspaceId={session.profile?.default_workspace_id ?? null}
      notifications={session.notifications}
      initialCollapsed={session.collapsed}
    >
      {children}
    </CaptionFoxAppShell>
  )
}
