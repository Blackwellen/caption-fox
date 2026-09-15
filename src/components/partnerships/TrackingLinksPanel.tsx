'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Link2, Plus } from 'lucide-react'
import { createTrackingLink } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'
import { formatNumber, formatShortDate } from './primitives'
import { PartnershipsEmpty } from './states'
import type { TrackingLinkRow } from '@/lib/partnerships/types'

export default function TrackingLinksPanel({
  programmeId, partnerId, links, canManage,
}: { programmeId: string; partnerId: string; links: TrackingLinkRow[]; canManage: boolean }) {
  const [destination, setDestination] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createTrackingLink(programmeId, partnerId, destination)
      if (!result.ok) { setError(result.error ?? 'Could not create the link.'); return }
      notify('success', result.message ?? 'Tracking link created.')
      setDestination('')
      router.refresh()
    })
  }

  function copy(slug: string) {
    const url = `${window.location.origin}/p/${slug}`
    navigator.clipboard?.writeText(url).then(() => notify('success', 'Link copied.')).catch(() => notify('error', 'Could not copy the link.'))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Tracking links</h2>

      {canManage && (
        <div className="mb-3 flex items-center gap-2">
          <input
            value={destination} onChange={e => setDestination(e.target.value)}
            placeholder="https://your-site.com/landing-page"
            className="h-9 flex-1 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button" onClick={submit} disabled={pending || !destination.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            {pending ? 'Creating…' : 'Create link'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {links.length === 0 ? (
        <PartnershipsEmpty bare title="No tracking links yet" message="Create a tracking link to attribute clicks and conversions to this partner." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {links.map(link => (
            <li key={link.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-mono text-blue-600"><Link2 size={12} />/p/{link.slug}</span>
                <p className="truncate text-[11px] text-slate-400">{link.destination_url}</p>
              </div>
              <span className="shrink-0 text-slate-500">{formatNumber(link.clicks)} clicks</span>
              <span className="hidden shrink-0 text-slate-400 sm:inline">{formatShortDate(link.created_at)}</span>
              <button type="button" onClick={() => copy(link.slug)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Copy link">
                <Copy size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
