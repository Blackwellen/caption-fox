'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, LayoutGrid, Mic, Star, Users, Video } from 'lucide-react'
import type { EventsTabId } from '@/lib/events/types'
import { EVENTS_TAB_LABELS } from '@/lib/events/entitlements'

const ICONS: Record<EventsTabId, typeof CalendarDays> = {
  overview: LayoutGrid,
  events: Users,
  webinars: Video,
  podcasts: Mic,
  sponsorships: Star,
  'follow-up': CheckCircle2,
}

/**
 * Mobile / PWA module navigation.
 * The reference layout uses six horizontal tabs, which do not fit a phone —
 * so on mobile the same entitled tab list becomes a dropdown selector, and
 * safe-area padding keeps it clear of the iOS home indicator.
 */
export default function EventsMobileNav({
  basePath, visibleTabs, activeTab,
}: { basePath: string; visibleTabs: EventsTabId[]; activeTab: EventsTabId }) {
  const router = useRouter()

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-2.5 md:hidden"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <label htmlFor="events-tab-select" className="sr-only">Events section</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600">
          {(() => { const Icon = ICONS[activeTab]; return <Icon size={17} aria-hidden /> })()}
        </span>
        <select
          id="events-tab-select"
          value={activeTab}
          onChange={event => {
            const tab = event.target.value as EventsTabId
            router.push(tab === 'overview' ? basePath : `${basePath}/${tab}`)
          }}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-[14px] font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {visibleTabs.map(tab => (
            <option key={tab} value={tab}>{EVENTS_TAB_LABELS[tab]}</option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="12" height="12" viewBox="0 0 12 12" aria-hidden
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
