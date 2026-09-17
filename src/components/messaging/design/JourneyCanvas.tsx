'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Bell, ChevronDown, Clock, Expand, Fingerprint, Globe, Hand, Link2, Mail, MessageSquareText, MinusCircle, MousePointer2,
  Plus, ShoppingCart, Smartphone, Webhook, ZoomIn, ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MessagingChannel } from '@/lib/messaging/constants'
import type { CanvasEdge, CanvasNode } from '@/lib/messaging/dashboard'
import { WhatsAppIcon } from './kit'

// A journey's saved graph drawn as the approved canvas: orthogonal connectors,
// yes/no branch labels, per-step stats, zoom and pan. The canvas is a view of
// the persisted definition; editing happens in the journey builder it links to,
// and execution happens server-side in the journey engine.

export interface CanvasJourneyOption { id: string; name: string; status: string }

const NODE_W = 92
const NODE_H = 27
const COND_W = 62
const COND_H = 16
const END_W = 38
const END_H = 17

function nodeSize(node: CanvasNode) {
  if (node.type === 'condition') return { w: Math.max(COND_W, (node.label?.length ?? 8) * 4.6 + 16), h: COND_H }
  if (node.type === 'end') return { w: END_W, h: END_H }
  return { w: NODE_W, h: NODE_H }
}

const CHANNEL_LABEL: Record<MessagingChannel, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', rcs: 'Send', push: 'Push' }

function kindLabel(node: CanvasNode, variant?: string) {
  if (node.type === 'trigger') return 'Trigger'
  if (node.type === 'wait') return 'Wait'
  if (node.type === 'action') return node.actionKind === 'webhook' ? 'Webhook' : node.actionKind === 'open_url' ? 'Open URL' : 'Action'
  if (node.type === 'message') {
    if (node.fallback) return 'Fallback'
    if (variant === 'whatsapp') return 'Send message'
    return node.channel ? CHANNEL_LABEL[node.channel] : 'Message'
  }
  return ''
}

function NodeIcon({ node }: { node: CanvasNode }) {
  const cls = 'h-[9px] w-[9px]'
  if (node.type === 'trigger') return node.label?.toLowerCase().includes('cart') ? <ShoppingCart className={cls} /> : <Fingerprint className={cls} />
  if (node.type === 'wait') return <Clock className={cls} />
  if (node.type === 'action') return node.actionKind === 'webhook' ? <Webhook className={cls} /> : <Link2 className={cls} />
  switch (node.channel) {
    case 'sms': return <Smartphone className={cls} />
    case 'whatsapp': return <WhatsAppIcon className={cls} />
    case 'rcs': return <MessageSquareText className={cls} />
    case 'push': return <Bell className={cls} />
    default: return <Mail className={cls} />
  }
}

function tileTone(node: CanvasNode) {
  if (node.type === 'wait') return 'bg-orange-50 text-orange-500 ring-orange-100'
  if (node.type === 'action') return 'bg-violet-50 text-violet-600 ring-violet-100'
  if (node.channel === 'whatsapp') return 'bg-emerald-50 text-emerald-600 ring-emerald-100'
  if (node.channel === 'push') return 'bg-violet-50 text-violet-600 ring-violet-100'
  return 'bg-blue-50 text-blue-600 ring-blue-100'
}

