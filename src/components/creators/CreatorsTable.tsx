'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Star, X } from 'lucide-react'
import { useToast } from '@/components/campaigns/Toast'
import { addCreatorToList, toggleShortlist } from '@/lib/creators/actions'
import {
  AVAILABILITY_LABELS, NICHE_LABELS, RELATIONSHIP_LABELS, RIGHTS_READINESS_LABELS,
  type Availability, type RelationshipStatus, type RightsReadiness,
} from '@/lib/creators/constants'
import type { CreatorListRow, CreatorRow } from '@/lib/creators/types'
import { cn } from '@/lib/utils'
import CreatorRowActions from './CreatorRowActions'
import { PlatformIcons } from './PlatformIcon'
import { Avatar, CARD, DotLabel, Pill, TD, TH, type Tone } from './design'

const NICHE_TONE: Record<string, Tone> = {
  beauty: 'red', travel: 'blue', fashion: 'violet', tech: 'blue', wellness: 'green', fitness: 'orange',
  food: 'amber', lifestyle: 'slate', home: 'sky', gaming: 'violet', family: 'red', finance: 'blue', pets: 'green', other: 'slate',
}
const RIGHTS_TONE: Record<string, Tone> = { full: 'green', limited: 'amber', none: 'red' }
const STATUS_TONE: Record<string, Tone> = {
  active: 'green', in_review: 'blue', shortlisted: 'violet', discovered: 'slate', invited: 'blue', invitation_accepted: 'blue',
  onboarding: 'violet', available: 'green', paused: 'amber', unavailable: 'slate', archived: 'slate', blocked: 'red',
}

function compact(n: number) {
  if (n >= 1e6) return `${Number((n / 1e6).toFixed(1))}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`
  return String(n)
}
const money = (n: number | null, currency = 'GBP') => (n === null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n))

export type CreatorWithCounts = CreatorRow & { active_briefs: number }

