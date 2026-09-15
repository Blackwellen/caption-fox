'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error'
interface ToastItem { id: number; tone: ToastTone; message: string }

const ToastContext = createContext<{ notify: (tone: ToastTone, message: string) => void } | null>(null)

/** Minimal, accessible toast surface for PR & Reputation mutations. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const notify = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random()
    setItems(list => [...list, { id, tone, message }])
    setTimeout(() => setItems(list => list.filter(item => item.id !== id)), tone === 'error' ? 7000 : 4000)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        role="status" aria-live="polite"
      >
        {items.map(item => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] shadow-lg',
              item.tone === 'success'
                ? 'border-emerald-200 bg-white text-slate-700'
                : 'border-red-200 bg-white text-slate-700',
            )}
          >
            {item.tone === 'success'
              ? <CheckCircle2 size={16} className="mt-px shrink-0 text-emerald-500" />
              : <AlertTriangle size={16} className="mt-px shrink-0 text-red-500" />}
            <span className="flex-1">{item.message}</span>
            <button
              type="button" aria-label="Dismiss"
              onClick={() => setItems(list => list.filter(i => i.id !== item.id))}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  return ctx ?? { notify: () => {} }
}
