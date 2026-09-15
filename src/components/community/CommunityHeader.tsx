import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import CommunitySubNav from './CommunitySubNav'
import { COMMUNITY_MODULE_META, type CommunityModule } from '@/lib/community/constants'

/**
 * Shared Community page header: breadcrumb → title → description → sub-nav.
 * Header actions are passed in per surface so each page keeps its own CTAs
 * while layout, spacing and width stay identical across all six routes.
 * Mirrors src/components/creators/CreatorsHeader.tsx.
 */
export default function CommunityHeader({
  module, modules, actions,
}: {
  module: CommunityModule
  modules: CommunityModule[]
  actions?: React.ReactNode
}) {
  const meta = COMMUNITY_MODULE_META[module]

  return (
    <header className="mb-4">
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/home" className="transition-colors hover:text-slate-600">Home</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/community" className="transition-colors hover:text-slate-600">Community</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li aria-current="page" className="font-medium text-slate-700">{meta.breadcrumb}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{meta.description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-4">
        <CommunitySubNav modules={modules} />
      </div>
    </header>
  )
}
