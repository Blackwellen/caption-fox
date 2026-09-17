import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

// The Social page header: H1 + subtitle on the left, the action cluster on the
// right with the "All times shown in UTC" note beneath it, then the trail/tabs
// row. Actions wrap under the title on narrower screens instead of overflowing.

export function SocialHeader({ title, subtitle, actions, nav, note = true, compact = false }: {
  title: string
  subtitle: string
  actions?: ReactNode
  nav: ReactNode
  note?: boolean
  /** Narrower subtitle so a long action cluster stays on one line. */
  compact?: boolean
}) {
  return (
    <div className="mb-4 space-y-3 lg:mb-3.5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-slate-900 lg:text-[23px]">{title}</h1>
          <p className={`mt-1 text-[13px] leading-snug text-slate-500 lg:text-[11px] ${compact ? 'max-w-[340px]' : 'max-w-xl'}`}>{subtitle}</p>
        </div>
        {actions && (
          <div className="flex flex-col gap-1.5 xl:items-end min-[1440px]:shrink-0">
            <div className={`flex flex-wrap items-center gap-2 xl:justify-end ${compact ? 'xl:gap-2' : 'xl:gap-2.5'}`}>{actions}</div>
            {note && (
              <p className="flex items-center gap-1 text-[11px] text-slate-400 lg:text-[9px]">
                All times shown in UTC <Info size={10} aria-hidden />
              </p>
            )}
          </div>
        )}
      </header>
      {nav}
    </div>
  )
}
