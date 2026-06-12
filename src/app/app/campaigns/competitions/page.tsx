'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy, Plus, ArrowLeft, LayoutGrid, Table2, Filter,
  Calendar, Hash, Users, Award, ChevronRight, MoreHorizontal,
  FileText, Clock, CheckCircle, Archive, Edit2, Trash2,
  Camera, PlayCircle, Briefcase, Star, Vote, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { COMPETITION_TYPES, COMPETITION_TYPE_LABELS, SOCIAL_PLATFORMS, PLATFORM_LABELS } from '@/lib/constants'

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Competition {
  id: string
  workspace_id: string
  campaign_id: string | null
  brand_id: string | null
  title: string
  description: string | null
  competition_type: string
  status: string
  start_date: string | null
  end_date: string | null
  submission_deadline: string | null
  platform: string | null
  entry_hashtag: string | null
  prize_title: string | null
  prize_value: number | null
  prize_currency: string
  prizes: Array<{ place: number; title: string; value: number }>
  judging_type: string
  judging_criteria: Array<{ name: string; weight: number }>
  max_submissions_per_person: number
  submission_count: number
  vote_count: number
  winner_announced_at: string | null
  created_at: string
  rules?: string | null
  terms_url?: string | null
  eligible_countries?: string[] | null
  require_follow?: boolean
  require_hashtag?: boolean
  min_age?: number | null
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
const STATUS_FILTERS = ['all', 'active', 'draft', 'open', 'judging', 'completed', 'archived']
const STATUS_LABELS: Record<string, string> = {
  all: 'All', active: 'Active', draft: 'Draft', open: 'Open',
  judging: 'Judging', completed: 'Completed', archived: 'Archived',
}

function statusBadgeVariant(s: string) {
  const map: Record<string, string> = {
    active: 'green', open: 'blue', draft: 'slate',
    judging: 'violet', completed: 'green', archived: 'slate',
  }
  return (map[s] ?? 'default') as any
}

function competitionTypeIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    photo: <Camera size={12} />, video: <PlayCircle size={12} />,
    caption: <FileText size={12} />, design: <Briefcase size={12} />,
    essay: <FileText size={12} />, recipe: <Star size={12} />,
    art: <Star size={12} />, vote: <Vote size={12} />, quiz: <CheckCircle size={12} />,
  }
  return icons[type] ?? <Trophy size={12} />
}

