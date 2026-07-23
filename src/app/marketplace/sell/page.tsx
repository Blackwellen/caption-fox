'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Store, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SUPPLIER_TYPES, type SupplierType } from '@/lib/marketplace/types'
import { slugify } from '@/lib/marketplace/supplier'

const TYPE_OPTIONS = SUPPLIER_TYPES.filter(t => t.id !== 'all') as { id: SupplierType; label: string; icon: string }[]

export default function SellPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', type: 'ugc_creator' as SupplierType, headline: '', location: '' })

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      const { data } = await supabase.from('marketplace_suppliers').select('id').eq('user_id', user.id).maybeSingle()
      if (data) { router.replace('/supplier'); return }
      setChecking(false)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  async function submit() {
    setError(null)
    if (!form.display_name.trim()) { setError('Please enter your name or business name.'); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?next=${encodeURIComponent('/marketplace/sell')}`); return }
    const { error } = await supabase.from('marketplace_suppliers').insert({
      user_id: user.id,
      slug: slugify(form.display_name),
      display_name: form.display_name.trim(),
      type: form.type,
      headline: form.headline.trim() || null,
      location: form.location.trim() || null,
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    router.push('/supplier')
  }

  if (checking) {
    return <div className="max-w-xl mx-auto px-4 py-20 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>
  }

  const benefits = [
    'Reach brands and agencies already creating content in Caption Fox',
    'Prepare for secure payouts when Stripe Connect is enabled',
    'Manage listings, orders, deliveries and disputes from one portal',
  ]

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3"><Store size={22} className="text-blue-600" /></div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Sell your services on Caption Fox</h1>
        <p className="text-sm text-slate-500">UGC creators, freelancers, ads managers, agencies and influencers.</p>
      </div>

      <ul className="space-y-2.5 mb-8">
        {benefits.map(b => <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {b}</li>)}
      </ul>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name or business name</label>
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="e.g. Mara Lewis or Northstar Agency"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">What kind of supplier are you?</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(t => (
              <button key={t.id} type="button" onClick={() => setForm(f => ({ ...f, type: t.id }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${form.type === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Headline <span className="text-slate-400 font-normal">(optional)</span></label>
          <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
            placeholder="e.g. Authentic UGC that converts"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location <span className="text-slate-400 font-normal">(optional)</span></label>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Manchester, UK or Remote"
            className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={submit} disabled={submitting}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Create supplier profile
        </button>
        <p className="text-[11px] text-slate-400 text-center">You can add listings and connect payouts next. <Link href="/marketplace" className="text-blue-600 hover:underline">Back to marketplace</Link></p>
      </div>
    </div>
  )
}
