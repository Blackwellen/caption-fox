'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Bell, ChevronDown, Command, HelpCircle, Menu, MoreHorizontal, Plus, Search, Settings2, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getShellItem, shellConfigs, type ShellConfig, type ShellNavItem, type ShellSurface } from '@/lib/shell/caption-fox-shell'

type ShellState = 'ready' | 'empty' | 'loading' | 'error' | 'restricted' | 'upgrade' | 'archived'

export default function CaptionFoxShell({ surface, path = [], basePath = '/shell' }: { surface: ShellSurface; path?: string[]; basePath?: string }) {
  const config = shellConfigs[surface]
  const item = getShellItem(config, path[0])
  const isDetail = path[1]?.startsWith('detail-') ?? false
  const isWizardRoute = path[1] === 'new'
  const requestedTab = isDetail || isWizardRoute ? undefined : path[1]?.replaceAll('-', ' ')
  const activeTab = item.tabs.find(tab => tab.toLowerCase() === requestedTab?.toLowerCase()) ?? item.tabs[0]
  const state = (path.includes('empty') ? 'empty' : path.includes('loading') ? 'loading' : path.includes('error') ? 'error' : path.includes('restricted') ? 'restricted' : path.includes('upgrade') ? 'upgrade' : path.includes('archived') ? 'archived' : 'ready') as ShellState
  const [mobileOpen, setMobileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(isWizardRoute)
  const [wizardStep, setWizardStep] = useState(0)
  const mobileItems = useMemo(() => config.groups.flatMap(group => group.items).filter(item => config.mobile.includes(item.id)), [config])

  function linkFor(id: string, tab?: string) {
    return `${basePath}/${id}${tab ? `/${tab.toLowerCase().replaceAll(' ', '-')}` : ''}`
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="fixed inset-x-0 top-0 z-50 flex min-h-8 items-center justify-center bg-amber-100 px-3 text-center text-xs font-medium text-amber-900">
        Development shell only - local fixtures, no live actions or production data.
      </div>
      <aside className="fixed inset-y-8 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="border-b border-slate-800 px-5 py-4">
          <Link href={basePath} className="flex items-center gap-2 text-sm font-semibold text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600"><Sparkles size={15} /></span>Caption Fox shell</Link>
          <p className="mt-2 text-xs text-slate-400">{config.label} · {config.role}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={`${config.label} navigation`}>
          {config.groups.map(group => <div key={group.label} className="mb-4">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{group.label}</p>
            {group.items.map(navItem => <Link key={navItem.id} href={linkFor(navItem.id)} className={cn('mb-0.5 flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors', navItem.id === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
              <span>{navItem.label}</span><span className="text-[10px] opacity-60">{navItem.tabs.length}</span>
            </Link>)}
          </div>)}
        </nav>
        <div className="border-t border-slate-800 p-3"><Link href={linkFor('settings')} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"><Settings2 size={15} />Settings</Link></div>
      </aside>

      <div className="pt-8 lg:pl-64">
        <header className="sticky top-8 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-7">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
          <Link href={basePath} className="hidden text-sm font-semibold text-slate-700 sm:block">{config.label}</Link>
          <button className="flex min-w-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"><span className="truncate">Jamahl {config.label.replace(' workspace', '')}</span><ChevronDown size={13} /></button>
          <button className="hidden flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-400 sm:flex"><Search size={15} />Search this shell <kbd className="ml-auto text-[10px]">Ctrl K</kbd></button>
          <div className="ml-auto flex items-center gap-1"><button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"><Plus size={15} />Create</button><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={18} /></button><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Help"><HelpCircle size={18} /></button></div>
        </header>

        <main className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 lg:p-8">
          <nav className="mb-3 flex items-center gap-1 text-xs text-slate-500"><Link href={`/shell/${surface}`} className="hover:text-slate-900">{config.label}</Link><span>/</span><span className="font-medium text-slate-700">{item.label}</span>{path[2] && <><span>/</span><span>{path[2]}</span></>}</nav>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{config.role} view</div><h1 className="text-2xl font-bold tracking-tight">{item.label}</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">{state === 'ready' ? `Structural shell for ${item.label.toLowerCase()}. Tabs, actions, states and related records are represented with local deterministic fixtures.` : `This route demonstrates the ${state} state for this section.`}</p></div><div className="flex gap-2"><button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">Export</button><button className="rounded-lg border border-slate-200 bg-white p-2" aria-label="More actions"><MoreHorizontal size={18} /></button></div></div>

          <Tabs item={item} active={activeTab} linkFor={linkFor} />
          <ShellContent state={state} item={item} activeTab={activeTab} linkFor={linkFor} detail={isDetail} />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden" aria-label="Mobile navigation">{mobileItems.slice(0, 4).map(navItem => <Link key={navItem.id} href={linkFor(navItem.id)} className={cn('flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px]', navItem.id === item.id ? 'text-blue-600' : 'text-slate-500')}><Sparkles size={16} />{navItem.label}</Link>)}<button onClick={() => setMobileOpen(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] text-slate-500"><MoreHorizontal size={17} />More</button></nav>
      {mobileOpen && <MobileDrawer config={config} item={item} linkFor={linkFor} close={() => setMobileOpen(false)} />}
      {createOpen && <Wizard item={item} onClose={() => { setCreateOpen(false); setWizardStep(0) }} step={wizardStep} setStep={setWizardStep} />}
    </div>
  )
}

function Tabs({ item, active, linkFor }: { item: ShellNavItem; active: string; linkFor: (id: string, tab?: string) => string }) {
  return <div className="mb-6 overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1">{item.tabs.map(tab => <Link key={tab} href={linkFor(item.id, tab)} className={cn('border-b-2 px-3 py-3 text-sm font-medium', tab === active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>{tab}</Link>)}</div></div>
}

function ShellContent({ state, item, activeTab, linkFor, detail: showDetail }: { state: ShellState; item: ShellNavItem; activeTab: string; linkFor: (id: string, tab?: string) => string; detail: boolean }) {
  if (state !== 'ready') return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><Command className="mx-auto mb-3 text-slate-400" /><h2 className="font-semibold capitalize">{state} state</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">This standard state is intentionally represented before the real domain workflow is connected.</p><Link href={linkFor(item.id)} className="mt-4 inline-block rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Return to shell</Link></div>
  if (showDetail) return <DetailShell item={item} linkFor={linkFor} />
  const detail = item.detailTabs?.length ? item : undefined
  return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{['In progress', 'Awaiting approval', 'Upcoming work', 'Performance'].map((label, index) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{index === 3 ? '4.8%' : String((index + 1) * 3)}</p><p className="mt-1 text-xs text-slate-400">Fixture metric for {activeTab}</p></div>)}</section><section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold">{activeTab}</h2><p className="text-xs text-slate-500">Collection, search, filters, sorting and saved views shell</p></div><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Filters</button></div><div className="divide-y divide-slate-100">{['North Star campaign', 'Launch content series', 'Supplier collaboration'].map((name, index) => <Link key={name} href={`${linkFor(item.id)}/detail-${index + 1}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"><div><p className="text-sm font-medium">{name}</p><p className="mt-0.5 text-xs text-slate-500">Local fixture · updated today · {item.label}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Draft</span></Link>)}</div></div><aside className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Quick actions</h2><div className="mt-3 space-y-2"><button className="w-full rounded-lg bg-blue-600 px-3 py-2 text-left text-sm font-medium text-white">Create {item.label.replace(/s$/, '')}</button><button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm">Import placeholder</button><button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm">Open saved view</button></div>{detail && <div className="mt-6 border-t pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detail tabs represented</p><div className="mt-2 flex flex-wrap gap-1">{detail.detailTabs?.map(tab => <span key={tab} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{tab}</span>)}</div></div>}</aside></section></div>
}

function DetailShell({ item, linkFor }: { item: ShellNavItem; linkFor: (id: string, tab?: string) => string }) {
  const tabs = item.detailTabs?.length ? item.detailTabs : ['Overview', 'Activity', 'Files', 'Audit']
  return <div className="space-y-6"><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fixture detail record</p><h2 className="mt-1 text-xl font-bold">North Star {item.label.replace(/s$/, '')}</h2><p className="mt-1 text-sm text-slate-500">A complete detail-page shell with status, owner, activity and tabbed record areas.</p></div><div className="flex gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Share</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Edit</button></div></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Status</p><p className="mt-1 font-medium">In review</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Owner</p><p className="mt-1 font-medium">Jamahl Thomas</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Updated</p><p className="mt-1 font-medium">Today</p></div></div></section><div className="overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-1">{tabs.map((tab, index) => <button key={tab} className={cn('border-b-2 px-3 py-3 text-sm font-medium', index === 0 ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800')}>{tab}</button>)}</div></div><section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Overview</h3><p className="mt-2 text-sm text-slate-500">The selected record’s fields, relationships, approvals and activity are represented here. Each detail tab has a route-backed, responsive shell ready for typed domain data.</p><Link href={linkFor(item.id)} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">Back to {item.label}</Link></section></div>
}

function MobileDrawer({ config, item, linkFor, close }: { config: ShellConfig; item: ShellNavItem; linkFor: (id: string) => string; close: () => void }) {
  return <div className="fixed inset-0 z-50 lg:hidden"><button onClick={close} className="absolute inset-0 bg-slate-950/40" aria-label="Close navigation" /><div className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto bg-slate-950 p-4 text-white"><div className="mb-5 flex items-center justify-between"><p className="font-semibold">{config.label}</p><button onClick={close} className="rounded p-2 hover:bg-slate-800" aria-label="Close navigation"><X size={18} /></button></div>{config.groups.map(group => <div key={group.label} className="mb-4"><p className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{group.label}</p>{group.items.map(navItem => <Link onClick={close} href={linkFor(navItem.id)} key={navItem.id} className={cn('block rounded-lg px-3 py-2 text-sm', navItem.id === item.id ? 'bg-blue-600' : 'text-slate-300 hover:bg-slate-800')}>{navItem.label}</Link>)}</div>)}</div></div>
}

function Wizard({ item, onClose, step, setStep }: { item: ShellNavItem; onClose: () => void; step: number; setStep: (step: number) => void }) {
  const steps = item.wizard?.length ? item.wizard : ['Details', 'Options', 'Review', 'Submit']
  const current = steps[Math.min(step, steps.length - 1)]
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Create ${item.label}`}><div className="w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">Create {item.label.replace(/s$/, '')}</h2><p className="text-xs text-slate-500">Mock wizard - no record is saved</p></div><button onClick={onClose} className="rounded p-2 hover:bg-slate-100" aria-label="Close wizard"><X size={18} /></button></div><div className="p-5"><ol className="mb-6 flex overflow-x-auto">{steps.map((label, index) => <li key={label} className={cn('min-w-24 border-t-2 pt-2 text-xs', index <= step ? 'border-blue-600 text-blue-700' : 'border-slate-200 text-slate-400')}>{index + 1}. {label}</li>)}</ol><h3 className="text-lg font-semibold">{current}</h3><p className="mt-2 text-sm text-slate-500">Required and optional fields, validation feedback, draft recovery and a responsive form belong in this step.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="h-10 rounded-lg border border-slate-200 bg-slate-50" /><div className="h-10 rounded-lg border border-slate-200 bg-slate-50" /></div></div><div className="flex justify-between border-t p-5"><button onClick={onClose} className="text-sm text-slate-600">Save draft and close</button><div className="flex gap-2"><button disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>{step < steps.length - 1 ? <button onClick={() => setStep(step + 1)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Next</button> : <button onClick={onClose} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">Submit mock</button>}</div></div></div></div>
}
