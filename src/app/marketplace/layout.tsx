import Link from 'next/link'
import Image from 'next/image'
import { Search, Heart, Store } from 'lucide-react'

// Marketplace runs as a SEPARATE surface from the workspace app (its own shell).
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/marketplace" className="flex items-center gap-2 shrink-0">
            <Image src="/caption fox favicon.png" alt="Caption Fox" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-slate-900 text-[15px] hidden sm:block">Caption Fox <span className="text-blue-600">Marketplace</span></span>
          </Link>

          <Link href="/marketplace" className="ml-auto md:ml-4 flex-1 max-w-md hidden md:flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-full text-sm text-slate-400 hover:shadow-sm transition-shadow">
            <Search size={15} /> Search services & suppliers…
          </Link>

          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            <Link href="/marketplace/favourites" className="p-2 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Favourites"><Heart size={18} /></Link>
            <Link href="/marketplace/sell" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-full">
              <Store size={15} /> List your services
            </Link>
            <Link href="/app/home" className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Caption Fox Marketplace</span>
          <span className="flex items-center gap-1.5"><Store size={13} /> Payments held in escrow · protected by dispute resolution</span>
        </div>
      </footer>
    </div>
  )
}
