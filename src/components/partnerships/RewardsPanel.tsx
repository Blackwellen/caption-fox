'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, Plus } from 'lucide-react'
import { issueReward, redeemReward } from '@/app/app/partnerships/actions'
import { useToast } from '@/components/campaigns/Toast'
import { Badge } from '@/components/ui/Badge'
import { formatMoney, formatShortDate } from './primitives'
import { PartnershipsEmpty } from './states'
import { REWARD_STATUS_BADGE, REWARD_STATUS_LABELS, REWARD_TYPES, REWARD_TYPE_LABELS } from '@/lib/partnerships/constants'
import type { RewardRow } from '@/lib/partnerships/types'

export default function RewardsPanel({
  programmeId, partnerId, rewards, canManage,
}: { programmeId: string; partnerId: string; rewards: RewardRow[]; canManage: boolean }) {
  const [type, setType] = useState<string>('cash')
  const [value, setValue] = useState('10')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { notify } = useToast()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await issueReward({ programme_id: programmeId, partner_id: partnerId, reward_type: type, value })
      if (!result.ok) { setError(result.error ?? 'Could not issue the reward.'); return }
      notify('success', result.message ?? 'Reward issued.')
      router.refresh()
    })
  }

  function redeem(id: string) {
    startTransition(async () => {
      const result = await redeemReward(id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Redeemed.') : (result.error ?? 'Could not redeem.'))
      if (result.ok) router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]">
      <h2 className="mb-2 text-[13px] font-semibold text-slate-900">Rewards</h2>

      {canManage && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={type} onChange={e => setType(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700">
            {REWARD_TYPES.map(t => <option key={t} value={t}>{REWARD_TYPE_LABELS[t]}</option>)}
          </select>
          <input
            type="number" min={0} step={0.01} value={value} onChange={e => setValue(e.target.value)}
            className="h-9 w-28 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700"
          />
          <button
            type="button" onClick={submit} disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            Issue reward
          </button>
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

      {rewards.length === 0 ? (
        <PartnershipsEmpty bare icon="search" title="No rewards yet" message="Rewards issued to this partner will appear here." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {rewards.map(reward => (
            <li key={reward.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Gift size={13} className="text-violet-500" />
                {REWARD_TYPE_LABELS[reward.reward_type] ?? reward.reward_type}
                <Badge variant={REWARD_STATUS_BADGE[reward.status] ?? 'slate'} className="text-[10px]">
                  {REWARD_STATUS_LABELS[reward.status] ?? reward.status}
                </Badge>
              </span>
              <span className="text-slate-400">{formatShortDate(reward.issued_at)}</span>
              <span className="font-medium text-slate-900">{formatMoney(reward.value, reward.currency)}</span>
              {canManage && reward.status === 'issued' && (
                <button type="button" onClick={() => redeem(reward.id)} disabled={pending} className="text-[12px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                  Mark redeemed
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
