'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, Copy, ExternalLink, Eye, FileText, GripVertical, Grid2x2, Image as ImageIcon, LayoutTemplate, List,
  Mail, Monitor, Package, Plus, Rows3, Smartphone, Timer, Trash2, Type, Video, CircleHelp, BadgePoundSterling, Minus, Rss,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BLOCKS, BLOCK_TYPES, blockSummary, CONVERSION_SNIPPETS, LINK_PAGE_SNIPPETS, type BlockIcon, type BlockType, type Snippet } from '@/lib/link-in-bio/blocks'
import { addBlock, deleteBlock, duplicateBlock, removeChildLink, reorderBlocks, updateBlock, upsertChildLink } from '@/lib/link-in-bio/actions'
import { toRenderModel, type Block, type ChildLink, type PageKind } from '@/lib/link-in-bio/records'
import type { ThemeTokens } from '@/lib/link-in-bio/theme'
import MicroPage from '../renderer/MicroPage'
import { BrowserFrame, PhoneFrame } from '../renderer/DeviceFrames'
import { buttonClass } from '../ui'
import { Menu, useAction } from '../client'
import { notify } from '../feedback'
import BlockFields, { type Lookups } from './BlockFields'

const ICONS: Record<BlockIcon, typeof List> = {
  hero: ImageIcon, list: List, stack: Rows3, product: Package, grid: Grid2x2, mail: Mail, eye: Eye, feed: Rss, timer: Timer,
  faq: CircleHelp, pricing: BadgePoundSterling, video: Video, image: ImageIcon, text: Type, divider: Minus, footer: FileText,
}

type Props = {
  workspaceType: string
  pageId: string
  kind: PageKind
  page: { title: string; description: string | null; legal: Record<string, string | null | undefined>; showBranding: boolean }
  initialBlocks: Block[]
  tokens: ThemeTokens
  readOnly: boolean
  readOnlyReason: string | null
  lookups: Lookups
  livePath: string | null
  capabilities: Record<string, boolean>
}

