'use client'

import { LazyMotion, MotionConfig } from 'framer-motion'
import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'

export const EASE_CF = [0.22, 1, 0.36, 1] as const

const loadFeatures = () => import('./motion-features').then((m) => m.default)

/** Framer Motion root for the public site: lazy features, OS reduced-motion respected. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.55, ease: EASE_CF }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  )
}

interface InViewProps {
  as?: ElementType
  children?: ReactNode
  className?: string
  id?: string
  style?: CSSProperties
  /** Fraction of the element that must be visible before revealing. */
  amount?: number
  'aria-labelledby'?: string
  'aria-label'?: string
  role?: string
}

/**
 * Marks itself with `data-inview` once it scrolls into view. CSS (.cf-reveal,
 * .cf-draw-wait) keys entrance motion off that attribute, so server-rendered
 * copy stays in the HTML and reduced-motion users get the finished state.
 */
export function InView({ as: As = 'div', children, amount = 0.2, ...rest }: InViewProps) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-inview', '')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.setAttribute('data-inview', '')
          io.disconnect()
        }
      },
      // A fractional threshold can never be met by elements taller than the viewport
      // (e.g. stacked mobile layouts), which would leave them hidden. Instead reveal as
      // soon as the element's top has moved `amount` of the way up into the viewport.
      { threshold: 0, rootMargin: `0px 0px -${Math.round(amount * 50)}% 0px` },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [amount])
  return (
    <As ref={ref} {...rest}>
      {children}
    </As>
  )
}
