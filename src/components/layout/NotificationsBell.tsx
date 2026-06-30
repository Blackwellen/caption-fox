'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

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

export default function NotificationsBell({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>(initial)
  const unread = items.filter(n => !n.is_read).length

  async function markAll() {
    const supabase = createClient()
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
  }

  async function openItem(n: NotificationItem) {
    if (!n.is_read) {
      const supabase = createClient()
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-sm text-slate-400 text-center">You&apos;re all caught up.</p>
              )}
              {items.map(n => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn('flex gap-2.5 w-full px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0', !n.is_read && 'bg-blue-50/40')}
                >
                  <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', n.is_read ? 'bg-transparent' : 'bg-blue-500')} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{n.title}</span>
                    {n.body && <span className="block text-xs text-slate-500 line-clamp-2">{n.body}</span>}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
