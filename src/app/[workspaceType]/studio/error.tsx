'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

/**
 * Route-level error boundary. It catches a failure in any Studio page without
 * taking down the app shell, and never surfaces the raw error to the user.
 */
export default function StudioError({
  error, reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Observability hook — the digest is safe to show, the message is not.
    console.error('[studio:boundary]', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-12 xl:px-8">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center" role="alert">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden>
          <AlertCircle size={20} />
        </span>
        <h1 className="text-[18px] font-semibold text-slate-900">Something went wrong loading Studio</h1>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
          The page could not finish loading. Try again — if it keeps happening, contact support and quote reference{' '}
          <span className="font-mono text-slate-700">{error.digest ?? 'CF-STUDIO'}</span>.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button type="button" onClick={reset}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">
            Try again
          </button>
          <Link href="/help" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
