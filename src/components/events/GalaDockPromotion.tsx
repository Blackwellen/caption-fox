'use client'

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dismissGalaDockPromotion, trackGalaDockPromotionClick } from '@/lib/events/actions'
import type { GalaDockConnectionState, GalaDockPlacement } from '@/lib/events/types'

/**
 * Gala Dock cross-product promotion.
 *
 * Caption Fox owns event MARKETING; Gala Dock owns full event OPERATIONS
 * (venues, logistics, staffing, ticketing, production). This component is the
 * only place that boundary is advertised — it never replaces the Caption Fox
 * shell, and it never claims an event is synced unless a link record exists.
 *
 * One component, five layouts, so all six routes stay consistent.
 */

export const GALA_DOCK_MARKETING_URL = 'https://galadock.com'

type Variant = 'wide' | 'wide-reverse' | 'tall' | 'footer'

const VARIANT_FOR: Record<GalaDockPlacement, Variant> = {
  'overview-banner': 'wide',
  'events-sidebar': 'tall',
  'webinars-banner': 'wide-reverse',
  'podcasts-banner': 'wide',
  'sponsorships-banner': 'wide-reverse',
  'sponsorships-footer': 'footer',
  'follow-up-banner': 'wide',
}

export interface GalaDockPromotionProps {
  placement: GalaDockPlacement
  routeSegment: string
  connectionState: GalaDockConnectionState
  title: string
  body: string
  /** Deep link when the workspace or event is genuinely linked. */
  workspaceUrl?: string | null
  eventUrl?: string | null
  syncError?: string | null
  dismissible?: boolean
  /** Server-resolved: this user already dismissed this placement. */
  dismissed?: boolean
  className?: string
}

/** CTA wording follows the real integration state — never a claimed one. */
function ctaFor(state: GalaDockConnectionState): { label: string; secondary?: string } {
  switch (state) {
    case 'event-linked': return { label: 'Manage Event in Gala Dock' }
    case 'workspace-connected': return { label: 'Open Gala Dock Workspace' }
    case 'error': return { label: 'Review Gala Dock Connection' }
    default: return { label: 'Learn More', secondary: 'See How It Works' }
  }
}

function destinationFor(props: GalaDockPromotionProps): string {
  if (props.connectionState === 'event-linked' && props.eventUrl) return props.eventUrl
  if (props.connectionState === 'workspace-connected' && props.workspaceUrl) return props.workspaceUrl
  return GALA_DOCK_MARKETING_URL
}

