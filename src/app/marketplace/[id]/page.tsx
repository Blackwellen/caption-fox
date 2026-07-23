'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Star, BadgeCheck, MapPin, Clock, ShieldCheck, Heart, Check,
  ChevronLeft, Lock, MessageSquare, Loader2, PartyPopper,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getDemoListing } from '@/lib/marketplace/demo'
import { formatPrice, typeLabel, gradientFor, type MarketplaceListing, type SupplierType } from '@/lib/marketplace/types'

type LoadedListing = MarketplaceListing & { supplierId?: string }
interface Review { id: string; name: string; rating: number; body: string }

const DEMO_REVIEWS: Review[] = [
  { id: '1', name: 'Hannah R.', rating: 5, body: 'Delivered ahead of schedule and the content performed brilliantly.' },
  { id: '2', name: 'Daniel O.', rating: 5, body: 'Professional, on-brand and easy to work with. Will book again.' },
  { id: '3', name: 'Aisha M.', rating: 4, body: 'Great quality. Needed one small revision which was handled quickly.' },
]
const ORDER_STEPS = ['Request recorded', 'Supplier confirms availability', 'Work is delivered', 'Payment integration completes']

export default function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [listing, setListing] = useState<LoadedListing | null>(null)
  const [reviews, setReviews] = useState<Review[]>(DEMO_REVIEWS)
  const [checkout, setCheckout] = useState(false)
  const [fav, setFav] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('marketplace_listings')
        .select('id, title, summary, category, price_cents, currency, delivery_days, rating, reviews_count, supplier_id, marketplace_suppliers(display_name, type, verified, location)')
        .eq('id', id)
        .maybeSingle()
      if (data) {
        const sup = (data as { marketplace_suppliers?: { display_name?: string; type?: SupplierType; verified?: boolean; location?: string } | { display_name?: string; type?: SupplierType; verified?: boolean; location?: string }[] }).marketplace_suppliers
        const s = Array.isArray(sup) ? sup[0] : sup
        setListing({
          id: data.id as string, supplierId: data.supplier_id as string,
          supplierName: s?.display_name ?? 'Supplier', supplierType: (s?.type ?? 'freelancer') as SupplierType,
          verified: s?.verified ?? false, title: data.title as string, summary: (data.summary as string) ?? '',
          category: (data.category as string) ?? '', priceCents: data.price_cents as number, currency: (data.currency as string) ?? 'GBP',
          deliveryDays: (data.delivery_days as number) ?? 0, rating: Number(data.rating ?? 0), reviewsCount: (data.reviews_count as number) ?? 0,
          location: s?.location ?? 'Remote', gradient: gradientFor(data.id as string),
        })
        const { data: revs } = await supabase.from('marketplace_reviews').select('id, rating, body').eq('listing_id', id).order('created_at', { ascending: false }).limit(10)
        if (revs && revs.length) setReviews(revs.map(r => ({ id: r.id as string, name: 'Verified buyer', rating: r.rating as number, body: (r.body as string) ?? '' })))
      } else {
        // Fallback to a demo listing (ordering disabled — no real supplier).
        const demo = getDemoListing(id)
        if (demo) setListing(demo)
      }
      setLoading(false)
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id])

  async function placeOrder() {
    if (!listing?.supplierId) return
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/marketplace/${id}`)}`); return }
    setPlacing(true)
    const { error } = await supabase.from('marketplace_orders').insert({
      listing_id: listing.id,
      supplier_id: listing.supplierId,
      buyer_id: user.id,
      amount_cents: listing.priceCents,
      currency: listing.currency,
      status: 'pending', // Payment capture is intentionally disabled until Stripe Connect is configured.
    })
    setPlacing(false)
    if (error) { setError(error.message); return }
    setPlaced(true)
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-10"><div className="aspect-[21/9] bg-slate-100 rounded-3xl animate-pulse mb-6" /><div className="h-8 w-64 bg-slate-100 rounded animate-pulse" /></div>

  if (!listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-slate-500">This listing could not be found.</p>
        <Link href="/marketplace" className="text-blue-600 text-sm font-medium hover:underline mt-2 inline-block">← Back to marketplace</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"><ChevronLeft size={15} /> Back</button>

      <div className="relative aspect-[21/9] rounded-3xl overflow-hidden mb-6" style={{ background: listing.gradient }}>
        <button onClick={() => setFav(f => !f)} className="absolute top-4 right-4 p-2 rounded-full bg-white/85 backdrop-blur" aria-label="Favourite">
          <Heart size={18} className={fav ? 'fill-rose-500 text-rose-500' : 'text-slate-700'} />
        </button>
        <span className="absolute bottom-4 left-4 px-2.5 py-1 bg-white/90 rounded-full text-xs font-semibold text-slate-700">{listing.category}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{typeLabel(listing.supplierType)}</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{listing.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
              <span className="flex items-center gap-1 font-medium text-slate-900">{listing.supplierName}{listing.verified && <BadgeCheck size={15} className="text-blue-500" />}</span>
              <span className="flex items-center gap-1"><Star size={14} className="fill-amber-400 text-amber-400" /> {listing.rating.toFixed(1)} ({listing.reviewsCount} reviews)</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {listing.location}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {listing.deliveryDays}-day delivery</span>
            </div>
          </div>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">About this service</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{listing.summary} This supplier delivers premium, on-brand work tailored to your goals. Share your brief and references, and you&apos;ll receive a first draft within the delivery window, with revisions included.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">What&apos;s included</h2>
            <ul className="space-y-2">
              {['Discovery & brief alignment', 'Concept and scripting', `Delivery within ${listing.deliveryDays} days`, '2 rounds of revisions', 'Full commercial usage rights'].map(i => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-700"><Check size={15} className="text-emerald-500 shrink-0" /> {i}</li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Reviews</h2>
              <span className="flex items-center gap-1 text-sm text-slate-700"><Star size={14} className="fill-amber-400 text-amber-400" /> {listing.rating.toFixed(1)} · {listing.reviewsCount}</span>
            </div>
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-900">{r.name}</p>
                    <span className="flex items-center gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={12} className="fill-amber-400 text-amber-400" />)}</span>
                  </div>
                  <p className="text-sm text-slate-600">{r.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky booking card */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{formatPrice(listing.priceCents, listing.currency)}</p>
            <p className="text-xs text-slate-500 mb-4">{listing.deliveryDays}-day delivery · revisions included</p>

            {placed ? (
              <div className="text-center py-2">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2"><PartyPopper size={20} className="text-emerald-500" /></div>
                <p className="text-sm font-semibold text-slate-900">Order placed</p>
                <p className="text-xs text-slate-500 mt-1">Your booking request is recorded. Payment capture will be enabled after Stripe Connect is configured.</p>
                <Link href="/marketplace" className="inline-block mt-3 text-sm font-medium text-blue-600 hover:underline">Browse more services</Link>
              </div>
            ) : !checkout ? (
              <>
                <button onClick={() => setCheckout(true)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors">
                  {listing.supplierType === 'influencer' || listing.supplierType === 'ugc_creator' ? 'Request booking' : 'Continue'}
                </button>
                <button className="w-full mt-2 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5">
                  <MessageSquare size={15} /> Message supplier
                </button>
                <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5 mb-1.5"><ShieldCheck size={14} /> Secure booking flow (beta)</p>
                  <p className="text-[11px] text-emerald-700">Your request is recorded for supplier coordination. Payment protection will be enabled with Stripe Connect.</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">Checkout</p>
                <div className="space-y-2 mb-4">
                  <Row label={listing.title} value={formatPrice(listing.priceCents, listing.currency)} />
                  <Row label="Buyer protection fee" value={formatPrice(Math.round(listing.priceCents * 0.05), listing.currency)} />
                  <div className="border-t border-slate-100 pt-2"><Row label="Total" value={formatPrice(Math.round(listing.priceCents * 1.05), listing.currency)} bold /></div>
                </div>
                <ol className="space-y-1.5 mb-4">
                  {ORDER_STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2 text-xs text-slate-600"><span className="w-4 h-4 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 flex items-center justify-center">{i + 1}</span> {s}</li>
                  ))}
                </ol>
                {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                <button onClick={placeOrder} disabled={placing || !listing.supplierId} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-1.5">
                  {placing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Request booking
                </button>
                <p className="text-[11px] text-slate-400 mt-2 text-center">{listing.supplierId ? 'Demo booking request — payment capture will be added with Stripe Connect.' : 'Demo listing — booking requests are unavailable.'}</p>
                <button onClick={() => setCheckout(false)} className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700">← Back</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-700'}>{value}</span>
    </div>
  )
}
