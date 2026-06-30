'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { gbp, ORDER_STATUS_META, type OrderRow, type SupplierRow } from '@/lib/marketplace/supplier'
import { Package, ShoppingBag, Coins, Star, ArrowRight, Plus, ShieldCheck } from 'lucide-react'

export default function SupplierDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<SupplierRow | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [activeListings, setActiveListings] = useState(0)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: sup } = await supabase.from('marketplace_suppliers').select('*').eq('user_id', user.id).maybeSingle()
      if (!sup) { setLoading(false); return }
      setSupplier(sup as SupplierRow)
      const [ordRes, listRes] = await Promise.all([
        supabase.from('marketplace_orders').select('*').eq('supplier_id', sup.id).order('created_at', { ascending: false }),
        supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('supplier_id', sup.id).eq('status', 'active'),
      ])
      setOrders((ordRes.data ?? []) as OrderRow[])
      setActiveListings(listRes.count ?? 0)
      setLoading(false)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  if (loading) return <div className="p-8 max-w-5xl mx-auto"><div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-6" /><div className="grid grid-cols-4 gap-4">{[0,1,2,3].map(i=><div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div></div>

  const earnings = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount_cents, 0)
  const openOrders = orders.filter(o => ['escrow_held', 'in_progress', 'delivered'].includes(o.status)).length

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Welcome back{supplier ? `, ${supplier.display_name}` : ''}</h1>
          <p className="text-sm text-slate-500">Here&apos;s how your supplier business is doing.</p>
        </div>
        <Link href="/supplier/listings" className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"><Plus size={15} /> New listing</Link>
      </div>

      {supplier && !supplier.verified && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <ShieldCheck size={15} /> Your profile is pending verification. Verified suppliers rank higher and win more orders.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<Coins size={18} className="text-emerald-500" />} label="Earnings (completed)" value={gbp(earnings)} />
        <Stat icon={<ShoppingBag size={18} className="text-blue-500" />} label="Open orders" value={String(openOrders)} />
        <Stat icon={<Package size={18} className="text-violet-500" />} label="Active listings" value={String(activeListings)} />
        <Stat icon={<Star size={18} className="text-amber-500" />} label="Rating" value={supplier ? `${supplier.rating.toFixed(1)} (${supplier.reviews_count})` : '—'} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Recent orders</p>
          <Link href="/supplier/orders" className="text-xs text-blue-600 hover:underline flex items-center gap-1">View all <ArrowRight size={12} /></Link>
        </div>
        {orders.length === 0 ? (
          <p className="px-5 py-10 text-sm text-slate-400 text-center">No orders yet. Add listings to start receiving orders.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {orders.slice(0, 6).map(o => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-600">Order #{o.id.slice(0, 8)}</span>
                <span className="flex items-center gap-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ORDER_STATUS_META[o.status].cls}`}>{ORDER_STATUS_META[o.status].label}</span>
                  <span className="font-medium text-slate-900 tabular-nums">{gbp(o.amount_cents, o.currency)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}
