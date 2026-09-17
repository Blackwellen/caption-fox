import type { ReactNode } from 'react'
import { CREATOR_MODULE_META, type CreatorModule } from '@/lib/creators/constants'
import type { CreatorSession } from '@/lib/creators/server'
import type { ModuleAccess } from '@/lib/creators/entitlements'
import { delta } from '@/lib/creators/data'
import { deltaLabel } from '@/lib/creators/rules'
import { resolveCreatorsLink } from '@/lib/creators/routes'
import { CreatorsTabs } from '../controls'
import { PageHeader } from '../design'
import { AccessBlocked } from '../states'

export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * The common frame for all six Creators & UGC routes: title block and actions
 * exactly as in the reference, then the section tabs (the product sidebar has
 * no sub-items, so the tabs are how the six sibling pages are reached).
 */
export function CreatorsFrame({
  session, module, access, actions, children,
}: {
  session: CreatorSession
  module: CreatorModule
  access: ModuleAccess
  actions?: ReactNode
  children: ReactNode
}) {
  const meta = CREATOR_MODULE_META[module]
  const tabs = session.modules.map(id => ({ id, label: CREATOR_MODULE_META[id].label }))
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title={meta.title}
        subtitle={meta.description}
        actions={access.allowed ? actions : undefined}
        nav={<CreatorsTabs basePath={session.basePath} tabs={tabs} />}
      />
      {access.allowed ? children : <AccessBlocked access={access} />}
    </div>
  )
}

/** "12.5% vs last 30 days" with trend, from two window totals. */
export function kpiDelta(current: number, previous: number, suffix?: string) {
  const d = delta(current, previous)
  return { delta: deltaLabel(d.pct, suffix), trend: d.trend }
}

export function link(session: CreatorSession, stored: string | null | undefined): string | null {
  return resolveCreatorsLink(stored, session.basePath)
}

export function currencyOf(rows: { currency?: string | null }[], fallback = 'GBP'): string {
  return rows.find(r => r.currency)?.currency ?? fallback
}
