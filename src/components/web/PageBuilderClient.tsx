'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/campaigns/Toast'
import { updatePageContent, publishPage, archivePage } from '@/app/app/web/actions'
import PageRenderer from './PageRenderer'
import { CARD, CARD_SHADOW } from './primitives'
import type { PageBlock, PageRow } from '@/lib/web/types'

const BLOCK_TYPES: { type: string; label: string; makeDefault: () => PageBlock }[] = [
  { type: 'hero', label: 'Hero', makeDefault: () => ({ id: crypto.randomUUID(), type: 'hero', heading: 'New headline', subheading: 'Supporting copy goes here.', cta_label: 'Get started' }) },
  { type: 'text', label: 'Text', makeDefault: () => ({ id: crypto.randomUUID(), type: 'text', heading: 'Section heading', body: 'Write your copy here.' }) },
  { type: 'benefits', label: 'Benefits', makeDefault: () => ({ id: crypto.randomUUID(), type: 'benefits', heading: 'Why choose us', items: ['Fast setup', 'No credit card required', 'Cancel anytime', '24/7 support'] }) },
  { type: 'faq', label: 'FAQ', makeDefault: () => ({ id: crypto.randomUUID(), type: 'faq', heading: 'Frequently asked questions', items: [{ q: 'How does it work?', a: 'Answer goes here.' }] }) },
  { type: 'cta', label: 'CTA', makeDefault: () => ({ id: crypto.randomUUID(), type: 'cta', heading: 'Ready to get started?', cta_label: 'Start free trial' }) },
  { type: 'footer', label: 'Footer', makeDefault: () => ({ id: crypto.randomUUID(), type: 'footer', text: '© Caption Fox' }) },
]

export default function PageBuilderClient({ page, canEdit, canPublish, canDelete }: {
  page: PageRow; canEdit: boolean; canPublish: boolean; canDelete: boolean
}) {
  const { notify } = useToast()
  const [blocks, setBlocks] = useState<PageBlock[]>(page.content)
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  function mutate(next: PageBlock[]) {
    setBlocks(next)
    setDirty(true)
  }

  function addBlock(type: string) {
    const factory = BLOCK_TYPES.find(b => b.type === type)
    if (!factory) return
    mutate([...blocks, factory.makeDefault()])
  }

  function removeBlock(id: string) {
    mutate(blocks.filter(b => b.id !== id))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const index = blocks.findIndex(b => b.id === id)
    const target = index + dir
    if (index < 0 || target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    mutate(next)
  }

  function updateField(id: string, field: string, value: unknown) {
    mutate(blocks.map(b => (b.id === id ? { ...b, [field]: value } : b)))
  }

  function save() {
    startTransition(async () => {
      const result = await updatePageContent(page.id, blocks)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Saved.') : (result.error ?? 'Could not save.'))
      if (result.ok) setDirty(false)
    })
  }

  function publish() {
    startTransition(async () => {
      const saveResult = await updatePageContent(page.id, blocks)
      if (!saveResult.ok) { notify('error', saveResult.error ?? 'Could not save.'); return }
      const result = await publishPage(page.id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Published.') : (result.error ?? 'Could not publish.'))
      if (result.ok) setDirty(false)
    })
  }

  function archive() {
    if (!confirm(`Archive "${page.name}"? It will stop being publicly reachable.`)) return
    startTransition(async () => {
      const result = await archivePage(page.id)
      notify(result.ok ? 'success' : 'error', result.ok ? (result.message ?? 'Archived.') : (result.error ?? 'Could not archive.'))
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-slate-900">Layout blocks</h2>
          {canEdit && (
            <div className="relative">
              <select
                onChange={e => { if (e.target.value) { addBlock(e.target.value); e.target.value = '' } }}
                className="h-8 rounded-lg border border-slate-200 bg-white pl-2.5 pr-6 text-[12px] font-medium text-slate-600"
                defaultValue=""
              >
                <option value="" disabled>+ Add block</option>
                {BLOCK_TYPES.map(b => <option key={b.type} value={b.type}>{b.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {blocks.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-slate-400">No blocks yet — add one to start building this page.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((block, index) => (
              <li key={block.id} className="rounded-lg border border-slate-200 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{block.type}</span>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveBlock(block.id, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowUp size={12} />
                      </button>
                      <button type="button" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                        <ArrowDown size={12} />
                      </button>
                      <button type="button" onClick={() => removeBlock(block.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                <BlockFields block={block} canEdit={canEdit} onChange={(field, value) => updateField(block.id, field, value)} />
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button" onClick={save} disabled={pending || !dirty}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Save draft
            </button>
            {canPublish && (
              <button
                type="button" onClick={publish} disabled={pending}
                className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Save &amp; publish
              </button>
            )}
            {canDelete && page.status !== 'archived' && (
              <button
                type="button" onClick={archive} disabled={pending}
                className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Archive
              </button>
            )}
          </div>
        )}
      </div>

      <div className={cn(CARD, CARD_SHADOW, 'p-4')}>
        <h2 className="mb-3 text-[13px] font-semibold text-slate-900">Preview</h2>
        <PageRenderer blocks={blocks} />
      </div>
    </div>
  )
}

function BlockFields({ block, canEdit, onChange }: { block: PageBlock; canEdit: boolean; onChange: (field: string, value: unknown) => void }) {
  const input = (field: string, placeholder: string) => (
    <input
      value={String(block[field] ?? '')} disabled={!canEdit} placeholder={placeholder}
      onChange={e => onChange(field, e.target.value)}
      className="h-8 w-full rounded-md border border-slate-200 px-2 text-[12px] text-slate-700 disabled:bg-slate-50"
    />
  )

  if (block.type === 'hero' || block.type === 'cta') {
    return (
      <div className="space-y-1.5">
        {input('heading', 'Heading')}
        {block.type === 'hero' && input('subheading', 'Subheading')}
        {input('cta_label', 'CTA button label')}
      </div>
    )
  }
  if (block.type === 'text') {
    return (
      <div className="space-y-1.5">
        {input('heading', 'Heading (optional)')}
        <textarea
          value={String(block.body ?? '')} disabled={!canEdit} placeholder="Body copy"
          onChange={e => onChange('body', e.target.value)} rows={2}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] text-slate-700 disabled:bg-slate-50"
        />
      </div>
    )
  }
  if (block.type === 'footer') return input('text', 'Footer text')
  return <p className="text-[11px] text-slate-400">This block type is edited via its default content.</p>
}
