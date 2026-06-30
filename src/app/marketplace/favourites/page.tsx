import Link from 'next/link'
import { Heart } from 'lucide-react'

export default function FavouritesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-3"><Heart size={22} className="text-rose-500" /></div>
      <h1 className="text-lg font-bold text-slate-900 mb-1">Your favourites</h1>
      <p className="text-sm text-slate-500 mb-5">Save suppliers and services you love to compare them later. Sign in to sync favourites across devices.</p>
      <Link href="/marketplace" className="text-sm font-medium text-blue-600 hover:underline">Browse the marketplace →</Link>
    </div>
  )
}
