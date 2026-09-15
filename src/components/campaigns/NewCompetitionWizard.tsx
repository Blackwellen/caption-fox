'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import WizardDialog, { ChipGroup, WIZARD_FIELD, WIZARD_LABEL, type WizardStep } from './wizard'
import { createCompetition } from '@/app/app/campaigns/entity-actions'
import { COMPETITION_TYPES, COMPETITION_TYPE_LABELS } from '@/lib/constants'
import { CAMPAIGN_CHANNELS, CHANNEL_LABELS } from '@/lib/campaigns/constants'
import type { PersonLite } from '@/lib/campaigns/types'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const COUNTRIES = ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'FR', 'DE', 'ES', 'IT', 'NL']

interface Draft {
  title: string
  description: string
  type: string
  ownerId: string
  startDate: string
  endDate: string
  submissionDeadline: string
  prizeTitle: string
  prizeValue: string
  judgingType: string
  maxSubmissions: string
  minAge: string
  countries: string[]
  hashtag: string
  channels: string[]
  rules: string
  termsUrl: string
}

const EMPTY: Draft = {
  title: '', description: '', type: 'photo', ownerId: '', startDate: '', endDate: '',
  submissionDeadline: '', prizeTitle: '', prizeValue: '', judgingType: 'panel',
  maxSubmissions: '1', minAge: '18', countries: ['GB'], hashtag: '', channels: [],
  rules: '', termsUrl: '',
}

