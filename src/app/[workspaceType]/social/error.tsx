'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

/**
 * Route-level error boundary for every Social page. A failure is contained
 * inside the shell, the raw error is never shown, and the digest gives support
 * a safe reference to find the server log.
 */
export default function SocialError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[social:boundary]', error.digest ?? 'client error')
  }, [error])

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center" role="alert">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden>
        <AlertCircle size={20} />
      </span>
      <h1 className="text-[18px] font-semibold text-slate-900">Social could not finish loading</h1>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
        Try again. If it keeps happening, contact support and quote reference{' '}
        <span className="font-mono text-slate-700">{error.digest ?? 'CF-SOCIAL'}</span>.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button type="button" onClick={reset} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700">Try again</button>
        <Link href="/help" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">Contact support</Link>
      </div>
    </div>
  )
}
