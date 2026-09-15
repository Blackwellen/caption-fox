import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { readNavCollapsed } from '@/lib/shell/nav-preference'
import type { NotificationItem } from '@/components/layout/NotificationsBell'
import { getNavigationForContext, navigationHasItem, normalisePlan, workspaceKindFromType } from './resolver'
import type { NavEntitlementContext, ShellNavigation, WorkspaceKind } from './types'

/** The request path forwarded by middleware (layouts cannot read it otherwise). */
export async function currentPathname(): Promise<string | null> {
  return (await headers()).get('x-cf-pathname')
}

export function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const fromName = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('')
  return fromName || email?.[0]?.toUpperCase() || '?'
}

const WORKSPACE_TYPE_LABEL: Record<WorkspaceKind, string> = {
  creator: 'Creator workspace', business: 'Business workspace', brand: 'Brand workspace', agency: 'Agency workspace',
}

/**
 * Resolves everything the workspace shell needs in one place, once per request
 * (React cache dedupes the call between nested layouts, pages and guards).
 * Returns null when there is no signed-in user.
 */
export const loadWorkspaceShell = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ active, workspaces }, { data: profile }, { data: supplier }, { data: notifications }] = await Promise.all([
    getActiveWorkspace(supabase, user.id),
    supabase.from('profiles').select('full_name, is_platform_admin, default_workspace_id').eq('id', user.id).maybeSingle(),
    supabase.from('marketplace_suppliers').select('display_name, verified').eq('user_id', user.id).maybeSingle(),
    supabase.from('notifications')
      .select('id, title, body, link, is_read, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  const workspaceRow = active
    ? (await supabase.from('workspaces').select('plan, plan_status, settings').eq('id', active.id).maybeSingle()).data
    : null

  const isPlatformAdmin = profile?.is_platform_admin ?? false
  const kind = workspaceKindFromType(active?.type)
  const settings = (workspaceRow?.settings ?? {}) as Record<string, unknown>
  const entitlements: NavEntitlementContext = {
    workspaceType: kind,
    plan: (workspaceRow?.plan as string | null) ?? null,
    planStatus: (workspaceRow?.plan_status as string | null) ?? null,
    role: active?.role ?? null,
    flags: (settings.feature_flags ?? null) as Record<string, boolean> | null,
    isPlatformAdmin,
  }
  const nav: ShellNavigation | null = active
    ? getNavigationForContext({ context: kind, entitlements, isPlatformAdmin })
    : null

  return {
    supabase,
    user,
    profile,
    active,
    workspaces,
    supplier,
    notifications: (notifications ?? []) as NotificationItem[],
    kind,
    entitlements,
    plan: normalisePlan(entitlements.plan),
    nav,
    isPlatformAdmin,
    collapsed: await readNavCollapsed(user.id),
    shellUser: {
      name: profile?.full_name ?? user.email?.split('@')[0] ?? 'Your account',
      email: user.email ?? null,
      initials: initialsFor(profile?.full_name, user.email),
      secondary: active ? `${active.name} · ${WORKSPACE_TYPE_LABEL[kind]}` : (user.email ?? ''),
    },
  }
})

export type WorkspaceShellSession = NonNullable<Awaited<ReturnType<typeof loadWorkspaceShell>>>

/**
 * Server-side twin of the sidebar: a module the resolved navigation does not
 * contain (wrong workspace type, missing Business entitlement, cancelled plan,
 * module flag off) 404s on direct URL instead of rendering.
 */
export async function requireWorkspaceModule(moduleId: string): Promise<WorkspaceShellSession> {
  const session = await loadWorkspaceShell()
  if (!session) redirect(`/login?next=${encodeURIComponent((await currentPathname()) ?? '/app/home')}`)
  if (!session.active) redirect('/onboarding')
  if (!session.nav || !navigationHasItem(session.nav, moduleId)) notFound()
  return session
}
