import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { InfoDot } from './Primitives'

// The Advertising page header: title, explanatory dot, subtitle and the primary
// action cluster, matching the reference layout on all six pages.
//
// Actions are never silently hidden when unavailable. An action the member
// cannot take is rendered disabled with the reason in its tooltip, so the
// interface explains itself instead of quietly shrinking. An action that does
// not exist for this workspace at all is omitted by the page, not disabled here.

export type HeaderAction = {
  key: string
  label: string
  icon?: ReactNode
  variant?: 'primary' | 'secondary'
  href?: string
  /** Non-null disables the control and becomes its tooltip and aria hint. */
  disabledReason?: string | null
  /** Renders a trailing caret, for split actions such as Export. */
  hasMenu?: boolean
}

export default function PageHeader({
  title, hint, subtitle, actions = [], children, className,
}: {
  title: string
  hint?: string
  subtitle: string
  actions?: HeaderAction[]
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.01em] text-slate-900">
            {title}
          </h1>
          {hint && <InfoDot label={hint} />}
        </div>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">{subtitle}</p>
      </div>

      {(actions.length > 0 || children) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
          {actions.map(action => <HeaderActionButton key={action.key} action={action} />)}
        </div>
      )}
    </header>
  )
}

function HeaderActionButton({ action }: { action: HeaderAction }) {
  const disabled = !!action.disabledReason
  const primary = action.variant === 'primary'

  const classes = cn(
    'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
    primary
      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
      : 'border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50',
    disabled && 'cursor-not-allowed opacity-55 hover:bg-inherit',
  )

  const content = (
    <>
      {action.icon}
      {action.label}
      {action.hasMenu && (
        <span className={cn('ml-0.5 border-l pl-1.5 text-[10px] leading-none', primary ? 'border-white/25' : 'border-slate-200')} aria-hidden>
          ▾
        </span>
      )}
    </>
  )

  if (disabled) {
    return (
      <button type="button" disabled className={classes} title={action.disabledReason ?? undefined} aria-disabled>
        {content}
        <span className="sr-only">. Unavailable: {action.disabledReason}</span>
      </button>
    )
  }

  if (action.href) {
    return <Link href={action.href} className={classes}>{content}</Link>
  }

  // No href and enabled means the page wraps this in its own client control.
  return <button type="button" className={classes}>{content}</button>
}

/** The compact filter/date bar that sits under the header on several pages. */
export function HeaderToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-end gap-2', className)}>
      {children}
    </div>
  )
}
