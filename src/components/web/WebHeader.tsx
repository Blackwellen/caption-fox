import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import WebSubNav from './WebSubNav'
import { WEB_MODULE_META, type WebModule } from '@/lib/web/constants'

/**
 * Shared Web & Conversion page header: breadcrumb → title → description →
 * sub-nav. Header actions are passed in per surface so each page keeps its
 * own CTAs while the layout, spacing and width stay identical across all six
 * routes. Mirrors src/components/messaging/MessagingHeader.tsx.
 */
export default function WebHeader({
  module, modules, actions,
}: {
  module: WebModule
  modules: WebModule[]
  actions?: React.ReactNode
}) {
  const meta = WEB_MODULE_META[module]

  return (
    <header className="mb-4">
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li>
            <Link href="/app/home" className="transition-colors hover:text-slate-600">Campaign Manager</Link>
          </li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li>
            <Link href="/app/web" className="transition-colors hover:text-slate-600">Web &amp; Conversion</Link>
          </li>
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
        <WebSubNav modules={modules} />
      </div>
    </header>
  )
}