export default function GalaDockPromotion(props: GalaDockPromotionProps) {
  const {
    placement, routeSegment, connectionState, title, body,
    dismissible = true, dismissed = false, syncError, className,
  } = props
  const pathname = usePathname()
  const [hidden, setHidden] = useState(dismissed)
  const [, startTransition] = useTransition()

  if (hidden) return null

  const variant = VARIANT_FOR[placement]
  const cta = ctaFor(connectionState)
  const destination = destinationFor(props)
  const external = destination.startsWith('http')

  function onCtaClick() {
    startTransition(() => {
      void trackGalaDockPromotionClick(routeSegment, placement, destination)
    })
  }

  function onDismiss() {
    setHidden(true)
    startTransition(() => {
      void dismissGalaDockPromotion(routeSegment, placement, pathname)
    })
  }

  const ctaButton = (
    <a
      href={destination}
      onClick={onCtaClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors',
        variant === 'footer'
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-slate-900/90 text-white ring-1 ring-white/15 hover:bg-slate-900',
      )}
    >
      {cta.label}
      {connectionState === 'error'
        ? <RefreshCw size={13} aria-hidden />
        : <ArrowUpRight size={14} aria-hidden />}
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  )

  const secondaryButton = cta.secondary && variant === 'wide-reverse' ? (
    <a
      href={`${GALA_DOCK_MARKETING_URL}/how-it-works`}
      onClick={onCtaClick}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
    >
      {cta.secondary}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : null

  const dismissButton = dismissible ? (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        'absolute right-3 top-3 rounded-md p-1.5 transition-colors',
        variant === 'footer'
          ? 'text-slate-400 hover:bg-slate-200/60 hover:text-slate-600'
          : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
      aria-label={`Dismiss Gala Dock promotion`}
    >
      <X size={16} />
    </button>
  ) : null

  /* --------------------------------------------------------------- footer */
  if (variant === 'footer') {
    return (
      <aside
        aria-label="Gala Dock cross-product recommendation"
        className={cn(
          'relative flex flex-col items-start gap-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-5 py-4 sm:flex-row sm:items-center',
          className,
        )}
      >
        <GalaDockMark size={34} tone="light" />
        <div className="min-w-0 flex-1 pr-8">
          <p className="text-[13.5px] font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-[12.5px] text-slate-600">{body}</p>
        </div>
        {ctaButton}
        {dismissButton}
      </aside>
    )
  }

  /* ----------------------------------------------------------------- tall */
  if (variant === 'tall') {
    return (
      <aside
        aria-label="Gala Dock cross-product recommendation"
        className={cn('relative overflow-hidden rounded-xl bg-[#0b1033] px-5 py-6 text-white', className)}
      >
        <Starfield />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <GalaDockMark size={34} />
            <GalaDockWordmark className="h-[22px] w-auto" />
          </div>
          <h2 className="mt-4 text-[19px] font-bold leading-snug">{title}</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{body}</p>
          {connectionState === 'error' && syncError && (
            <p className="mt-2 rounded-md bg-rose-500/15 px-2 py-1 text-[11.5px] text-rose-200">{syncError}</p>
          )}
          <div className="mt-4">{ctaButton}</div>
        </div>
        {dismissButton}
      </aside>
    )
  }

  /* ----------------------------------------------------------------- wide */
  const logoBlock = (
    <div className="flex shrink-0 items-center gap-3">
      <GalaDockMark size={variant === 'wide' ? 62 : 52} />
      {variant === 'wide-reverse' && <GalaDockWordmark className="hidden h-[34px] w-auto sm:block" />}
    </div>
  )

  return (
    <aside
      aria-label="Gala Dock cross-product recommendation"
      className={cn(
        'relative flex items-center gap-5 overflow-hidden rounded-xl bg-[#0b1033] px-6 py-5 text-white',
        className,
      )}
    >
      <Starfield />
      {logoBlock}
      <div className="relative min-w-0 flex-1 pr-8">
        <h2 className="text-[17px] font-bold leading-snug">{title}</h2>
        <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-slate-300">{body}</p>
        {connectionState === 'error' && syncError && (
          <p className="mt-2 inline-block rounded-md bg-rose-500/15 px-2 py-1 text-[11.5px] text-rose-200">{syncError}</p>
        )}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          {ctaButton}
          {secondaryButton}
        </div>
      </div>
      {variant === 'wide' && (
        <GalaDockWordmark className="relative hidden h-[46px] w-auto shrink-0 xl:block" />
      )}
      {dismissButton}
    </aside>
  )
}

/* ------------------------------------------------------------------ brand */

/**
 * Gala Dock spiral mark. Rendered as inline SVG so it stays crisp at every
 * placement size and in both themes. Swap for the official PNG by replacing
 * this component's body with an <Image> — nothing else needs to change.
 */
export function GalaDockMark({ size = 48, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  const bg = tone === 'dark' ? '#161a3f' : '#ffffff'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Gala Dock">
      <rect width="64" height="64" rx="18" fill={bg} />
      <path
        d="M44 24.5a15 15 0 1 0 2.2 12.4c1-4.6-1.6-8.7-6-9.4-4-.6-7.6 1.9-8.3 5.7-.6 3.2 1.4 6 4.4 6.5 2.6.4 4.9-1.2 5.3-3.6"
        fill="none"
        stroke="#5b4bf5"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function GalaDockWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 48" className={className} role="img" aria-label="Gala Dock">
      <text
        x="0" y="35"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="36" fontWeight="700" fill="#5b4bf5" letterSpacing="-0.5"
      >
        Gala
      </text>
      <circle cx="93" cy="24" r="4" fill="#5b4bf5" />
      <text
        x="104" y="35"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="36" fontWeight="700" fill="#5b4bf5" letterSpacing="-0.5"
      >
        Dock
      </text>
    </svg>
  )
}

function Starfield() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
      preserveAspectRatio="none"
      viewBox="0 0 800 140"
    >
      <defs>
        <radialGradient id="gd-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#6d5cff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6d5cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="430" cy="70" rx="120" ry="70" fill="url(#gd-glow)" />
      <path d="M430 34 L436 66 L468 70 L436 74 L430 106 L424 74 L392 70 L424 66 Z" fill="#a99cff" opacity="0.75" />
      <path d="M520 52 L523 66 L537 69 L523 72 L520 86 L517 72 L503 69 L517 66 Z" fill="#a99cff" opacity="0.5" />
    </svg>
  )
}
