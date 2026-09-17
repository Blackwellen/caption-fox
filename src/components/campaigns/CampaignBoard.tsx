'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, GripVertical, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import CampaignActionsMenu from './CampaignActionsMenu'
import { CampaignThumb } from './CampaignCard'
import { useToast } from './Toast'
import { Avatar, CARD, CARD_SHADOW, ChannelChips, formatMoney, formatShortDate } from './primitives'
import { moveCampaignStage } from '@/app/app/campaigns/actions'
import {
  BOARD_COLUMN_FOR, BOARD_STAGES, LIFECYCLE_LABELS, PRIORITY_BADGE, PRIORITY_LABELS,
  canTransitionStage, type CampaignPriority, type LifecycleStage,
} from '@/lib/campaigns/constants'
import { CAMPAIGN_TYPE_LABELS } from '@/lib/constants'
import type { CampaignRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'
import { useCampaignsBase } from './links'

const COLUMN_ACCENT: Record<string, string> = {
  planning: 'text-blue-600', in_review: 'text-violet-600', scheduled: 'text-amber-600',
  live: 'text-emerald-600', completed: 'text-slate-600', at_risk: 'text-red-600',
}

interface DragState {
  id: string
  from: LifecycleStage
  x: number
  y: number
  width: number
  label: string
}

/**
 * Operational campaign board.
 *
 * Dragging uses pointer events so it works with a mouse, a pen and touch.
 * Every card also carries a "Move to stage" menu, which is the keyboard and
 * screen-reader path — the board is never drag-only. Moves apply optimistically
 * and roll back with an explanation when the server rejects the transition.
 */
export default function CampaignBoard({
  campaigns, capabilities, newCampaignSlot,
}: {
  campaigns: CampaignRow[]
  capabilities: CampaignCapabilities
  newCampaignSlot?: React.ReactNode
}) {
  const router = useRouter()
  const campaignsBase = useCampaignsBase()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverStage, setHoverStage] = useState<LifecycleStage | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, LifecycleStage>>({})
  const scroller = useRef<HTMLDivElement>(null)
  const autoScroll = useRef<number | null>(null)

  const stageOf = useCallback(
    (campaign: CampaignRow) => (optimistic[campaign.id] ?? campaign.lifecycle_stage) as LifecycleStage,
    [optimistic],
  )

  const byStage = new Map<LifecycleStage, CampaignRow[]>()
  for (const stage of BOARD_STAGES) byStage.set(stage, [])
  for (const campaign of campaigns) {
    const stage = stageOf(campaign)
    // The board shows the six delivery columns. Stages that are not columns map
    // to the column that represents the same point in the workflow, so no record
    // disappears and none is mislabelled: work in progress sits with Planning
    // (pre-review delivery) and blocked work sits with At risk.
    const column = byStage.has(stage) ? stage : BOARD_COLUMN_FOR[stage] ?? 'at_risk'
    byStage.get(column)!.push(campaign)
  }

  const stopAutoScroll = useCallback(() => {
    if (autoScroll.current !== null) {
      cancelAnimationFrame(autoScroll.current)
      autoScroll.current = null
    }
  }, [])

  useEffect(() => stopAutoScroll, [stopAutoScroll])

  function beginDrag(event: React.PointerEvent, campaign: CampaignRow) {
    if (!capabilities.manageBoard) return
    if ((event.target as HTMLElement).closest('button, a, select, input')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setDrag({
      id: campaign.id, from: stageOf(campaign),
      x: event.clientX, y: event.clientY, width: rect.width, label: campaign.name,
    })
  }

  function moveDrag(event: React.PointerEvent) {
    if (!drag) return
    event.preventDefault()
    setDrag(current => (current ? { ...current, x: event.clientX, y: event.clientY } : current))

    const element = document.elementFromPoint(event.clientX, event.clientY)
    const column = element?.closest('[data-stage]') as HTMLElement | null
    setHoverStage((column?.dataset.stage as LifecycleStage | undefined) ?? null)

    // Edge auto-scroll keeps distant columns reachable mid-drag.
    const node = scroller.current
    if (!node) return
    const bounds = node.getBoundingClientRect()
    const delta = event.clientX < bounds.left + 60 ? -14
      : event.clientX > bounds.right - 60 ? 14 : 0
    stopAutoScroll()
    if (delta !== 0) {
      const step = () => {
        node.scrollLeft += delta
        autoScroll.current = requestAnimationFrame(step)
      }
      autoScroll.current = requestAnimationFrame(step)
    }
  }

  function endDrag() {
    stopAutoScroll()
    const current = drag
    const target = hoverStage
    setDrag(null)
    setHoverStage(null)
    if (!current || !target || target === current.from) return

    if (!canTransitionStage(current.from, target)) {
      notify('error', `${LIFECYCLE_LABELS[current.from]} cannot move straight to ${LIFECYCLE_LABELS[target]}.`)
      return
    }

    setOptimistic(state => ({ ...state, [current.id]: target }))
    startTransition(async () => {
      const result = await moveCampaignStage(current.id, target)
      if (!result.ok) {
        // Roll the card back to where it came from and say why.
        setOptimistic(state => {
          const next = { ...state }
          delete next[current.id]
          return next
        })
        notify('error', result.error ?? 'The move could not be saved.')
        return
      }
      notify('success', `${current.label} moved to ${LIFECYCLE_LABELS[target]}.`)
      router.refresh()
    })
  }

  return (
    <>
      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-2.5">
          {BOARD_STAGES.map(stage => {
            const items = byStage.get(stage) ?? []
            const droppable = drag ? canTransitionStage(drag.from, stage) : true
            const active = hoverStage === stage && Boolean(drag)

            return (
              <section
                key={stage}
                data-stage={stage}
                aria-label={`${LIFECYCLE_LABELS[stage]} column, ${items.length} campaigns`}
                className={cn(
                  CARD, 'flex w-[248px] lg:w-[194px] shrink-0 flex-col bg-slate-50/70 transition-colors',
                  active && droppable && 'border-blue-400 bg-blue-50/60',
                  active && !droppable && 'border-red-300 bg-red-50/50',
                )}
              >
                <header className="flex items-center gap-2 px-3 pb-2 pt-2.5">
                  <h3 className={cn('text-[13px] lg:text-[10px] font-semibold', COLUMN_ACCENT[stage] ?? 'text-slate-700')}>
                    {LIFECYCLE_LABELS[stage]}
                  </h3>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[11px] lg:text-[8.5px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    {items.length}
                  </span>
                  {active && !droppable && (
                    <span className="ml-auto text-[10px] lg:text-[8px] font-medium text-red-600">Not allowed</span>
                  )}
                </header>

                <div className="flex-1 space-y-2 px-2 pb-2">
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 px-2 py-6 text-center text-[11px] lg:text-[8.5px] text-slate-400">
                      Nothing in {LIFECYCLE_LABELS[stage].toLowerCase()}
                    </p>
                  )}

                  {items.map(campaign => (
                    <article
                      key={campaign.id}
                      onPointerDown={event => beginDrag(event, campaign)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={cn(
                        CARD, CARD_SHADOW, 'bg-white p-2.5 transition-opacity',
                        capabilities.manageBoard ? 'cursor-grab touch-none' : 'cursor-default',
                        drag?.id === campaign.id && 'opacity-40',
                      )}
                    >
                      <div className="flex gap-2">
                        <CampaignThumb campaign={campaign} className="h-[42px] w-[46px] lg:h-[36px] lg:w-[40px]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1">
                            <Link
                              href={`${campaignsBase}/${campaign.id}`}
                              className="line-clamp-2 flex-1 text-[12px] lg:text-[9.5px] font-semibold leading-snug text-slate-900 hover:text-blue-600"
                            >
                              {campaign.name}
                            </Link>
                            <CampaignActionsMenu
                              campaignId={campaign.id} name={campaign.name}
                              stage={stageOf(campaign)} archived={Boolean(campaign.archived_at)}
                              capabilities={capabilities}
                            />
                          </div>
                          <p className="mt-0.5 truncate text-[10px] lg:text-[8px] text-slate-400">
                            {CAMPAIGN_TYPE_LABELS[campaign.campaign_type] ?? campaign.campaign_type}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar person={campaign.owner} size={15} />
                        <span className="truncate text-[10px] lg:text-[8px] text-slate-500">
                          {campaign.owner?.full_name ?? campaign.owner?.email ?? 'Unassigned'}
                        </span>
                        <Badge
                          variant={PRIORITY_BADGE[campaign.priority as CampaignPriority] ?? 'slate'}
                          className="ml-auto text-[9px]"
                        >
                          {PRIORITY_LABELS[campaign.priority as CampaignPriority] ?? campaign.priority}
                        </Badge>
                      </div>

                      <p className="mt-1.5 flex items-center gap-1 text-[10px] lg:text-[8px] text-slate-500">
                        <CalendarDays size={10} className="shrink-0 text-slate-400" />
                        {formatShortDate(campaign.end_date)}
                      </p>

                      <p className="mt-1 text-[10px] lg:text-[8px] text-slate-500">
                        <span className="font-semibold text-slate-800">
                          {formatMoney(campaign.budget, campaign.currency ?? 'GBP')}
                        </span>
                        {' · '}
                        {campaign.progress}% complete
                      </p>

                      <div className="mt-1.5 flex items-center gap-1.5">
                        <ChannelChips channels={campaign.channels} max={3} />
                        {capabilities.manageBoard && (
                          <GripVertical size={12} className="ml-auto shrink-0 text-slate-300" aria-hidden />
                        )}
                      </div>
                    </article>
                  ))}

                  {capabilities.create && newCampaignSlot && (
                    <div className="pt-0.5">{newCampaignSlot}</div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      {drag && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-xl border border-blue-300 bg-white px-3 py-2 text-[12px] lg:text-[9.5px] font-semibold text-slate-900 shadow-xl"
          style={{ left: drag.x + 12, top: drag.y + 12, width: Math.min(drag.width, 240) }}
        >
          {drag.label}
        </div>
      )}

      {pending && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] lg:text-[10px] text-slate-500" role="status">
          <Loader2 size={13} className="animate-spin" /> Saving board change…
        </p>
      )}

      {!capabilities.manageBoard && (
        <p className="mt-2 text-[13px] lg:text-[10px] text-slate-500">
          Your role can view the board but cannot move campaigns between stages.
        </p>
      )}
    </>
  )
}
