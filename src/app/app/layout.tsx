import { notFound, redirect } from 'next/navigation'
import { ensureDemoWorkspaces } from '@/lib/demo-workspaces'
import { currentPathname, loadWorkspaceShell } from '@/lib/navigation/session'
import { appPathModule } from '@/lib/navigation/app-path'
import { navigationHasItem } from '@/lib/navigation/resolver'
import WorkspaceShellFrame from '@/components/shell/app-shell/WorkspaceShellFrame'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = await currentPathname()
  const session = await loadWorkspaceShell()
  if (!session) redirect(`/login${pathname ? `?next=${encodeURIComponent(pathname)}` : ''}`)

  // Provisioning is a convenience, never a hard dependency of the shell — a
  // failure here must not take down every /app route.
  try {
    await ensureDemoWorkspaces(session.user.id, session.user.email)
  } catch {
    // Non-fatal: the workspace shell renders from whatever already exists.
  }

  // A supplier-only account has no marketing workspace: its home is /supplier.
  if (!session.active) redirect(session.supplier ? '/supplier' : '/onboarding')

  // Direct URLs to a module this workspace does not include 404 instead of
  // rendering (the module layouts enforce the same rule on client navigation).
  const moduleId = pathname ? appPathModule(pathname) : null
  if (moduleId && session.nav && !navigationHasItem(session.nav, moduleId)) notFound()

  return <WorkspaceShellFrame session={session}>{children}</WorkspaceShellFrame>
}
