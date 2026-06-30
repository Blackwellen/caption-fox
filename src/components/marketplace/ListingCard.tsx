'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, Heart, BadgeCheck, MapPin } from 'lucide-react'
import { formatPrice, typeLabel, type MarketplaceListing } from '@/lib/marketplace/types'

// Premium Airbnb-style 16:9 listing card.
export default function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const [fav, setFav] = useState(false)
  return (
    <Link href={`/marketplace/${listing.id}`} className="group block">
      <div className="relative aspect-video rounded-2xl overflow-hidden" style={{ background: listing.gradient }}>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
        <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur rounded-full text-[11px] font-semibold text-slate-700">
          {typeLabel(listing.supplierType)}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); setFav(f => !f) }}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/85 backdrop-blur hover:scale-105 transition-transform"
          aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Heart size={16} className={fav ? 'fill-rose-500 text-rose-500' : 'text-slate-600'} />
        </button>
        <span className="absolute bottom-3 left-3 right-3 text-white font-semibold text-sm drop-shadow line-clamp-2">{listing.title}</span>
      </div>

      <div className="pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-1 truncate">
            {listing.supplierName}
            {listing.verified && <BadgeCheck size={14} className="text-blue-500 shrink-0" />}
          </p>
          <span className="flex items-center gap-1 text-sm text-slate-700 shrink-0">
            <Star size={13} className="fill-amber-400 text-amber-400" /> {listing.rating.toFixed(1)}
            <span className="text-slate-400">({listing.reviewsCount})</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {listing.location}</p>
        <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{listing.summary}</p>
        <p className="text-sm mt-1.5"><span className="font-bold text-slate-900">{formatPrice(listing.priceCents, listing.currency)}</span> <span className="text-slate-500">· {listing.deliveryDays}d delivery</span></p>
      </div>
    </Link>
  )
}
