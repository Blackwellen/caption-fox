import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveWorkspace } from '@/lib/workspace'
import SupplierSidebar from '@/components/supplier/SupplierSidebar'
import TopNav from '@/components/layout/TopNav'
import type { SupplierType } from '@/lib/marketplace/types'

// Standalone supplier/seller WORKSPACE shell (a supplier logs into their own
// workspace — not a portal controlled from a marketer workspace). Requires the
// user to have a marketplace_suppliers row; otherwise routes them to onboarding.
// Uses the same shell chrome as the marketer workspace so the workspace switcher,
// search, notifications and account menu stay available here too.
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/supplier')

  const { data: supplier } = await supabase
    .from('marketplace_suppliers')
    .select('display_name, type, verified')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!supplier) redirect('/marketplace/sell')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, is_platform_admin')
    .eq('id', user.id)
    .single()

  // The switcher needs every workspace the user can reach so they can move
  // between the supplier workspace and their marketer workspaces.
  const { active, workspaces } = await getActiveWorkspace(supabase, user.id)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, link, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SupplierSidebar
        name={supplier.display_name}
        type={supplier.type as SupplierType}
        verified={supplier.verified}
        email={user.email}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          workspaces={workspaces}
          activeWorkspaceId={active?.id ?? null}
          supplier={supplier}
          supplierActive
          variant="supplier"
          userName={profile?.full_name ?? null}
          userEmail={user.email ?? null}
          isAdmin={profile?.is_platform_admin ?? false}
          notifications={notifications ?? []}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