export default function JourneyCanvas({
  nodes, edges, journeyId, journeys, status, height = 290, variant, selectedId, selectable, showStats, highlightIds, className,
  toolbar = 'left', header = true, param = 'journey', editHref,
}: {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  journeyId: string | null
  journeys?: CanvasJourneyOption[]
  status?: string
  height?: number
  variant?: string
  selectedId?: string | null
  selectable?: boolean
  showStats?: boolean
  highlightIds?: string[]
  className?: string
  toolbar?: 'left' | 'none'
  header?: boolean
  param?: string
  editHref?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [journeyId])

  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(search.toString())
    if (value) next.set(key, value); else next.delete(key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [pathname, router, search])

  const statsGutter = showStats ? 70 : 0
  const rows = nodes.map(n => n.row ?? n.order ?? 0)
  const maxRow = rows.length ? Math.max(...rows) : 0
  const top = 12
  const rowH = Math.max(30, Math.min(46, (height - top - 18) / Math.max(1, maxRow + 0.6)))
  const usable = Math.max(200, width - statsGutter - 20)

  const layout = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; h: number; node: CanvasNode }>()
    nodes.forEach((node, index) => {
      const { w, h } = nodeSize(node)
      const cx = 10 + (node.x ?? 0.5) * usable
      const cy = top + (node.row ?? node.order ?? index) * rowH + NODE_H / 2
      map.set(node.id, { x: Math.min(Math.max(cx - w / 2, 4), usable + 10 - w + statsGutter * 0), y: cy - h / 2, w, h, node })
    })
    return map
  }, [nodes, usable, rowH, statsGutter])

  const paths = useMemo(() => edges.map(edge => {
    const a = layout.get(edge.from), b = layout.get(edge.to)
    if (!a || !b) return null
    const ax = a.x + a.w / 2, bx = b.x + b.w / 2
    const aBottom = a.y + a.h, bTop = b.y, bMid = b.y + b.h / 2
    let d: string
    let labelAt: { x: number; y: number } | null = null
    if (Math.abs(ax - bx) < 2) {
      d = `M${ax},${aBottom} L${bx},${bTop}`
    } else if (a.node.type === 'condition') {
      const sx = bx < ax ? a.x : a.x + a.w
      const sy = a.y + a.h / 2
      d = `M${sx},${sy} L${bx},${sy} L${bx},${bTop}`
      labelAt = { x: (sx + bx) / 2, y: sy }
    } else if (bMid > aBottom + 4) {
      const tx = bx > ax ? b.x : b.x + b.w
      d = `M${ax},${aBottom} L${ax},${bMid} L${tx},${bMid}`
    } else {
      d = `M${ax},${aBottom} L${ax},${aBottom + 6} L${bx},${aBottom + 6} L${bx},${bTop}`
    }
    return { key: `${edge.from}-${edge.to}`, d, branch: edge.branch, labelAt }
  }).filter(Boolean) as { key: string; d: string; branch?: 'yes' | 'no'; labelAt: { x: number; y: number } | null }[], [edges, layout])

  const contentHeight = top + (maxRow + 1) * rowH + 8
  const onPointerDown = (event: ReactPointerEvent) => {
    if (tool !== 'pan') return
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y }
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag.current) return
    setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y })
  }

  const current = journeys?.find(j => j.id === journeyId)

  return (
    <div className={cn('relative flex min-w-0 flex-col', className)}>
      {header && journeys && (
        <div className="mb-1.5 flex items-center gap-2 lg:mb-[6px]">
          <span className="w-14 text-[11.5px] text-slate-500 lg:w-[40px] lg:text-[8.5px]">Journey</span>
          <label className="relative">
            <span className="sr-only">Choose journey</span>
            <select
              value={journeyId ?? ''} onChange={event => setParam(param, event.target.value || null)}
              className="h-8 w-44 appearance-none truncate rounded-md border border-slate-200 bg-white pl-2 pr-6 text-[12px] text-slate-700 lg:h-[20px] lg:w-[92px] lg:rounded-[4px] lg:pl-[6px] lg:text-[8px]"
            >
              {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400 lg:h-2.5 lg:w-2.5" aria-hidden />
          </label>
          {current && (
            <span className={cn('rounded px-1.5 text-[11px] font-medium lg:h-[14px] lg:text-[7.5px] lg:leading-[14px]',
              current.status === 'active' ? 'bg-emerald-50 text-emerald-600' : current.status === 'paused' ? 'bg-amber-50 text-amber-600' : 'bg-orange-50 text-orange-600')}>
              {current.status === 'active' ? 'Active' : current.status === 'paused' ? 'Paused' : 'Draft'}
            </span>
          )}
        </div>
      )}

      <div
        ref={frame}
        className={cn('relative min-w-0 overflow-hidden rounded-md', tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : '')}
        style={{ height }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }}
        role="group" aria-label={`Journey canvas${status ? `, ${status}` : ''}`}
      >
        {nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-[12px] text-slate-500 lg:text-[9px]">No journey to show yet.</p>
            <Link href="/app/messaging/journeys/new" className="text-[12px] font-medium text-blue-600 hover:underline lg:text-[9px]">Create a journey</Link>
          </div>
        ) : (
          <div className="absolute left-0 top-0 origin-top-left transition-transform duration-75" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width, height: contentHeight }}>
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={contentHeight} aria-hidden>
              <defs>
                <marker id={`arrow-${journeyId}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0,0 L6,3 L0,6 z" fill="#475569" />
                </marker>
              </defs>
              {paths.map(p => (
                <g key={p.key}>
                  <path d={p.d} fill="none" stroke="#64748b" strokeWidth={1} markerEnd={`url(#arrow-${journeyId})`} />
                  {p.labelAt && p.branch && (
                    <text x={p.labelAt.x} y={p.labelAt.y - 2} textAnchor="middle" fontSize={7.5} fontWeight={600} fill={p.branch === 'yes' ? '#16a34a' : '#ef4444'}>
                      {p.branch === 'yes' ? 'Yes' : 'No'}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {[...layout.values()].map(({ x, y, w, h, node }) => {
              const selected = selectedId === node.id || highlightIds?.includes(node.id)
              const common = cn('absolute flex items-center border bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:outline-2 focus-visible:outline-blue-600',
                selected ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-200' : 'border-slate-200')
              const style = { left: x, top: y, width: w, height: h }
              const onClick = selectable ? () => setParam('step', node.id) : undefined
              const Tag = selectable ? 'button' : 'div'

              if (node.type === 'condition') {
                return (
                  <Tag key={node.id} type={selectable ? 'button' : undefined} onClick={onClick} style={style}
                    className={cn(common, 'justify-center rounded-full px-2 text-[8px] text-slate-700')}>
                    <span className="truncate">{node.label ?? 'Condition'}</span>
                  </Tag>
                )
              }
              if (node.type === 'end') {
                return (
                  <Tag key={node.id} type={selectable ? 'button' : undefined} onClick={onClick} style={style}
                    className={cn(common, 'justify-center gap-1 rounded-[5px] text-[8px] text-slate-600')}>
                    {node.label === 'End' && showStats && <MinusCircle className="h-[8px] w-[8px] text-slate-400" aria-hidden />}
                    {node.label ?? 'End'}
                  </Tag>
                )
              }
              return (
                <div key={node.id} className="contents">
                  <Tag type={selectable ? 'button' : undefined} onClick={onClick} style={style}
                    aria-pressed={selectable ? selectedId === node.id : undefined}
                    className={cn(common, 'gap-1.5 rounded-[5px] px-1.5')}>
                    <span className={cn('flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] ring-1', tileTone(node))} aria-hidden><NodeIcon node={node} /></span>
                    <span className="min-w-0 leading-[1.15]">
                      <span className="block truncate text-[6.5px] text-slate-500">{kindLabel(node, variant)}</span>
                      <span className="block truncate text-[7.5px] font-medium text-slate-800">{node.label}{node.sublabel ? <span className="block font-normal text-slate-600">{node.sublabel}</span> : null}</span>
                    </span>
                  </Tag>
                  {showStats && node.stats && (
                    <span className="absolute text-right text-[7.5px] leading-tight tabular-nums" style={{ left: x + w + 12, top: y + 3, width: 44 }}>
                      <span className="block text-slate-700">{node.stats.count.toLocaleString('en-GB')}</span>
                      <span className="block text-slate-400">{node.stats.label ?? (node.stats.rate !== undefined ? `${node.stats.rate}%` : '')}</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {toolbar === 'left' && nodes.length > 0 && (
          <div className="absolute left-1 top-2 flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm lg:top-[4px]">
            {editHref && (
              <Link href={editHref} aria-label="Add a step in the journey builder" className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 lg:h-[20px] lg:w-[20px]">
                <Plus className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" />
              </Link>
            )}
            <ToolButton label="Select" active={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" /></ToolButton>
            <ToolButton label="Pan" active={tool === 'pan'} onClick={() => setTool('pan')}><Hand className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" /></ToolButton>
            <ToolButton label="Fit to view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}><Globe className="h-3.5 w-3.5 lg:h-2.5 lg:w-2.5" /></ToolButton>
          </div>
        )}
      </div>

      {nodes.length > 0 && (
        <div className={cn('pointer-events-none absolute right-2 flex items-center gap-1 lg:right-[4px]', header && journeys ? 'top-12 lg:top-[34px]' : 'top-2 lg:top-[4px]')} data-zoom>
          <div className="pointer-events-auto flex items-center rounded-md border border-slate-200 bg-white text-[11px] text-slate-600 lg:h-[20px] lg:text-[7.5px]">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="flex h-7 w-6 items-center justify-center hover:bg-slate-50 lg:h-full lg:w-[16px]"><ZoomOut className="h-3 w-3 lg:h-2.5 lg:w-2.5" /></button>
            <span className="w-9 text-center tabular-nums lg:w-[26px]" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(1.8, +(z + 0.1).toFixed(2)))} className="flex h-7 w-6 items-center justify-center hover:bg-slate-50 lg:h-full lg:w-[16px]"><ZoomIn className="h-3 w-3 lg:h-2.5 lg:w-2.5" /></button>
          </div>
          {journeyId && (
            <Link href={`/app/messaging/journeys/${journeyId}`} aria-label="Open full journey" className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-[20px] lg:w-[20px]">
              <Expand className="h-3 w-3 lg:h-2.5 lg:w-2.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={active} onClick={onClick}
      className={cn('flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 lg:h-[20px] lg:w-[20px]', active && 'bg-slate-100 text-slate-800')}>
      {children}
    </button>
  )
}
