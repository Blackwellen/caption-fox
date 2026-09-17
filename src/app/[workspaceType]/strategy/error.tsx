'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/** Route-level boundary: a failing Strategy panel never white-screens the shell. */
export default function StrategyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[strategy] route error', error.digest ?? error.message) }, [error])
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-sg-line bg-white p-8 text-center shadow-sg-card" role="alert">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500"><AlertTriangle aria-hidden className="h-6 w-6" /></span>
      <h1 className="mt-4 text-[17px] font-semibold text-sg-ink">This Strategy page could not load</h1>
      <p className="mt-1 text-[13px] text-sg-muted">Your data is safe. Try again, and if it keeps happening share this reference with support.</p>
      {error.digest && <p className="mt-3 font-mono text-[11px] text-slate-400">Reference: {error.digest}</p>}
      {process.env.NODE_ENV === 'development' && <p className="mt-2 break-words font-mono text-[11px] text-red-500">{error.message}</p>}
      <button type="button" onClick={reset} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-sg-blue px-4 text-[13px] font-semibold text-white hover:bg-sg-blue-hover">
        <RotateCcw aria-hidden className="h-4 w-4" /> Try again
      </button>
    </div>
  )
}
