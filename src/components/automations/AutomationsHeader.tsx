import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import AutomationsSubNav from './AutomationsSubNav'
import { AUTOMATION_MODULE_META, type AutomationModule } from '@/lib/automations/constants'

export default function AutomationsHeader({
  module, modules, actions,
}: { module: AutomationModule; modules: AutomationModule[]; actions?: React.ReactNode }) {
  const meta = AUTOMATION_MODULE_META[module]
  return (
    <header className="mb-4">
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex items-center gap-1 text-xs text-slate-400">
          <li><Link href="/app/home" className="transition-colors hover:text-slate-600">Home</Link></li>
          <li aria-hidden><ChevronRight size={12} className="text-slate-300" /></li>
          <li><Link href="/app/automations" className="transition-colors hover:text-slate-600">Automations</Link></li>
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
      <div className="mt-4"><AutomationsSubNav modules={modules} /></div>
    </header>
  )
}
