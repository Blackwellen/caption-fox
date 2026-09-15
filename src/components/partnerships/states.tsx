import { Handshake, SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'

export { AccessBlocked, LoadError } from '@/components/campaigns/states'

/** Empty state used when a Partnerships surface genuinely has no records yet. */
export function PartnershipsEmpty({
  title, message, action, icon = 'partner', bare = false, className,
}: {
  title: string
  message: string
  action?: React.ReactNode
  icon?: 'partner' | 'search'
  bare?: boolean
  className?: string
}) {
  const Icon = icon === 'search' ? SearchX : Handshake
  return (
    <div className={cn(!bare && [CARD, CARD_SHADOW], 'flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon size={20} />
      </span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
