'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { CARD, CARD_SHADOW } from './primitives'
import { cn } from '@/lib/utils'
import { createPage, createForm, createFunnel, createExperiment } from '@/app/app/web/actions'
import { PAGE_TYPES, PAGE_TYPE_LABELS, FORM_TYPES, FORM_TYPE_LABELS, FUNNEL_TYPES, FUNNEL_TYPE_LABELS, EXPERIMENT_TYPES, EXPERIMENT_TYPE_LABELS } from '@/lib/web/constants'

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={cn(CARD, CARD_SHADOW, 'mb-3 p-4')}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-100">
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
  )
}

const INPUT = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const PRIMARY = 'inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50'

export function CreatePageForm() {
  const router = useRouter()
  const pathname = usePathname()
  const onClose = () => router.push(pathname)
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [pageType, setPageType] = useState<typeof PAGE_TYPES[number]>('landing_page')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createPage({ name, page_type: pageType })
      if (!result.ok) { notify('error', result.error ?? 'Could not create the page.'); return }
      notify('success', result.message ?? 'Page created.')
      router.push(`/app/web/pages/${result.id}`)
    })
  }

  return (
    <Shell title="New page" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Page name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={140} placeholder="Summer Launch 2026" className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Type</span>
          <select value={pageType} onChange={e => setPageType(e.target.value as typeof pageType)} className={INPUT}>
            {PAGE_TYPES.map(t => <option key={t} value={t}>{PAGE_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending || !name.trim()} className={PRIMARY}>Create page</button>
      </form>
    </Shell>
  )
}

export function CreateFormForm() {
  const router = useRouter()
  const pathname = usePathname()
  const onClose = () => router.push(pathname)
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [formType, setFormType] = useState<typeof FORM_TYPES[number]>('lead_capture')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createForm({ name, form_type: formType })
      if (!result.ok) { notify('error', result.error ?? 'Could not create the form.'); return }
      notify('success', result.message ?? 'Form created.')
      router.push(`/app/web/forms/${result.id}`)
    })
  }

  return (
    <Shell title="New form" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Form name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={140} placeholder="Lead Capture Form" className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Type</span>
          <select value={formType} onChange={e => setFormType(e.target.value as typeof formType)} className={INPUT}>
            {FORM_TYPES.map(t => <option key={t} value={t}>{FORM_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending || !name.trim()} className={PRIMARY}>Create form</button>
      </form>
    </Shell>
  )
}

export function CreateFunnelForm() {
  const router = useRouter()
  const pathname = usePathname()
  const onClose = () => router.push(pathname)
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [funnelType, setFunnelType] = useState<typeof FUNNEL_TYPES[number]>('standard')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createFunnel({ name, funnel_type: funnelType })
      if (!result.ok) { notify('error', result.error ?? 'Could not create the funnel.'); return }
      notify('success', result.message ?? 'Funnel created.')
      router.push(`/app/web/funnels/${result.id}`)
    })
  }

  return (
    <Shell title="New funnel" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Funnel name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={140} placeholder="Main Conversion Funnel" className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Type</span>
          <select value={funnelType} onChange={e => setFunnelType(e.target.value as typeof funnelType)} className={INPUT}>
            {FUNNEL_TYPES.map(t => <option key={t} value={t}>{FUNNEL_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending || !name.trim()} className={PRIMARY}>Create funnel</button>
      </form>
    </Shell>
  )
}

export function CreateExperimentForm() {
  const router = useRouter()
  const pathname = usePathname()
  const onClose = () => router.push(pathname)
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [experimentType, setExperimentType] = useState<typeof EXPERIMENT_TYPES[number]>('page')
  const [surfaceRef, setSurfaceRef] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createExperiment({ name, experiment_type: experimentType, surface_ref: surfaceRef || undefined })
      if (!result.ok) { notify('error', result.error ?? 'Could not create the experiment.'); return }
      notify('success', result.message ?? 'Experiment created.')
      router.push(`/app/web/experiments/${result.id}`)
    })
  }

  return (
    <Shell title="New experiment" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Experiment name</span>
          <input value={name} onChange={e => setName(e.target.value)} required maxLength={140} placeholder="Homepage Hero Test" className={INPUT} />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Type</span>
          <select value={experimentType} onChange={e => setExperimentType(e.target.value as typeof experimentType)} className={INPUT}>
            {EXPERIMENT_TYPES.map(t => <option key={t} value={t}>{EXPERIMENT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="min-w-[160px]">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Surface (path)</span>
          <input value={surfaceRef} onChange={e => setSurfaceRef(e.target.value)} maxLength={200} placeholder="/homepage" className={INPUT} />
        </label>
        <button type="submit" disabled={pending || !name.trim()} className={PRIMARY}>Create experiment</button>
      </form>
    </Shell>
  )
}
