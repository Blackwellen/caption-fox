import { cn } from '@/lib/utils'
import type { StudioModule } from '@/lib/studio/constants'
import StudioTabs from './StudioTabs'

type Layout =
  /** H1 + description, then the tab strip (Overview, Templates, Media). */
  | 'stacked'
  /** "Studio" + tabs in one strip, page actions on the right (Compose). */
  | 'bar'
  /** "Studio" + tabs strip, then the page H1 + description (AI Generate, Ideas, Hashtags). */
  | 'bar-title'
  /** "Studio" label above the tabs, then the page H1 (Content Library). */
  | 'label-title'

/**
 * Shared Studio page header. Every route renders the same tab component and the
 * same title tokens; the four layouts mirror the approved per-page compositions.
 */
export default function StudioPageHeader({
  layout, base, modules, title, description, actions, titleAdornment, className, titleClassName, ownHeading = false,
}: {
  layout: Layout
  base: string
  modules: StudioModule[]
  title: string
  description?: string
  actions?: React.ReactNode
  titleAdornment?: React.ReactNode
  className?: string
  titleClassName?: string
  /** The page renders its own visible H1, so the bar layout omits its hidden one. */
  ownHeading?: boolean
}) {
  const heading = (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className={cn('flex items-center gap-2 text-[24px] font-semibold leading-[1.25] tracking-[-0.02em] text-slate-900', titleClassName)}>
          {title}{titleAdornment}
        </h1>
        {description && <p className="mt-1 text-[13px] text-slate-500 lg:mt-[3px] lg:text-[12.5px]">{description}</p>}
      </div>
      {actions && layout !== 'bar' && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )

  if (layout === 'stacked') {
    return (
      <header className={cn('mb-4', className)}>
        {heading}
        <StudioTabs base={base} modules={modules} className="mt-4 lg:mt-[14px] lg:border-b lg:border-[#e6e9f0]" />
      </header>
    )
  }

  const strip = (
    <div className="flex flex-col gap-3 lg:-mx-6 lg:flex-row lg:items-center lg:gap-0 lg:border-b lg:border-[#e6e9f0] lg:bg-white lg:px-6">
      <p className="text-[18px] font-semibold tracking-[-0.01em] text-slate-900 lg:mr-5 lg:text-[18px]">Studio</p>
      <StudioTabs base={base} modules={modules} className="min-w-0 lg:self-stretch" itemClassName="lg:h-[52px] lg:px-[10px] lg:text-[11.5px]" />
      {layout === 'bar' && actions && <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:flex-nowrap lg:pl-3">{actions}</div>}
    </div>
  )

  if (layout === 'bar') {
    return (
      <header className={cn('mb-0 sm:-mt-7 lg:-mt-[12px]', className)}>
        {strip}
        {!ownHeading && <h1 className="sr-only">{title}</h1>}
      </header>
    )
  }

  if (layout === 'bar-title') {
    return (
      <header className={cn('mb-4 sm:-mt-7 lg:-mt-[12px]', className)}>
        {strip}
        <div className="mt-4">{heading}</div>
      </header>
    )
  }

  return (
    <header className={cn('mb-4', className)}>
      <p className="mb-2 text-[16px] font-semibold text-slate-900 lg:mb-1 lg:text-[13px]">Studio</p>
      <StudioTabs base={base} modules={modules} className="lg:border-b lg:border-[#e6e9f0]" />
      <div className="mt-4">{heading}</div>
    </header>
  )
}
