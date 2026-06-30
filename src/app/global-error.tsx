'use client'

import { useEffect } from 'react'

// Global error boundary — catches errors in the root layout itself.
// Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error.message)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
              The application hit an unexpected error. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 20 }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
