'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SUPPLIER_TYPES, type SupplierType } from '@/lib/marketplace/types'
import type { SupplierRow } from '@/lib/marketplace/supplier'
import { BadgeCheck, Loader2, Check } from 'lucide-react'

const TYPE_OPTIONS = SUPPLIER_TYPES.filter(t => t.id !== 'all') as { id: SupplierType; label: string; icon: string }[]

export default function SupplierProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [row, setRow] = useState<SupplierRow | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('marketplace_suppliers').select('*').eq('user_id', user.id).maybeSingle()
      setRow(data as SupplierRow)
      setLoading(false)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  function set<K extends keyof SupplierRow>(k: K, v: SupplierRow[K]) {
    setRow(r => r ? { ...r, [k]: v } : r)
    setSaved(false)
  }

  async function save() {
    if (!row) return
    setSaving(true)
    const { error } = await supabase.from('marketplace_suppliers').update({
      display_name: row.display_name, type: row.type, headline: row.headline,
      bio: row.bio, location: row.location, status: row.status,
    }).eq('id', row.id)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (loading || !row) return <div className="p-8 max-w-2xl mx-auto"><div className="h-8 w-40 bg-slate-100 rounded animate-pulse mb-6" /><div className="h-64 bg-slate-100 rounded-2xl animate-pulse" /></div>

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${row.verified ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
          <BadgeCheck size={13} /> {row.verified ? 'Verified' : 'Pending verification'}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <Field label="Display name">
          <input value={row.display_name} onChange={e => set('display_name', e.target.value)} className={inputCls} />
        </Field>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier type</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.id} type="button" onClick={() => set('type', t.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${row.type === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Headline"><input value={row.headline ?? ''} onChange={e => set('headline', e.target.value)} placeholder="One line that sells you" className={inputCls} /></Field>
        <Field label="Location"><input value={row.location ?? ''} onChange={e => set('location', e.target.value)} placeholder="e.g. London, UK or Remote" className={inputCls} /></Field>
        <Field label="Bio"><textarea value={row.bio ?? ''} onChange={e => set('bio', e.target.value)} rows={4} placeholder="Tell buyers about your experience and style" className={inputCls} /></Field>

        <Field label="Visibility">
          <select value={row.status} onChange={e => set('status', e.target.value as SupplierRow['status'])} className={inputCls}>
            <option value="active">Active — visible in the marketplace</option>
            <option value="paused">Paused — hidden from the marketplace</option>
          </select>
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Save profile
          </button>
          {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>{children}</div>
}
