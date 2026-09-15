'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2 } from 'lucide-react'
import { reviewAsset } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'
import { Badge } from '@/components/ui/Badge'
import { formatShortDate } from './primitives'
import { PartnershipsEmpty } from './states'
import type { AssetRow } from '@/lib/partnerships/types'
import type { BadgeVariant } from '@/components/ui/Badge'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested',
  approved: 'Approved', rejected: 'Rejected', published: 'Published',
}
const STATUS_BADGE: Record<string, BadgeVariant> = {
  draft: 'slate', submitted: 'amber', in_review: 'violet', changes_requested: 'blue',
  approved: 'green', rejected: 'red', published: 'green',
}

export default function AssetsPanel({
  assets, canReview, title = 'Content awaiting review',
}: { assets: AssetRow[]; canReview: boolean; title?: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { notify } = useToast()

  function decide(id: string, decision: 'approved' | 'changes_requested' | 'rejected') {
    startTransition(async () => {
      const result = await reviewAsset(id, decision)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Updated.') : (result.error ?? 'Could not update.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-900">{title}</h2>
      {assets.length === 0 ? (
        <PartnershipsEmpty bare icon="search" title="Nothing to review" message="Submitted content and assets will appear here for approval." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {assets.map(asset => (
            <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  <FileCheck2 size={13} className="text-blue-500" />
                  {asset.title}
                </span>
                <p className="truncate text-[11px] text-slate-400">
                  {asset.partner?.name ?? 'Unknown partner'} · {asset.programme?.name ?? ''} · {formatShortDate(asset.submitted_at)}
                </p>
              </div>
              <Badge variant={STATUS_BADGE[asset.status] ?? 'slate'} className="text-[10px]">{STATUS_LABEL[asset.status] ?? asset.status}</Badge>
              {canReview && ['submitted', 'in_review'].includes(asset.status) && (
                <span className="flex items-center gap-2">
                  <button type="button" disabled={pending} onClick={() => decide(asset.id, 'approved')} className="text-[12px] font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">Approve</button>
                  <button type="button" disabled={pending} onClick={() => decide(asset.id, 'changes_requested')} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">Request changes</button>
                  <button type="button" disabled={pending} onClick={() => decide(asset.id, 'rejected')} className="text-[12px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50">Reject</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
