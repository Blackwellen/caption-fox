'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { cropMediaAsset } from '@/lib/studio/actions/media'
import type { MediaRow } from '@/lib/studio/types'
import { Dialog } from '../overlays'
import { Btn, S_FOCUS } from '../ui'

type Box = { x: number; y: number; width: number; height: number }
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se'

const PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: 0 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
] as const

export const CROPPABLE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const MIN = 0.05

/**
 * Crop editor. The selection is kept as fractions of the image so the server
 * can apply it at full resolution; the result is saved as a new version.
 */
export function CropDialog({ asset, open, onClose }: { asset: MediaRow; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, start] = useTransition()
  const [box, setBox] = useState<Box>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 })
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('free')
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ handle: Handle; startX: number; startY: number; start: Box } | null>(null)

  const ratioFor = (id: string) => {
    const p = PRESETS.find(x => x.id === id)
    if (!p || p.ratio === null) return null
    return p.ratio === 0 ? (natural ? natural.w / natural.h : null) : p.ratio
  }
  // A pixel ratio r needs height = width * W / (r * H) in fractional units.
  const fit = (b: Box, ratio: number | null): Box => {
    if (!ratio || !natural) return b
    let { width, height } = b
    height = (width * natural.w) / (ratio * natural.h)
    if (height > 1) { height = 1; width = (height * ratio * natural.h) / natural.w }
    if (b.y + height > 1) height = 1 - b.y
    width = (height * ratio * natural.h) / natural.w
    return { x: clamp(b.x, 0, 1 - width), y: clamp(b.y, 0, 1 - height), width, height }
  }

  const choose = (id: (typeof PRESETS)[number]['id']) => {
    setPreset(id)
    const ratio = ratioFor(id)
    if (!ratio || !natural) return
    // Largest centred box with that ratio.
    let width = 1
    let height = (width * natural.w) / (ratio * natural.h)
    if (height > 1) { height = 1; width = (ratio * natural.h) / natural.w }
    setBox({ x: (1 - width) / 2, y: (1 - height) / 2, width, height })
  }

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ handle, startX: e.clientX, startY: e.clientY, start: box })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag
    const rect = frame.current?.getBoundingClientRect()
    if (!d || !rect) return
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const s = d.start
    if (d.handle === 'move') {
      setBox({ ...s, x: clamp(s.x + dx, 0, 1 - s.width), y: clamp(s.y + dy, 0, 1 - s.height) })
      return
    }
    let { x, y, width, height } = s
    if (d.handle.includes('e')) width = clamp(s.width + dx, MIN, 1 - s.x)
    if (d.handle.includes('s')) height = clamp(s.height + dy, MIN, 1 - s.y)
    if (d.handle.includes('w')) { x = clamp(s.x + dx, 0, s.x + s.width - MIN); width = s.x + s.width - x }
    if (d.handle.includes('n')) { y = clamp(s.y + dy, 0, s.y + s.height - MIN); height = s.y + s.height - y }
    const ratio = ratioFor(preset)
    setBox(ratio ? fit({ x, y, width, height }, ratio) : { x, y, width, height })
  }
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    setBox(b => ({ ...b, x: clamp(b.x + m[0], 0, 1 - b.width), y: clamp(b.y + m[1], 0, 1 - b.height) }))
  }

  const pixels = natural ? { w: Math.round(box.width * natural.w), h: Math.round(box.height * natural.h) } : null
  const outW = pixels ? (rotate % 180 === 0 ? pixels.w : pixels.h) : null
  const outH = pixels ? (rotate % 180 === 0 ? pixels.h : pixels.w) : null

  const save = () => start(async () => {
    const result = await cropMediaAsset({ id: asset.id, crop: box, rotate })
    notify(result.ok ? 'success' : 'error', result.ok ? result.message ?? 'Cropped.' : result.error ?? 'Could not crop the image.')
    if (result.ok) { onClose(); router.refresh() }
  })

  const handle = (h: Exclude<Handle, 'move'>, pos: string) => (
    <span role="presentation" onPointerDown={onPointerDown(h)}
      className={cn('absolute h-3.5 w-3.5 rounded-sm border-2 border-white bg-[#1a5cff] shadow', pos, h === 'nw' || h === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize')} />
  )

  return (
    <Dialog open={open} onClose={onClose} size="xl" title={`Crop “${asset.file_name}”`}
      description="Drag the frame to move it, drag a corner to resize, or use the arrow keys. The original is kept in Versions."
      footer={<>
        <span className="mr-auto self-center text-[12px] text-slate-500" aria-live="polite">{outW && outH ? `Output ${outW} x ${outH}px` : 'Loading image…'}</span>
        <Btn size="md" onClick={onClose}>Cancel</Btn>
        <Btn size="md" variant="primary" onClick={save} disabled={pending || !natural}>{pending ? 'Saving…' : 'Save crop'}</Btn>
      </>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Aspect ratio" className="inline-flex flex-wrap rounded-[7px] border border-[#e3e7ee] p-0.5">
          {PRESETS.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => choose(p.id)}
              className={cn('h-8 rounded-[5px] px-3 text-[12px] font-medium', S_FOCUS, preset === p.id ? 'bg-[#eef3ff] text-[#1a5cff]' : 'text-slate-600 hover:text-slate-900')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[12px] text-slate-500">Rotate {rotate}°</span>
          <Btn size="sm" aria-label="Rotate left" onClick={() => setRotate(r => ((r + 270) % 360) as 0 | 90 | 180 | 270)}><RotateCcw size={13} /></Btn>
          <Btn size="sm" aria-label="Rotate right" onClick={() => setRotate(r => ((r + 90) % 360) as 0 | 90 | 180 | 270)}><RotateCw size={13} /></Btn>
        </div>
      </div>
      <div className="flex justify-center rounded-lg bg-slate-900/90 p-3">
        <div ref={frame} className="relative inline-block touch-none select-none" onPointerMove={onPointerMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.file_url} alt={asset.alt_text ?? asset.file_name} draggable={false}
            onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="block max-h-[58vh] max-w-full" />
          <div className="pointer-events-none absolute inset-0 bg-black/50" style={{
            clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.x * 100}% ${box.y * 100}%, ${box.x * 100}% ${(box.y + box.height) * 100}%, ${(box.x + box.width) * 100}% ${(box.y + box.height) * 100}%, ${(box.x + box.width) * 100}% ${box.y * 100}%, ${box.x * 100}% ${box.y * 100}%)`,
            clipRule: 'evenodd',
          }} />
          <div role="slider" tabIndex={0} aria-label="Crop area. Use arrow keys to move it."
            aria-valuetext={pixels ? `${pixels.w} by ${pixels.h} pixels at ${Math.round(box.x * 100)}% left, ${Math.round(box.y * 100)}% top` : undefined}
            onKeyDown={onKey} onPointerDown={onPointerDown('move')}
            className={cn('absolute cursor-move border-2 border-white outline-none focus-visible:ring-2 focus-visible:ring-[#1a5cff]')}
            style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}>
            <span className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/40" />
            <span className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/40" />
            <span className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/40" />
            <span className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/40" />
            {handle('nw', '-left-2 -top-2')}{handle('ne', '-right-2 -top-2')}{handle('sw', '-bottom-2 -left-2')}{handle('se', '-bottom-2 -right-2')}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
