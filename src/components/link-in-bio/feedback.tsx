'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Lightweight save/publish feedback for the Link in Bio module. notify() can be
// called from any client component; the toaster renders into an aria-live
// region so screen readers announce every result.

type Toast = { id: number; tone: 'success' | 'error'; message: string }
const EVENT = 'links:notify'
let counter = 0

export function notify(message: string, tone: Toast['tone'] = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: ++counter, tone, message } }))
}

export function LinksToaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    const onToast = (event: Event) => {
      const toast = (event as CustomEvent<Toast>).detail
      setToasts(list => [...list.slice(-2), toast])
      window.setTimeout(() => setToasts(list => list.filter(t => t.id !== toast.id)), toast.tone === 'error' ? 7000 : 3500)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6">
      {toasts.map(toast => (
        <div key={toast.id} className={cn('pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[12.5px] shadow-lg', toast.tone === 'success' ? 'border-emerald-200 bg-white text-slate-800' : 'border-red-200 bg-red-50 text-red-800')}>
          {toast.tone === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden />}
          <span className="min-w-0">{toast.message}</span>
          <button type="button" onClick={() => setToasts(list => list.filter(t => t.id !== toast.id))} className="ml-1 shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Dismiss"><X size={13} /></button>
        </div>
      ))}
    </div>
  )
}

/** Downloads text content as a file in the browser. */
export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
