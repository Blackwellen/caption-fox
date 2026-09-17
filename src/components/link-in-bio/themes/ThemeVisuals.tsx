import { cn } from '@/lib/utils'
import { themeSampleModel } from '@/lib/link-in-bio/sample'
import type { ThemeTokens } from '@/lib/link-in-bio/theme'
import MicroPage, { pageBackground } from '../renderer/MicroPage'
import { PhoneFrame } from '../renderer/DeviceFrames'

/** Top of a phone showing the theme applied to the sample page (theme cards). */
export function ThemePhoneThumb({ tokens, name, className }: { tokens: ThemeTokens; name: string; className?: string }) {
  return (
    <div className={cn('relative flex h-[140px] justify-center overflow-hidden rounded-lg bg-slate-50', className)}>
      <div className="absolute top-2.5">
        <PhoneFrame width={104} label={`${name} theme preview`}>
          <MicroPage model={themeSampleModel(tokens, { headline: name, linkCount: 4, form: false })} mode="preview" />
        </PhoneFrame>
      </div>
    </div>
  )
}

/** Small square swatch of the theme background (approval queue, activity). */
export function ThemeSwatch({ tokens, size = 26, className }: { tokens: ThemeTokens; size?: number; className?: string }) {
  return (
    <span
      className={cn('relative inline-block shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200', className)}
      style={{ width: size, height: size, ...pageBackground(tokens) }}
      aria-hidden
    >
      <span className="absolute inset-x-[22%] bottom-[18%] h-[14%] rounded-sm" style={{ backgroundColor: tokens.palette.primary === '#FFFFFF' ? tokens.palette.accent : tokens.palette.primary }} />
    </span>
  )
}
