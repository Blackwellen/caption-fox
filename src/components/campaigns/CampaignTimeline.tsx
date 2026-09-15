'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, CARD, CARD_SHADOW } from './primitives'
import { useToast } from './Toast'
import { rescheduleCampaign } from '@/app/app/campaigns/actions'
import type { CampaignRow, MilestoneRow, PhaseRow } from '@/lib/campaigns/types'
import type { CampaignCapabilities } from '@/lib/campaigns/entitlements'

const DAY_MS = 86_400_000
const ROW_HEIGHT = 52
const DAY_WIDTH = 34

const PHASE_ACCENTS: Record<string, string> = {
  blue: 'bg-blue-500', violet: 'bg-violet-500', emerald: 'bg-emerald-500',
  amber: 'bg-amber-500', slate: 'bg-slate-400', rose: 'bg-rose-500',
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

function formatDay(date: Date): { day: number; month: string } {
  return { day: date.getDate(), month: date.toLocaleDateString('en-GB', { month: 'short' }) }
}

/**
 * Real Gantt-style timeline — every row, bar and milestone is a DOM element
 * driven by campaign data, not a rendered image. Horizontal scroll covers any
 * date range; a sticky "today" marker and accessible data table back it up.
 */
export default function CampaignTimeline({
  campaigns, phases, milestones, capabilities, rangeStart, rangeEnd,
}: {
  campaigns: CampaignRow[]
  phases: PhaseRow[]
  milestones: MilestoneRow[]
  capabilities: CampaignCapabilities
  rangeStart: string
  rangeEnd: string
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'resize-end'; startX: number; origStart: Date; origEnd: Date; deltaDays: number } | null>(null)

  const start = toDate(rangeStart)
  const end = toDate(rangeEnd)
  const totalDays = Math.max(1, daysBetween(start, end) + 1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const phasesByCampaign = useMemo(() => {
    const map = new Map<string, PhaseRow[]>()
    for (const phase of phases) {
      const list = map.get(phase.campaign_id) ?? []
      list.push(phase)
      map.set(phase.campaign_id, list)
    }
    return map
  }, [phases])

  const milestonesByCampaign = useMemo(() => {
    const map = new Map<string, MilestoneRow[]>()
    for (const milestone of milestones) {
      const list = map.get(milestone.campaign_id) ?? []
      list.push(milestone)
      map.set(milestone.campaign_id, list)
    }
    return map
  }, [milestones])

  // Week headers spanning the visible range.
  const weeks: { start: Date; days: number }[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const weekEnd = new Date(Math.min(cursor.getTime() + 6 * DAY_MS, end.getTime()));
    weeks.push({ start: new Date(cursor), days: daysBetween(cursor, weekEnd) + 1 })
    cursor = new Date(cursor.getTime() + 7 * DAY_MS)
  }

  function barPosition(campaignStart: string | null, campaignEnd: string | null) {
    const s = campaignStart ? toDate(campaignStart) : start
    const e = campaignEnd ? toDate(campaignEnd) : new Date(s.getTime() + 7 * DAY_MS)
    const left = Math.max(0, daysBetween(start, s)) * DAY_WIDTH
    const width = Math.max(1, daysBetween(s, e) + 1) * DAY_WIDTH
    return { left, width, s, e }
  }

  function onBarPointerDown(event: React.PointerEvent, campaign: CampaignRow, mode: 'move' | 'resize-end') {
    if (!capabilities.manageTimeline) return
    if ((event.target as HTMLElement).closest('a, button')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      id: campaign.id, mode, startX: event.clientX,
      origStart: campaign.start_date ? toDate(campaign.start_date) : today,
      origEnd: campaign.end_date ? toDate(campaign.end_date) : today,
      deltaDays: 0,
    })
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return
    const deltaPx = event.clientX - drag.startX
    const deltaDays = Math.round(deltaPx / DAY_WIDTH)
    if (deltaDays !== drag.deltaDays) setDrag(current => (current ? { ...current, deltaDays } : current))
  }

  function onPointerUp() {
    if (!drag) return
    const current = drag
    setDrag(null)
    if (current.deltaDays === 0) return

    const newStart = current.mode === 'move'
      ? new Date(current.origStart.getTime() + current.deltaDays * DAY_MS)
      : current.origStart
    const newEnd = new Date(current.origEnd.getTime() + current.deltaDays * DAY_MS)

    if (newEnd < newStart) {
      notify('error', 'A campaign cannot end before it starts.')
      return
    }

    const iso = (date: Date) => date.toISOString().slice(0, 10)
    startTransition(async () => {
      const result = await rescheduleCampaign(current.id, iso(newStart), iso(newEnd))
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Rescheduled.') : (result.error ?? 'Could not reschedule this campaign.'))
      if (result.ok) router.refresh()
    })
  }

  const todayOffset = today >= start && today <= end ? daysBetween(start, today) * DAY_WIDTH : null

  return (
    <>
      <div className={cn(CARD, CARD_SHADOW, 'overflow-hidden')} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 260 + totalDays * DAY_WIDTH }}>
            {/* Header */}
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50/90 backdrop-blur">
              <div className="w-[260px] shrink-0 border-r border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Campaign
              </div>
              <div className="relative flex">
                {weeks.map((week, i) => (
                  <div
                    key={i} style={{ width: week.days * DAY_WIDTH }}
                    className="shrink-0 border-r border-slate-200 px-1.5 py-2 text-[10px] font-medium text-slate-500"
                  >
                    {week.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(week.start.getTime() + (week.days - 1) * DAY_MS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="relative">
              {todayOffset !== null && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-[5] w-px bg-blue-500"
                  style={{ left: 260 + todayOffset + DAY_WIDTH / 2 }}
                  aria-hidden
                >
                  <span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                </div>
              )}

              {campaigns.map(campaign => {
                const dragging = drag?.id === campaign.id
                const shift = dragging ? drag.deltaDays * DAY_WIDTH : 0
                const base = barPosition(campaign.start_date, campaign.end_date)
                const left = drag && dragging && drag.mode === 'move' ? base.left + shift : base.left
                const width = drag && dragging && drag.mode === 'resize-end' ? Math.max(DAY_WIDTH, base.width + shift) : base.width
                const campaignPhases = phasesByCampaign.get(campaign.id) ?? []
                const campaignMilestones = milestonesByCampaign.get(campaign.id) ?? []

                return (
                  <div key={campaign.id} className="flex border-b border-slate-100" style={{ height: ROW_HEIGHT }}>
                    <div className="flex w-[260px] shrink-0 items-center gap-2 border-r border-slate-200 px-3">
                      <Link href={`/app/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-slate-900 hover:text-blue-600">{campaign.name}</span>
                      </Link>
                      <Avatar person={campaign.owner} size={20} />
                    </div>

                    <div className="relative flex-1">
                      {campaignPhases.length > 0 ? (
                        campaignPhases.map(phase => {
                          const pos = barPosition(phase.start_date, phase.end_date)
                          return (
                            <div
                              key={phase.id}
                              title={`${phase.name}: ${phase.start_date} to ${phase.end_date}`}
                              className={cn('absolute top-2.5 h-6 rounded-md opacity-90', PHASE_ACCENTS[phase.accent] ?? 'bg-slate-400')}
                              style={{ left: pos.left, width: pos.width }}
                            >
                              <span className="flex h-full items-center truncate px-2 text-[10px] font-medium text-white">
                                {phase.name}
                              </span>
                            </div>
                          )
                        })
                      ) : (
                        <div
                          onPointerDown={event => onBarPointerDown(event, campaign, 'move')}
                          className={cn(
                            'absolute top-2.5 h-6 rounded-md bg-blue-500 opacity-90 transition-shadow',
                            capabilities.manageTimeline ? 'cursor-grab touch-none hover:shadow-md' : 'cursor-default',
                          )}
                          style={{ left, width }}
                        >
                          <span className="flex h-full items-center justify-between gap-1 truncate px-2 text-[10px] font-medium text-white">
                            <span className="truncate">{campaign.progress}%</span>
                          </span>
                          {capabilities.manageTimeline && (
                            <span
                              onPointerDown={event => { event.stopPropagation(); onBarPointerDown(event, campaign, 'resize-end') }}
                              className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
                              aria-hidden
                            />
                          )}
                        </div>
                      )}

                      {campaignMilestones.map(milestone => {
                        const offset = daysBetween(start, toDate(milestone.due_date)) * DAY_WIDTH
                        if (offset < 0 || offset > totalDays * DAY_WIDTH) return null
                        return (
                          <span
                            key={milestone.id}
                            title={`${milestone.title} — ${milestone.due_date}`}
                            className={cn(
                              'absolute top-1 h-3 w-3 rotate-45',
                              milestone.status === 'completed' ? 'bg-emerald-500'
                                : milestone.status === 'at_risk' || milestone.status === 'blocked' ? 'bg-red-500' : 'bg-violet-500',
                            )}
                            style={{ left: offset + DAY_WIDTH / 2 - 6 }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {pending && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500" role="status">
          <Loader2 size={13} className="animate-spin" /> Saving schedule change…
        </p>
      )}

      {/* Accessible data table alternative to the visual Gantt. */}
      <table className="sr-only">
        <caption>Campaign timeline: start date, end date and progress</caption>
        <thead>
          <tr><th scope="col">Campaign</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Progress</th></tr>
        </thead>
        <tbody>
          {campaigns.map(campaign => (
            <tr key={campaign.id}>
              <th scope="row">{campaign.name}</th>
              <td>{campaign.start_date ?? 'Not set'}</td>
              <td>{campaign.end_date ?? 'Not set'}</td>
              <td>{campaign.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
