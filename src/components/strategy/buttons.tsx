import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// Header / toolbar buttons at the approved density (31px desktop, 44px touch).

const BASE = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-blue disabled:cursor-not-allowed lg:rounded-[7px]'
const SIZE = 'h-11 px-4 text-[14px] lg:h-[31px] lg:gap-[7px] lg:px-[13px] lg:text-[11px]'

export const BUTTON = {
  primary: cn(BASE, SIZE, 'bg-sg-blue text-white shadow-[0_1px_2px_rgb(63_111_248/0.25)] hover:bg-sg-blue-hover disabled:bg-sg-blue/50'),
  secondary: cn(BASE, SIZE, 'border border-sg-line bg-white text-sg-ink hover:bg-slate-50 disabled:text-slate-400'),
  icon: cn(BASE, 'h-11 w-11 border border-sg-line bg-white text-sg-body hover:bg-slate-50 lg:h-[31px] lg:w-[33px]'),
}

export const ICON = 'h-4 w-4 lg:h-[13px] lg:w-[13px]'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }

export const StrategyButton = forwardRef<HTMLButtonElement, ButtonProps>(function StrategyButton(
  { variant = 'secondary', className, type = 'button', ...props }, ref,
) {
  return <button ref={ref} type={type} {...props} className={cn(BUTTON[variant], className)} />
})
