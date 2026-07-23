'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Wand2, Calendar, Inbox, Menu, X,
  Megaphone, Video, Link2, BarChart2, Radio, Settings, Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Primary destinations in the bottom bar (≤5). The rest live in the "More" sheet.
const primary = [
  { label: 'Home', href: '/app/home', icon: Home },
  { label: 'Studio', href: '/app/studio', icon: Wand2 },
  { label: 'Calendar', href: '/app/calendar', icon: Calendar },
  { label: 'Inbox', href: '/app/inbox', icon: Inbox },
]

const more = [
  { label: 'Campaigns', href: '/app/campaigns', icon: Megaphone },
  { label: 'UGC', href: '/app/ugc', icon: Video },
  { label: 'Link in Bio', href: '/app/links', icon: Link2 },
  { label: 'Marketplace', href: '/marketplace', icon: Store },
  { label: 'Analytics', href: '/app/analytics', icon: BarChart2 },
  { label: 'Listening', href: '/app/listening', icon: Radio },
  { label: 'Settings', href: '/app/settings', icon: Settings },
]

export default function MobileNav() {
  const pathname = usePathname()
  const [sheet, setSheet] = useState(false)

  return (
    <>
      {/* More sheet */}
      {sheet && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSheet(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-900">More</p>
              <button onClick={() => setSheet(false)} className="p-1 text-slate-400" aria-label="Close menu"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSheet(false)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition-colors',
                    pathname.startsWith(href) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {primary.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn('flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium', active ? 'text-blue-600' : 'text-slate-500')}>
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
        <button onClick={() => setSheet(true)} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-slate-500">
          <Menu size={20} />
          More
        </button>
      </nav>
    </>
  )
}
