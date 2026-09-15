'use client'

import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { startExperiment, pauseExperiment, completeExperiment, declareWinner, archiveExperiment } from '@/app/app/web/actions'
import { computeExperimentStats } from '@/lib/web/stats'
import { CARD, CARD_SHADOW, formatCompactNumber, formatPercentValue, formatSignedPercent } from './primitives'
import type { ExperimentRow } from '@/lib/web/types'

export default function ExperimentLifecycleClient({ experiment, canLaunch, canDeclareWinner, canDelete }: {
  experiment: ExperimentRow; canLaunch: boolean; canDeclareWinner: boolean; canDelete: boolean
}) {
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const stats = computeExperimentStats(experiment.control_visitors, experiment.control_conversions, experiment.variant_visitors, experiment.variant_conversions)

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action()
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Done.') : (result.error ?? 'Something went wrong.'))
    })
  }

  const canDeclare = stats.hasEnoughData && stats.confidencePercent >= 90 && !experiment.winner

  return (
    <div className="space-y-4">
      <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900">Variant comparison</h2>
          <div className="flex flex-wrap gap-2">
            {canLaunch && ['draft', 'planning', 'scheduled', 'paused'].includes(experiment.status) && (
              <button type="button" disabled={pending} onClick={() => run(() => startExperiment(experiment.id))} className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-[12px] font-medium text-white hover:bg-blue-700 disabled:opacity-50">Start</button>
            )}
            {canLaunch && experiment.status === 'running' && (
              <button type="button" disabled={pending} onClick={() => run(() => pauseExperiment(experiment.id))} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Pause</button>
            )}
            {canLaunch && ['running', 'paused'].includes(experiment.status) && (
              <button type="button" disabled={pending} onClick={() => run(() => completeExperiment(experiment.id))} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Move to analysis</button>
            )}
            {canDelete && experiment.status !== 'archived' && (
              <button
                type="button" disabled={pending}
                onClick={() => { if (confirm(`Archive "${experiment.name}"?`)) run(() => archiveExperiment(experiment.id)) }}
                className="inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Archive
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <VariantCard label="A — Control" visitors={experiment.control_visitors} conversions={experiment.control_conversions} rate={stats.controlRate} isWinner={experiment.winner === 'control'} />
          <VariantCard label="B — Variant" visitors={experiment.variant_visitors} conversions={experiment.variant_conversions} rate={stats.variantRate} isWinner={experiment.winner === 'variant'} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-center">
          <div><p className="text-[16px] font-bold text-slate-900">{formatSignedPercent(stats.upliftPercent)}</p><p className="text-[11px] text-slate-400">Uplift</p></div>
          <div><p className="text-[16px] font-bold text-slate-900">{stats.hasEnoughData ? formatPercentValue(stats.confidencePercent, 0) : '—'}</p><p className="text-[11px] text-slate-400">Confidence</p></div>
          <div><p className="text-[16px] font-bold text-slate-900">{stats.hasEnoughData ? formatPercentValue(stats.probabilityToBeatBaseline, 0) : '—'}</p><p className="text-[11px] text-slate-400">Probability to beat baseline</p></div>
        </div>
        {!stats.hasEnoughData && (
          <p className="mt-2 text-[11px] text-slate-400">Collecting data — each arm needs at least 100 visitors before confidence is calculated (two-proportion z-test).</p>
        )}
      </div>

      {canDeclareWinner && (
        <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
          <h2 className="mb-1 text-[13px] font-semibold text-slate-900">Declare a winner</h2>
          <p className="mb-3 text-[12px] text-slate-500">
            {experiment.winner
              ? `${experiment.winner === 'variant' ? 'Variant' : 'Control'} was declared the winner.`
              : canDeclare
                ? 'Confidence has reached the 90% threshold — you can declare a winner.'
                : 'Not enough data yet. A winner can only be declared once each arm has at least 100 visitors and confidence reaches 90%.'}
          </p>
          {!experiment.winner && (
            <div className="flex gap-2">
              <button type="button" disabled={pending || !canDeclare} onClick={() => run(() => declareWinner(experiment.id, 'control'))} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Declare control the winner</button>
              <button type="button" disabled={pending || !canDeclare} onClick={() => run(() => declareWinner(experiment.id, 'variant'))} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-40">Declare variant the winner</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VariantCard({ label, visitors, conversions, rate, isWinner }: { label: string; visitors: number; conversions: number; rate: number; isWinner: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', isWinner ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200')}>
      <p className="text-[12px] font-semibold text-slate-900">{label}{isWinner && ' 🏆'}</p>
      <p className="mt-1 text-[20px] font-bold text-slate-900">{formatPercentValue(rate * 100)}</p>
      <p className="text-[11px] text-slate-400">Conversion rate</p>
      <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
        <span>{formatCompactNumber(conversions)} conversions</span>
        <span>{formatCompactNumber(visitors)} visitors</span>
      </div>
    </div>
  )
}
