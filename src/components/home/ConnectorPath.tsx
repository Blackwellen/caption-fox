'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'

/**
 * SVG connector that "draws" from its start point once an ancestor gains
 * `data-inview`. Uses the path's measured pixel length (Chrome does not scale
 * CSS dash values by `pathLength` reliably), and reveals dashed styles through
 * a mask so the dash pattern survives the draw. Without JS, or with reduced
 * motion, the full connector renders immediately.
 */
export function ConnectorPath({
  d, delay = 0, dashed = false, opacity = 0.6, width = 1.4,
}: {
  d: string
  delay?: number
  dashed?: boolean
  opacity?: number
  width?: number
}) {
  const revealRef = useRef<SVGPathElement>(null)
  const maskId = useId().replace(/:/g, '')

  useEffect(() => {
    const el = revealRef.current
    if (!el) return
    const len = Math.ceil(el.getTotalLength()) + 2
    el.style.strokeDasharray = `${len}`
    el.style.strokeDashoffset = `${len}`
  }, [d])

  const style = { '--d': `${delay}ms` } as CSSProperties

  if (!dashed) {
    return <path ref={revealRef} d={d} fill="none" stroke="#1769FF" strokeOpacity={opacity} strokeWidth={width} className="cf-draw-real" style={style} />
  }

  return (
    <g>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="-100" y="-100" width="4000" height="4000">
        <path ref={revealRef} d={d} fill="none" stroke="#fff" strokeWidth={width + 6} className="cf-draw-real" style={style} />
      </mask>
      <path d={d} fill="none" stroke="#1769FF" strokeOpacity={opacity} strokeWidth={width} strokeDasharray="4 4" strokeLinecap="round" mask={`url(#${maskId})`} />
    </g>
  )
}