export default function DesignWorkbench({ workspaceType, pageId, kind, page, initialBlocks, tokens, readOnly, readOnlyReason, lookups, livePath, capabilities }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [snippetTab, setSnippetTab] = useState<'recommended' | 'all'>('recommended')
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const snippetsRef = useRef<HTMLDivElement | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const { run, pending } = useAction()

  // Server refreshes (after add/duplicate/restore) replace the local copy.
  const serverKey = JSON.stringify(initialBlocks.map(b => [b.id, b.sortOrder, b.isActive, b.children.length]))
  const [syncedKey, setSyncedKey] = useState(serverKey)
  if (serverKey !== syncedKey) { setSyncedKey(serverKey); setBlocks(initialBlocks) }

  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t) }, [])

  const model = useMemo(() => toRenderModel({ title: page.title, description: page.description, kind, legal: page.legal, showBranding: page.showBranding }, blocks, tokens), [blocks, tokens, page, kind])

  const debounce = useCallback((key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(key, setTimeout(async () => {
      timers.current.delete(key)
      setSaving(true)
      try {
        const result = await fn()
        if (!result.ok) notify(result.error ?? 'Could not save.', 'error')
      } finally { setSaving(timers.current.size > 0) }
    }, 700))
  }, [])

  const patchBlock = (id: string, patch: Partial<Block>) => setBlocks(list => list.map(b => (b.id === id ? { ...b, ...patch } : b)))

  const onConfig = (block: Block, patch: Record<string, unknown>) => {
    const config = { ...block.config, ...patch }
    patchBlock(block.id, { config })
    debounce(`block:${block.id}`, () => updateBlock({ workspaceType, pageId, blockId: block.id, config: patch }).then(r => (r.ok ? r : (patchBlock(block.id, { config: block.config }), r))))
  }

  const onChild = (block: Block, childId: string, patch: Partial<ChildLink>) => {
    const children = block.children.map(c => (c.id === childId ? { ...c, ...patch } : c))
    patchBlock(block.id, { children })
    const child = children.find(c => c.id === childId)!
    debounce(`child:${childId}`, () => upsertChildLink({ workspaceType, pageId, blockId: block.id, linkId: childId, title: child.title || 'Untitled link', url: child.url ?? '', reusableLinkId: child.reusableLinkId, isActive: child.isActive, scheduleStart: child.scheduleStart, scheduleEnd: child.scheduleEnd }))
  }

  const toggle = (block: Block) => {
    const next = !block.isActive
    patchBlock(block.id, { isActive: next })
    run(async () => {
      const result = await updateBlock({ workspaceType, pageId, blockId: block.id, isActive: next })
      if (!result.ok) patchBlock(block.id, { isActive: !next })
      return result
    })
  }

  const persistOrder = (next: Block[], previous: Block[]) => {
    setBlocks(next.map((b, i) => ({ ...b, sortOrder: i })))
    run(async () => {
      const result = await reorderBlocks({ workspaceType, pageId, orderedIds: next.map(b => b.id) })
      if (!result.ok) setBlocks(previous)
      return result
    }, {})
  }

  const move = (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex(b => b.id === id)
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    persistOrder(next, blocks)
  }

  const moveChild = (block: Block, childId: string, direction: -1 | 1) => {
    const index = block.children.findIndex(c => c.id === childId)
    const target = index + direction
    if (target < 0 || target >= block.children.length) return
    const children = [...block.children]
    ;[children[index], children[target]] = [children[target], children[index]]
    patchBlock(block.id, { children })
    run(async () => {
      const result = await reorderBlocks({ workspaceType, pageId, parentId: block.id, orderedIds: children.map(c => c.id) })
      if (!result.ok) patchBlock(block.id, { children: block.children })
      return result
    })
  }

  const add = (type: BlockType, config?: Record<string, unknown>) =>
    run(() => addBlock({ workspaceType, pageId, type, config }), { success: `${BLOCKS[type].label} added` }, data => setExpanded(data.id))

  const addMenu = BLOCK_TYPES.map(type => ({
    label: BLOCKS[type].label,
    disabledReason: BLOCKS[type].requires && !capabilities[BLOCKS[type].requires!] ? 'Not included in your plan or role.' : null,
    onSelect: () => add(type),
  }))

  const snippets: Snippet[] = kind === 'conversion_page' ? CONVERSION_SNIPPETS : LINK_PAGE_SNIPPETS
  const visibleSnippets: Snippet[] = snippetTab === 'recommended' ? snippets : [...snippets, ...BLOCK_TYPES.filter(t => !snippets.some(s => s.type === t)).map(t => ({ id: t, label: BLOCKS[t].label, type: t, preview: 'image-cta' as const }))]

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_164px_214px]">
      {/* ------------------------------------------------------------ builder */}
      <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-label="Page builder">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-slate-900">Page builder</h2>
            <p className="mt-0.5 text-[10.5px] text-slate-500">{readOnly ? readOnlyReason : saving ? 'Saving…' : 'Drag and drop blocks to build your page.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Preview device</span>
              <select value={device} onChange={e => setDevice(e.target.value as 'mobile' | 'desktop')} className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[11.5px] text-slate-700">
                <option value="desktop">Preview on desktop</option>
                <option value="mobile">Preview on mobile</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
            </label>
            {!readOnly && (
              <Menu label="Add block" items={addMenu} trigger={<span className={cn(buttonClass.primary, 'h-8')}><Plus size={14} aria-hidden /> Add block</span>} />
            )}
            <button type="button" className={buttonClass.secondary} onClick={() => { setSnippetTab('all'); snippetsRef.current?.focus() }}><LayoutTemplate size={14} aria-hidden /> Templates</button>
          </div>
        </div>

        {blocks.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-slate-700">This page has no blocks yet</p>
            <p className="mt-1 text-[12px] text-slate-500">Add a hero and some links to get started.</p>
          </div>
        ) : (
          <ol className="mt-3.5 space-y-2" aria-label="Blocks">
            {blocks.map((block, index) => {
              const def = BLOCKS[block.type]
              const Icon = ICONS[def.icon]
              const summaryText = blockSummary(block.type, block.children.length)
              const image = block.type === 'hero' && typeof block.config.imageUrl === 'string' ? block.config.imageUrl : null
              const open = expanded === block.id
              return (
                <li
                  key={block.id}
                  draggable={!readOnly}
                  onDragStart={e => { setDragId(block.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => { if (dragId && dragId !== block.id) e.preventDefault() }}
                  onDrop={e => {
                    e.preventDefault()
                    if (!dragId || dragId === block.id) return
                    const from = blocks.findIndex(b => b.id === dragId)
                    const next = [...blocks]
                    const [moved] = next.splice(from, 1)
                    next.splice(index, 0, moved)
                    setDragId(null)
                    persistOrder(next, blocks)
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={cn('rounded-lg border border-slate-200 bg-white transition-shadow', dragId === block.id && 'opacity-50', open && 'shadow-sm')}
                >
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5">
                    <span className={cn('text-slate-400', !readOnly && 'cursor-grab')} aria-hidden><GripVertical size={15} /></span>
                    <span className="w-3 text-center text-[11px] text-slate-500">{index + 1}</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white text-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Icon size={17} aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-slate-900">{block.title || def.label}</p>
                      <p className="truncate text-[10.5px] text-slate-500">{block.type === 'links' && block.config.style === 'icon' ? 'Icon row style' : def.description}</p>
                    </div>
                    {summaryText && <span className="hidden h-6 items-center rounded-md border border-slate-200 px-2.5 text-[10.5px] text-slate-600 sm:inline-flex">{summaryText}</span>}
                    <button
                      type="button" role="switch" aria-checked={block.isActive} aria-label={`${block.isActive ? 'Hide' : 'Show'} ${def.label}`} disabled={readOnly}
                      onClick={() => toggle(block)}
                      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60', block.isActive ? 'bg-[#1a5cff]' : 'bg-slate-200')}
                    >
                      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', block.isActive ? 'translate-x-[18px]' : 'translate-x-0.5')} />
                    </button>
                    <button type="button" disabled={readOnly || pending} onClick={() => run(() => duplicateBlock({ workspaceType, pageId, blockId: block.id }), { success: 'Block duplicated' })} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40" aria-label={`Duplicate ${def.label}`}><Copy size={15} /></button>
                    <button type="button" disabled={readOnly || pending}
                      onClick={() => {
                        if (!window.confirm(`Delete the ${def.label} block?`)) return
                        const previous = blocks
                        setBlocks(list => list.filter(b => b.id !== block.id))
                        run(async () => { const r = await deleteBlock({ workspaceType, pageId, blockId: block.id }); if (!r.ok) setBlocks(previous); return r }, { success: 'Block deleted' })
                      }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={`Delete ${def.label}`}><Trash2 size={15} /></button>
                    <div className="flex flex-col">
                      <button type="button" disabled={readOnly || index === 0} onClick={() => move(block.id, -1)} className="sr-only focus:not-sr-only focus:rounded focus:px-1 focus:text-[10px]" aria-label={`Move ${def.label} up`}>Up</button>
                      <button type="button" disabled={readOnly || index === blocks.length - 1} onClick={() => move(block.id, 1)} className="sr-only focus:not-sr-only focus:rounded focus:px-1 focus:text-[10px]" aria-label={`Move ${def.label} down`}>Down</button>
                    </div>
                    <button type="button" aria-expanded={open} aria-controls={`block-${block.id}`} onClick={() => setExpanded(open ? null : block.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`${open ? 'Collapse' : 'Edit'} ${def.label}`}>
                      <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
                    </button>
                  </div>
                  {open && (
                    <div id={`block-${block.id}`} className="border-t border-slate-100 px-3.5 py-3">
                      <BlockFields
                        block={block} readOnly={readOnly} lookups={lookups}
                        onConfig={patch => onConfig(block, patch)}
                        onChild={(childId, patch) => onChild(block, childId, patch)}
                        onMoveChild={(childId, direction) => moveChild(block, childId, direction)}
                        onAddChild={() => run(() => upsertChildLink({ workspaceType, pageId, blockId: block.id, title: 'New link', url: 'https://example.com' }), { success: 'Link added' })}
                        onRemoveChild={childId => {
                          const previous = block.children
                          patchBlock(block.id, { children: previous.filter(c => c.id !== childId) })
                          run(async () => { const r = await removeChildLink({ workspaceType, pageId, linkId: childId }); if (!r.ok) patchBlock(block.id, { children: previous }); return r })
                        }}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        {!readOnly && (
          <Menu label="Add section" items={addMenu} className="mt-3" align="left"
            trigger={<span className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-medium text-[#1a5cff] hover:bg-blue-50/40"><Plus size={14} aria-hidden /> Add section</span>} />
        )}
      </section>

      {/* ----------------------------------------------------------- snippets */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-label="Block snippets">
        <h2 className="text-[12px] font-semibold text-slate-900">Block snippets</h2>
        <div ref={snippetsRef} tabIndex={-1} role="tablist" aria-label="Snippet groups" className="mt-2.5 flex gap-4 border-b border-slate-100 text-[11px] outline-none">
          {(['recommended', 'all'] as const).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={snippetTab === tab} onClick={() => setSnippetTab(tab)}
              className={cn('-mb-px border-b-2 pb-1.5 font-medium capitalize', snippetTab === tab ? 'border-[#1a5cff] text-[#1a5cff]' : 'border-transparent text-slate-500 hover:text-slate-800')}>{tab}</button>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {visibleSnippets.map(snippet => {
            const locked = BLOCKS[snippet.type].requires && !capabilities[BLOCKS[snippet.type].requires!]
            return (
              <li key={snippet.id}>
                <button type="button" disabled={readOnly || pending || !!locked} title={locked ? 'Not included in your plan or role.' : `Add ${snippet.label}`}
                  onClick={() => add(snippet.type, snippet.config)}
                  className="w-full rounded-lg border border-slate-200 p-1.5 text-left hover:border-blue-300 hover:bg-blue-50/30 disabled:opacity-50">
                  <SnippetArt kind={snippet.preview} />
                  <span className="mt-1.5 block truncate text-[9.5px] text-slate-700">{snippet.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" onClick={() => setSnippetTab(snippetTab === 'all' ? 'recommended' : 'all')} className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/50 text-[10.5px] font-medium text-[#1a5cff] hover:bg-blue-50">
          <Grid2x2 size={13} aria-hidden /> {snippetTab === 'all' ? 'Show recommended' : 'Browse all templates'}
        </button>
      </section>

      {/* ------------------------------------------------------------ preview */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" aria-label="Live preview">
        <div className="flex items-center justify-between gap-1">
          <h2 className="text-[11px] font-medium text-slate-900">Live preview</h2>
          <div className="flex items-center gap-1" role="group" aria-label="Preview device">
            <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} className={cn('rounded-md p-1.5', device === 'desktop' ? 'bg-[#1a5cff] text-white' : 'text-slate-500 hover:bg-slate-100')} aria-label="Desktop preview"><Monitor size={14} /></button>
            <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} className={cn('rounded-md p-1.5', device === 'mobile' ? 'bg-[#1a5cff] text-white' : 'text-slate-500 hover:bg-slate-100')} aria-label="Mobile preview"><Smartphone size={14} /></button>
            <span className="ml-1 text-[10.5px] text-slate-600">{device === 'mobile' ? 'Mobile' : 'Desktop'}</span>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          {device === 'mobile'
            ? <PhoneFrame width={188}><MicroPage model={model} mode="preview" /></PhoneFrame>
            : <BrowserFrame width={188} height={380} logicalWidth={900}><MicroPage model={model} mode="preview" device="desktop" /></BrowserFrame>}
        </div>
        {livePath
          ? <a href={livePath} target="_blank" rel="noopener" className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[11.5px] font-medium text-[#1a5cff] hover:bg-slate-50">Open live page <ExternalLink size={13} aria-hidden /></a>
          : <p className="mt-3 text-center text-[10.5px] text-slate-500">Publish to get a live URL.</p>}
      </section>
    </div>
  )
}

function SnippetArt({ kind }: { kind: Snippet['preview'] }) {
  const bar = (w: string, c = 'bg-slate-200') => <span className={cn('block h-1 rounded-full', c)} style={{ width: w }} />
  const frame = 'flex h-[50px] w-full flex-col justify-center gap-1 overflow-hidden rounded-md bg-slate-50 px-1.5'
  switch (kind) {
    case 'countdown': return <span className={cn(frame, 'items-center')}><span className="text-[9px] font-semibold tracking-wide text-slate-700">00 : 3 : 00 : 10</span>{bar('70%')}</span>
    case 'video': return <span className={cn(frame, 'items-center bg-slate-900')}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-[7px]">▶</span></span>
    case 'product-grid': case 'product-benefits': return <span className={cn(frame, 'grid grid-cols-3 gap-1 py-1.5')}>{[0, 1, 2].map(i => <span key={i} className="h-full rounded-sm bg-gradient-to-b from-amber-200 to-orange-300" />)}</span>
    case 'link-icons': return <span className={frame}>{[0, 1, 2].map(i => <span key={i} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />{bar('75%')}</span>)}</span>
    case 'feed': return <span className={cn(frame, 'grid grid-cols-3 gap-0.5 py-1')}>{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="rounded-sm bg-gradient-to-br from-orange-200 to-rose-300" />)}</span>
    case 'testimonials': return <span className={frame}><span className="text-[7px] text-amber-400">★★★★★</span>{bar('90%')}{bar('60%')}</span>
    case 'pricing': return <span className={cn(frame, 'grid grid-cols-3 gap-1 py-1.5')}>{[0, 1, 2].map(i => <span key={i} className={cn('rounded-sm border', i === 1 ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white')} />)}</span>
    case 'lead-form': return <span className={frame}>{bar('60%', 'bg-slate-300')}<span className="block h-2 w-full rounded-sm border border-slate-200 bg-white" /><span className="block h-2 w-full rounded-sm bg-slate-800" /></span>
    case 'faq': return <span className={frame}>{[0, 1, 2].map(i => <span key={i} className="flex items-center justify-between">{bar('70%')}<span className="text-[6px] text-slate-400">+</span></span>)}</span>
    case 'footer': return <span className={cn(frame, 'items-center justify-end pb-1.5')}><span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400" />)}</span>{bar('50%')}</span>
    case 'hero-cta': return <span className={frame}>{bar('70%', 'bg-slate-400')}<span className="block h-2 w-full rounded-sm bg-slate-800" /><span className="block h-2 w-full rounded-sm border border-slate-300" /></span>
    case 'before-after': return <span className={cn(frame, 'grid grid-cols-2 gap-0.5 p-1')}><span className="rounded-sm bg-stone-300" /><span className="rounded-sm bg-amber-200" /></span>
    default: return <span className={cn(frame, 'flex-row items-center gap-1.5')}><span className="h-8 w-9 shrink-0 rounded-sm bg-gradient-to-br from-sky-200 to-amber-200" /><span className="flex flex-1 flex-col gap-1">{bar('90%')}{bar('70%')}{bar('80%')}</span></span>
  }
}
