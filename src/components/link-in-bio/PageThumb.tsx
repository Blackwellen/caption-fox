import { cn } from '@/lib/utils'
import { readableOn } from '@/lib/link-in-bio/theme'
import type { Thumb } from '@/lib/link-in-bio/server/collections'
import { fontFamily, THEME_FONT_CLASSES } from './renderer/fonts'

// Landscape card thumbnail derived from the page's real hero block and theme:
// hero photo, headline in the theme heading font, and the first link as a CTA
// pill in the theme primary colour.

export default function PageThumb({ thumb, className, size = 'card' }: { thumb: Thumb | null; className?: string; size?: 'card' | 'row' }) {
  if (!thumb) {
    return <div className={cn('rounded-md bg-gradient-to-br from-slate-100 to-slate-200', className)} aria-hidden />
  }
  const { tokens } = thumb
  const dark = tokens.mode === 'dark' || !!thumb.imageUrl
  const ink = dark ? '#FFFFFF' : tokens.palette.textPrimary
  if (size === 'row') {
    return (
      <div className={cn('overflow-hidden rounded-md bg-slate-200', className)} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb.imageUrl && <img src={thumb.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
      </div>
    )
  }
  return (
    <div className={cn(THEME_FONT_CLASSES, 'relative overflow-hidden rounded-md', className)} style={{ backgroundColor: tokens.palette.background }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumb.imageUrl && <img src={thumb.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
      <div className="absolute inset-0" style={{ background: dark ? 'linear-gradient(90deg, rgba(10,12,20,0.78) 0%, rgba(10,12,20,0.35) 55%, rgba(10,12,20,0) 100%)' : 'linear-gradient(90deg, rgba(255,255,255,0.85), rgba(255,255,255,0))' }} />
      <div className="relative flex h-full flex-col justify-center px-[9%]" style={{ color: ink }}>
        {thumb.eyebrow && <span className="mb-1.5 w-fit rounded border px-1 text-[6.5px] font-bold tracking-[0.08em]" style={{ borderColor: ink }}>{thumb.eyebrow}</span>}
        <p className="max-w-[58%] text-[13px] font-semibold leading-[1.15]" style={{ fontFamily: fontFamily(tokens.typography.heading) }}>{thumb.headline}</p>
        {thumb.cta && (
          <span className="mt-2 w-fit rounded px-2 py-[2px] text-[6px] font-bold" style={{ backgroundColor: tokens.palette.primary === '#FFFFFF' ? tokens.palette.accent : tokens.palette.primary, color: readableOn(tokens.palette.primary === '#FFFFFF' ? tokens.palette.accent : tokens.palette.primary) }}>
            {thumb.cta}
          </span>
        )}
      </div>
    </div>
  )
}
