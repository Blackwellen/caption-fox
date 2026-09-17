'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, Eye, Palette, Pencil } from 'lucide-react'
import { signedPercent, shortDate } from '@/lib/link-in-bio/format'
import { duplicateTheme, publishTheme, setThemeLifecycle } from '@/lib/link-in-bio/actions'
import type { ThemeRow } from '@/lib/link-in-bio/server/collections'
import { Avatar, EmptyState, StatusBadge } from '../ui'
import { Menu, useAction, type MenuItem } from '../client'
import { ThemePhoneThumb, ThemeSwatch } from './ThemeVisuals'

type Caps = { manage: boolean; publish: boolean }

export default function ThemeResults({ rows, view, basePath, workspaceType, caps, hasFilters }: {
  rows: ThemeRow[]; view: 'cards' | 'table'; basePath: string; workspaceType: string; caps: Caps; hasFilters: boolean
}) {
  const { run, pending } = useAction()
  const router = useRouter()

  const menu = (theme: ThemeRow): MenuItem[] => [
    { label: 'Open editor', href: `${basePath}/themes/${theme.id}/editor` },
    { label: 'Pages using theme', href: `${basePath}/themes/${theme.id}/pages` },
    { label: 'Duplicate', disabledReason: caps.manage ? null : 'Your role cannot create themes.', onSelect: () => run(() => duplicateTheme({ workspaceType, themeId: theme.id }), { success: 'Theme duplicated' }, data => router.push(`${basePath}/themes/${data.id}/editor`)) },
    ...(theme.approvalStatus === 'pending' && caps.publish ? [{ label: 'Approve', onSelect: () => run(() => setThemeLifecycle({ workspaceType, themeId: theme.id, action: 'approve' }), { success: 'Theme approved' }) }] : []),
    { label: 'Publish', disabledReason: caps.publish ? (theme.archivedAt ? 'Restore the theme first.' : null) : 'Your role cannot publish themes.', onSelect: () => run(() => publishTheme({ workspaceType, themeId: theme.id }), { success: 'Theme published' }) },
    theme.archivedAt
      ? { label: 'Restore', disabledReason: caps.manage ? null : 'Your role cannot manage themes.', onSelect: () => run(() => setThemeLifecycle({ workspaceType, themeId: theme.id, action: 'restore' }), { success: 'Theme restored' }) }
      : { label: 'Archive', danger: true, disabledReason: caps.manage ? (theme.pages > 0 ? `Used by ${theme.pages} ${theme.pages === 1 ? 'page' : 'pages'}. Move them to another theme first.` : null) : 'Your role cannot manage themes.', onSelect: () => run(() => setThemeLifecycle({ workspaceType, themeId: theme.id, action: 'archive' }), { success: 'Theme archived', confirm: `Archive “${theme.name}”?` }) },
  ]

  const statusOf = (theme: ThemeRow) => theme.archivedAt ? 'archived' : theme.approvalStatus === 'pending' ? 'review' : theme.status

  if (rows.length === 0) {
    return (
      <EmptyState icon={<Palette size={28} />} title={hasFilters ? 'No themes match these filters' : 'No themes yet'}
        description={hasFilters ? 'Try a different search or clear the filters.' : 'Create a theme to give every link page a consistent, on-brand look.'}
        action={hasFilters ? <Link href={`${basePath}/themes`} className="text-[12.5px] font-medium text-[#1a5cff] hover:underline">Clear filters</Link>
          : caps.manage ? <Link href={`${basePath}/themes/new`} className="inline-flex h-8 items-center rounded-lg bg-[#1a5cff] px-3.5 text-[12.5px] font-medium text-white">Create theme</Link> : undefined} />
    )
  }

  if (view === 'table') {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead className="border-b border-slate-100 text-[11px] text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Theme</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Category</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Owner</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">Pages</th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">Avg CTR uplift</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Updated</th>
              <th scope="col" className="w-10 px-2 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(theme => (
              <tr key={theme.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2"><Link href={`${basePath}/themes/${theme.id}/editor`} className="flex items-center gap-2.5 font-medium text-slate-900 hover:text-[#1a5cff]"><ThemeSwatch tokens={theme.tokens} />{theme.name}</Link></td>
                <td className="px-2 py-2 text-slate-600">{[theme.category, ...theme.tags].filter(Boolean).join(' · ')}</td>
                <td className="px-2 py-2"><span className="inline-flex items-center gap-1.5 text-slate-600"><Avatar member={theme.owner} size={18} />{theme.owner?.name ?? 'System'}</span></td>
                <td className="px-2 py-2"><StatusBadge status={statusOf(theme)} /></td>
                <td className="px-2 py-2 text-right tabular-nums">{theme.pages}</td>
                <td className="px-2 py-2 text-right tabular-nums">{signedPercent(theme.uplift)}</td>
                <td className="px-2 py-2 text-slate-600">{shortDate(theme.updatedAt)}</td>
                <td className="px-2 py-2"><Menu label={`Actions for ${theme.name}`} items={menu(theme)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const iconButton = 'inline-flex h-[30px] flex-1 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(theme => (
        <li key={theme.id} className="relative flex min-w-0 flex-col rounded-xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Link href={`${basePath}/themes/${theme.id}/editor`} aria-label={`Open ${theme.name}`}><ThemePhoneThumb tokens={theme.tokens} name={theme.name} /></Link>
          <div className="absolute right-1 top-1.5">
            <Menu label={`Actions for ${theme.name}`} items={menu(theme)} trigger={<span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">⋮</span>} />
          </div>
          <div className="px-1.5 pt-2.5">
            <Link href={`${basePath}/themes/${theme.id}/editor`} className="block truncate text-[13.5px] font-semibold text-slate-900 hover:text-[#1a5cff]">{theme.name}</Link>
            <p className="mt-1 truncate text-[10.5px] text-slate-500">{[theme.category, ...theme.tags].filter(Boolean).join('  ·  ')}</p>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600">
              <Avatar member={theme.owner} size={18} /><span className="truncate">{theme.owner?.name ?? 'System'}</span>
              <StatusBadge status={statusOf(theme)} className="ml-auto" />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              <div><dt className="text-slate-500">Pages</dt><dd className="mt-0.5 text-[11px] font-medium text-slate-800 tabular-nums">{theme.pages}</dd></div>
              <div><dt className="text-slate-500">Avg CTR uplift</dt><dd className="mt-0.5 text-[11px] font-medium text-slate-800 tabular-nums">{signedPercent(theme.uplift)}</dd></div>
              <div><dt className="text-slate-500">Updated</dt><dd className="mt-0.5 truncate text-[11px] font-medium text-slate-800">{shortDate(theme.updatedAt)}</dd></div>
            </dl>
          </div>
          <div className="mt-3 flex gap-1.5 px-1.5 pb-1">
            <Link href={`${basePath}/themes/${theme.id}/overview`} className={iconButton} aria-label={`Preview ${theme.name}`} title="Preview"><Eye size={14} /></Link>
            <button type="button" disabled={pending || !caps.manage} onClick={() => run(() => duplicateTheme({ workspaceType, themeId: theme.id }), { success: 'Theme duplicated' }, data => router.push(`${basePath}/themes/${data.id}/editor`))} className={iconButton} aria-label={`Duplicate ${theme.name}`} title={caps.manage ? 'Duplicate' : 'Your role cannot create themes.'}><Copy size={14} /></button>
            <Link href={`${basePath}/themes/${theme.id}/editor`} className={iconButton} aria-label={`Edit ${theme.name}`} title="Edit"><Pencil size={14} /></Link>
            <Menu label={`More actions for ${theme.name}`} items={menu(theme)} className="flex flex-1" trigger={<span className={`${iconButton} w-full`}>···</span>} />
          </div>
        </li>
      ))}
    </ul>
  )
}
