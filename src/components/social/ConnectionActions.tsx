'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { disconnectChannel, resolveConnectionIssue, syncChannelNow } from '@/lib/social/actions'
import { SOCIAL_PROVIDERS, PROVIDER_LABELS, type SocialProvider } from '@/types/social'

export function ConnectChannelButton() {
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect(provider: SocialProvider) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/social/oauth/${provider}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnTo: '/app/social/connections' }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Could not start the connection.'); setPending(false); return }
      window.location.href = body.authorizeUrl
    } catch {
      setError('Could not reach the authorisation service.')
      setPending(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(current => !current)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm"
      >
        + Connect Channel
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {SOCIAL_PROVIDERS.map(provider => (
            <button
              key={provider}
              disabled={pending}
              onClick={() => connect(provider)}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {PROVIDER_LABELS[provider]}
            </button>
          ))}
          {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

export function SyncNowButton({ channelId }: { channelId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await syncChannelNow(channelId)
        if (!result.ok) alert(result.message)
        else router.refresh()
      })}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
    >
      <RefreshCw size={12} className={pending ? 'animate-spin' : ''} />Sync now
    </button>
  )
}

export function DisconnectButton({ channelId, accountName }: { channelId: string; accountName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Disconnect ${accountName}? Queued posts for this channel will be cancelled.`)) return
        startTransition(async () => {
          const result = await disconnectChannel(channelId)
          if (!result.ok) alert(result.message)
          else router.refresh()
        })
      }}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-50"
    >
      Disconnect
    </button>
  )
}

export function ResolveIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await resolveConnectionIssue(issueId)
        if (!result.ok) alert(result.message)
        else router.refresh()
      })}
      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
    >
      Mark resolved
    </button>
  )
}
