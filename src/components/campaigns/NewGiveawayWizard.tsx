'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import WizardDialog, { ChipGroup, WIZARD_FIELD, WIZARD_LABEL, type WizardStep } from './wizard'
import { createGiveaway } from '@/app/app/campaigns/entity-actions'
import { GIVEAWAY_ENTRY_METHODS, GIVEAWAY_ENTRY_LABELS } from '@/lib/constants'
import { CAMPAIGN_CHANNELS, CHANNEL_LABELS } from '@/lib/campaigns/constants'
import type { PersonLite } from '@/lib/campaigns/types'

const ISO = /^\d{4}-\d{2}-\d{2}$/

const COUNTRIES = ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'FR', 'DE', 'ES', 'IT', 'NL']

interface Draft {
  title: string
  description: string
  prizeTitle: string
  prizeDescription: string
  prizeValue: string
  prizeQuantity: string
  fulfilmentOwner: string
  entryMethods: string[]
  entryHashtag: string
  maxEntries: string
  minFollowers: string
  countries: string[]
  startDate: string
  endDate: string
  channels: string[]
  winnerCount: string
  winnerSelection: string
  rules: string
  termsUrl: string
}

const EMPTY: Draft = {
  title: '', description: '', prizeTitle: '', prizeDescription: '', prizeValue: '',
  prizeQuantity: '1', fulfilmentOwner: '', entryMethods: [], entryHashtag: '',
  maxEntries: '1', minFollowers: '0', countries: ['GB'], startDate: '', endDate: '',
  channels: [], winnerCount: '1', winnerSelection: 'random', rules: '', termsUrl: '',
}

