'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gbp, type OrderRow } from '@/lib/marketplace/supplier'
import { Wallet, Lock, Coins, Clock, ShieldCheck } from 'lucide-react'

export default function SupplierPayoutsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRow[]>([])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: sup } = await supabase.from('marketplace_suppliers').select('id').eq('user_id', user.id).maybeSingle()
      if (!sup) { setLoading(false); return }
      const { data } = await supabase.from('marketplace_orders').select('*').eq('supplier_id', sup.id)
      setOrders((data ?? []) as OrderRow[])
      setLoading(false)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  if (loading) return <div className="p-8 max-w-3xl mx-auto"><div className="h-8 w-40 bg-slate-100 rounded animate-pulse mb-6" /><div className="h-40 bg-slate-100 rounded-2xl animate-pulse" /></div>

  const available = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount_cents, 0)
  const pending = orders.filter(o => ['escrow_held', 'in_progress', 'delivered'].includes(o.status)).reduce((s, o) => s + o.amount_cents, 0)

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold text-slate-900">Payouts</h1><p className="text-sm text-slate-500">Connect your account to withdraw earnings securely.</p></div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1.5"><Coins size={18} className="text-emerald-500" /><span className="text-xs text-slate-500">Available to withdraw</span></div>
          <p className="text-2xl font-bold text-slate-900">{gbp(available)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1.5"><Clock size={18} className="text-amber-500" /><span className="text-xs text-slate-500">In escrow (pending)</span></div>
          <p className="text-2xl font-bold text-slate-900">{gbp(pending)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Wallet size={20} className="text-blue-600" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Connect payouts with Stripe</p>
            <p className="text-sm text-slate-500 mt-0.5">Caption Fox uses Stripe Connect to hold buyer payments in escrow and pay you out automatically when an order completes.</p>
            <button disabled className="mt-3 px-4 py-2 bg-slate-200 text-slate-500 text-sm font-semibold rounded-lg cursor-not-allowed flex items-center gap-1.5"><Lock size={14} /> Connect Stripe</button>
            <p className="text-[11px] text-slate-400 mt-2">Enabled once the platform&apos;s Stripe Connect keys are configured.</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-500" /> Funds are protected by escrow and only released after the buyer approves delivery.</p>
    </div>
  )
}
