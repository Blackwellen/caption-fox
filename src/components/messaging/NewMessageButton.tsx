'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHANNEL_LABELS, MESSAGING_MODULE_META, type MessagingChannel } from '@/lib/messaging/constants'

/**
 * Channel picker for starting a new message. Only channels the workspace is
 * entitled to (plan + role + workspace type) are ever offered — an unavailable
 * channel simply does not appear here rather than showing as disabled.
 */
export default function NewMessageButton({ channels }: { channels: MessagingChannel[] }) {
  const [open, setOpen] = useState(false)
  if (channels.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <Plus size={14} />
        New message
        <ChevronDown size={13} className="opacity-80" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {channels.map(channel => (
              <Link
                key={channel} role="menuitem" onClick={() => setOpen(false)}
                href={`${MESSAGING_MODULE_META[channel].href}/compose`}
                className={cn('block px-3 py-2 text-[13px] text-slate-700 transition-colors hover:bg-slate-50')}
              >
                {CHANNEL_LABELS[channel]}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
