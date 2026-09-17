'use client'

import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { INBOX_TAB_LABELS } from '@/lib/inbox/entitlements'
import type { InboxTabId } from '@/lib/inbox/types'

/** Mobile / PWA: the entitled Inbox tabs become a dropdown pinned above the home indicator. */
export default function InboxMobileNav({
  basePath, visibleTabs, activeTab,
}: { basePath: string; visibleTabs: InboxTabId[]; activeTab: InboxTabId }) {
  const router = useRouter()
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 py-2.5 md:hidden"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <label htmlFor="inbox-tab-select" className="sr-only">Inbox section</label>
      <div className="relative">
        <select
          id="inbox-tab-select"
          value={activeTab}
          onChange={event => router.push(`${basePath}/${event.target.value}`)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-9 text-[14px] font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {visibleTabs.map(tab => <option key={tab} value={tab}>{INBOX_TAB_LABELS[tab]}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      </div>
    </div>
  )
}
