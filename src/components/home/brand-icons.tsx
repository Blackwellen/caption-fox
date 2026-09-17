import { Globe, Mail, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { hasBrand } from '@/lib/brand/brands'

/**
 * Compact channel glyphs for the public homepage product reconstructions.
 * Platforms render their real logos from the shared brand registry; only the
 * generic channels (email, web, ads) use lucide icons. All are decorative —
 * the adjacent text always names the channel.
 */
export type ChannelKey =
  | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'facebook' | 'x' | 'pinterest' | 'threads'
  | 'email' | 'web' | 'ads'

export function ChannelIcon({ channel, size = 20, className }: { channel: ChannelKey | string; size?: number; className?: string }) {
  const s = { width: size, height: size }
  const base = cn('shrink-0', className)
  if (hasBrand(channel)) return <BrandLogo brand={channel} size={size} className={base} decorative />
  switch (channel) {
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
