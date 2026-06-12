'use client'

import { cn } from '@/lib/utils'

export interface Tab {
  id: string
  label: string
  count?: number
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
  pill?: boolean
}

export function Tabs({ tabs, active, onChange, className, pill }: TabsProps) {
  if (pill) {
    return (
      <div className={cn('flex gap-1 p-1 bg-slate-100 rounded-lg', className)}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
              active === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('ml-1.5 px-1.5 py-0.5 text-xs rounded-full',
                active === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500',
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-0 border-b border-slate-200', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150',
            active === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('px-1.5 py-0.5 text-xs rounded-full',
              active === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500',
            )}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
