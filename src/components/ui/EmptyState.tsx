import { cn } from '@/lib/utils'
import { Button } from './Button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-10 px-4' : 'py-20 px-6',
      className,
    )}>
      {Icon && (
        <div className={cn('rounded-2xl bg-slate-100 flex items-center justify-center mb-4',
          compact ? 'w-10 h-10' : 'w-14 h-14',
        )}>
          {typeof Icon === 'function'
            ? <Icon size={compact ? 20 : 28} className="text-slate-400" />
            : Icon}
        </div>
      )}
      <h3 className={cn('font-semibold text-slate-900', compact ? 'text-sm' : 'text-base')}>{title}</h3>
      {description && (
        <p className={cn('text-slate-500 mt-1 max-w-xs', compact ? 'text-xs' : 'text-sm')}>{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex gap-2 mt-5">
          {secondaryAction && (
            <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button variant="primary" size={compact ? 'sm' : 'md'} icon={action.icon} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
