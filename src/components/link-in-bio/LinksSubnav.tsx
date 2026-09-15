'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'library', label: 'Link Library', href: '/app/links/library' },
  { id: 'themes', label: 'Themes', href: '/app/links/themes' },
  { id: 'analytics', label: 'Analytics', href: '/app/links/analytics' },
] as const

export default function LinksSubnav({ active }: { active: 'library' | 'themes' | 'analytics' }) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-5 -mt-1">
      {TABS.map(t => (
        <Link
          key={t.id}
          href={t.href}
          className={cn(
            'px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-700',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