export default function CreatorsTable({
  creators, lists, basePath, view, canManage, canManageLists, canExport,
}: {
  creators: CreatorWithCounts[]
  lists: CreatorListRow[]
  basePath: string
  view: 'table' | 'cards'
  canManage: boolean
  canManageLists: boolean
  canExport: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const allSelected = creators.length > 0 && selected.length === creators.length

  function toggle(id: string) { setSelected(list => (list.includes(id) ? list.filter(v => v !== id) : [...list, id])) }

  function bulk(label: string, run: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      let failed = 0
      for (const id of selected) {
        const result = await run(id)
        if (!result.ok) failed += 1
      }
      notify(failed ? 'error' : 'success', failed ? `${label}: ${failed} of ${selected.length} failed.` : `${label}: ${selected.length} creator(s) updated.`)
      setSelected([])
      router.refresh()
    })
  }

  function shortlist(creator: CreatorRow) {
    startTransition(async () => {
      const result = await toggleShortlist(creator.id, !creator.shortlisted)
      if (!result.ok) notify('error', result.error ?? 'Could not update the shortlist.')
      router.refresh()
    })
  }

  const bulkBar = selected.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#eef0f4] bg-[#f5f8ff] px-[14px] py-2 text-[11px]" role="region" aria-label="Bulk actions">
      <span className="font-medium text-[#1d4ed8]">{selected.length} selected</span>
      {canManage && (
        <button type="button" disabled={pending} onClick={() => bulk('Added to shortlist', id => toggleShortlist(id, true))}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#c9dafd] bg-white px-2 text-[#1d4ed8] hover:bg-blue-50">
          <Star size={12} />Add to shortlist
        </button>
      )}
      {canManageLists && lists.length > 0 && (
        <label className="inline-flex items-center gap-1">
          <span className="sr-only">Add selected creators to list</span>
          <select disabled={pending} defaultValue=""
            onChange={e => { const listId = e.target.value; e.target.value = ''; if (listId) bulk('Added to list', id => addCreatorToList(listId, id)) }}
            className="h-7 rounded-md border border-[#c9dafd] bg-white px-2 text-[11px] text-[#1d4ed8]">
            <option value="">Add to list…</option>
            {lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </label>
      )}
      {canExport && (
        <a href={`/api/creators/export?entity=creators&ids=${selected.join(',')}`}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#c9dafd] bg-white px-2 text-[#1d4ed8] hover:bg-blue-50">
          <Download size={12} />Export selected
        </a>
      )}
      {pending && <Loader2 size={13} className="animate-spin text-[#1d4ed8]" aria-hidden />}
      <button type="button" onClick={() => setSelected([])} className="ml-auto inline-flex items-center gap-1 text-[#475467] hover:text-[#101828]">
        <X size={12} />Clear
      </button>
    </div>
  )

  if (view === 'cards') {
    return (
      <>
        {bulkBar}
        <ul className="grid grid-cols-1 gap-3 p-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {creators.map(creator => (
            <li key={creator.id} className={cn(CARD, 'relative p-[14px]')}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected.includes(creator.id)} onChange={() => toggle(creator.id)} aria-label={`Select ${creator.name}`} className="mt-1 rounded border-slate-300" />
                <Avatar name={creator.name} src={creator.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <Link href={`${basePath}/creators/${creator.id}`} className="block truncate text-[12.5px] font-semibold text-[#101828] hover:underline">{creator.name}</Link>
                  <p className="truncate text-[10.5px] text-[#8a94a6]">@{creator.handle ?? '—'} · {creator.region ?? '—'}</p>
                </div>
                <CreatorRowActions creator={creator} lists={lists} canManage={canManage} canManageLists={canManageLists} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {creator.niche && <Pill tone={NICHE_TONE[creator.niche] ?? 'slate'}>{NICHE_LABELS[creator.niche] ?? creator.niche}</Pill>}
                <Pill tone={RIGHTS_TONE[creator.rights_readiness] ?? 'slate'}>{RIGHTS_READINESS_LABELS[creator.rights_readiness as RightsReadiness] ?? creator.rights_readiness}</Pill>
                <PlatformIcons platforms={creator.platforms} size={15} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div><dt className="text-[#8a94a6]">Audience</dt><dd className="font-semibold text-[#101828]">{compact(creator.audience_size)}</dd></div>
                <div><dt className="text-[#8a94a6]">Eng. rate</dt><dd className="font-semibold text-[#101828]">{Number(creator.engagement_rate).toFixed(1)}%</dd></div>
                <div><dt className="text-[#8a94a6]">Rate card</dt><dd className="font-semibold text-[#101828]">{money(creator.avg_rate, creator.currency ?? 'GBP')}</dd></div>
              </dl>
              <div className="mt-3 flex items-center justify-between text-[10px] text-[#475467]">
                <span>{AVAILABILITY_LABELS[creator.availability as Availability] ?? creator.availability} · Fit {creator.campaign_fit}%</span>
                <Pill tone={STATUS_TONE[creator.relationship_status] ?? 'slate'}>{RELATIONSHIP_LABELS[creator.relationship_status as RelationshipStatus] ?? creator.relationship_status}</Pill>
              </div>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      {bulkBar}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[800px] [&_td]:px-[9px] [&_th]:px-[9px]">
          <caption className="sr-only">Creators</caption>
          <thead className="border-b border-[#eef0f4]">
            <tr className="h-[44px]">
              <th scope="col" className={cn(TH, 'w-[34px] pl-[14px] pr-0')}>
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : creators.map(c => c.id))} aria-label="Select all creators on this page" className="rounded border-slate-300" />
              </th>
              {['Creator', 'Niche', 'Audience', 'Region', 'Platforms', 'Eng. Rate', 'Avg. Rate Card', 'Active Briefs', 'Rights', 'Workflow Status'].map(h => (
                <th key={h} scope="col" className={cn(TH, h === 'Active Briefs' && 'text-center')}>{h}</th>
              ))}
              <th scope="col" className={TH}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {creators.map(creator => {
              const status = creator.relationship_status
              return (
                <tr key={creator.id} className={cn('h-[45.5px] border-b border-[#f1f3f6] last:border-0 hover:bg-[#fafbfd]', selected.includes(creator.id) && 'bg-[#f5f8ff]')}>
                  <td className={cn(TD, 'pl-[14px] pr-0')}>
                    <input type="checkbox" checked={selected.includes(creator.id)} onChange={() => toggle(creator.id)} aria-label={`Select ${creator.name}`} className="rounded border-slate-300" />
                  </td>
                  <td className={TD}>
                    <Link href={`${basePath}/creators/${creator.id}`} className="flex items-center gap-[10px] hover:opacity-85">
                      <Avatar name={creator.name} src={creator.avatar_url} size={30} />
                      <span className="leading-tight">
                        <span className="block text-[11px] font-medium text-[#101828]">{creator.name}</span>
                        <span className="block text-[9.5px] text-[#8a94a6]">@{creator.handle ?? '—'}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={TD}>{creator.niche ? <Pill tone={NICHE_TONE[creator.niche] ?? 'slate'}>{NICHE_LABELS[creator.niche] ?? creator.niche}</Pill> : '—'}</td>
                  <td className={cn(TD, 'tabular-nums')}>{compact(creator.audience_size)}</td>
                  <td className={TD}>{creator.region ?? '—'}</td>
                  <td className={TD}><PlatformIcons platforms={creator.platforms} /></td>
                  <td className={cn(TD, 'tabular-nums')}>{Number(creator.engagement_rate).toFixed(1)}%</td>
                  <td className={cn(TD, 'tabular-nums')}>{money(creator.avg_rate, creator.currency ?? 'GBP')}</td>
                  <td className={cn(TD, 'text-center tabular-nums')}>{creator.active_briefs}</td>
                  <td className={TD}><Pill tone={RIGHTS_TONE[creator.rights_readiness] ?? 'slate'}>{RIGHTS_READINESS_LABELS[creator.rights_readiness as RightsReadiness] ?? creator.rights_readiness}</Pill></td>
                  <td className={TD}>
                    <Pill tone={STATUS_TONE[status] ?? 'slate'}>
                      {status === 'active' ? <DotLabel tone="green">Active</DotLabel> : RELATIONSHIP_LABELS[status as RelationshipStatus] ?? status}
                    </Pill>
                  </td>
                  <td className={cn(TD, 'pr-[14px] text-right')}>
                    {creator.shortlisted && canManage ? (
                      <button type="button" disabled={pending} onClick={() => shortlist(creator)} aria-label={`Remove ${creator.name} from shortlist`} aria-pressed
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#1d6bf3] hover:bg-blue-50">
                        <Star size={15} />
                      </button>
                    ) : (
                      <CreatorRowActions creator={creator} lists={lists} canManage={canManage} canManageLists={canManageLists} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
