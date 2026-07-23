'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gbp, ORDER_STATUS_META, nextOrderActions, type OrderRow } from '@/lib/marketplace/supplier'
import { ShoppingBag, Loader2 } from 'lucide-react'

const FILTERS: { id: 'all' | 'open' | 'completed'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
]

export default function SupplierOrdersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: sup } = await supabase.from('marketplace_suppliers').select('id').eq('user_id', user.id).maybeSingle()
    if (!sup) { setLoading(false); return }
    const { data } = await supabase.from('marketplace_orders').select('*').eq('supplier_id', sup.id).order('created_at', { ascending: false })
    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function advance(o: OrderRow, to: OrderRow['status']) {
    setBusy(o.id)
    await supabase.from('marketplace_orders').update({ status: to }).eq('id', o.id)
    setBusy(null)
    load()
  }

  const shown = orders.filter(o =>
    filter === 'all' ? true :
    filter === 'completed' ? o.status === 'completed' :
    ['escrow_held', 'in_progress', 'delivered', 'pending'].includes(o.status),
  )

  if (loading) return <div className="p-8 max-w-4xl mx-auto"><div className="h-8 w-40 bg-slate-100 rounded animate-pulse mb-6" /><div className="space-y-3">{[0,1,2].map(i=><div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div></div>

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold text-slate-900">Orders</h1><p className="text-sm text-slate-500">Manage incoming orders and their payment status (beta).</p></div>

      <div className="flex items-center gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><ShoppingBag size={22} className="text-slate-400" /></div>
          <p className="text-sm text-slate-500">No orders here yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map(o => {
            const actions = nextOrderActions(o.status)
            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString('en-GB')}{o.scheduled_for ? ` · scheduled ${new Date(o.scheduled_for).toLocaleDateString('en-GB')}` : ''}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${ORDER_STATUS_META[o.status].cls}`}>{ORDER_STATUS_META[o.status].label}</span>
                <p className="text-sm font-bold text-slate-900 shrink-0 tabular-nums">{gbp(o.amount_cents, o.currency)}</p>
                <div className="shrink-0">
                  {actions.map(a => (
                    <button key={a.to} onClick={() => advance(o, a.to)} disabled={busy === o.id} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5">
                      {busy === o.id && <Loader2 size={12} className="animate-spin" />} {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">Payment capture and payouts are being connected to Stripe. Order status changes are currently for workspace demo flows.</p>
    </div>
  )
}
