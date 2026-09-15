import { notFound, redirect } from 'next/navigation'
import { currentPathname, loadWorkspaceShell } from '@/lib/navigation/session'
import { isWorkspaceKind } from '@/lib/navigation/resolver'
import WorkspaceShellFrame from '@/components/shell/app-shell/WorkspaceShellFrame'

/**
 * The single shell for every type-first workspace route (/creator, /business,
 * /brand, /agency). Module layouts below this one render content only.
 */
export default async function WorkspaceTypeLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceType: string }>
}) {
  const { workspaceType } = await params
  if (!isWorkspaceKind(workspaceType)) notFound()

  const pathname = (await currentPathname()) ?? `/${workspaceType}`
  const session = await loadWorkspaceShell()
  if (!session) redirect(`/login?next=${encodeURIComponent(pathname)}`)
  if (!session.active) redirect(session.supplier ? '/supplier' : '/onboarding')

  // The URL always reflects the active workspace's type, so a /brand link can
  // never render Brand navigation over an Agency workspace's data.
  if (session.kind !== workspaceType) {
    redirect(pathname.replace(new RegExp(`^/${workspaceType}(?=/|$)`), `/${session.kind}`))
  }

  return <WorkspaceShellFrame session={session}>{children}</WorkspaceShellFrame>
}
