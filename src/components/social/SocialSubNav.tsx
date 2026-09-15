'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SOCIAL_SURFACES, SURFACE_LABELS, type SocialSurface } from '@/lib/social/entitlements'

const ROUTES: Record<SocialSurface, string> = {
  overview: '/app/social',
  publishing: '/app/social/publishing',
  engagement: '/app/social/engagement',
  listening: '/app/social/listening',
  connections: '/app/social/connections',
  analytics: '/app/social/analytics',
}

export function SocialSubNav({ visible }: { visible: SocialSurface[] }) {
  const pathname = usePathname()
  return (
    <div className="mb-5 overflow-x-auto border-b border-slate-200">
      <nav className="flex min-w-max gap-1" aria-label="Social">
        {SOCIAL_SURFACES.filter(surface => visible.includes(surface)).map(surface => {
          const href = ROUTES[surface]
          const active = pathname === href
          return (
            <Link
              key={surface}
              href={href}
              className={cn(
                'border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {SURFACE_LABELS[surface]}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
