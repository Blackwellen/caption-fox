'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Home, Calendar, Megaphone, Wand2, Video, Inbox, BarChart2,
  Radio, Link2, Settings, Plus, FileText, CalendarPlus, UserPlus, ArrowRight, Gift, Store, Handshake,
  Target, LibraryBig, BadgeDollarSign, Mail, Globe2, FileSearch, Users, Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { workspaceRouteSegment } from '@/lib/workspace-shared'

interface Command {
  label: string
  href: string
  group: 'Go to' | 'Create'
  icon: React.ElementType
  keywords?: string
}

// Mirrors Sidebar.tsx's information architecture so ⌘K never drifts out of
// sync with the real sidebar. Sections only wired up on the type-first
// surface route there instead of the still-unbuilt /app/* fixture.
function buildCommands(typedBase: string | null): Command[] {
  const typed = (segment: string, fallback: string) => typedBase ? `${typedBase}/${segment}` : fallback
  return [
    { label: 'Home', href: '/app/home', group: 'Go to', icon: Home, keywords: 'dashboard overview' },
    { label: 'Strategy', href: '/app/strategy', group: 'Go to', icon: Target, keywords: 'plan goals north star' },
    { label: 'Studio', href: '/app/studio', group: 'Go to', icon: Wand2, keywords: 'create content ai generate' },
    { label: 'Calendar', href: '/app/calendar', group: 'Go to', icon: Calendar, keywords: 'schedule plan' },
    { label: 'Campaigns', href: '/app/campaigns', group: 'Go to', icon: Megaphone, keywords: 'giveaways competitions' },
    { label: 'Brand & Assets', href: typed('brand', '/app/brand'), group: 'Go to', icon: LibraryBig, keywords: 'logo guidelines rights assets' },
    { label: 'Creators and UGC', href: '/app/creators', group: 'Go to', icon: Video, keywords: 'creators briefs submissions rights payments' },
    { label: 'Link in Bio', href: '/app/links', group: 'Go to', icon: Link2, keywords: 'links bio page' },
    { label: 'Social', href: '/app/social', group: 'Go to', icon: Radio, keywords: 'posts publishing channels' },
    { label: 'Advertising', href: typed('advertising', '/app/advertising'), group: 'Go to', icon: BadgeDollarSign, keywords: 'ads campaigns accounts creatives audiences reports' },
    { label: 'Messaging', href: '/app/messaging', group: 'Go to', icon: Mail, keywords: 'email sms journeys campaigns' },
    { label: 'Web & Conversion', href: '/app/web', group: 'Go to', icon: Globe2, keywords: 'landing pages conversion forms' },
    { label: 'SEO & Discovery', href: '/app/seo', group: 'Go to', icon: FileSearch, keywords: 'search keywords rankings' },
    { label: 'Inbox', href: '/app/inbox', group: 'Go to', icon: Inbox, keywords: 'messages comments dms engage' },
    { label: 'Analytics', href: '/app/analytics', group: 'Go to', icon: BarChart2, keywords: 'reports performance measure' },
    { label: 'Listening', href: '/app/listening', group: 'Go to', icon: Radio, keywords: 'mentions monitoring' },
    { label: 'PR & Reputation', href: '/app/reputation', group: 'Go to', icon: Radio, keywords: 'reviews reputation press' },
    { label: 'Community', href: '/app/community', group: 'Go to', icon: Users, keywords: 'community members engagement' },
    { label: 'Events', href: typed('events', '/app/events'), group: 'Go to', icon: Calendar, keywords: 'webinars podcasts sponsorships registrations' },
    { label: 'Leads & Audiences', href: '/app/audiences', group: 'Go to', icon: Users, keywords: 'leads segments crm' },
    { label: 'Affiliates', href: '/app/affiliates', group: 'Go to', icon: Gift, keywords: 'referral earn commission affiliate' },
    { label: 'Partnerships', href: '/app/partnerships', group: 'Go to', icon: Handshake, keywords: 'affiliates referrals ambassadors loyalty resellers co-marketing programmes partners commissions payouts' },
    { label: 'Marketplace', href: '/app/marketplace', group: 'Go to', icon: Store, keywords: 'hire suppliers ugc freelancers ads agencies influencers' },
    { label: 'Supplier workspace', href: '/supplier', group: 'Go to', icon: Store, keywords: 'sell seller listings orders payouts supplier dashboard workspace' },
    { label: 'Finance', href: '/app/finance', group: 'Go to', icon: BadgeDollarSign, keywords: 'invoices spend budget billing' },
    { label: 'Automations', href: '/app/automations', group: 'Go to', icon: Workflow, keywords: 'recipes triggers actions workflows' },
    { label: 'Settings', href: '/app/settings', group: 'Go to', icon: Settings, keywords: 'team billing workspace account' },
    { label: 'New Post', href: '/app/studio?action=new-post', group: 'Create', icon: FileText },
    { label: 'New Campaign', href: '/app/campaigns?action=new', group: 'Create', icon: Megaphone },
    { label: 'Generate Content Plan', href: '/app/studio?action=plan', group: 'Create', icon: CalendarPlus },
    { label: 'New UGC Brief', href: '/app/creators/briefs?action=new', group: 'Create', icon: Video },
    { label: 'Invite Team Member', href: '/app/settings?tab=team&action=invite', group: 'Create', icon: UserPlus },
    { label: 'Create Report', href: '/app/analytics?action=report', group: 'Create', icon: Plus },
  ]
}

export default function CommandPalette({ open, onClose, workspaceType }: { open: boolean; onClose: () => void; workspaceType?: string | null }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const COMMANDS = useMemo(() => buildCommands(workspaceRouteSegment(workspaceType)), [workspaceType])
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter(c => (c.label + ' ' + (c.keywords ?? '') + ' ' + c.group).toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  function go(href: string) {
    onClose()
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active].href) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null

  let runningIndex = -1
  const groups: Command['group'][] = ['Go to', 'Create']

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or jump to…"
            className="flex-1 py-3.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] text-slate-400 font-mono border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No results for &ldquo;{query}&rdquo;</p>
          )}
          {groups.map(group => {
            const items = results.filter(r => r.group === group)
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                {items.map(item => {
                  runningIndex += 1
                  const idx = runningIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={item.label}
                      onClick={() => go(item.href)}
                      onMouseEnter={() => setActive(idx)}
                      className={cn(
                        'flex items-center gap-3 w-full px-4 py-2 text-sm transition-colors',
                        idx === active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <Icon size={15} className={idx === active ? 'text-blue-600' : 'text-slate-400'} />
                      {item.label}
                      {idx === active && <ArrowRight size={13} className="ml-auto text-blue-400" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
