import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { requireWorkspaceModule } from '@/lib/navigation/session'
import { resolveInbox, type ResolvedInbox } from './context'
import { INBOX_ROUTE_SURFACES, visibleInboxTabs } from './entitlements'
import type { InboxTabId } from './types'

export interface InboxPage extends ResolvedInbox {
  routeSegment: string
  basePath: string
  visibleTabs: InboxTabId[]
}

/**
 * Every Inbox route starts here: shell module gate (so a workspace without
 * Inbox in its sidebar cannot open it by URL), session, membership, plan, role,
 * flags and tab entitlement — resolved server-side before any record is read.
 */
export async function getInboxPage(routeSegment: string, tab: InboxTabId): Promise<InboxPage> {
  if (!INBOX_ROUTE_SURFACES[routeSegment]) notFound()
  await requireWorkspaceModule('inbox')
  const resolved = await resolveInbox()
  if (!resolved) redirect(`/login?next=${encodeURIComponent(`/${routeSegment}/inbox/${tab}`)}`)
  const visibleTabs = visibleInboxTabs(resolved.ctx)
  if (!visibleTabs.includes(tab)) notFound()
  return { ...resolved, routeSegment, basePath: `/${routeSegment}/inbox`, visibleTabs }
}
