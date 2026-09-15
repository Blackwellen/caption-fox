import CaptionFoxAppShell from './CaptionFoxAppShell'
import FoxAIBubble from '@/components/fox-ai/FoxAIBubble'
import type { WorkspaceShellSession } from '@/lib/navigation/session'

/**
 * Server frame shared by every marketing-workspace layout (/app/* and the
 * type-first /{creator|business|brand|agency}/* routes) so both surfaces get
 * the identical shell, navigation and Fox AI bubble.
 */
export default function WorkspaceShellFrame({ session, children }: { session: WorkspaceShellSession; children: React.ReactNode }) {
  const { active, nav } = session
  if (!active || !nav) return null
  const canAssign = session.isPlatformAdmin || ['owner', 'admin', 'manager'].includes(active.role ?? '')

  return (
    <>
      <CaptionFoxAppShell
        nav={nav}
        user={session.shellUser}
        context={{ kind: 'workspace', label: active.name }}
        userId={session.user.id}
        workspaces={session.workspaces}
        activeWorkspaceId={active.id}
        supplier={session.supplier}
        defaultWorkspaceId={session.profile?.default_workspace_id ?? null}
        notifications={session.notifications}
        initialCollapsed={session.collapsed}
      >
        {children}
      </CaptionFoxAppShell>
      <FoxAIBubble workspaceId={active.id} userId={session.user.id} canAssign={canAssign} />
    </>
  )
}
