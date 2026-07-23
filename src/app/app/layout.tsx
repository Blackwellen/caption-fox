import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import MobileNav from '@/components/layout/MobileNav'
import FoxAIBubble from '@/components/fox-ai/FoxAIBubble'
import { ensureDemoWorkspaces } from '@/lib/demo-workspaces'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Provisioning is a convenience, never a hard dependency of the shell — a
  // failure here must not take down every /app route.
  try {
    await ensureDemoWorkspaces(user.id, user.email)
  } catch {
    // Non-fatal: the workspace shell renders from whatever already exists.
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_platform_admin')
    .eq('id', user.id)
    .single()

  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)

  const { data: supplier } = await supabase
    .from('marketplace_suppliers')
    .select('display_name, verified')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, link, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const isAdmin = profile?.is_platform_admin ?? false

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
        isAdmin={isAdmin}
        workspaceType={active?.type}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          workspaces={workspaces}
          activeWorkspaceId={active?.id ?? null}
          supplier={supplier}
          userName={profile?.full_name ?? null}
          userEmail={user.email ?? null}
          isAdmin={isAdmin}
          notifications={notifications ?? []}
        />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNav workspaceType={active?.type} />
      <FoxAIBubble />
    </div>
  )
}
