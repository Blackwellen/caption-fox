'use client'

import { useSearchParams } from 'next/navigation'

export function ConnectStatusBanner() {
  const params = useSearchParams()
  const connected = params.get('connected')
  const error = params.get('connect_error')
  if (connected) {
    return <div className="mb-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Connected {connected} successfully.</div>
  }
  if (error) {
    return <div className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
  }
  return null
}
