'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SEO_TAB_HREF, SEO_TAB_LABELS } from '@/lib/seo/entitlements'
import type { SeoTabId } from '@/lib/seo/types'

/**
 * SEO sub-navigation. Desktop and tablet get a horizontally scrollable tab
 * strip; mobile collapses to a native select so the tabs never wrap or
 * overflow the shell. Tabs the workspace is not entitled to are omitted by
 * the caller — nothing is rendered disabled.
 */
export function SeoSubNav({ tabs, active, query }: { tabs: SeoTabId[]; active: SeoTabId; query?: string }) {
  const router = useRouter()
  if (tabs.length <= 1) return null
  const href = (tab: SeoTabId) => `${SEO_TAB_HREF[tab]}${query ? `?${query}` : ''}`

  return (
    <div className="border-b border-slate-200">
      <div className="sm:hidden">
        <label htmlFor="seo-tab-select" className="sr-only">SEO and Discovery section</label>
        <select
          id="seo-tab-select"
          value={active}
          onChange={event => router.push(href(event.target.value as SeoTabId))}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
        >
          {tabs.map(tab => <option key={tab} value={tab}>{SEO_TAB_LABELS[tab]}</option>)}
        </select>
      </div>

      <nav aria-label="SEO and Discovery sections" className="hidden sm:block">
        <ul className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map(tab => {
            const current = tab === active
            return (
              <li key={tab} role="presentation">
                <Link
                  href={href(tab)}
                  role="tab"
                  aria-selected={current}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    current
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                  )}
                >
                  {SEO_TAB_LABELS[tab]}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
