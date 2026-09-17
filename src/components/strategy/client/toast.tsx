'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: number; tone: ToastTone; message: string }

const ToastContext = createContext<{ notify: (tone: ToastTone, message: string) => void } | null>(null)

/** Strategy toast surface. Polite live region; errors stay longer. */
export function StrategyToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems(list => list.filter(item => item.id !== id)), [])
  const notify = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random()
    setItems(list => [...list.slice(-3), { id, tone, message }])
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500)
  }, [dismiss])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[80] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-[360px]"
        role="status" aria-live="polite"
      >
        {items.map(item => (
          <div key={item.id} className={cn(
            'pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-[13px] text-sg-body shadow-sg-pop',
            item.tone === 'error' ? 'border-red-200' : 'border-sg-line',
          )}>
            {item.tone === 'error'
              ? <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              : <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
            <p className="min-w-0 flex-1">{item.message}</p>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"
              className="-m-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  // Rendering outside the provider must never crash a page; fall back to console.
  return context ?? { notify: (tone: ToastTone, message: string) => console[tone === 'error' ? 'error' : 'log'](message) }
}
