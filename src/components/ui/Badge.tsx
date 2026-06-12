import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate' | 'outline'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  blue:    'bg-blue-100 text-blue-700',
  green:   'bg-emerald-100 text-emerald-700',
  amber:   'bg-amber-100 text-amber-700',
  red:     'bg-red-100 text-red-700',
  violet:  'bg-violet-100 text-violet-700',
  slate:   'bg-slate-100 text-slate-500',
  outline: 'border border-slate-300 text-slate-600',
}

const statusMap: Record<string, BadgeVariant> = {
  active: 'green', live: 'green', published: 'green', approved: 'green', completed: 'green',
  draft: 'slate', idea: 'slate', pending: 'amber', in_review: 'amber', in_production: 'blue',
  scheduled: 'blue', briefing: 'blue', failed: 'red', rejected: 'red', archived: 'slate',
  reporting: 'violet', open: 'blue', resolved: 'green', closed: 'slate',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  status?: string
  className?: string
  dot?: boolean
}

export function Badge({ children, variant, status, className, dot }: BadgeProps) {
  const v = variant ?? (status ? statusMap[status] ?? 'default' : 'default')
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full', variants[v], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}
