'use client'

import { useId, useState } from 'react'
import { BRANDS, DOMAIN_BRANDS, rootDomain, type BrandEntry } from '@/lib/brand/brands'
import { cn } from '@/lib/utils'

/** Google's four-colour "G". */
function GoogleMark({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

/** Instagram's glyph in its official radial gradient. */
function InstagramMark({ path, size }: { path: string; size: number }) {
  const id = `ig-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id={id} cx="0.3" cy="1.07" r="1.3">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.1" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <path d={path} fill={`url(#${id})`} />
    </svg>
  )
}

/** TikTok's note with its cyan and red offset layers. */
function TikTokMark({ path, size, white = false }: { path: string; size: number; white?: boolean }) {
  return (
    <svg viewBox="-1 -1 26 26" width={size} height={size} aria-hidden>
      <path d={path} fill="#25F4EE" transform="translate(-0.7 -0.7)" />
      <path d={path} fill="#FE2C55" transform="translate(0.7 0.7)" />
      <path d={path} fill={white ? '#FFFFFF' : '#000000'} />
    </svg>
  )
}

function Mark({ entry, size }: { entry: BrandEntry; size: number }) {
  if (entry.special === 'google') return <GoogleMark size={size} />
  if (entry.special === 'instagram' && entry.icon) return <InstagramMark path={entry.icon.path} size={size} />
  if (entry.special === 'tiktok' && entry.icon) return <TikTokMark path={entry.icon.path} size={size} />
  if (entry.icon) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill={entry.tileBg ? '#000000' : `#${entry.icon.hex}`}>
        <path d={entry.icon.path} />
      </svg>
    )
  }
  if (entry.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny self-hosted brand mark
      <img src={entry.image} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} />
    )
  }
  return null
}

/** Favicon for an arbitrary site, with a lettered fallback if it can't load. */
function Favicon({ domain, size }: { domain: string; size: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        className="flex items-center justify-center rounded-[4px] bg-slate-200 font-bold uppercase text-slate-600"
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.55) }}
        aria-hidden
      >
        {domain.charAt(0)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote favicon for a user-supplied domain
    <img
      src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  )
}

const INSTAGRAM_APP_BG = 'radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)'

/**
 * App-icon form: the brand's official glyph in white on its brand colour, as
 * the platforms present their own app icons. Brands with a multi-colour or
 * light mark keep it on white.
 */
function AppIcon({ entry, size }: { entry: BrandEntry; size: number }) {
  const radius = Math.round(size * 0.24)
  const glyph = Math.round(size * 0.62)
  if (entry.image || entry.special === 'google') {
    return (
      <span className="flex items-center justify-center overflow-hidden border border-slate-200 bg-white" style={{ width: size, height: size, borderRadius: radius }}>
        <Mark entry={entry} size={entry.image ? size : glyph} />
      </span>
    )
  }
  const background = entry.special === 'instagram'
    ? INSTAGRAM_APP_BG
    : entry.special === 'tiktok' ? '#000000' : entry.tileBg ?? `#${entry.icon?.hex ?? '64748B'}`
  const glyphColour = entry.tileBg ? '#000000' : '#FFFFFF'
  return (
    <span className="flex items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background }}>
      {entry.special === 'tiktok' && entry.icon
        ? <TikTokMark path={entry.icon.path} size={glyph} white />
        : (
          <svg viewBox="0 0 24 24" width={glyph} height={glyph} aria-hidden fill={glyphColour}>
            <path d={entry.icon?.path} />
          </svg>
        )}
    </span>
  )
}

/**
 * The real logo for a third-party brand. `tile` wraps it in the rounded,
 * bordered container used by account, engine and listing cards; `variant="app"`
 * renders the platform's app-icon form. `decorative` hides the text
 * alternative when the name is already visible.
 */
export function BrandLogo({
  brand, size = 16, tile = false, tileSize, className, title, decorative = false, variant = 'mark',
}: {
  brand: string
  size?: number
  tile?: boolean
  tileSize?: number
  className?: string
  title?: string
  decorative?: boolean
  variant?: 'mark' | 'app'
}) {
  const key = brand.toLowerCase()
  const entry = BRANDS[key]
  const label = title ?? entry?.label ?? brand
  const text = decorative ? null : <span className="sr-only">{label}</span>
  if (variant === 'app' && entry) {
    return (
      <span className={cn('relative inline-flex shrink-0', className)} title={decorative ? undefined : label} aria-hidden={decorative || undefined}>
        <AppIcon entry={entry} size={size} />
        {text}
      </span>
    )
  }
  const mark = entry ? <Mark entry={entry} size={size} /> : <Favicon domain={rootDomain(key)} size={size} />

  if (!tile) {
    return (
      <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} title={decorative ? undefined : label} aria-hidden={decorative || undefined}>
        {mark}
        {text}
      </span>
    )
  }
  const box = tileSize ?? size + 14
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200', className)}
      style={{ width: box, height: box, backgroundColor: entry?.tileBg ?? '#FFFFFF' }}
      title={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      {mark}
      {text}
    </span>
  )
}

/** Real logo for an arbitrary website (referring domains, competitors, prospects). */
export function DomainLogo({ domain, size = 16, className }: { domain: string; size?: number; className?: string }) {
  const root = rootDomain(domain)
  const brandKey = DOMAIN_BRANDS[root]
  const entry = brandKey ? BRANDS[brandKey] : undefined
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} aria-hidden>
      {entry ? <Mark entry={entry} size={size} /> : <Favicon domain={root} size={size} />}
    </span>
  )
}
