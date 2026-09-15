import type { ReactNode } from 'react'
import type { ShellNavigation } from '@/lib/navigation/types'
import type { WorkspaceLite } from '@/lib/workspace-shared'
import type { NotificationItem } from '@/components/layout/NotificationsBell'

export type ShellContextKind = 'workspace' | 'supplier' | 'admin' | 'affiliate'

export interface ShellUserInfo {
  name: string
  email: string | null
  initials: string
  /** Second line in the sidebar profile block (workspace/context or email). */
  secondary: string
}

export interface ShellContextInfo {
  kind: ShellContextKind
  /** Workspace name, supplier name, "Platform Admin" or "Affiliate Portal". */
  label: string
  /** Small pill under the wordmark ("Admin Console", "Affiliate Portal"). */
  badge?: string | null
}

export interface AppShellProps {
  nav: ShellNavigation
  user: ShellUserInfo
  context: ShellContextInfo
  userId: string
  workspaces?: WorkspaceLite[]
  activeWorkspaceId?: string | null
  supplier?: { display_name: string } | null
  defaultWorkspaceId?: string | null
  notifications: NotificationItem[]
  initialCollapsed: boolean
  /** Value copied by a `copy-link` primary action (affiliate referral link). */
  copyValue?: string | null
  /** Development QA harness only: resolve the active item from this path. */
  qaPathname?: string
  children: ReactNode
}
