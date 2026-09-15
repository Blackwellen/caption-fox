import Link from 'next/link'
import { AlertTriangle, Lock, SearchX, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, CARD_SHADOW } from './primitives'
import type { ModuleAccess } from '@/lib/automations/entitlements'

/** Canonical blocked / upgrade state. Mirrors src/components/community/states.tsx. */
export function AccessBlocked({ access }: { access: Extract<ModuleAccess, { allowed: false }> }) {
  const isUpgrade = access.upgrade
  return (
    <div className={cn(CARD, CARD_SHADOW, 'mx-auto max-w-lg px-6 py-10 text-center')}>
      <span className={cn('mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl', isUpgrade ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500')}>
        {isUpgrade ? <Sparkles size={20} /> : <Lock size={20} />}
      </span>
      <h2 className="text-base font-semibold text-slate-900">{isUpgrade ? 'Upgrade to unlock this area' : 'You do not have access to this area'}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">{access.message}</p>
      {isUpgrade && (
        <Link href="/app/settings/billing" className="mt-4 inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          View plans &amp; billing
        </Link>
      )}
    </div>
  )
}

export function AutomationsEmpty({
  title, message, action, icon = 'automation', className,
}: { title: string; message: string; action?: React.ReactNode; icon?: 'automation' | 'search'; className?: string }) {
  const Icon = icon === 'search' ? SearchX : Zap
  return (
    <div className={cn(CARD, CARD_SHADOW, 'flex flex-col items-center px-6 py-12 text-center', className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Icon size={20} /></span>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadError({ message, className }: { message: string; className?: string }) {
  return (
    <div className={cn(CARD, 'border-red-200 bg-red-50/50 px-4 py-3', className)} role="alert">
      <p className="flex items-start gap-2 text-[13px] text-red-800">
        <AlertTriangle size={15} className="mt-px shrink-0 text-red-500" />
        <span>
          <span className="font-medium">We could not load this data.</span> {message} If this keeps happening, contact support with reference{' '}
          <code className="rounded bg-red-100 px-1 font-mono text-[11px]">CF-AUTOMATIONS</code>.
        </span>
      </p>
    </div>
  )
}
