'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, Copy, Eye, History, Link2, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compact, percent, shortDate } from '@/lib/link-in-bio/format'
import { duplicatePage, setPageLifecycle, setReusableLinkStatus } from '@/lib/link-in-bio/actions'
import type { LibraryRow } from '@/lib/link-in-bio/server/collections'
import PageThumb from '../PageThumb'
import { Avatar, Chip, EmptyState, StatusBadge } from '../ui'
import { CopyText, Menu, useAction, type MenuItem } from '../client'
import { notify } from '../feedback'

const TYPE_LABEL = { link_page: 'Link Page', conversion_page: 'Conversion Page', reusable_link: 'Reusable Link' } as const

type Caps = { edit: boolean; archive: boolean; publish: boolean; create: boolean; reusable: boolean }

export default function LibraryResults({ rows, view, workspaceType, caps, basePath, hasFilters }: {
  rows: LibraryRow[]; view: 'cards' | 'table'; workspaceType: string; caps: Caps; basePath: string; hasFilters: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { run, pending } = useAction()
  const router = useRouter()

  const toggle = (id: string) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const menuFor = (row: LibraryRow): MenuItem[] => {
    if (row.recordType === 'reusable_link') {
      return [
        { label: 'Open', href: row.href },
        { label: 'Analytics', href: `${row.href}/analytics` },
        { label: row.status === 'active' ? 'Disable link' : 'Enable link', disabledReason: caps.reusable ? null : 'Your role cannot manage reusable links.', onSelect: () => run(() => setReusableLinkStatus({ workspaceType, linkId: row.id, status: row.status === 'active' ? 'paused' : 'active' }), { success: 'Link updated' }) },
        row.status === 'archived'
          ? { label: 'Restore', disabledReason: caps.reusable ? null : 'Your role cannot manage reusable links.', onSelect: () => run(() => setReusableLinkStatus({ workspaceType, linkId: row.id, status: 'restore' }), { success: 'Link restored' }) }
          : { label: 'Archive', danger: true, disabledReason: caps.reusable ? null : 'Your role cannot manage reusable links.', onSelect: () => run(() => setReusableLinkStatus({ workspaceType, linkId: row.id, status: 'archived' }), { success: 'Link archived', confirm: `Archive “${row.title}”? Its short URL stops redirecting.` }) },
      ]
    }
    return [
      { label: 'Open', href: row.href },
      { label: 'Preview live page', href: row.publicUrl ?? '#', external: true, disabledReason: row.status === 'published' ? null : 'Only published pages have a live URL.' },
      { label: 'Duplicate', disabledReason: caps.create ? null : 'Your role cannot create pages.', onSelect: () => run(() => duplicatePage({ workspaceType, pageId: row.id }), { success: 'Page duplicated' }, data => router.push(`${basePath}/pages/${data.id}/design`)) },
      { label: 'Settings', href: `${basePath}/pages/${row.id}/settings` },
      ...(row.status === 'published' ? [{ label: 'Unpublish', disabledReason: caps.publish ? null : 'Your role cannot publish pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId: row.id, action: 'unpublish' }), { success: 'Page unpublished', confirm: `Unpublish “${row.title}”? Visitors will see a not-found page.` }) }] : []),
      row.status === 'archived'
        ? { label: 'Restore', disabledReason: caps.archive ? null : 'Your role cannot archive pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId: row.id, action: 'restore' }), { success: 'Page restored' }) }
        : { label: 'Archive', danger: true, disabledReason: caps.archive ? null : 'Your role cannot archive pages.', onSelect: () => run(() => setPageLifecycle({ workspaceType, pageId: row.id, action: 'archive' }), { success: 'Page archived', confirm: `Archive “${row.title}”? It will be unpublished and become read-only.` }) },
    ]
  }

  const bulkArchive = () => {
    const ids = rows.filter(r => selected.has(r.id) && r.recordType !== 'reusable_link' && r.status !== 'archived').map(r => r.id)
    if (!ids.length) { notify('Select pages that are not already archived.', 'error'); return }
    run(async () => {
      for (const id of ids) {
        const result = await setPageLifecycle({ workspaceType, pageId: id, action: 'archive' })
        if (!result.ok) return result
      }
      return { ok: true as const, data: undefined }
    }, { success: `${ids.length} ${ids.length === 1 ? 'page' : 'pages'} archived`, confirm: `Archive ${ids.length} selected ${ids.length === 1 ? 'page' : 'pages'}?` }, () => setSelected(new Set()))
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Link2 size={28} />}
        title={hasFilters ? 'No results match these filters' : 'No link pages yet'}
        description={hasFilters ? 'Try a different search or clear the filters to see everything in the library.' : 'Create a link page to share everything your audience needs from one link.'}
        action={hasFilters ? <Link href={basePath + '/library'} className="text-[12.5px] font-medium text-[#1a5cff] hover:underline">Clear filters</Link>
          : caps.create ? <Link href={`${basePath}/new`} className="inline-flex h-8 items-center rounded-lg bg-[#1a5cff] px-3.5 text-[12.5px] font-medium text-white">New link page</Link> : undefined}
      />
    )
  }

  const bulkBar = selected.size > 0 && (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-[12.5px] text-blue-900" role="region" aria-label="Bulk actions">
      <span>{selected.size} selected</span>
      <div className="flex items-center gap-3">
        <button type="button" disabled={pending || !caps.archive} title={caps.archive ? undefined : 'Your role cannot archive pages.'} onClick={bulkArchive} className="font-medium text-red-600 disabled:opacity-50">Archive</button>
        <button type="button" onClick={() => setSelected(new Set())} className="font-medium text-blue-700">Clear selection</button>
      </div>
    </div>
  )

  if (view === 'table') {
    return (
      <>
        {bulkBar}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead className="border-b border-slate-100 text-[11px] text-slate-500">
              <tr>
                <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th>
                <th scope="col" className="px-2 py-2.5 font-medium">Name</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Owner</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">Clicks (30d)</th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">CTR</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Updated</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Theme</th>
                <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${row.title}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} className="h-3.5 w-3.5 rounded border-slate-300" /></td>
                  <td className="px-2 py-2">
                    <Link href={row.href} className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-[#1a5cff]">
                      <PageThumb thumb={row.thumb} size="row" className="h-7 w-10 shrink-0" />
                      <span className="min-w-0"><span className="block truncate">{row.title}</span>{row.publicUrl && <span className="block truncate text-[10.5px] font-normal text-slate-500">{row.publicUrl}</span>}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-slate-600">{TYPE_LABEL[row.recordType]}</td>
                  <td className="px-2 py-2"><span className="inline-flex items-center gap-1.5 text-slate-600"><Avatar member={row.owner} size={18} />{row.owner?.name ?? 'System'}</span></td>
                  <td className="px-2 py-2"><StatusBadge status={row.status} /></td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-800">{compact(row.clicks)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-800">{percent(row.ctr)}</td>
                  <td className="px-2 py-2 text-slate-600">{shortDate(row.updatedAt)}</td>
                  <td className="px-2 py-2 text-slate-600">{row.themeName ?? '—'}</td>
                  <td className="px-2 py-2"><Menu label={`Actions for ${row.title}`} items={menuFor(row)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  const iconButton = 'inline-flex h-[30px] flex-1 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <>
      {bulkBar}
      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(row => (
          <li key={row.id} className="relative flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="relative">
              <Link href={row.href} tabIndex={-1} aria-hidden className="block">
                <PageThumb thumb={row.thumb} className="h-[102px] w-full" />
              </Link>
              <input
                type="checkbox" aria-label={`Select ${row.title}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)}
                className="absolute left-2 top-2 h-4 w-4 cursor-pointer rounded border-white/80 bg-white/90 accent-[#1a5cff]"
              />
            </div>
            <div className="absolute right-1 top-1.5">
              <Menu label={`Actions for ${row.title}`} items={menuFor(row)} trigger={<span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">⋮</span>} />
            </div>
            <div className="px-1.5 pt-2.5">
              <Link href={row.href} className="block truncate text-[13.5px] font-semibold text-slate-900 hover:text-[#1a5cff]">{row.title}</Link>
              <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-slate-500">
                <span className="shrink-0">{TYPE_LABEL[row.recordType]}</span>
                <span className="inline-flex min-w-0 items-center gap-1.5"><Avatar member={row.owner} size={16} /><span className="truncate">{row.owner?.name ?? 'System'}</span></span>
                <StatusBadge status={row.status} label={row.status === 'published' && row.recordType === 'conversion_page' ? 'Live' : undefined} className="ml-auto" />
              </div>
              <div className="mt-2 flex h-[19px] flex-wrap gap-1.5 overflow-hidden">{row.tags.slice(0, 3).map(tag => <Chip key={tag}>{tag}</Chip>)}</div>
              <dl className="mt-3 grid grid-cols-[auto_auto_1fr_1fr] gap-x-3 text-[10px]">
                <div><dt className="text-slate-500">Clicks</dt><dd className="mt-0.5 text-[11px] font-medium text-slate-800 tabular-nums">{compact(row.clicks)}</dd></div>
                <div><dt className="text-slate-500">CTR</dt><dd className="mt-0.5 text-[11px] font-medium text-slate-800 tabular-nums">{percent(row.ctr)}</dd></div>
                <div className="border-l border-slate-100 pl-3"><dt className="text-slate-500">Updated</dt><dd className="mt-0.5 truncate text-[11px] font-medium text-slate-800">{shortDate(row.updatedAt)}</dd></div>
                <div className="border-l border-slate-100 pl-3"><dt className="text-slate-500">Theme</dt><dd className="mt-0.5 truncate text-[11px] font-medium text-slate-800">{row.themeName ?? '—'}</dd></div>
              </dl>
            </div>
            <div className="mt-3 flex gap-1.5 px-1.5 pb-1">
              {row.publicUrl && row.status === 'published'
                ? <a href={row.publicUrl} target="_blank" rel="noopener" className={iconButton} aria-label={`Preview ${row.title}`} title="Preview"><Eye size={14} /></a>
                : <Link href={row.href} className={iconButton} aria-label={`Open ${row.title}`} title="Open"><Eye size={14} /></Link>}
              <Link href={row.recordType === 'reusable_link' ? `${row.href}/analytics` : `${basePath}/pages/${row.id}/analytics`} className={iconButton} aria-label={`Analytics for ${row.title}`} title="Analytics"><BarChart3 size={14} /></Link>
              <button type="button" disabled={pending || !caps.create || row.recordType === 'reusable_link'} onClick={() => run(() => duplicatePage({ workspaceType, pageId: row.id }), { success: 'Page duplicated' }, data => router.push(`${basePath}/pages/${data.id}/design`))} className={iconButton} aria-label={`Duplicate ${row.title}`} title={caps.create ? 'Duplicate' : 'Your role cannot create pages.'}><Copy size={14} /></button>
              {row.publicUrl
                ? <CopyText value={row.publicUrl} label={`Copy link to ${row.title}`} className={iconButton}><Share2 size={14} /></CopyText>
                : <button type="button" disabled className={iconButton} title="No public URL yet"><Share2 size={14} /></button>}
              <Link href={row.recordType === 'reusable_link' ? `${row.href}/versions` : `${basePath}/pages/${row.id}/versions`} className={iconButton} aria-label={`Version history for ${row.title}`} title="Versions"><History size={14} /></Link>
              <Menu label={`More actions for ${row.title}`} items={menuFor(row)} className="flex flex-1" trigger={<span className={cn(iconButton, 'w-full')}>···</span>} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
