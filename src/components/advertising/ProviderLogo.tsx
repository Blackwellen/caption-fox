import { cn } from '@/lib/utils'
import { AD_PROVIDERS } from '@/lib/advertising/providers'
import { BrandLogo } from '@/components/brand/BrandLogo'

// Ad platform marks. Each is the platform's real logo from the shared brand
// registry (self-hosted, so no external image requests), with a text
// alternative for screen readers.

type Props = {
  provider: string
  size?: number
  className?: string
  /** Renders the mark inside a tinted rounded tile, as on the account cards. */
  tile?: boolean
  /** Hides the mark from assistive tech when the name is already adjacent. */
  decorative?: boolean
}

/** Ad provider id → brand registry key (Google Ads has its own mark, not the G). */
const BRAND_KEY: Record<string, string> = {
  google: 'google_ads',
}

export default function ProviderLogo({ provider, size = 20, className, tile, decorative }: Props) {
  const definition = AD_PROVIDERS[provider as keyof typeof AD_PROVIDERS]
  if (!definition) {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-500', className)}
        style={{ width: size, height: size }}
        aria-hidden={decorative}
      >
        {provider.slice(0, 2).toUpperCase()}
      </span>
    )
  }

  const mark = <BrandLogo brand={BRAND_KEY[definition.id] ?? definition.id} size={tile ? Math.round(size * 0.62) : size} decorative />

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        tile && 'rounded-lg border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
        className,
      )}
      style={tile ? { width: size, height: size } : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : definition.name}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : definition.name}
    >
      {mark}
    </span>
  )
}
