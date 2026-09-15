'use client'

import { useEffect, useState } from 'react'
import { Search, MessageSquare, Users2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, cn } from '@/lib/utils'
import { PLATFORM_EMOJI } from '@/lib/inbox/queries'

interface Contact {
  key: string
  name: string
  handle: string | null
  lastPlatform: string
  lastActivity: string
  lastThreadId: string
  threadCount: number
  tags: string[]
}

/**
 * People and audiences derived from real inbox conversations — one row per
 * distinct sender (name + handle) across all channels. Caption Fox does not
 * yet have a dedicated contacts table; this view is grounded in real
 * inbox_threads data rather than a fabricated contact list.
 */
export function ContactsTab({ workspaceId, onOpenConversation }: { workspaceId: string; onOpenConversation: (threadId: string) => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const sb = createClient()
    let cancelled = false
    sb.from('inbox_threads')
      .select('id, sender_name, sender_handle, platform, updated_at, tags')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (cancelled) return
        const map = new Map<string, Contact>()
        for (const t of data ?? []) {
          const key = (t.sender_handle || t.sender_name || t.id) as string
          if (!map.has(key)) {
            map.set(key, {
              key, name: t.sender_name ?? 'Unknown', handle: t.sender_handle,
              lastPlatform: t.platform, lastActivity: t.updated_at, lastThreadId: t.id,
              threadCount: 1, tags: t.tags ?? [],
            })
          } else {
            const c = map.get(key)!
            c.threadCount += 1
            for (const tag of t.tags ?? []) if (!c.tags.includes(tag)) c.tags.push(tag)
          }
        }
        setContacts([...map.values()])
      })
    return () => { cancelled = true }
  }, [workspaceId])

  const filtered = (contacts ?? []).filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.handle?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-h-[560px] overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users2 size={16} /></div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Contacts <span className="ml-1 font-normal text-slate-400">{contacts?.length ?? '—'}</span></p>
          <p className="text-xs text-slate-500">People you've engaged with across channels</p>
        </div>
      </div>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm" />
      </div>

      {contacts === null ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users2} title="No contacts yet" description="Contacts appear here once conversations come in through your connected channels." compact />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(c => (
            <button key={c.key} onClick={() => onOpenConversation(c.lastThreadId)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left transition-colors hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{c.name[0]?.toUpperCase() ?? '?'}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                <p className="truncate text-xs text-slate-400">{c.handle ?? `${c.threadCount} conversation${c.threadCount === 1 ? '' : 's'}`}</p>
                {c.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.slice(0, 3).map(t => <Badge key={t} variant="blue" className="!px-1.5 !py-0 text-[10px]">{t}</Badge>)}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-400">
                <span>{PLATFORM_EMOJI[c.lastPlatform] ?? ''} {formatRelative(c.lastActivity)}</span>
                <span className={cn('flex items-center gap-1 text-blue-600')}><MessageSquare size={11} /> Open</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
