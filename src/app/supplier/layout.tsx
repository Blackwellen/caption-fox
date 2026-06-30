import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SupplierSidebar from '@/components/supplier/SupplierSidebar'
import type { SupplierType } from '@/lib/marketplace/types'

// Standalone supplier/seller WORKSPACE shell (a supplier logs into their own
// workspace — not a portal controlled from a marketer workspace). Requires the
// user to have a marketplace_suppliers row; otherwise routes them to onboarding.
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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SupplierSidebar
        name={supplier.display_name}
        type={supplier.type as SupplierType}
        verified={supplier.verified}
        email={user.email}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
