'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Download, FileSpreadsheet, Link2, MoreVertical, PencilLine, PlusCircle, Printer } from 'lucide-react'
import { BUTTON, ICON } from '../buttons'
import { Menu } from '../client/menu'
import { useToast } from '../client/toast'
import { ObjectiveDialog, type Option } from '../forms/ObjectiveDialog'
import { ResearchDialog } from '../forms/ResearchDialog'
import type { PersonLite } from '@/lib/strategy/types'
import type { StrategyModule } from '@/lib/strategy/constants'

/**
 * Header actions shared by Strategy pages. Buttons a role cannot use are not
 * rendered; the server actions enforce the same rules for direct calls.
 */
export default function StrategyPageActions({
  module, people, strategies, collections = [], can, primary = 'objective', extraMenu = [],
}: {
  module: StrategyModule
  people: PersonLite[]
  strategies: Option[]
  collections?: Option[]
  can: { createObjective: boolean; createResearch: boolean; export: boolean }
  primary?: 'objective' | 'research'
  extraMenu?: { id: string; label: string; href: string }[]
}) {
  const params = useSearchParams()
  const { notify } = useToast()
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [researchOpen, setResearchOpen] = useState(false)
  const exportHref = (format: 'csv' | 'json') => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', module)
    qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }

  return (
    <>
      {can.createObjective && primary === 'objective' && (
        <button type="button" className={BUTTON.primary} onClick={() => setObjectiveOpen(true)}>
          <PlusCircle aria-hidden className={ICON} /> New objective
        </button>
      )}
      {can.createResearch && (
        <button type="button" className={primary === 'research' ? BUTTON.primary : BUTTON.secondary} onClick={() => setResearchOpen(true)}>
          <PencilLine aria-hidden className={ICON} /> Add research
        </button>
      )}
      {can.export && (
        <Menu
          label="Export"
          items={[
            { id: 'csv', label: 'Export CSV', description: 'Uses the current filters', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
            { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
          ]}
          trigger={({ ref, toggle, open, ...aria }) => (
            <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
              <Download aria-hidden className={ICON} /> Export
              <ChevronDown aria-hidden className={`${ICON} ml-2 text-slate-500 transition-transform lg:ml-[9px] ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        />
      )}
      <Menu
        label="More actions"
        items={[
          ...extraMenu.map(item => ({ ...item })),
          {
            id: 'copy', label: 'Copy link to this view', icon: <Link2 className="h-3.5 w-3.5" />,
            onSelect: () => navigator.clipboard.writeText(window.location.href)
              .then(() => notify('success', 'Link copied.'), () => notify('error', 'Could not copy the link.')),
          },
          { id: 'print', label: 'Print', icon: <Printer className="h-3.5 w-3.5" />, onSelect: () => window.print() },
        ]}
        trigger={({ ref, toggle, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}>
            <MoreVertical aria-hidden className={ICON} />
          </button>
        )}
      />
      <ObjectiveDialog open={objectiveOpen} onClose={() => setObjectiveOpen(false)} people={people} strategies={strategies} />
      <ResearchDialog open={researchOpen} onClose={() => setResearchOpen(false)} collections={collections} />
    </>
  )
}
