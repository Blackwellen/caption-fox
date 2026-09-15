import { cn } from '@/lib/utils'
import { AD_PROVIDERS, type AdProvider } from '@/lib/advertising/providers'

// Platform glyphs drawn inline so the pages have no external image requests and
// no broken-logo state. Each mark is a simplified, recognisable form in the
// platform's own brand colour, with a text alternative for screen readers.

type Props = {
  provider: string
  size?: number
  className?: string
  /** Renders the mark inside a tinted rounded tile, as on the account cards. */
  tile?: boolean
  /** Hides the mark from assistive tech when the name is already adjacent. */
  decorative?: boolean
}

function Glyph({ provider, size }: { provider: AdProvider; size: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  const color = AD_PROVIDERS[provider].brandColor

  switch (provider) {
    case 'meta':
      // Meta's infinity loop, reduced to two interlocking strokes.
      return (
        <svg {...common} fill="none">
          <path
            d="M2.5 14.2c0-3.9 2-7.4 4.6-7.4 1.6 0 2.8 1.1 4 3 1.2-1.9 2.4-3 4-3 2.6 0 4.6 3.5 4.6 7.4 0 2.1-1 3.5-2.7 3.5-1.7 0-2.7-1.3-4.2-3.9l-1-1.7c-.3-.5-.5-.9-.7-1.3-.2.4-.4.8-.7 1.3l-1 1.7c-1.5 2.6-2.5 3.9-4.2 3.9-1.7 0-2.7-1.4-2.7-3.5Z"
            stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )
    case 'google':
      // The four-colour G, as a segmented ring plus the crossbar.
      return (
        <svg {...common} fill="none">
          <path d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" fill="#FBBC05" />
          <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.9 14.7 2 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4.1 5.6-4.1Z" fill="#EA4335" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common} fill="none">
          <path
            d="M14.3 2.5h2.9a5.2 5.2 0 0 0 4.3 4.4v2.9a8 8 0 0 1-4.3-1.4v6.4a6 6 0 1 1-6-6c.3 0 .5 0 .8.05v3a3 3 0 1 0 2.3 2.9V2.5Z"
            fill={color}
          />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common} fill="none">
          <rect x="2" y="2" width="20" height="20" rx="4" fill={color} />
          <circle cx="7.2" cy="7.4" r="1.6" fill="#fff" />
          <path d="M5.9 10.2h2.6v8H5.9v-8Zm4.5 0h2.5v1.1c.5-.8 1.4-1.3 2.6-1.3 2 0 3 1.3 3 3.6v4.6h-2.6v-4.1c0-1.1-.4-1.8-1.4-1.8-.8 0-1.3.5-1.5 1.1-.1.2-.1.5-.1.8v4H10.4v-8Z" fill="#fff" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="10" fill={color} />
          <path d="M12.4 5.8c-3.4 0-5.2 2.2-5.2 4.6 0 1.1.6 2.5 1.6 2.9.2.07.3 0 .3-.15l.2-.8c.05-.2 0-.3-.1-.4-.4-.5-.7-1.2-.7-2 0-2 1.5-3.8 3.9-3.8 2.1 0 3.6 1.4 3.6 3.4 0 2.3-1.1 3.9-2.6 3.9-.8 0-1.4-.7-1.2-1.5.25-1 .7-2.1.7-2.8 0-.65-.35-1.2-1.1-1.2-.85 0-1.55.9-1.55 2.1 0 .75.25 1.3.25 1.3l-1 4.3c-.3 1.25-.05 2.8 0 2.95.02.1.14.12.2.05.08-.1 1.1-1.35 1.45-2.6l.55-2.1c.3.55 1.1 1.05 2 1.05 2.6 0 4.4-2.4 4.4-5.6 0-2.4-2.05-4.65-5.2-4.65Z" fill="#fff" />
        </svg>
      )
    case 'reddit':
      return (
        <svg {...common} fill="none">
          <circle cx="12" cy="12" r="10" fill={color} />
          <ellipse cx="12" cy="13.6" rx="6.4" ry="4.6" fill="#fff" />
          <circle cx="9.6" cy="13.2" r="1.15" fill={color} />
          <circle cx="14.4" cy="13.2" r="1.15" fill={color} />
          <path d="M9.5 16c.7.6 1.6.85 2.5.85s1.8-.25 2.5-.85" stroke={color} strokeWidth="1" strokeLinecap="round" />
          <circle cx="18.4" cy="9.2" r="1.7" fill="#fff" />
          <circle cx="5.6" cy="9.2" r="1.7" fill="#fff" />
          <circle cx="14.6" cy="5.6" r="1.5" fill="#fff" />
          <path d="M12 9.1V6.2l2.2-.5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )
    case 'snapchat':
      return (
        <svg {...common} fill="none">
          <rect x="2" y="2" width="20" height="20" rx="5" fill={color} />
          <path
            d="M12 5.6c1.9 0 3.3 1.4 3.4 3.3 0 .5 0 1.1-.05 1.6.3.15.65.1 1-.05.55-.2 1 .35.75.8-.25.45-1.05.75-1.5.9-.2.07-.25.2-.2.4.35 1.15 1.5 2.35 2.6 2.6.35.08.4.5.1.65-.5.25-1.2.4-1.5.5-.15.05-.2.2-.2.35-.05.4-.15.6-.5.6-.45 0-1-.15-1.6 0-.55.15-1.1 1-2.3 1s-1.75-.85-2.3-1c-.6-.15-1.15 0-1.6 0-.35 0-.45-.2-.5-.6 0-.15-.05-.3-.2-.35-.3-.1-1-.25-1.5-.5-.3-.15-.25-.57.1-.65 1.1-.25 2.25-1.45 2.6-2.6.05-.2 0-.33-.2-.4-.45-.15-1.25-.45-1.5-.9-.25-.45.2-1 .75-.8.35.15.7.2 1 .05-.05-.5-.05-1.1-.05-1.6.1-1.9 1.5-3.3 3.4-3.3Z"
            fill="#fff"
          />
        </svg>
      )
    case 'x':
      return (
        <svg {...common} fill="none">
          <rect x="2" y="2" width="20" height="20" rx="4" fill={color} />
          <path d="m6.6 6.4 4.3 5.75-4.33 4.7h1.4l3.55-3.85 2.88 3.85h3.32l-4.55-6.08 4.03-4.37h-1.4l-3.25 3.53-2.64-3.53H6.6Zm1.86 1h1.28l6.9 9.2h-1.28l-6.9-9.2Z" fill="#fff" />
        </svg>
      )
    case 'microsoft':
      return (
        <svg {...common} fill="none">
          <rect x="3" y="3" width="8.2" height="8.2" fill="#F25022" />
          <rect x="12.8" y="3" width="8.2" height="8.2" fill="#7FBA00" />
          <rect x="3" y="12.8" width="8.2" height="8.2" fill="#00A4EF" />
          <rect x="12.8" y="12.8" width="8.2" height="8.2" fill="#FFB900" />
        </svg>
      )
    case 'yahoo':
      return (
        <svg {...common} fill="none">
          <rect x="2" y="2" width="20" height="20" rx="4" fill={color} />
          <path d="m5.4 7.2h2.7l2 4.7 2-4.7h2.6l-4.2 9.6H7.9l1.2-2.6L5.4 7.2Z" fill="#fff" />
          <circle cx="17.2" cy="15" r="1.5" fill="#fff" />
        </svg>
      )
    case 'amazon':
      return (
        <svg {...common} fill="none">
          <path
            d="M4.2 16.6c3.3 2 7.4 2.5 11.2 1.2.5-.17.9.35.45.72-1.6 1.35-4 2-6.1 2-2.9 0-5.6-1.1-7.6-2.9-.16-.15 0-.35.2-.25l1.85-.77Z"
            fill={color}
          />
          <path d="M17.4 17.1c-.3-.4.2-1.7.5-2.3.1-.2.35-.15.4.05.2.9.05 2.2-.25 2.6-.2.25-.5.05-.65-.35Z" fill={color} />
          <path d="M8.2 8.2c0-1.7 1.3-2.9 3.3-2.9 1.5 0 3 .6 3 2.5v3.4c0 .6.25.9.5 1.2.1.1.1.25 0 .35l-1 .85c-.1.1-.25.1-.35 0-.3-.25-.5-.5-.65-.75-.7.7-1.4 1-2.4 1-1.4 0-2.5-.85-2.5-2.5 0-1.3.7-2.2 1.7-2.6.85-.35 2.05-.45 3-.55v-.25c0-.45-.05-.95-.35-1.25-.25-.25-.65-.35-1-.35-.7 0-1.3.35-1.45 1.05-.03.16-.15.3-.3.3l-1.2-.13c-.16-.03-.3-.16-.25-.4Zm4.6 2.05c-.6.05-1.3.1-1.8.35-.5.25-.75.7-.75 1.25 0 .7.4 1.15 1.05 1.15.5 0 .95-.3 1.2-.75.3-.55.3-1.05.3-1.65v-.35Z" fill={color} />
        </svg>
      )
    default:
      return <svg {...common} fill="none"><circle cx="12" cy="12" r="9" fill={color} /></svg>
  }
}

export default function ProviderLogo({ provider, size = 20, className, tile, decorative }: Props) {
  const definition = AD_PROVIDERS[provider as AdProvider]
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

  const mark = <Glyph provider={definition.id} size={tile ? Math.round(size * 0.62) : size} />

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
