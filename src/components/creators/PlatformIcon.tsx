import { CHANNEL_LABELS } from '@/lib/creators/constants'
import { cn } from '@/lib/utils'

/**
 * Compact platform marks for creator rows and rights channels (16px, as in the
 * references). Simplified glyphs in each platform's brand colour; the
 * accessible name is always the platform label.
 */
export function PlatformIcon({ platform, size = 16, className }: { platform: string; size?: number; className?: string }) {
  const label = CHANNEL_LABELS[platform] ?? platform
  const common = { width: size, height: size, viewBox: '0 0 24 24', role: 'img' as const, 'aria-label': label, className: cn('shrink-0', className) }
  switch (platform) {
    case 'instagram':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="cf-ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#feda75" /><stop offset="0.35" stopColor="#fa7e1e" />
              <stop offset="0.6" stopColor="#d62976" /><stop offset="1" stopColor="#4f5bd5" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#cf-ig)" />
          <rect x="6.5" y="6.5" width="11" height="11" rx="3.4" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx="16.3" cy="7.7" r="1" fill="#fff" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="#111" />
          <path d="M13.2 6.2h2.1c.2 1.4 1 2.4 2.5 2.6v2.1c-1 0-1.8-.3-2.5-.8v4.3a3.6 3.6 0 1 1-3.6-3.6h.4v2.1a1.5 1.5 0 1 0 1.1 1.5V6.2Z" fill="#fff" />
          <path d="M13.2 6.2h.6v8.9a2.2 2.2 0 0 1-1 1.8 1.5 1.5 0 0 0 .4-1.3V6.2Z" fill="#25f4ee" opacity=".8" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff0000" />
          <path d="M10 9v6l5-3-5-3Z" fill="#fff" />
        </svg>
      )
    case 'twitch':
      return (
        <svg {...common}>
          <path d="M4.5 3 3 6.5V20h4.5v2.5H10L12.5 20H16l5-5V3H4.5Z" fill="#9146ff" />
          <path d="M11 7.5h1.6v4.5H11zM15 7.5h1.6v4.5H15z" fill="#fff" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="#1877f2" />
          <path d="M13.2 19v-5.6h1.9l.3-2.2h-2.2V9.8c0-.6.2-1.1 1.1-1.1h1.2V6.8a15 15 0 0 0-1.7-.1c-1.7 0-2.9 1-2.9 3v1.6H9v2.2h1.9V19h2.3Z" fill="#fff" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#0a66c2" />
          <path d="M7 10h2.3v7H7zM8.1 6.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM10.8 10h2.2v1c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.8 1.5 2.8 3.5V17h-2.3v-3.3c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.8V17h-2.3v-7Z" fill="#fff" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="#000" />
          <path d="m7 7 4 5.3L7 17h1l3.4-4 3 4H17l-4.2-5.6L16.6 7h-1l-3.2 3.6L9.8 7H7Z" fill="#fff" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="#e60023" />
          <path d="M12.3 5.5c-3.6 0-5.4 2.6-5.4 4.7 0 1.3.5 2.4 1.5 2.8.2.1.3 0 .4-.2l.1-.6c.1-.2 0-.3-.1-.5a2.6 2.6 0 0 1-.6-1.8c0-2.3 1.7-4.4 4.5-4.4 2.4 0 3.8 1.5 3.8 3.5 0 2.6-1.2 4.9-2.9 4.9-.9 0-1.6-.8-1.4-1.8.3-1.1.8-2.4.8-3.2 0-.7-.4-1.4-1.2-1.4-1 0-1.8 1-1.8 2.4 0 .9.3 1.5.3 1.5l-1.2 5c-.3 1.5 0 3.3 0 3.5h.2c.1-.1 1.2-1.5 1.6-2.9l.6-2.4c.3.6 1.2 1.1 2.2 1.1 2.9 0 4.8-2.6 4.8-6.1 0-2.7-2.3-5.2-5.7-5.2Z" fill="#fff" />
        </svg>
      )
    default:
      return (
        <span role="img" aria-label={label} className={cn('inline-flex items-center justify-center rounded bg-slate-100 text-[8px] font-bold uppercase text-slate-600', className)} style={{ width: size, height: size }}>
          {label.slice(0, 2)}
        </span>
      )
  }
}

export function PlatformIcons({ platforms, max = 4, size = 16, className }: { platforms?: string[] | null; max?: number; size?: number; className?: string }) {
  const list = platforms ?? []
  if (list.length === 0) return <span className="text-[11px] text-slate-300">—</span>
  return (
    <span className={cn('inline-flex items-center gap-[8px]', className)}>
      {list.slice(0, max).map(p => <PlatformIcon key={p} platform={p} size={size} />)}
      {list.length > max && <span className="text-[10px] text-slate-400">+{list.length - max}</span>}
    </span>
  )
}
