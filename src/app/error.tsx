'use client'

import { useEffect } from 'react'

// Route-level error boundary (App Router). Catches render/runtime errors in any
// route segment without white-screening the whole app.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Safe to wire to an observability provider later (no sensitive data logged).
    console.error('Route error:', error.message)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Something went wrong</h1>
        <p className="text-sm text-slate-500 mb-5">
          An unexpected error occurred. You can try again, and if it keeps happening, contact support.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono mb-5">Reference: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