function countdown(deadline: string | null): string {
  if (!deadline) return ''
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d left`
  const hours = Math.floor(diff / 3600000)
  return `${hours}h left`
}

function judgingLabel(type: string) {
  return type === 'panel' ? 'Panel Judging' : type === 'public_vote' ? 'Public Vote' : 'Hybrid'
}

/* ─── Step form default state ────────────────────────────────────────── */
function defaultForm() {
  return {
    // Step 1
    title: '', description: '', competition_type: 'photo', platform: '',
    campaign_id: '', brand_id: '',
    // Step 2
    prizes: [{ place: 1, title: '', value: 0, currency: 'USD' }],
    require_follow: false, require_hashtag: false, entry_hashtag: '',
    // Step 3
    judging_type: 'panel',
    judging_criteria: [{ name: '', weight: 100 }],
    max_submissions_per_person: 1, min_age: 0,
    // Step 4
    rules: '', terms_url: '', eligible_countries: '',
    // Step 5
    start_date: '', end_date: '', submission_deadline: '',
  }
}

/* ─── New Competition Modal ──────────────────────────────────────────── */
function NewCompetitionModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(defaultForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = 5

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function addPrize() {
    setForm(f => ({
      ...f,
      prizes: [...f.prizes, { place: f.prizes.length + 1, title: '', value: 0, currency: 'USD' }],
    }))
  }

  function removePrize(i: number) {
    setForm(f => ({ ...f, prizes: f.prizes.filter((_, idx) => idx !== i) }))
  }

  function updatePrize(i: number, key: string, val: any) {
    setForm(f => {
      const prizes = [...f.prizes]
      prizes[i] = { ...prizes[i], [key]: val }
      return { ...f, prizes }
    })
  }

  function addCriterion() {
    setForm(f => ({ ...f, judging_criteria: [...f.judging_criteria, { name: '', weight: 0 }] }))
  }

  function removeCriterion(i: number) {
    setForm(f => ({ ...f, judging_criteria: f.judging_criteria.filter((_, idx) => idx !== i) }))
  }

  function updateCriterion(i: number, key: string, val: any) {
    setForm(f => {
      const judging_criteria = [...f.judging_criteria]
      judging_criteria[i] = { ...judging_criteria[i], [key]: val }
      return { ...f, judging_criteria }
    })
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      const payload: any = {
        workspace_id: ws?.id,
        title: form.title,
        description: form.description || null,
        competition_type: form.competition_type,
        platform: form.platform || null,
        campaign_id: form.campaign_id || null,
        brand_id: form.brand_id || null,
        prizes: form.prizes,
        prize_title: form.prizes[0]?.title || null,
        prize_value: form.prizes[0]?.value || null,
        prize_currency: form.prizes[0]?.currency || 'USD',
        require_follow: form.require_follow,
        require_hashtag: form.require_hashtag,
        entry_hashtag: form.entry_hashtag || null,
        judging_type: form.judging_type,
        judging_criteria: form.judging_criteria,
        max_submissions_per_person: form.max_submissions_per_person,
        min_age: form.min_age || null,
        rules: form.rules || null,
        terms_url: form.terms_url || null,
        eligible_countries: form.eligible_countries
          ? form.eligible_countries.split(',').map((s: string) => s.trim()).filter(Boolean)
          : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        submission_deadline: form.submission_deadline || null,
        status: 'draft',
        submission_count: 0,
        vote_count: 0,
      }

      const { error: err } = await supabase.from('competitions').insert(payload)
      if (err) throw err

      onCreated()
      onClose()
      setStep(1)
      setForm(defaultForm())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-700 mb-1'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`New Competition — Step ${step} of ${total}`}
      description={['Basics', 'Prizes & Entry', 'Judging', 'Rules', 'Schedule'][step - 1]}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className={cn('w-2 h-2 rounded-full transition-colors',
                i + 1 === step ? 'bg-blue-600' : i + 1 < step ? 'bg-blue-200' : 'bg-slate-200',
              )} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setStep(s => s - 1)}>Back</Button>
            )}
            {step < total ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !form.title}>
                Continue
              </Button>
            ) : (
              <Button size="sm" loading={saving} onClick={handleSubmit}>Create Competition</Button>
            )}
          </div>
        </div>
      }
    >
      {error && <p className="text-sm text-red-600 mb-4 p-3 bg-red-50 rounded-lg">{error}</p>}

      {/* ── Step 1: Basics ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title} placeholder="Summer Photo Contest 2026"
              onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={cn(inputCls, 'resize-none')} rows={3} value={form.description}
              placeholder="Describe the competition..."
              onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Competition Type *</label>
              <select className={inputCls} value={form.competition_type}
                onChange={e => set('competition_type', e.target.value)}>
                {COMPETITION_TYPES.map(t => (
                  <option key={t} value={t}>{COMPETITION_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Platform</label>
              <select className={inputCls} value={form.platform}
                onChange={e => set('platform', e.target.value)}>
                <option value="">All Platforms</option>
                {SOCIAL_PLATFORMS.map(p => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Campaign ID (optional)</label>
              <input className={inputCls} value={form.campaign_id} placeholder="campaign UUID"
                onChange={e => set('campaign_id', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Brand ID (optional)</label>
              <input className={inputCls} value={form.brand_id} placeholder="brand UUID"
                onChange={e => set('brand_id', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Prizes ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700">Prizes</label>
              <Button variant="ghost" size="xs" icon={<Plus size={12} />} onClick={addPrize}>
                Add Prize
              </Button>
            </div>
            <div className="space-y-3">
              {form.prizes.map((prize, i) => (
                <div key={i} className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      {i === 0 ? '1st Place' : i === 1 ? '2nd Place' : i === 2 ? '3rd Place' : `${i + 1}th Place`}
                    </span>
                    {form.prizes.length > 1 && (
                      <button onClick={() => removePrize(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input className={inputCls} value={prize.title} placeholder="e.g. iPhone 16 Pro"
                        onChange={e => updatePrize(i, 'title', e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                      <select className={cn(inputCls, 'w-16')} value={prize.currency}
                        onChange={e => updatePrize(i, 'currency', e.target.value)}>
                        <option>USD</option><option>GBP</option><option>EUR</option>
                      </select>
                      <input className={inputCls} type="number" min="0" value={prize.value}
                        placeholder="0" onChange={e => updatePrize(i, 'value', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-medium text-slate-700">Entry Requirements</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.require_follow}
                onChange={e => set('require_follow', e.target.checked)}
                className="rounded border-slate-300" />
              <span className="text-sm text-slate-700">Require follow to enter</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.require_hashtag}
                onChange={e => set('require_hashtag', e.target.checked)}
                className="rounded border-slate-300" />
              <span className="text-sm text-slate-700">Require entry hashtag</span>
            </label>
            {form.require_hashtag && (
              <div>
                <label className={labelCls}>Entry Hashtag</label>
                <input className={inputCls} value={form.entry_hashtag} placeholder="#MyContest2026"
                  onChange={e => set('entry_hashtag', e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Judging ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Judging Type *</label>
            <select className={inputCls} value={form.judging_type}
              onChange={e => set('judging_type', e.target.value)}>
              <option value="panel">Panel Judging — Judges score submissions</option>
              <option value="public_vote">Public Vote — Audience votes determine winner</option>
              <option value="hybrid">Hybrid — Panel + Public Vote combined</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-700">Judging Criteria</label>
              <Button variant="ghost" size="xs" icon={<Plus size={12} />} onClick={addCriterion}>
                Add Criterion
              </Button>
            </div>
            <div className="space-y-2">
              {form.judging_criteria.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className={cn(inputCls, 'flex-1')} value={c.name} placeholder="Criterion name (e.g. Creativity)"
                    onChange={e => updateCriterion(i, 'name', e.target.value)} />
                  <input className={cn(inputCls, 'w-20')} type="number" min="0" max="100" value={c.weight}
                    placeholder="%" onChange={e => updateCriterion(i, 'weight', Number(e.target.value))} />
                  <span className="text-xs text-slate-400">%</span>
                  {form.judging_criteria.length > 1 && (
                    <button onClick={() => removeCriterion(i)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Total weight: {form.judging_criteria.reduce((s, c) => s + (c.weight || 0), 0)}% (should sum to 100)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Submissions Per Person</label>
              <input className={inputCls} type="number" min="1" value={form.max_submissions_per_person}
                onChange={e => set('max_submissions_per_person', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Minimum Age (0 = no limit)</label>
              <input className={inputCls} type="number" min="0" value={form.min_age}
                onChange={e => set('min_age', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Rules ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Competition Rules</label>
            <textarea className={cn(inputCls, 'resize-none')} rows={6} value={form.rules}
              placeholder="Enter full competition rules and terms..."
              onChange={e => set('rules', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Terms & Conditions URL</label>
            <input className={inputCls} value={form.terms_url} placeholder="https://example.com/terms"
              onChange={e => set('terms_url', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Eligible Countries (comma-separated, empty = worldwide)</label>
            <input className={inputCls} value={form.eligible_countries}
              placeholder="US, UK, CA, AU"
              onChange={e => set('eligible_countries', e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Step 5: Schedule + Review ── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input className={inputCls} type="datetime-local" value={form.start_date}
                onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Submission Deadline</label>
              <input className={inputCls} type="datetime-local" value={form.submission_deadline}
                onChange={e => set('submission_deadline', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input className={inputCls} type="datetime-local" value={form.end_date}
                onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Review Summary</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Title:</span> <span className="text-slate-900 font-medium">{form.title || '—'}</span></div>
              <div><span className="text-slate-500">Type:</span> <span className="text-slate-900">{COMPETITION_TYPE_LABELS[form.competition_type]}</span></div>
              <div><span className="text-slate-500">Platform:</span> <span className="text-slate-900">{form.platform ? PLATFORM_LABELS[form.platform] : 'All'}</span></div>
              <div><span className="text-slate-500">Judging:</span> <span className="text-slate-900">{judgingLabel(form.judging_type)}</span></div>
              <div><span className="text-slate-500">Prizes:</span> <span className="text-slate-900">{form.prizes.length} prize(s)</span></div>
              <div><span className="text-slate-500">Max entries:</span> <span className="text-slate-900">{form.max_submissions_per_person} per person</span></div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ─── Competition Card ───────────────────────────────────────────────── */
function CompetitionCard({ comp, onAction }: {
  comp: Competition
  onAction: (action: string, id: string) => void
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const cd = countdown(comp.submission_deadline)

  const topPrizes = Array.isArray(comp.prizes) && comp.prizes.length > 0
    ? comp.prizes.slice(0, 3)
    : comp.prize_title
      ? [{ place: 1, title: comp.prize_title, value: comp.prize_value ?? 0 }]
      : []

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={comp.status} dot>{comp.status.charAt(0).toUpperCase() + comp.status.slice(1)}</Badge>
          <Badge variant="slate" className="flex items-center gap-1">
            {competitionTypeIcon(comp.competition_type)}
            {COMPETITION_TYPE_LABELS[comp.competition_type]}
          </Badge>
          {comp.platform && (
            <Badge variant="outline">{PLATFORM_LABELS[comp.platform] ?? comp.platform}</Badge>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen(m => !m)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-40"
              onMouseLeave={() => setMenuOpen(false)}>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => { setMenuOpen(false); router.push(`/app/campaigns/competitions/${comp.id}`) }}>
                <Eye size={13} /> View
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => { setMenuOpen(false); onAction('end_submissions', comp.id) }}>
                <Clock size={13} /> End Submissions
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => { setMenuOpen(false); onAction('move_to_judging', comp.id) }}>
                <Award size={13} /> Move to Judging
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => { setMenuOpen(false); onAction('archive', comp.id) }}>
                <Archive size={13} /> Archive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 leading-snug">{comp.title}</h3>
        {comp.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{comp.description}</p>
        )}
      </div>

      {/* Prizes */}
      {topPrizes.length > 0 && (
        <div className="space-y-1.5">
          {topPrizes.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn('text-xs font-bold w-5', i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400')}>
                {i === 0 ? '1st' : i === 1 ? '2nd' : '3rd'}
              </span>
              <span className="text-xs text-slate-700 flex-1">{p.title}</span>
              {p.value > 0 && (
                <span className="text-xs font-semibold text-slate-900">
                  ${p.value.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="violet" className="text-xs">{judgingLabel(comp.judging_type)}</Badge>
        {comp.entry_hashtag && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Hash size={11} />{comp.entry_hashtag}
          </span>
        )}
        {cd && comp.status === 'open' && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <Clock size={11} />{cd}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <FileText size={11} />
          <span className="font-medium text-slate-700">{comp.submission_count}</span> entries
        </span>
        {comp.judging_type !== 'panel' && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Vote size={11} />
            <span className="font-medium text-slate-700">{comp.vote_count}</span> votes
          </span>
        )}
        <div className="ml-auto">
          <Button size="xs" variant="secondary"
            onClick={() => router.push(`/app/campaigns/competitions/${comp.id}`)}>
            View <ChevronRight size={11} />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Table Row ──────────────────────────────────────────────────────── */
function CompetitionTableRow({ comp, onAction }: {
  comp: Competition
  onAction: (action: string, id: string) => void
}) {
  const router = useRouter()
  const topPrize = Array.isArray(comp.prizes) && comp.prizes.length > 0
    ? comp.prizes[0]
    : { title: comp.prize_title ?? '—', value: comp.prize_value ?? 0 }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{comp.title}</p>
          {comp.description && <p className="text-xs text-slate-400 truncate max-w-xs">{comp.description}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="slate" className="flex items-center gap-1 w-fit">
          {competitionTypeIcon(comp.competition_type)}
          {COMPETITION_TYPE_LABELS[comp.competition_type]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {comp.platform
          ? <Badge variant="outline">{PLATFORM_LABELS[comp.platform]}</Badge>
          : <span className="text-xs text-slate-400">All</span>}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">
          <p className="text-slate-900 font-medium truncate max-w-[120px]">{topPrize.title || '—'}</p>
          {topPrize.value > 0 && <p className="text-xs text-slate-500">${topPrize.value.toLocaleString()}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge status={comp.status}>{comp.status.charAt(0).toUpperCase() + comp.status.slice(1)}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">{comp.submission_count}</td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {comp.submission_deadline
          ? new Date(comp.submission_deadline).toLocaleDateString()
          : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => router.push(`/app/campaigns/competitions/${comp.id}`)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="View">
            <Eye size={14} />
          </button>
          <button onClick={() => onAction('end_submissions', comp.id)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="End Submissions">
            <Clock size={14} />
          </button>
          <button onClick={() => onAction('archive', comp.id)}
            className="p-1.5 rounded hover:bg-red-50 text-red-400" title="Archive">
            <Archive size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function CompetitionsPage() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [newOpen, setNewOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ action: string; id: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false })
    setCompetitions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all'
    ? competitions
    : competitions.filter(c => c.status === filter)

  const kpi = {
    active: competitions.filter(c => ['active', 'open'].includes(c.status)).length,
    submissions: competitions.reduce((s, c) => s + (c.submission_count ?? 0), 0),
    judging: competitions.filter(c => c.status === 'judging').length,
    votes: competitions.reduce((s, c) => s + (c.vote_count ?? 0), 0),
  }

  async function handleAction(action: string, id: string) {
    setActionTarget({ action, id })
  }

  async function confirmAction() {
    if (!actionTarget) return
    setActionLoading(true)
    const supabase = createClient()
    const statusMap: Record<string, string> = {
      end_submissions: 'judging',
      move_to_judging: 'judging',
      archive: 'archived',
    }
    const newStatus = statusMap[actionTarget.action]
    if (newStatus) {
      await supabase.from('competitions').update({ status: newStatus }).eq('id', actionTarget.id)
    }
    setActionLoading(false)
    setActionTarget(null)
    load()
  }

  const actionLabels: Record<string, { title: string; description: string; confirmLabel: string; danger?: boolean }> = {
    end_submissions: {
      title: 'End Submissions',
      description: 'Close entries and move competition to judging phase?',
      confirmLabel: 'End Submissions',
    },
    move_to_judging: {
      title: 'Move to Judging',
      description: 'Move this competition into the judging phase?',
      confirmLabel: 'Move to Judging',
    },
    archive: {
      title: 'Archive Competition',
      description: 'Archive this competition? It will be hidden from active views.',
      confirmLabel: 'Archive',
      danger: true,
    },
  }

  const currentActionMeta = actionTarget ? actionLabels[actionTarget.action] : null

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <PageHeader
        title="Competitions"
        subtitle="Engage your audience with photo, video & caption contests."
        breadcrumbs={[
          { label: 'Campaigns', href: '/app/campaigns' },
          { label: 'Competitions' },
        ]}
      >
        <Button icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>
          New Competition
        </Button>
      </PageHeader>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Competitions', value: kpi.active, icon: <Trophy size={18} className="text-blue-600" />, color: 'blue' },
          { label: 'Total Submissions', value: kpi.submissions, icon: <FileText size={18} className="text-violet-600" />, color: 'violet' },
          { label: 'In Judging', value: kpi.judging, icon: <Award size={18} className="text-amber-600" />, color: 'amber' },
          { label: 'Total Votes', value: kpi.votes, icon: <Vote size={18} className="text-emerald-600" />, color: 'emerald' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{k.label}</p>
              <div className="p-2 bg-slate-50 rounded-lg">{k.icon}</div>
            </div>
            {loading
              ? <Skeleton className="h-8 w-16" />
              : <p className="text-2xl font-bold text-slate-900">{k.value.toLocaleString()}</p>}
          </div>
        ))}
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                filter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600',
              )}>
              {STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button onClick={() => setView('cards')}
            className={cn('p-1.5 rounded-md transition-all', view === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')}>
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setView('table')}
            className={cn('p-1.5 rounded-md transition-all', view === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')}>
            <Table2 size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={filter === 'all' ? 'No competitions yet' : `No ${filter} competitions`}
          description={filter === 'all' ? 'Create your first competition to engage your audience.' : 'Try a different filter.'}
          action={filter === 'all' ? { label: 'New Competition', onClick: () => setNewOpen(true), icon: <Plus size={14} /> } : undefined}
        />
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CompetitionCard key={c.id} comp={c} onAction={handleAction} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Title', 'Type', 'Platform', 'Prize', 'Status', 'Submissions', 'Deadline', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <CompetitionTableRow key={c.id} comp={c} onAction={handleAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <NewCompetitionModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={load}
      />

      {actionTarget && currentActionMeta && (
        <ConfirmModal
          open={!!actionTarget}
          onClose={() => setActionTarget(null)}
          onConfirm={confirmAction}
          title={currentActionMeta.title}
          description={currentActionMeta.description}
          confirmLabel={currentActionMeta.confirmLabel}
          danger={currentActionMeta.danger}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