export default function NewCompetitionWizard({ members, className }: { members: PersonLite[]; className?: string }) {
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
        if (!draft.title.trim()) return 'Give the competition a name.'
        if (draft.title.trim().length > 140) return 'The name must be 140 characters or fewer.'
        return null
      },
      render: () => (
        <>
          <label className="block">
            <span className={WIZARD_LABEL}>Competition name <span className="text-red-500">*</span></span>
            <input
              value={draft.title} onChange={e => set('title', e.target.value)} maxLength={140}
              className={WIZARD_FIELD} placeholder="e.g. Capture the Adventure" autoFocus
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Description</span>
            <textarea
              value={draft.description} onChange={e => set('description', e.target.value)} rows={2} maxLength={2000}
              className={cn(WIZARD_FIELD, 'h-auto py-2')} placeholder="What are entrants being asked to create?"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={WIZARD_LABEL}>Category <span className="text-red-500">*</span></span>
              <select value={draft.type} onChange={e => set('type', e.target.value)} className={WIZARD_FIELD}>
                {COMPETITION_TYPES.map(type => (
                  <option key={type} value={type}>{COMPETITION_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Owner</span>
              <select value={draft.ownerId} onChange={e => set('ownerId', e.target.value)} className={WIZARD_FIELD}>
                <option value="">Assign to me</option>
                {members.map(member => <option key={member.id} value={member.id}>{member.full_name ?? member.email}</option>)}
              </select>
            </label>
          </div>
        </>
      ),
    },
    {
      id: 'entry', label: 'Entry & eligibility',
      validate: () => {
        if (Number(draft.maxSubmissions) < 1) return 'Entrants must be allowed at least one submission.'
        const age = Number(draft.minAge)
        if (draft.minAge && (!Number.isInteger(age) || age < 0 || age > 120)) return 'Minimum age must be a whole number between 0 and 120.'
        return null
      },
      render: () => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={WIZARD_LABEL}>Max submissions per person</span>
              <input type="number" min="1" value={draft.maxSubmissions} onChange={e => set('maxSubmissions', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Minimum age</span>
              <input type="number" min="0" max="120" value={draft.minAge} onChange={e => set('minAge', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Entry hashtag</span>
              <input value={draft.hashtag} onChange={e => set('hashtag', e.target.value)} className={WIZARD_FIELD} placeholder="#captureit" />
            </label>
          </div>
          <ChipGroup
            legend="Eligible countries"
            options={COUNTRIES.map(code => ({ value: code, label: code }))}
            value={draft.countries}
            onChange={value => set('countries', value)}
          />
          <ChipGroup
            legend="Channels"
            options={CAMPAIGN_CHANNELS.map(channel => ({ value: channel, label: CHANNEL_LABELS[channel] }))}
            value={draft.channels}
            onChange={value => set('channels', value)}
          />
        </>
      ),
    },
    {
      id: 'judging', label: 'Prize & judging',
      validate: () => {
        if (draft.prizeValue && !Number.isFinite(Number(draft.prizeValue))) return 'Prize value must be a number.'
        return null
      },
      render: () => (
        <>
          <label className="block">
            <span className={WIZARD_LABEL}>Prize</span>
            <input
              value={draft.prizeTitle} onChange={e => set('prizeTitle', e.target.value)} maxLength={200}
              className={WIZARD_FIELD} placeholder="e.g. £1,000 camera bundle"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={WIZARD_LABEL}>Prize value (GBP)</span>
              <input type="number" min="0" value={draft.prizeValue} onChange={e => set('prizeValue', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Judging method</span>
              <select value={draft.judgingType} onChange={e => set('judgingType', e.target.value)} className={WIZARD_FIELD}>
                <option value="panel">Judging panel</option>
                <option value="public_vote">Public vote</option>
                <option value="hybrid">Panel plus public vote</option>
              </select>
            </label>
          </div>
          <p className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[12px] text-slate-600">
            Judges are assigned from the competition page once it exists, so you can invite the right people
            after the brief is settled. Judging always starts at <strong>Pending</strong>.
          </p>
        </>
      ),
    },
    {
      id: 'schedule', label: 'Dates & review',
      validate: () => {
        if (!ISO.test(draft.startDate)) return 'Choose a start date.'
        if (!ISO.test(draft.endDate)) return 'Choose an end date.'
        if (draft.endDate < draft.startDate) return 'The end date cannot be before the start date.'
        if (draft.submissionDeadline) {
          if (!ISO.test(draft.submissionDeadline)) return 'The submission deadline must be a valid date.'
          if (draft.submissionDeadline > draft.endDate) return 'The submission deadline cannot be after the competition ends.'
          if (draft.submissionDeadline < draft.startDate) return 'The submission deadline cannot be before the competition starts.'
        }
        if (draft.termsUrl && !/^https?:\/\/\S+$/i.test(draft.termsUrl)) return 'The terms link must start with http:// or https://.'
        return null
      },
      render: () => (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={WIZARD_LABEL}>Start date <span className="text-red-500">*</span></span>
              <input type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} className={WIZARD_FIELD} />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>Submission deadline</span>
              <input
                type="date" value={draft.submissionDeadline} min={draft.startDate || undefined} max={draft.endDate || undefined}
                onChange={e => set('submissionDeadline', e.target.value)} className={WIZARD_FIELD}
              />
            </label>
            <label className="block">
              <span className={WIZARD_LABEL}>End date <span className="text-red-500">*</span></span>
              <input
                type="date" value={draft.endDate} min={draft.startDate || undefined}
                onChange={e => set('endDate', e.target.value)} className={WIZARD_FIELD}
              />
            </label>
          </div>
          <label className="block">
            <span className={WIZARD_LABEL}>Terms &amp; conditions URL</span>
            <input
              type="url" value={draft.termsUrl} onChange={e => set('termsUrl', e.target.value)}
              className={WIZARD_FIELD} placeholder="https://example.com/competition-terms"
            />
          </label>
          <label className="block">
            <span className={WIZARD_LABEL}>Rules &amp; submission requirements</span>
            <textarea
              value={draft.rules} onChange={e => set('rules', e.target.value)} rows={3} maxLength={5000}
              className={cn(WIZARD_FIELD, 'h-auto py-2')}
              placeholder="Accepted file types and sizes, originality requirements, how winners are announced…"
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[12px] text-slate-600">
            <p className="mb-1 font-medium text-slate-900">Review</p>
            <p>
              <strong>{draft.title || 'Untitled competition'}</strong> —{' '}
              {COMPETITION_TYPE_LABELS[draft.type]} · {draft.judgingType.replace('_', ' ')} judging ·{' '}
              {draft.startDate || '—'} to {draft.endDate || '—'}
            </p>
            <p className="mt-1 text-slate-500">The competition is created as a draft so you can add judges before opening it.</p>
          </div>
        </>
      ),
    },
  ]

  function submit() {
    startTransition(async () => {
      const result = await createCompetition({
        title: draft.title,
        description: draft.description,
        competition_type: draft.type,
        start_date: draft.startDate,
        end_date: draft.endDate,
        submission_deadline: draft.submissionDeadline,
        prize_title: draft.prizeTitle,
        prize_value: draft.prizeValue,
        judging_type: draft.judgingType,
        max_submissions_per_person: draft.maxSubmissions,
        min_age: draft.minAge,
        eligible_countries: draft.countries,
        entry_hashtag: draft.hashtag,
        rules: draft.rules,
        terms_url: draft.termsUrl,
        channels: draft.channels,
        owner_id: draft.ownerId,
      })

      if (!result.ok) { setError(result.error ?? 'Could not create the competition.'); return }
      notify('success', result.message ?? 'Competition created.')
      setOpen(false); setDraft(EMPTY); setDirty(false); setError(null)
      router.refresh()
      if (result.id) router.push(`/app/campaigns/competitions/${result.id}`)
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700', className)}
      >
        <Plus size={15} />
        New competition
      </button>
      <WizardDialog
        open={open}
        title="New competition"
        description="Set the brief, eligibility, judging method and schedule. The competition is created as a draft."
        steps={steps}
        submitLabel="Create competition"
        pending={pending}
        error={error}
        dirty={dirty}
        onClose={() => { setOpen(false); setError(null) }}
        onSubmit={submit}
      />
    </>
  )
}
