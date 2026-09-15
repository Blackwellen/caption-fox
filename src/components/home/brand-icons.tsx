import { Globe, Mail, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Compact channel glyphs for the public homepage product reconstructions.
 * lucide-react v1 ships no brand marks, so these are simplified inline SVGs.
 * All are decorative (aria-hidden); the adjacent text always names the channel.
 */
export type ChannelKey =
  | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook' | 'x' | 'pinterest' | 'threads'
  | 'email' | 'web' | 'ads'

export function ChannelIcon({ channel, size = 20, className }: { channel: ChannelKey | string; size?: number; className?: string }) {
  const s = { width: size, height: size }
  const base = cn('shrink-0', className)
  switch (channel) {
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <defs>
            <linearGradient id="cf-ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEC053" />
              <stop offset=".45" stopColor="#F2203E" />
              <stop offset="1" stopColor="#7024C4" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#cf-ig)" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4.4" fill="none" stroke="url(#cf-ig)" strokeWidth="2.2" />
          <circle cx="17.4" cy="6.6" r="1.3" fill="#C92B7A" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <path d="M14.5 3h3c.2 1.9 1.4 3.3 3.3 3.5v3a7 7 0 0 1-3.3-1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3Z" fill="#25F4EE" transform="translate(-.8 -.6)" />
          <path d="M14.5 3h3c.2 1.9 1.4 3.3 3.3 3.5v3a7 7 0 0 1-3.3-1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3Z" fill="#FE2C55" transform="translate(.8 .6)" />
          <path d="M14.5 3h3c.2 1.9 1.4 3.3 3.3 3.5v3a7 7 0 0 1-3.3-1v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.7 2.7 0 1 0 1.8 2.5V3Z" fill="#0A1630" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" />
          <path d="M7.2 10h2.4v7.6H7.2V10Zm1.2-3.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM11.1 10h2.3v1.1c.4-.7 1.2-1.3 2.5-1.3 2.4 0 2.9 1.6 2.9 3.7v4.1h-2.4v-3.6c0-.9 0-2-1.2-2s-1.4.9-1.4 1.9v3.7h-2.4V10Z" fill="#fff" />
        </svg>
      )
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#FF0033" />
          <path d="M10 9v6l5.2-3L10 9Z" fill="#fff" />
        </svg>
      )
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path d="M13.2 21.9v-7h2.3l.4-2.8h-2.7v-1.8c0-.8.3-1.3 1.4-1.3h1.4V6.5c-.3 0-1.1-.1-2.1-.1-2.1 0-3.4 1.2-3.4 3.5v2.2H8.2v2.8h2.3v7h2.7Z" fill="#fff" />
        </svg>
      )
    case 'x':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" fill="#0A1630" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <circle cx="12" cy="12" r="10" fill="#E60023" />
          <path d="M12.3 6c-3.6 0-5.4 2.6-5.4 4.7 0 1.3.5 2.4 1.5 2.8.2.1.3 0 .4-.2l.2-.6c0-.2 0-.3-.1-.5-.3-.4-.5-.9-.5-1.6 0-2 1.5-3.8 4-3.8 2.2 0 3.4 1.3 3.4 3.1 0 2.4-1 4.3-2.6 4.3-.9 0-1.5-.7-1.3-1.6.3-1 .7-2.2.7-2.9 0-.7-.4-1.2-1.1-1.2-.9 0-1.6.9-1.6 2.2 0 .8.3 1.3.3 1.3l-1.1 4.6c-.3 1.4 0 3.1 0 3.3h.3c.1-.1 1.2-1.5 1.5-2.9l.6-2.3c.3.6 1.2 1.1 2.1 1.1 2.8 0 4.7-2.5 4.7-6 0-2.6-2.2-5-5.7-5Z" fill="#fff" />
        </svg>
      )
    case 'threads':
      return (
        <svg viewBox="0 0 24 24" style={s} className={base} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#0A1630" />
          <path d="M15.6 11.6c-.1-.1-.2-.1-.3-.2-.2-2.2-1.4-3.4-3.3-3.4-1.2 0-2.2.5-2.8 1.4l1.1.7c.4-.6 1-.8 1.7-.8.8 0 1.4.3 1.7.8.2.3.4.8.4 1.3-.6-.1-1.3-.1-2-.1-2 .1-3.3 1.3-3.2 2.9.1 1.6 1.6 2.6 3.4 2.5 1.4-.1 2.5-.8 3-2.3.3.2.6.5.7.9.4.9.4 2.3-.8 3.4-1 1-2.3 1.4-4.2 1.4-2.1 0-3.7-.7-4.7-2-.9-1.2-1.4-2.9-1.4-5s.5-3.8 1.4-5c1-1.3 2.6-2 4.7-2s3.7.7 4.8 2c.5.6.9 1.4 1.1 2.3l1.3-.4c-.3-1.1-.8-2.1-1.4-2.9-1.4-1.7-3.4-2.5-5.8-2.5-2.5 0-4.5.8-5.8 2.5C4.6 8.4 4 10.4 4 12.6v.1c0 2.3.6 4.2 1.8 5.7 1.3 1.6 3.3 2.5 5.8 2.5 2.2 0 3.8-.6 5.1-1.8 1.7-1.7 1.6-3.8 1.1-5-.4-1.1-1.1-1.9-2.2-2.5Zm-3.9 3.7c-.8 0-1.7-.3-1.7-1.1 0-.6.4-1.3 1.9-1.4h.5c.5 0 1 0 1.4.1-.2 1.8-1.1 2.3-2.1 2.4Z" fill="#fff" />
        </svg>
      )
    case 'email':
      return <Mail style={s} className={cn(base, 'text-cf-blue')} strokeWidth={1.9} aria-hidden />
    case 'web':
      return <Globe style={s} className={cn(base, 'text-cf-blue')} strokeWidth={1.9} aria-hidden />
    case 'ads':
      return <Megaphone style={s} className={cn(base, 'text-cf-blue')} strokeWidth={1.9} aria-hidden />
    default:
      return <Globe style={s} className={cn(base, 'text-cf-subtle')} aria-hidden />
  }
}
