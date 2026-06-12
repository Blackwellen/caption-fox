import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopNav from '@/components/layout/TopNav'
import FoxAIBubble from '@/components/fox-ai/FoxAIBubble'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_platform_admin')
    .eq('id', user.id)
    .single()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
        isAdmin={profile?.is_platform_admin ?? false}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav workspaceName={workspace?.name ?? 'My Workspace'} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <FoxAIBubble />
    </div>
  )
}
