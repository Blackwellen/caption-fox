'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, MapPin, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_LISTINGS } from '@/lib/marketplace/demo'
import { SUPPLIER_TYPES, gradientFor, type SupplierType, type MarketplaceListing } from '@/lib/marketplace/types'
import ListingCard from '@/components/marketplace/ListingCard'
import { cn } from '@/lib/utils'

export default function MarketplaceBrowsePage() {
  const supabase = createClient()
  const [type, setType] = useState<SupplierType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recommended' | 'rating' | 'price_low' | 'price_high'>('recommended')
  const [all, setAll] = useState<MarketplaceListing[]>(DEMO_LISTINGS)
  const [live, setLive] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, title, summary, category, price_cents, currency, delivery_days, rating, reviews_count, marketplace_suppliers(display_name, type, verified, location)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error || !data || data.length === 0) return // keep demo fallback
      const mapped: MarketplaceListing[] = data.map((r) => {
        const sup = (r as { marketplace_suppliers?: { display_name?: string; type?: SupplierType; verified?: boolean; location?: string } | { display_name?: string; type?: SupplierType; verified?: boolean; location?: string }[] }).marketplace_suppliers
        const s = Array.isArray(sup) ? sup[0] : sup
        return {
          id: r.id as string,
          supplierName: s?.display_name ?? 'Supplier',
          supplierType: (s?.type ?? 'freelancer') as SupplierType,
          verified: s?.verified ?? false,
          title: r.title as string,
          summary: (r.summary as string) ?? '',
          category: (r.category as string) ?? '',
          priceCents: r.price_cents as number,
          currency: (r.currency as string) ?? 'GBP',
          deliveryDays: (r.delivery_days as number) ?? 0,
          rating: Number(r.rating ?? 0),
          reviewsCount: (r.reviews_count as number) ?? 0,
          location: s?.location ?? 'Remote',
          gradient: gradientFor(r.id as string),
        }
      })
      setAll(mapped)
      setLive(true)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  const listings = useMemo(() => {
    let out = all.filter(l =>
      (type === 'all' || l.supplierType === type) &&
      (query.trim() === '' || (l.title + l.summary + l.supplierName + l.category).toLowerCase().includes(query.toLowerCase())),
    )
    if (sort === 'rating') out = [...out].sort((a, b) => b.rating - a.rating)
    else if (sort === 'price_low') out = [...out].sort((a, b) => a.priceCents - b.priceCents)
    else if (sort === 'price_high') out = [...out].sort((a, b) => b.priceCents - a.priceCents)
    return out
  }, [all, type, query, sort])

  return (
    <div>
      <section className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Hire the best social & marketing talent</h1>
          <p className="text-slate-500 mt-2">UGC creators, ads managers, freelancers, agencies and influencers — discover the right support for your next campaign.</p>
          <div className="mt-6 flex items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm max-w-xl mx-auto">
            <Search size={18} className="text-slate-400 ml-3" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a service, skill or supplier…" className="flex-1 py-2.5 text-sm bg-transparent focus:outline-none" />
            <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-colors">Search</button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1">
          <div className="flex items-center gap-2">
            {SUPPLIER_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border',
                  type === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="text-sm border border-slate-200 rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="recommended">Recommended</option>
              <option value="rating">Top rated</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
            <button className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:border-slate-300">
              <SlidersHorizontal size={14} /> Filters
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 mb-5">
          <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-500" /> Secure supplier booking flow (beta)</span>
          <span className="flex items-center gap-1"><MapPin size={13} className="text-blue-500" /> UK & remote suppliers</span>
          <span className="text-slate-400">{listings.length} results</span>
        </div>

        {listings.length === 0 ? (
          <p className="text-center py-16 text-slate-400">No suppliers match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}

        {!live && <p className="mt-10 text-center text-xs text-slate-400">Showing demo listings — live <code>marketplace_listings</code> appear automatically once suppliers publish.</p>}
      </div>
    </div>
  )
}
