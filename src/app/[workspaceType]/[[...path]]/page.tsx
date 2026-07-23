import { notFound, redirect } from 'next/navigation'
import CaptionFoxShell from '@/components/shell/CaptionFoxShell'
import type { ShellSurface } from '@/lib/shell/caption-fox-shell'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import { ensureDemoWorkspaces } from '@/lib/demo-workspaces'

const surfaceByRoute: Record<string, ShellSurface> = {
  creator: 'creator',
  business: 'business',
  brand: 'brand',
  agency: 'agency',
  'affiliate-portal': 'affiliate',
  'publisher-portal': 'publisher',
  'client-portal': 'portal-client',
  'creator-portal': 'portal-creator',
  'buyer-portal': 'portal-buyer',
  'link-page': 'public-link',
}

/** Canonical type-first routes for Jamahl's seeded workspace and portal demos. */
export default async function WorkspaceTypeShellPage({ params }: { params: Promise<{ workspaceType: string; path?: string[] }> }) {
  const { workspaceType, path = [] } = await params
  const surface = surfaceByRoute[workspaceType]
  if (!surface) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${workspaceType}`)
  if (user.email?.toLowerCase() !== 'jamahlthomas1996@gmail.com') notFound()
  await ensureDemoWorkspaces(user.id, user.email)

  // Real workspaces so the shell header shows a working switcher rather than a
  // static label — provisioning runs first so newly seeded workspaces appear.
  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)
  const { data: supplier } = await supabase
    .from('marketplace_suppliers')
    .select('display_name, verified')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <CaptionFoxShell
      surface={surface}
      path={path}
      basePath={`/${workspaceType}`}
      workspaces={workspaces}
      activeWorkspaceId={active?.id ?? null}
      supplier={supplier}
    />
  )
}
