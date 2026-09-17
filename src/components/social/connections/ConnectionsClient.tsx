'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { syncChannelNow } from '@/lib/social/actions'
import { Dialog, FormError, secondaryButton, useParamDialog } from '../Dialog'
import { ProviderIcon } from '../kit'

// Client controls for Social Connections. Connecting starts server-side OAuth:
// the start endpoint stores state (and a PKCE verifier) and returns the
// provider's authorize URL — no secret or token ever reaches the browser.

export function ConnectButton({ provider, channelId, returnTo, className, children }: {
  provider: string; channelId?: string; returnTo: string; className?: string; children: ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; setupUrl?: string } | null>(null)
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button" disabled={pending} className={className}
        onClick={async () => {
          setPending(true)
          setError(null)
          try {
            const response = await fetch(`/api/social/oauth/${provider}/start`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channelId, returnTo }),
            })
            const body = await response.json().catch(() => ({})) as { authorizeUrl?: string; error?: string; setupUrl?: string }
            if (response.ok && body.authorizeUrl) { window.location.assign(body.authorizeUrl); return }
            setError({ message: body.error ?? 'The connection could not be started. Please try again.', setupUrl: body.setupUrl })
          } catch {
            setError({ message: 'Network error. Check your connection and try again.' })
          }
          setPending(false)
        }}
      >
        {pending && <Loader2 size={13} className="animate-spin" aria-hidden />}{children}
      </button>
      {error && (
        <span role="alert" className="max-w-xs text-[12px] text-red-600">
          {error.message}
          {error.setupUrl && /^https:\/\//.test(error.setupUrl) && (
            <a href={error.setupUrl} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-medium underline">Developer console <ExternalLink size={11} aria-hidden /></a>
          )}
        </span>
      )}
    </span>
  )
}

export function SyncNowButton({ channelId, allowed, className, label = 'Sync now' }: { channelId: string; allowed: boolean; className?: string; label?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button type="button" disabled={!allowed || pending} title={allowed ? undefined : 'Your role cannot sync channels.'} className={className}
        onClick={() => start(async () => {
          setError(null)
          const result = await syncChannelNow(channelId)
          if (result.ok) router.refresh()
          else setError(result.message)
        })}>
        {pending ? 'Starting sync…' : label}
      </button>
      {error && <p role="alert" className="px-2.5 py-1 text-[12px] text-red-600">{error}</p>}
    </>
  )
}

export function RefreshButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" aria-label="Refresh connection data" title="Refresh" onClick={() => start(() => router.refresh())}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 lg:h-[30px] lg:w-[30px]">
      <RefreshCw size={14} className={cn(pending && 'animate-spin')} aria-hidden />
    </button>
  )
}

export function ConnectChannelDialog({ providers, returnTo, blockedReason }: {
  providers: { provider: string; name: string; configured: boolean; connected: number; note: string }[]
  returnTo: string
  blockedReason: string | null
}) {
  const { open, close } = useParamDialog('connect')
  if (!open) return null
  return (
    <Dialog open onClose={close} title="Connect a channel" description="You sign in with the platform and approve access. Caption Fox never sees your password."
      footer={<button type="button" onClick={close} className={secondaryButton}>Close</button>}>
      {blockedReason && <div className="mb-3"><FormError message={blockedReason} /></div>}
      <ul className="divide-y divide-slate-100">
        {providers.map(item => (
          <li key={item.provider} className="flex items-center gap-3 py-3">
            <ProviderIcon provider={item.provider} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-slate-900">{item.name}</span>
              <span className="block text-[12.5px] text-slate-500">{item.connected ? `${item.connected} connected · ` : ''}{item.note}</span>
            </span>
            {item.configured && !blockedReason ? (
              <ConnectButton provider={item.provider} returnTo={returnTo}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                Connect
              </ConnectButton>
            ) : (
              <button type="button" disabled title={blockedReason ?? 'This platform has not been set up on this deployment yet.'}
                className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-400">
                {blockedReason ? 'Connect' : 'Not set up'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
