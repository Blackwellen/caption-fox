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

type Variant = 'wide' | 'wide-reverse' | 'wide-cta-right' | 'tall' | 'footer'

const VARIANT_FOR: Record<GalaDockPlacement, Variant> = {
  'overview-banner': 'wide',
  'events-sidebar': 'tall',
  'webinars-banner': 'wide-reverse',
  'podcasts-banner': 'wide',
  'sponsorships-banner': 'wide-cta-right',
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
        'inline-flex h-[26px] items-center gap-1.5 rounded-md px-3.5 text-[11.5px] font-semibold transition-colors',
        variant === 'footer'
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : variant === 'tall'
            ? 'border border-white/40 text-white hover:bg-white/10'
            : 'bg-[#07071a] text-white ring-1 ring-white/10 hover:bg-black',
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
      className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-white/30 px-3.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/10"
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
        <div className="sm:mr-24">{ctaButton}</div>
        {dismissButton}
      </aside>
    )
  }

  /* ----------------------------------------------------------------- tall */
  if (variant === 'tall') {
    return (
      <aside
        aria-label="Gala Dock cross-product recommendation"
        className={cn('relative overflow-hidden rounded-xl bg-[linear-gradient(135deg,#0b0c2c_0%,#131048_60%,#1f1a7a_100%)] px-5 py-5 text-white', className)}
      >
        <Starfield />
        <div className="relative">
          <GalaDockLogo height={46} />
          <h2 className="mt-3 max-w-[240px] text-[17px] font-bold leading-snug">{title}</h2>
          <p className="mt-2 max-w-[250px] text-[12px] leading-relaxed text-slate-200">{body}</p>
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
  const logoBlock = variant === 'wide' ? (
    <div className="relative flex shrink-0 items-center">
      <GalaDockMark size={74} />
    </div>
  ) : (
    <div className="relative flex shrink-0 items-center lg:pr-4">
      <span className="sm:hidden"><GalaDockMark size={56} /></span>
      <GalaDockLogo height={70} className="hidden sm:block" />
    </div>
  )

  return (
    <aside
      aria-label="Gala Dock cross-product recommendation"
      className={cn(
        'relative flex items-center gap-[38px] overflow-hidden rounded-xl',
        variant === 'wide' ? 'min-h-[107px]' : variant === 'wide-cta-right' ? 'min-h-[116px]' : 'min-h-[140px]',
        ' bg-[linear-gradient(90deg,#0b0c2c_0%,#131048_55%,#1f1a7a_100%)] py-3 pl-5 pr-6 text-white',
        className,
      )}
    >
      <Starfield />
      {logoBlock}
      <div className="relative min-w-0 flex-1 pr-8">
        <h2 className="text-[17px] font-bold leading-snug tracking-tight">{title}</h2>
        <p className={cn('mt-1 text-[12px] leading-snug text-slate-200', variant === 'wide' ? 'max-w-2xl' : 'max-w-[340px]')}>{body}</p>
        {connectionState === 'error' && syncError && (
          <p className="mt-2 inline-block rounded-md bg-rose-500/15 px-2 py-1 text-[11.5px] text-rose-200">{syncError}</p>
        )}
        {(variant !== 'wide-cta-right') ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {ctaButton}
            {secondaryButton}
          </div>
        ) : (
          <div className="mt-2.5 md:hidden">{ctaButton}</div>
        )}
      </div>
      {variant === 'wide-cta-right' && <div className="relative mr-14 hidden shrink-0 md:block">{ctaButton}</div>}
      {variant === 'wide' && (
        <div className="relative mr-10 hidden shrink-0 items-center xl:flex" aria-hidden>
          <GalaDockLogo height={76} />
        </div>
      )}
      {dismissButton}
    </aside>
  )
}

/* ------------------------------------------------------------------ brand */

/*
 * Official Gala Dock artwork (transparent PNGs, trimmed to their content).
 * Plain <img> with explicit dimensions: tiny static brand assets, and the
 * intrinsic size reserves space so nothing shifts while they load.
 */
const ICON_SRC = '/brands/gala-dock/gala-dock-icon.png' // 116 x 115
const LOGO_SRC = '/brands/gala-dock/gala-dock-logo.png' // 431 x 115

/** The spiral mark on its own. */
export function GalaDockMark({ size = 48, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  const icon = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ICON_SRC} alt="Gala Dock" width={size} height={size} className="shrink-0 object-contain" style={{ width: size, height: size }} />
  )
  if (tone === 'dark') return icon
  return (
    <span className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-indigo-100">
      {icon}
    </span>
  )
}

/** Mark + "Gala·Dock" wordmark lockup, sized by height. */
export function GalaDockLogo({ height, className }: { height: number; className?: string }) {
  const width = Math.round((height * 431) / 115)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="Gala Dock"
      width={width}
      height={height}
      className={cn('shrink-0 object-contain', className)}
      style={{ width, height }}
    />
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
      <ellipse cx="455" cy="70" rx="90" ry="60" fill="url(#gd-glow)" opacity="0.45" />
      <path d="M455 38 L458 67 L487 70 L458 73 L455 102 L452 73 L423 70 L452 67 Z" fill="#7f74ff" opacity="0.7" />
    </svg>
  )
}
