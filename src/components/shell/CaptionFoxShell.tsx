'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Command, MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getShellItem, shellConfigs, type ShellNavItem, type ShellSurface } from '@/lib/shell/caption-fox-shell'

type ShellState = 'ready' | 'empty' | 'loading' | 'error' | 'restricted' | 'upgrade' | 'archived'

/**
 * Development-only fixture CONTENT for the /shell/[surface] preview route
 * (disabled in production). It no longer renders any application chrome —
 * the only application frame is the permanent CaptionFoxAppShell.
 */
export default function CaptionFoxShell({
  surface,
  path = [],
  basePath = '/shell',
}: {
  surface: ShellSurface
  path?: string[]
  basePath?: string
}) {
  const config = shellConfigs[surface]
  const item = getShellItem(config, path[0])
  const isDetail = path[1]?.startsWith('detail-') ?? false
  const isWizardRoute = path[1] === 'new'
  const requestedTab = isDetail || isWizardRoute ? undefined : path[1]?.replaceAll('-', ' ')
  const activeTab = item.tabs.find(tab => tab.toLowerCase() === requestedTab?.toLowerCase()) ?? item.tabs[0]
  const state = (path.includes('empty') ? 'empty' : path.includes('loading') ? 'loading' : path.includes('error') ? 'error' : path.includes('restricted') ? 'restricted' : path.includes('upgrade') ? 'upgrade' : path.includes('archived') ? 'archived' : 'ready') as ShellState
  const [createOpen, setCreateOpen] = useState(isWizardRoute)
  const [wizardStep, setWizardStep] = useState(0)

  function linkFor(id: string, tab?: string) {
    return `${basePath}/${surface}/${id}${tab ? `/${tab.toLowerCase().replaceAll(' ', '-')}` : ''}`
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-8 items-center justify-center bg-amber-100 px-3 text-center text-xs font-medium text-amber-900">
        Development fixture preview only - local fixtures, no live actions or production data.
      </div>
      <main className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 lg:p-8">
        <nav className="mb-4 flex flex-wrap gap-1 text-xs">
          {config.groups.flatMap(group => group.items).map(navItem => (
            <Link key={navItem.id} href={linkFor(navItem.id)} className={cn('rounded-md px-2 py-1', navItem.id === item.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100')}>{navItem.label}</Link>
          ))}
        </nav>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{config.role} view</div><h1 className="text-2xl font-bold tracking-tight">{item.label}</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">{state === 'ready' ? `Structural fixture for ${item.label.toLowerCase()}.` : `This route demonstrates the ${state} state for this section.`}</p></div><div className="flex gap-2"><button onClick={() => setCreateOpen(true)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Create</button><button className="rounded-lg border border-slate-200 bg-white p-2" aria-label="More actions"><MoreHorizontal size={18} /></button></div></div>
        <Tabs item={item} active={activeTab} linkFor={linkFor} />
        <ShellContent state={state} item={item} activeTab={activeTab} linkFor={linkFor} detail={isDetail} />
      </main>
      {createOpen && <Wizard item={item} onClose={() => { setCreateOpen(false); setWizardStep(0) }} step={wizardStep} setStep={setWizardStep} />}
    </div>
  )
}

function Tabs({ item, active, linkFor }: { item: ShellNavItem; active: string; linkFor: (id: string, tab?: string) => string }) {
  return <div className="mb-6 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1">{item.tabs.map(tab => <Link key={tab} href={linkFor(item.id, tab)} className={cn('border-b-2 px-3 py-3 text-sm font-medium', tab === active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>{tab}</Link>)}</div></div>
}

function ShellContent({ state, item, activeTab, linkFor, detail }: { state: ShellState; item: ShellNavItem; activeTab: string; linkFor: (id: string, tab?: string) => string; detail: boolean }) {
  if (state !== 'ready') return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Command className="mx-auto mb-3 text-slate-400" /><h2 className="font-semibold capitalize">{state} state</h2><Link href={linkFor(item.id)} className="mt-4 inline-block rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Return</Link></div>
  if (detail) {
    const tabs = item.detailTabs?.length ? item.detailTabs : ['Overview', 'Activity', 'Files', 'Audit']
    return <div className="space-y-4"><div className="overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1">{tabs.map((tab, index) => <span key={tab} className={cn('border-b-2 px-3 py-3 text-sm font-medium', index === 0 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500')}>{tab}</span>)}</div></div><Link href={linkFor(item.id)} className="text-sm font-medium text-blue-600">Back to {item.label}</Link></div>
  }
  return <section className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">{activeTab}</h2></div><div className="divide-y divide-slate-100">{['North Star record', 'Launch content series', 'Supplier collaboration'].map((name, index) => <Link key={name} href={`${linkFor(item.id)}/detail-${index + 1}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"><p className="text-sm font-medium">{name}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Fixture</span></Link>)}</div></section>
}

function Wizard({ item, onClose, step, setStep }: { item: ShellNavItem; onClose: () => void; step: number; setStep: (step: number) => void }) {
  const steps = item.wizard?.length ? item.wizard : ['Details', 'Options', 'Review', 'Submit']
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Create ${item.label}`}><div className="w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="font-semibold">Fixture wizard - {item.label}</h2><button onClick={onClose} className="rounded p-2 hover:bg-slate-100" aria-label="Close wizard"><X size={18} /></button></div><ol className="flex overflow-x-auto p-5">{steps.map((label, index) => <li key={label} className={cn('min-w-24 border-t-2 pt-2 text-xs', index <= step ? 'border-blue-600 text-blue-700' : 'border-slate-200 text-slate-400')}>{index + 1}. {label}</li>)}</ol><div className="flex justify-end gap-2 border-t p-5"><button disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button><button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onClose()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">{step < steps.length - 1 ? 'Next' : 'Close'}</button></div></div></div>
}
