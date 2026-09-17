import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import CampaignsSubNav from './CampaignsSubNav'
import { CAMPAIGN_MODULE_META, type CampaignModule } from '@/lib/campaigns/constants'

/**
 * Shared Campaigns page header: breadcrumb → title → description → sub-nav.
 * Header actions are passed in per surface so each page keeps its own CTAs
 * while the layout, spacing and width stay identical across all seven routes.
 */
export default function CampaignsHeader({
  module, modules, base, actions,
}: {
  module: CampaignModule
  modules: CampaignModule[]
  /** Canonical route prefix, e.g. `/brand/campaigns`. */
  base: string
  actions?: React.ReactNode
}) {
  const meta = CAMPAIGN_MODULE_META[module]

  return (
    <header className="mb-4 lg:mb-3">
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400 lg:text-[10px]">
          <li>
            <Link href={`${base.replace(/\/campaigns$/, '')}/home`} className="transition-colors hover:text-slate-600">Campaign Manager</Link>
          </li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li>
            <Link href={base} className="transition-colors hover:text-slate-600">Campaigns</Link>
          </li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{meta.breadcrumb}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900 lg:text-[19px]">{meta.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500 lg:text-[11px]">{meta.description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-4 lg:mt-3">
        <CampaignsSubNav modules={modules} base={base} />
      </div>
    </header>
  )
}
