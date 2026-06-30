'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gbp, LISTING_KINDS, type ListingRow, type ListingKind } from '@/lib/marketplace/supplier'
import { Plus, Package, Pencil, Pause, Play, Archive, Loader2, X } from 'lucide-react'

type Draft = { id?: string; title: string; summary: string; kind: ListingKind; category: string; price: string; delivery_days: string }
const empty: Draft = { title: '', summary: '', kind: 'service', category: '', price: '', delivery_days: '' }

export default function SupplierListingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [listings, setListings] = useState<ListingRow[]>([])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: sup } = await supabase.from('marketplace_suppliers').select('id').eq('user_id', user.id).maybeSingle()
    if (!sup) { setLoading(false); return }
    setSupplierId(sup.id)
    const { data } = await supabase.from('marketplace_listings').select('*').eq('supplier_id', sup.id).order('created_at', { ascending: false })
    setListings((data ?? []) as ListingRow[])
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function save() {
    if (!editing || !supplierId) return
    if (!editing.title.trim()) return
    setSaving(true)
    const payload = {
      supplier_id: supplierId,
      title: editing.title.trim(),
      summary: editing.summary.trim() || null,
      kind: editing.kind,
      category: editing.category.trim() || null,
      price_cents: Math.round((parseFloat(editing.price) || 0) * 100),
      delivery_days: editing.delivery_days ? parseInt(editing.delivery_days) : null,
    }
    const res = editing.id
      ? await supabase.from('marketplace_listings').update(payload).eq('id', editing.id)
      : await supabase.from('marketplace_listings').insert(payload)
    setSaving(false)
    if (!res.error) { setEditing(null); load() }
  }

  async function setStatus(l: ListingRow, status: ListingRow['status']) {
    await supabase.from('marketplace_listings').update({ status }).eq('id', l.id)
    load()
  }

  if (loading) return <div className="p-8 max-w-4xl mx-auto"><div className="h-8 w-40 bg-slate-100 rounded animate-pulse mb-6" /><div className="space-y-3">{[0,1,2].map(i=><div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div></div>

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Listings</h1><p className="text-sm text-slate-500">Create and manage the services you sell.</p></div>
        <button onClick={() => setEditing({ ...empty })} className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"><Plus size={15} /> New listing</button>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3"><Package size={22} className="text-slate-400" /></div>
          <p className="text-sm text-slate-500 mb-4">You don&apos;t have any listings yet.</p>
          <button onClick={() => setEditing({ ...empty })} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg">Create your first listing</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {listings.map(l => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{l.title}</p>
                  <span className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">{l.kind}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${l.status === 'active' ? 'bg-emerald-50 text-emerald-700' : l.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{l.status}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{l.summary ?? l.category ?? '—'}</p>
              </div>
              <p className="text-sm font-bold text-slate-900 shrink-0">{gbp(l.price_cents, l.currency)}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditing({ id: l.id, title: l.title, summary: l.summary ?? '', kind: l.kind, category: l.category ?? '', price: String(l.price_cents / 100), delivery_days: l.delivery_days ? String(l.delivery_days) : '' })} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Edit"><Pencil size={15} /></button>
                {l.status === 'active'
                  ? <button onClick={() => setStatus(l, 'paused')} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Pause"><Pause size={15} /></button>
                  : l.status === 'paused'
                    ? <button onClick={() => setStatus(l, 'active')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Activate"><Play size={15} /></button>
                    : null}
                {l.status !== 'archived' && <button onClick={() => setStatus(l, 'archived')} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Archive"><Archive size={15} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editing.id ? 'Edit listing' : 'New listing'}</h2>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div><label className={labelCls}>Title</label><input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={inputCls} placeholder="e.g. Authentic UGC video bundle" /></div>
            <div><label className={labelCls}>Summary</label><input value={editing.summary} onChange={e => setEditing({ ...editing, summary: e.target.value })} className={inputCls} placeholder="Short one-liner buyers see on the card" /></div>
            <div>
              <label className={labelCls}>Type</label>
              <div className="grid grid-cols-3 gap-2">
                {LISTING_KINDS.map(k => (
                  <button key={k.id} type="button" onClick={() => setEditing({ ...editing, kind: k.id })} title={k.hint}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${editing.kind === k.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{k.label}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Price (£)</label><input value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} className={inputCls} inputMode="decimal" placeholder="180" /></div>
              <div><label className={labelCls}>Delivery (days)</label><input value={editing.delivery_days} onChange={e => setEditing({ ...editing, delivery_days: e.target.value })} className={inputCls} inputMode="numeric" placeholder="5" /></div>
              <div><label className={labelCls}>Category</label><input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className={inputCls} placeholder="UGC Video" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={save} disabled={saving || !editing.title.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center gap-2">{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1'