export default function NewGiveawayWizard({ members, className }: { members: PersonLite[]; className?: string }) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDirty(true)
    setDraft(current => ({ ...current, [key]: value }))
  }

  const steps: WizardStep[] = [
    {
      id: 'basics', label: 'Basics',
      validate: () => {
        if (!draft.title.trim()) return 'Give the giveaway a name.'
        if (draft.title.trim().length > 140) return 'The name must be 140 characters or fewer.'
        return null
      },
      render: () => (
        <>
          <label className="block">
            <span className={WIZARD_LABEL}>Giveaway name <span className="text-red-500">*</span></span>
            <input
              value={draft.title} onChange={e => set('title', e.target.value)} maxLength={140}
              className={WIZARD_FIELD} placeholder="e.g. Summer Sneakers Giveaway" autoFocus
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Description <span className="text-slate-400">(optional)</span></span>
            <textarea
              value={draft.description} onChange={e => set('description', e.target.value)} rows={2} maxLength={2000}
              className={cn(WIZARD_FIELD, 'h-auto py-2')} placeholder="What is this giveaway promoting?"
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Owner</span>
            <select value={draft.fulfilmentOwner} onChange={e => set('fulfilmentOwner', e.target.value)} className={WIZARD_FIELD}>
              <option value="">Assign to me</option>
              {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
            </select>
          </label>
        </>
      ),
    },
    {
      id: 'prize', label: 'Prize & fulfilment',
      validate: () => {
        if (!draft.prizeTitle.trim()) return 'Describe the prize entrants are competing for.'
        if (draft.prizeValue && !Number.isFinite(Number(draft.prizeValue))) return 'Prize value must be a number.'
        const winners = Number(draft.winnerCount)
        if (!Number.isInteger(winners) || winners < 1) return 'There must be at least one winner.'
        return null
      },
      render: () => (
        <>
          <label className="block">
            <span className={WIZARD_LABEL}>Prize <span className="text-red-500">*</span></span>
            <input
              value={draft.prizeTitle} onChange={e => set('prizeTitle', e.target.value)} maxLength={200}
              className={WIZARD_FIELD} placeholder="e.g. A pair of Nike Air Max"
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Prize details <span className="text-slate-400">(optional)</span></span>
            <textarea
              value={draft.prizeDescription} onChange={e => set('prizeDescription', e.target.value)} rows={2} maxLength={2000}
              className={cn(WIZARD_FIELD, 'h-auto py-2')} placeholder="Sizes, colours, delivery expectations…"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={WIZARD_LABEL}>Prize value (GBP)</span>
              <input type="number" min="0" value={draft.prizeValue} onChange={e => set('prizeValue', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Prize quantity</span>
              <input type="number" min="1" value={draft.prizeQuantity} onChange={e => set('prizeQuantity', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Number of winners</span>
              <input type="number" min="1" value={draft.winnerCount} onChange={e => set('winnerCount', e.target.value)} className={WIZARD_FIELD} />
            </label>
          </div>
          <label className="block">
            <span className={WIZARD_LABEL}>Winner selection</span>
            <select value={draft.winnerSelection} onChange={e => set('winnerSelection', e.target.value)} className={WIZARD_FIELD}>
              <option value="random">Random draw from valid entries</option>
              <option value="manual">Manual selection by the team</option>
            </select>
          </label>
        </>
      ),
    },
    {
      id: 'entry', label: 'Entry rules',
      validate: () => {
        if (draft.entryMethods.length === 0) return 'Choose at least one way for people to enter.'
        if (Number(draft.maxEntries) < 1) return 'Entrants must be allowed at least one entry.'
        return null
      },
      render: () => (
        <>
          <ChipGroup
            legend="How can people enter? *"
            options={GIVEAWAY_ENTRY_METHODS.map(method => ({ value: method, label: GIVEAWAY_ENTRY_LABELS[method] }))}
            value={draft.entryMethods}
            onChange={value => set('entryMethods', value)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={WIZARD_LABEL}>Entry hashtag</span>
              <input value={draft.entryHashtag} onChange={e => set('entryHashtag', e.target.value)} className={WIZARD_FIELD} placeholder="#summerwin" />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Max entries per person</span>
              <input type="number" min="1" value={draft.maxEntries} onChange={e => set('maxEntries', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Minimum followers</span>
              <input type="number" min="0" value={draft.minFollowers} onChange={e => set('minFollowers', e.target.value)} className={WIZARD_FIELD} />
            </label>
          </div>
          <ChipGroup
            legend="Eligible countries"
            options={COUNTRIES.map(code => ({ value: code, label: code }))}
            value={draft.countries}
            onChange={value => set('countries', value)}
          />
        </>
      ),
    },
    {
      id: 'schedule', label: 'Dates & review',
      validate: () => {
        if (!ISO.test(draft.startDate)) return 'Choose a start date.'
        if (!ISO.test(draft.endDate)) return 'Choose an end date.'
        if (draft.endDate < draft.startDate) return 'The end date cannot be before the start date.'
        if (draft.termsUrl && !/^https?:\/\/\S+$/i.test(draft.termsUrl)) return 'The terms link must start with http:// or https://.'
        return null
      },
      render: () => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={WIZARD_LABEL}>Start date <span className="text-red-500">*</span></span>
              <input type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>End date <span className="text-red-500">*</span></span>
              <input type="date" value={draft.endDate} min={draft.startDate || undefined} onChange={e => set('endDate', e.target.value)} className={WIZARD_FIELD} />
            </label>
          </div>
          <ChipGroup
            legend="Channels"
            options={CAMPAIGN_CHANNELS.map(channel => ({ value: channel, label: CHANNEL_LABELS[channel] }))}
            value={draft.channels}
            onChange={value => set('channels', value)}
          />
          <label className="block">
            <span className={WIZARD_LABEL}>Terms &amp; conditions URL</span>
            <input
              type="url" value={draft.termsUrl} onChange={e => set('termsUrl', e.target.value)}
              className={WIZARD_FIELD} placeholder="https://example.com/giveaway-terms"
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Rules summary <span className="text-slate-400">(shown to entrants)</span></span>
            <textarea
              value={draft.rules} onChange={e => set('rules', e.target.value)} rows={3} maxLength={5000}
              className={cn(WIZARD_FIELD, 'h-auto py-2')}
              placeholder="Eligibility, age restrictions, how and when winners are contacted…"
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[12px] text-slate-600">
            <p className="mb-1 font-medium text-slate-900">Review</p>
            <p>
              <strong>{draft.title || 'Untitled giveaway'}</strong> — {draft.prizeTitle || 'no prize set'} ·{' '}
              {draft.winnerCount} winner{Number(draft.winnerCount) === 1 ? '' : 's'} ·{' '}
              {draft.entryMethods.length} entry method{draft.entryMethods.length === 1 ? '' : 's'} ·{' '}
              {draft.startDate || '—'} to {draft.endDate || '—'}
            </p>
            <p className="mt-1 text-slate-500">
              The giveaway is created as a draft. Publish it from the giveaway page once you are happy with the setup.
            </p>
          </div>
        </>
      ),
    },
  ]

  function submit() {
    startTransition(async () => {
      const result = await createGiveaway({
        title: draft.title,
        description: draft.description,
        prize_title: draft.prizeTitle,
        prize_description: draft.prizeDescription,
        prize_value: draft.prizeValue,
        prize_quantity: draft.prizeQuantity,
        start_date: draft.startDate,
        end_date: draft.endDate,
        entry_methods: draft.entryMethods,
        entry_hashtag: draft.entryHashtag,
        max_entries_per_person: draft.maxEntries,
        min_followers_required: draft.minFollowers,
        eligible_countries: draft.countries,
        winner_count: draft.winnerCount,
        winner_selection: draft.winnerSelection,
        channels: draft.channels,
        rules: draft.rules,
        terms_url: draft.termsUrl,
        owner_id: draft.fulfilmentOwner,
      })

      if (!result.ok) { setError(result.error ?? 'Could not create the giveaway.'); return }
      notify('success', result.message ?? 'Giveaway created.')
      setOpen(false); setDraft(EMPTY); setDirty(false); setError(null)
      router.refresh()
      if (result.id) router.push(`/app/campaigns/giveaways/${result.id}`)
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700', className)}
      >
        <Plus size={15} />
        New giveaway
      </button>
      <WizardDialog
        open={open}
        title="New giveaway"
        description="Set up the prize, entry rules and schedule. The giveaway is created as a draft."
        steps={steps}
        submitLabel="Create giveaway"
        pending={pending}
        error={error}
        dirty={dirty}
        onClose={() => { setOpen(false); setError(null) }}
        onSubmit={submit}
      />
    </>
  )
}
