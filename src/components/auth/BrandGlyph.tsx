// Small platform glyphs (lucide v1 removed brand icons). Decorative only —
// always paired with a visible text label.

export function BrandGlyph({ platform, size = 20 }: { platform: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  switch (platform) {
    case 'instagram':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#F9A33B" /><stop offset="0.5" stopColor="#E8336E" /><stop offset="1" stopColor="#8A3AB9" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="url(#ig-grad)" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="url(#ig-grad)" strokeWidth="2.2" />
          <circle cx="17.3" cy="6.7" r="1.3" fill="#E8336E" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M14.5 3h2.6c.3 2 1.6 3.4 3.6 3.6v2.7a6.6 6.6 0 0 1-3.6-1.1v6.6a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.7 2.7 0 1 0 1.9 2.6V3Z" fill="#111827" />
          <path d="M13.6 4h.9v11.3a2.7 2.7 0 0 1-3.8 2.4 2.7 2.7 0 0 0 2.9-2.7V4Z" fill="#25F4EE" opacity=".8" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...common}>
          <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0000" />
          <path d="M10 9v6l5.2-3L10 9Z" fill="#fff" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="M4 3.5h4.6l3.9 5.4 4.6-5.4h2.3l-5.9 6.9 6.9 10.1h-4.6l-4.3-6.2-5.3 6.2H3.9l6.6-7.6L4 3.5Zm3.1 1.6 9.6 13.8h1.4L8.6 5.1H7.1Z" fill="#111827" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#0A66C2" />
          <path d="M7.3 10h2.2v7H7.3v-7Zm1.1-3.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM11 10h2.1v1c.4-.7 1.3-1.2 2.4-1.2 2.2 0 2.6 1.4 2.6 3.3V17h-2.2v-3.4c0-.8 0-1.9-1.2-1.9s-1.4.9-1.4 1.8V17H11v-7Z" fill="#fff" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path d="M13.2 21v-6.6h2.2l.4-2.6h-2.6v-1.6c0-.8.3-1.3 1.4-1.3h1.3V6.6c-.3 0-1-.1-1.9-.1-2 0-3.3 1.2-3.3 3.3v2H8.5v2.6h2.2V21h2.5Z" fill="#fff" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#E60023" />
          <path d="M12.3 5.8c-3.6 0-5.4 2.6-5.4 4.7 0 1.3.5 2.4 1.5 2.8.2.1.3 0 .4-.2l.2-.6c0-.2 0-.3-.1-.5-.3-.4-.5-.9-.5-1.6 0-2 1.5-3.9 4-3.9 2.2 0 3.4 1.3 3.4 3.1 0 2.4-1 4.3-2.6 4.3-.9 0-1.5-.7-1.3-1.6.3-1 .7-2.1.7-2.9 0-.7-.4-1.2-1.1-1.2-.9 0-1.6.9-1.6 2.2 0 .8.3 1.3.3 1.3l-1.1 4.5c-.3 1.3 0 3 0 3.1 0 .1.1.1.2 0 .1-.1 1.2-1.5 1.6-2.9l.6-2.3c.3.6 1.2 1.1 2.1 1.1 2.8 0 4.7-2.5 4.7-5.9 0-2.6-2.2-5-5.6-5Z" fill="#fff" />
        </svg>
      )
    case 'threads':
      return (
        <svg {...common}>
          <path d="M16.6 11.2c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.6-4.6-4.7h-.1c-1.6 0-3 .7-3.9 2l1.5 1c.6-.9 1.6-1.1 2.3-1.1h.1c.9 0 1.6.3 2 .8.3.4.5 1 .6 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.4.7.5 1.6.7 2.6.6 1.3-.1 2.3-.6 3-1.4.5-.7.9-1.5 1-2.6.6.4 1.1.9 1.3 1.5.4 1 .4 2.6-.9 3.9-1.2 1.2-2.6 1.7-4.7 1.7-2.4 0-4.2-.8-5.3-2.3C5.1 16.6 4.5 14.6 4.5 12s.6-4.6 1.7-6c1.1-1.5 2.9-2.3 5.3-2.3 2.4 0 4.2.8 5.4 2.3.6.7 1 1.6 1.3 2.7l1.8-.5c-.4-1.3-.9-2.4-1.7-3.3C16.8 3 14.5 2 11.5 2 8.5 2 6.3 3 4.8 4.9 3.4 6.6 2.7 9 2.7 12s.7 5.4 2.1 7.1C6.3 21 8.5 22 11.5 22c2.6 0 4.4-.7 5.9-2.2 2-2 2-4.4 1.3-6-.4-1.1-1.3-2-2.1-2.6Zm-4.5 4.4c-1.1.1-2.2-.4-2.3-1.4 0-.8.6-1.6 2.2-1.7h.7c.6 0 1.2.1 1.7.2-.2 2.5-1.4 2.8-2.3 2.9Z" fill="#111827" />
        </svg>
      )
    case 'twitch':
      return (
        <svg {...common}>
          <path d="M4.5 2.5 3 6.3v13.2h4.5V22h2.5l2.5-2.5h3.7L21 14.7V2.5H4.5Zm14.7 11.3-2.8 2.8H12l-2.5 2.5v-2.5H5.8V4.4h13.4v9.4Z" fill="#9146FF" />
          <path d="M16.4 7.5h-1.8v5h1.8v-5Zm-4.7 0H10v5h1.8v-5Z" fill="#9146FF" />
        </svg>
      )
    case 'snapchat':
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#FFFC00" />
          <path d="M12 5.5c2.2 0 3.6 1.6 3.6 3.6v1.6l1.1-.3c.4 0 .6.5.2.7l-1.2.7c.4 1.3 1.4 2.3 2.6 2.7.3.1.3.5 0 .6l-1.3.4-.2.8-1.5-.1c-.6.6-1.6 1.3-3.3 1.3s-2.7-.7-3.3-1.3l-1.5.1-.2-.8-1.3-.4c-.3-.1-.3-.5 0-.6 1.2-.4 2.2-1.4 2.6-2.7l-1.2-.7c-.4-.2-.2-.7.2-.7l1.1.3V9.1c0-2 1.4-3.6 3.6-3.6Z" fill="#fff" stroke="#111827" strokeWidth=".9" />
        </svg>
      )
    case 'google':
      return (
        <svg {...common}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )
    case 'email':
      return (
        <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="3" fill="#1769FF" /><path d="m4 7.5 8 5.5 8-5.5" stroke="#fff" strokeWidth="1.8" fill="none" /></svg>
      )
    case 'web':
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" fill="none" stroke="#1769FF" strokeWidth="1.8" /><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3Z" fill="none" stroke="#1769FF" strokeWidth="1.8" /></svg>
      )
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" fill="#DCE7F7" /></svg>
  }
}
