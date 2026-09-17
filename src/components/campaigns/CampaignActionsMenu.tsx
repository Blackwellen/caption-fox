'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Archive, ArrowUpRight, ChevronRight, Loader2, MoreHorizontal, RotateCcw, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import {
  archiveCampaign, bulkUpdateCampaigns, deleteCampaign, moveCampaignStage,
} from '@/app/app/campaigns/actions'
import {
  ALLOWED_STAGE_TRANSITIONS, LIFECYCLE_LABELS, PRIORITIES, PRIORITY_LABELS,
  type LifecycleStage,
} from '@/lib/campaigns/constants'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'
import { useCampaignsBase } from './links'

const ITEM = 'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

export default function CampaignActionsMenu({
  campaignId, name, stage, archived, capabilities, align = 'right', trigger,
}: {
  campaignId: string
  name: string
  stage: string
  archived: boolean
  capabilities: CampaignCapabilities
  align?: 'left' | 'right'
  trigger?: React.ReactNode
}) {
  const router = useRouter()
  const campaignsBase = useCampaignsBase()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<'stage' | 'priority' | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const stages = (ALLOWED_STAGE_TRANSITIONS[stage as LifecycleStage] ?? [])
    .filter(next => next !== stage && next !== 'archived')

  function run(work: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await work()
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Done.') : (result.error ?? 'Something went wrong.'))
      if (result.ok) router.refresh()
      setOpen(false)
      setSubmenu(null)
      setConfirmDelete(false)
    })
  }

  const noActions = !capabilities.edit && !capabilities.archive && !capabilities.delete

  return (
    <div className="relative">
      <button
        type="button"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${name}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : (trigger ?? <MoreHorizontal size={15} />)}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSubmenu(null); setConfirmDelete(false) }} aria-hidden />
          <div
            role="menu"
            className={cn(
              'absolute top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <button type="button" role="menuitem" className={ITEM}
              onClick={() => { setOpen(false); router.push(`${campaignsBase}/${campaignId}`) }}>
              <ArrowUpRight size={14} className="text-slate-400" />
              Open campaign
            </button>

            {capabilities.edit && !archived && stages.length > 0 && (
              <div className="relative">
                <button
                  type="button" role="menuitem" className={ITEM}
                  onClick={() => setSubmenu(s => (s === 'stage' ? null : 'stage'))}
                  aria-expanded={submenu === 'stage'}
                >
                  <ChevronRight size={14} className={cn('text-slate-400 transition-transform', submenu === 'stage' && 'rotate-90')} />
                  Move to stage
                </button>
                {submenu === 'stage' && (
                  <div className="border-y border-slate-100 bg-slate-50/60 py-1">
                    {stages.map(next => (
                      <button
                        key={next} type="button" role="menuitem" disabled={pending}
                        className={cn(ITEM, 'pl-9 text-slate-600')}
                        onClick={() => run(() => moveCampaignStage(campaignId, next))}
                      >
                        {LIFECYCLE_LABELS[next]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {capabilities.edit && !archived && (
              <div className="relative">
                <button
                  type="button" role="menuitem" className={ITEM}
                  onClick={() => setSubmenu(s => (s === 'priority' ? null : 'priority'))}
                  aria-expanded={submenu === 'priority'}
                >
                  <ChevronRight size={14} className={cn('text-slate-400 transition-transform', submenu === 'priority' && 'rotate-90')} />
                  Set priority
                </button>
                {submenu === 'priority' && (
                  <div className="border-y border-slate-100 bg-slate-50/60 py-1">
                    {PRIORITIES.map(priority => (
                      <button
                        key={priority} type="button" role="menuitem" disabled={pending}
                        className={cn(ITEM, 'pl-9 text-slate-600')}
                        onClick={() => run(() => bulkUpdateCampaigns([campaignId], { priority }))}
                      >
                        {PRIORITY_LABELS[priority]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {capabilities.archive && (
              <button
                type="button" role="menuitem" className={ITEM} disabled={pending}
                onClick={() => run(() => archiveCampaign(campaignId, archived))}
              >
                {archived ? <RotateCcw size={14} className="text-slate-400" /> : <Archive size={14} className="text-slate-400" />}
                {archived ? 'Restore campaign' : 'Archive campaign'}
              </button>
            )}

            {capabilities.delete && (
              <>
                <div className="my-1 border-t border-slate-100" />
                {confirmDelete ? (
                  <div className="px-3 py-2">
                    <p className="mb-2 text-xs text-slate-600">
                      Permanently delete <span className="font-medium text-slate-900">{name}</span>? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button" disabled={pending}
                        onClick={() => run(() => deleteCampaign(campaignId))}
                        className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                      <button
                        type="button" onClick={() => setConfirmDelete(false)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button" role="menuitem"
                    className={cn(ITEM, 'text-red-600 hover:bg-red-50')}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={14} />
                    Delete campaign
                  </button>
                )}
              </>
            )}

            {noActions && (
              <p className="px-3 py-2 text-xs text-slate-400">
                Your role has read-only access to campaigns.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
