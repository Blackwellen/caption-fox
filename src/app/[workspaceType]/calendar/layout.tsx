import { notFound, redirect } from 'next/navigation'
import CampaignManagerShell from '@/components/shell/CampaignManagerShell'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { shellConfigs, type ShellSurface } from '@/lib/shell/caption-fox-shell'
import { normaliseRole } from '@/lib/calendar/entitlements'

/**
 * Shared shell for every Calendar route. Resolving auth, workspace membership
 * and shell configuration here means all four pages get identical chrome,
 * identical width and an identical active-navigation state.
 */

const SURFACE_BY_ROUTE: Record<string, ShellSurface> = {
  creator: 'creator',
  business: 'business',
  brand: 'brand',
  agency: 'agency',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Workspace Owner', admin: 'Administrator', manager: 'Marketing Director',
  creator: 'Content Creator', client: 'Client (read-only)',
  analyst: 'Analyst', external_creator: 'Creator (external)',
}

export default async function CalendarLayout({
  children, params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceType: string }>
}) {
  const { workspaceType } = await params
  const surface = SURFACE_BY_ROUTE[workspaceType]
  // Portals and public surfaces do not receive the Campaign Manager Calendar.
  if (!surface) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${workspaceType}/calendar`)

  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)
  if (!active) redirect('/onboarding')

  const [{ data: profile }, { data: member }, { data: supplier }, { data: notifications }] = await Promise.all([
    supabase.from('profiles').select('full_name, is_platform_admin').eq('id', user.id).maybeSingle(),
    supabase.from('workspace_members').select('role').eq('workspace_id', active.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('marketplace_suppliers').select('display_name, verified').eq('user_id', user.id).maybeSingle(),
    supabase.from('notifications')
      .select('id, title, body, link, is_read, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  const role = normaliseRole(member?.role)

  return (
    <CampaignManagerShell
      surface={surface}
      basePath={`/${workspaceType}`}
      activeItemId="calendar"
      workspaces={workspaces}
      activeWorkspaceId={active.id}
      supplier={supplier}
      userName={profile?.full_name ?? null}
      userEmail={user.email ?? null}
      userRole={ROLE_LABEL[role] ?? shellConfigs[surface].role}
      isAdmin={profile?.is_platform_admin ?? false}
      notifications={notifications ?? []}
    >
      {children}
    </CampaignManagerShell>
  )
}
