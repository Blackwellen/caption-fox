'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { usePopover } from '@/components/shell/app-shell/usePopover'

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** Only same-origin app paths are followed from a notification. */
function safeInternalLink(link: string | null): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null
  return link
}

export default function NotificationsBell({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter()
  const { open, setOpen, close, rootRef, triggerRef } = usePopover()
  const panelRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<NotificationItem[]>(initial)
  const unread = items.filter(n => !n.is_read).length

  async function markAll() {
    const ids = items.filter(n => !n.is_read).map(n => n.id)
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    if (ids.length) await createClient().from('notifications').update({ is_read: true }).in('id', ids)
  }

  async function openItem(n: NotificationItem) {
    if (!n.is_read) {
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      await createClient().from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    close(false)
    const target = safeInternalLink(n.link)
    if (target) router.push(target)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-shell-text-2 transition-colors duration-150 hover:bg-shell-canvas hover:text-shell-text"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell size={20} aria-hidden />
        {unread > 0 && <span aria-hidden className="absolute right-[9px] top-[9px] h-2 w-2 rounded-full bg-shell-blue ring-2 ring-white" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="cf-shell-pop absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-shell-border bg-white shadow-shell-pop"
        >
          <div className="flex items-center justify-between border-b border-shell-border-soft px-4 py-3">
            <p className="text-[14px] font-semibold text-shell-text">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-shell-blue hover:bg-shell-blue-soft">
                <CheckCheck size={14} aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-[13.5px] text-shell-muted">You&apos;re all caught up.</p>
            )}
            {items.map(n => (
              <button
                type="button"
                key={n.id}
                onClick={() => openItem(n)}
                className={cn(
                  'flex w-full gap-2.5 border-b border-shell-border-soft px-4 py-3 text-left transition-colors last:border-0 hover:bg-shell-canvas',
                  !n.is_read && 'bg-shell-blue-soft/50',
                )}
              >
                <span aria-hidden className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-shell-blue')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-shell-text">{n.title}</span>
                  {n.body && <span className="line-clamp-2 block text-[12.5px] text-shell-muted">{n.body}</span>}
                  {!n.is_read && <span className="sr-only">Unread</span>}
                </span>
                <span className="shrink-0 text-[11px] text-shell-muted">{timeAgo(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
