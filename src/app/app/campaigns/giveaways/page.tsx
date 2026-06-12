'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Gift, Trophy, Calendar, Users, Hash, Eye, Edit2,
  Archive, StopCircle, LayoutGrid, List, ChevronLeft, Check,
  Copy, Globe, Shuffle,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  GIVEAWAY_ENTRY_METHODS,
  GIVEAWAY_ENTRY_LABELS,
  SOCIAL_PLATFORMS,
  PLATFORM_LABELS,
} from '@/lib/constants'

interface Giveaway {
  id: string
  workspace_id: string
  campaign_id: string | null
  brand_id: string | null
  title: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
  platform: string | null
  prize_title: string
  prize_value: number | null
  prize_currency: string
  prize_quantity: number
  entry_methods: string[]
  entry_hashtag: string | null
  winner_count: number
  winner_selection: string
  total_entries: number
  total_unique_participants: number
  winners_announced_at: string | null
  created_at: string
}

interface Campaign { id: string; title: string }
interface Brand { id: string; name: string }

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
  { id: 'ended', label: 'Ended' },
  { id: 'archived', label: 'Archived' },
]

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
]

const WINNER_SELECTION_OPTIONS = [
  { value: 'random', label: 'Random draw' },
  { value: 'manual', label: 'Manual selection' },
]

const currencySymbol = (c: string) => c === 'GBP' ? '£' : c === 'USD' ? '$' : '€'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusBadgeVariant(s: string) {
  if (s === 'active') return 'green'
  if (s === 'draft') return 'slate'
  if (s === 'ended') return 'amber'
  if (s === 'cancelled') return 'red'
  if (s === 'archived') return 'default'
  return 'default'
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─── Giveaway Card ─────────────────────────────────────────────────────────────
function GiveawayCard({
  giveaway,
  onEdit,
  onEnd,
  onArchive,
}: {
  giveaway: Giveaway
  onEdit: (g: Giveaway) => void
  onEnd: (g: Giveaway) => void
  onArchive: (g: Giveaway) => void
}) {
  const router = useRouter()

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={giveaway.status} dot>{giveaway.status.charAt(0).toUpperCase() + giveaway.status.slice(1)}</Badge>
            {giveaway.platform && (
              <Badge variant="blue">{PLATFORM_LABELS[giveaway.platform] ?? giveaway.platform}</Badge>
            )}
          </div>
          <h3 className="font-semibold text-slate-900 text-sm leading-snug">{giveaway.title}</h3>
        </div>
      </div>

      {/* Prize */}
      <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
        <Trophy size={15} className="text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-amber-800 truncate">{giveaway.prize_title}</span>
        {giveaway.prize_value && (
          <span className="ml-auto text-sm font-semibold text-amber-700 shrink-0">
            {currencySymbol(giveaway.prize_currency)}{giveaway.prize_value.toLocaleString()}
          </span>
        )}
      </div>

      {/* Dates */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar size={12} />
        <span>
          {giveaway.start_date ? fmtDate(giveaway.start_date) : 'TBD'}
          {' → '}
          {giveaway.end_date ? fmtDate(giveaway.end_date) : 'TBD'}
        </span>
      </div>

      {/* Entry methods */}
      {giveaway.entry_methods?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {giveaway.entry_methods.slice(0, 3).map(m => (
            <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
              <Check size={10} />
              {GIVEAWAY_ENTRY_LABELS[m] ?? m}
            </span>
          ))}
          {giveaway.entry_methods.length > 3 && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
              +{giveaway.entry_methods.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
        <span className="flex items-center gap-1"><Users size={12} />{giveaway.total_entries.toLocaleString()} entries</span>
        <span className="flex items-center gap-1"><Trophy size={12} />{giveaway.winner_count} winner{giveaway.winner_count !== 1 ? 's' : ''}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="primary" icon={<Eye size={13} />} onClick={() => router.push(`/app/campaigns/giveaways/${giveaway.id}`)}>
          View
        </Button>
        <Button size="sm" variant="secondary" icon={<Edit2 size={13} />} onClick={() => onEdit(giveaway)}>
          Edit
        </Button>
        {giveaway.status === 'active' && (
          <Button size="sm" variant="ghost" icon={<StopCircle size={13} />} onClick={() => onEnd(giveaway)}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
            End
          </Button>
        )}
        {giveaway.status !== 'archived' && (
          <Button size="sm" variant="ghost" icon={<Archive size={13} />} onClick={() => onArchive(giveaway)}
            className="text-slate-500">
            Archive
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Table Row ─────────────────────────────────────────────────────────────────
function GiveawayTableRow({
  giveaway,
  onEdit,
  onEnd,
  onArchive,
}: {
  giveaway: Giveaway
  onEdit: (g: Giveaway) => void
  onEnd: (g: Giveaway) => void
  onArchive: (g: Giveaway) => void
}) {
  const router = useRouter()
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900 text-sm">{giveaway.title}</div>
        {giveaway.description && (
          <div className="text-xs text-slate-400 truncate max-w-[200px]">{giveaway.description}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {giveaway.platform
          ? <Badge variant="blue">{PLATFORM_LABELS[giveaway.platform] ?? giveaway.platform}</Badge>
          : <span className="text-xs text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Trophy size={13} className="text-amber-500" />
          <span className="text-sm text-slate-700">{giveaway.prize_title}</span>
          {giveaway.prize_value && (
            <span className="text-xs text-slate-400">
              ({currencySymbol(giveaway.prize_currency)}{giveaway.prize_value.toLocaleString()})
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge status={giveaway.status} dot>{giveaway.status.charAt(0).toUpperCase() + giveaway.status.slice(1)}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{giveaway.total_entries.toLocaleString()}</td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {fmtDate(giveaway.start_date)} → {fmtDate(giveaway.end_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={() => router.push(`/app/campaigns/giveaways/${giveaway.id}`)}>
            <Eye size={12} />
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onEdit(giveaway)}>
            <Edit2 size={12} />
          </Button>
          {giveaway.status === 'active' && (
            <Button size="xs" variant="ghost" className="text-amber-600 hover:bg-amber-50" onClick={() => onEnd(giveaway)}>
              <StopCircle size={12} />
            </Button>
          )}
          {giveaway.status !== 'archived' && (
            <Button size="xs" variant="ghost" onClick={() => onArchive(giveaway)}>
              <Archive size={12} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── New / Edit Giveaway Modal ─────────────────────────────────────────────────
const EMPTY_FORM = {
  title: '',
  description: '',
  platform: '',
  campaign_id: '',
  brand_id: '',
  prize_title: '',
  prize_description: '',
  prize_value: '',
  prize_currency: 'GBP',
  prize_quantity: '1',
  winner_count: '1',
  winner_selection: 'random',
  entry_methods: [] as string[],
  entry_hashtag: '',
  entry_post_url: '',
  max_entries_per_person: '',
  min_followers_required: '',
  eligible_countries: '',
  rules: '',
  terms_url: '',
  start_date: '',
  end_date: '',
}

function GiveawayFormModal({
  open,
  onClose,
  onSaved,
  editGiveaway,
  campaigns,
  brands,
  workspaceId,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editGiveaway: Giveaway | null
  campaigns: Campaign[]
  brands: Brand[]
  workspaceId: string
}) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    if (open) {
      setStep(1)
      setErrors({})
      if (editGiveaway) {
        setForm({
          title: editGiveaway.title ?? '',
          description: editGiveaway.description ?? '',
          platform: editGiveaway.platform ?? '',
          campaign_id: editGiveaway.campaign_id ?? '',
          brand_id: editGiveaway.brand_id ?? '',
          prize_title: editGiveaway.prize_title ?? '',
          prize_description: '',
          prize_value: editGiveaway.prize_value?.toString() ?? '',
          prize_currency: editGiveaway.prize_currency ?? 'GBP',
          prize_quantity: editGiveaway.prize_quantity?.toString() ?? '1',
          winner_count: editGiveaway.winner_count?.toString() ?? '1',
          winner_selection: editGiveaway.winner_selection ?? 'random',
          entry_methods: editGiveaway.entry_methods ?? [],
          entry_hashtag: editGiveaway.entry_hashtag ?? '',
          entry_post_url: '',
          max_entries_per_person: '',
          min_followers_required: '',
          eligible_countries: '',
          rules: '',
          terms_url: '',
          start_date: editGiveaway.start_date ? editGiveaway.start_date.slice(0, 16) : '',
          end_date: editGiveaway.end_date ? editGiveaway.end_date.slice(0, 16) : '',
        })
      } else {
        setForm({ ...EMPTY_FORM })
      }
    }
  }, [open, editGiveaway])

  const set = (k: keyof typeof EMPTY_FORM, v: string | string[]) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  const toggleMethod = (m: string) => {
    set('entry_methods', form.entry_methods.includes(m)
      ? form.entry_methods.filter(x => x !== m)
      : [...form.entry_methods, m],
    )
  }

  const validate = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 1 && !form.title.trim()) e.title = 'Title is required'
    if (s === 2 && !form.prize_title.trim()) e.prize_title = 'Prize title is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (!validate(step)) return
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    if (!validate(4)) return
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId,
        title: form.title.trim(),
        description: form.description || null,
        platform: form.platform || null,
        campaign_id: form.campaign_id || null,
        brand_id: form.brand_id || null,
        prize_title: form.prize_title.trim(),
        prize_value: form.prize_value ? parseFloat(form.prize_value) : null,
        prize_currency: form.prize_currency,
        prize_quantity: parseInt(form.prize_quantity) || 1,
        winner_count: parseInt(form.winner_count) || 1,
        winner_selection: form.winner_selection,
        entry_methods: form.entry_methods,
        entry_hashtag: form.entry_hashtag || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: 'draft',
        total_entries: 0,
        total_unique_participants: 0,
      }
      if (editGiveaway) {
        await supabase.from('giveaways').update(payload).eq('id', editGiveaway.id)
      } else {
        await supabase.from('giveaways').insert(payload)
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const stepLabels = ['Basics', 'Prize', 'Entry Rules', 'Schedule']

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editGiveaway ? 'Edit Giveaway' : 'New Giveaway'}
      description={`Step ${step} of 4 — ${stepLabels[step - 1]}`}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={cn('w-2 h-2 rounded-full transition-colors', s === step ? 'bg-blue-600' : s < step ? 'bg-blue-300' : 'bg-slate-200')} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setStep(s => s - 1)}>Back</Button>
            )}
            {step < 4
              ? <Button variant="primary" size="sm" onClick={handleNext}>Next</Button>
              : <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>{editGiveaway ? 'Save Changes' : 'Create Giveaway'}</Button>
            }
          </div>
        </div>
      }
    >
      {/* Step 1 — Basics */}
      {step === 1 && (
        <div className="space-y-4">
          <Input label="Title *" placeholder="Summer Giveaway 2026" value={form.title} onChange={e => set('title', e.target.value)} error={errors.title} />
          <Textarea label="Description" placeholder="Brief description of the giveaway…" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          <Select
            label="Platform"
            value={form.platform}
            onChange={e => set('platform', e.target.value)}
            options={[{ value: '', label: '— Select platform —' }, ...SOCIAL_PLATFORMS.map(p => ({ value: p, label: PLATFORM_LABELS[p] }))]}
          />
          <Select
            label="Linked Campaign"
            value={form.campaign_id}
            onChange={e => set('campaign_id', e.target.value)}
            options={[{ value: '', label: '— None —' }, ...campaigns.map(c => ({ value: c.id, label: c.title }))]}
          />
          <Select
            label="Brand"
            value={form.brand_id}
            onChange={e => set('brand_id', e.target.value)}
            options={[{ value: '', label: '— None —' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
          />
        </div>
      )}

      {/* Step 2 — Prize */}
      {step === 2 && (
        <div className="space-y-4">
          <Input label="Prize Title *" placeholder="Apple iPhone 16 Pro" value={form.prize_title} onChange={e => set('prize_title', e.target.value)} error={errors.prize_title} />
          <Textarea label="Prize Description" placeholder="What the winner receives…" value={form.prize_description} onChange={e => set('prize_description', e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prize Value" type="number" placeholder="500" value={form.prize_value} onChange={e => set('prize_value', e.target.value)} />
            <Select label="Currency" value={form.prize_currency} onChange={e => set('prize_currency', e.target.value)} options={CURRENCY_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" min="1" value={form.prize_quantity} onChange={e => set('prize_quantity', e.target.value)} />
            <Input label="Number of Winners" type="number" min="1" value={form.winner_count} onChange={e => set('winner_count', e.target.value)} />
          </div>
          <Select label="Winner Selection" value={form.winner_selection} onChange={e => set('winner_selection', e.target.value)} options={WINNER_SELECTION_OPTIONS} />
        </div>
      )}

      {/* Step 3 — Entry Rules */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Entry Methods</label>
            <div className="grid grid-cols-2 gap-2">
              {GIVEAWAY_ENTRY_METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left',
                    form.entry_methods.includes(m)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0 border',
                    form.entry_methods.includes(m) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                  )}>
                    {form.entry_methods.includes(m) && <Check size={10} className="text-white" />}
                  </div>
                  {GIVEAWAY_ENTRY_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <Input label="Entry Hashtag" placeholder="#MySummerGiveaway" value={form.entry_hashtag} onChange={e => set('entry_hashtag', e.target.value)} icon={<Hash size={14} />} />
          <Input label="Giveaway Post URL" placeholder="https://instagram.com/p/..." value={form.entry_post_url} onChange={e => set('entry_post_url', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Entries Per Person" type="number" placeholder="1" value={form.max_entries_per_person} onChange={e => set('max_entries_per_person', e.target.value)} />
            <Input label="Min Followers Required" type="number" placeholder="0" value={form.min_followers_required} onChange={e => set('min_followers_required', e.target.value)} />
          </div>
          <Input label="Eligible Countries" placeholder="GB, US, CA (comma-separated)" value={form.eligible_countries} onChange={e => set('eligible_countries', e.target.value)} icon={<Globe size={14} />} />
          <Textarea label="Rules & Conditions" placeholder="By entering this giveaway you agree to…" value={form.rules} onChange={e => set('rules', e.target.value)} rows={4} />
          <Input label="Terms URL" placeholder="https://example.com/giveaway-terms" value={form.terms_url} onChange={e => set('terms_url', e.target.value)} />
        </div>
      )}

      {/* Step 4 — Schedule + Review */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date & Time" type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            <Input label="End Date & Time" type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Review Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Title</span><span className="font-medium text-slate-900">{form.title || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Platform</span><span className="font-medium text-slate-900">{form.platform ? PLATFORM_LABELS[form.platform] : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Prize</span><span className="font-medium text-slate-900">{form.prize_title || '—'}{form.prize_value ? ` (${currencySymbol(form.prize_currency)}${form.prize_value})` : ''}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Winners</span><span className="font-medium text-slate-900">{form.winner_count} ({form.winner_selection})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Entry Methods</span><span className="font-medium text-slate-900">{form.entry_methods.length > 0 ? form.entry_methods.length + ' selected' : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Schedule</span>
                <span className="font-medium text-slate-900 text-right">
                  {form.start_date ? new Date(form.start_date).toLocaleDateString() : 'TBD'} → {form.end_date ? new Date(form.end_date).toLocaleDateString() : 'TBD'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function GiveawaysPage() {
  const supabase = createClient()
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showNew, setShowNew] = useState(false)
  const [editGiveaway, setEditGiveaway] = useState<Giveaway | null>(null)
  const [endTarget, setEndTarget] = useState<Giveaway | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Giveaway | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchGiveaways = useCallback(async (wsId: string) => {
    const { data } = await supabase
      .from('giveaways')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
    setGiveaways(data ?? [])
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      const wsId = member?.workspace_id ?? ''
      setWorkspaceId(wsId)
      if (wsId) {
        await Promise.all([
          fetchGiveaways(wsId),
          supabase.from('campaigns').select('id, title').eq('workspace_id', wsId).then(r => setCampaigns(r.data ?? [])),
          supabase.from('brands').select('id, name').eq('workspace_id', wsId).then(r => setBrands(r.data ?? [])),
        ])
      }
      setLoading(false)
    }
    init()
  }, [])

  const filtered = giveaways.filter(g => statusFilter === 'all' || g.status === statusFilter)

  // KPIs
  const activeCount = giveaways.filter(g => g.status === 'active').length
  const totalEntries = giveaways.reduce((s, g) => s + (g.total_entries ?? 0), 0)
  const pendingWinners = giveaways.filter(g => g.status === 'ended' && !g.winners_announced_at).length
  const now = new Date()
  const upcoming = giveaways.filter(g => g.status === 'draft' && g.start_date && new Date(g.start_date) > now).length

  const handleEnd = async () => {
    if (!endTarget) return
    setActionLoading(true)
    await supabase.from('giveaways').update({ status: 'ended' }).eq('id', endTarget.id)
    await fetchGiveaways(workspaceId)
    setEndTarget(null)
    setActionLoading(false)
  }

  const handleArchive = async () => {
    if (!archiveTarget) return
    setActionLoading(true)
    await supabase.from('giveaways').update({ status: 'archived' }).eq('id', archiveTarget.id)
    await fetchGiveaways(workspaceId)
    setArchiveTarget(null)
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Giveaways"
        subtitle="Run, track and manage all your social giveaways."
        breadcrumbs={[{ label: 'Campaigns', href: '/app/campaigns' }, { label: 'Giveaways' }]}
      >
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditGiveaway(null); setShowNew(true) }}>
          New Giveaway
        </Button>
      </PageHeader>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Giveaways" value={activeCount} icon={Gift} color="bg-blue-600" />
        <KpiCard label="Total Entries" value={totalEntries.toLocaleString()} icon={Users} color="bg-emerald-500" />
        <KpiCard label="Pending Winners" value={pendingWinners} icon={Trophy} color="bg-amber-500" />
        <KpiCard label="Upcoming" value={upcoming} icon={Calendar} color="bg-violet-500" />
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs
          tabs={STATUS_TABS.map(t => ({
            ...t,
            count: t.id === 'all' ? giveaways.length : giveaways.filter(g => g.status === t.id).length,
          }))}
          active={statusFilter}
          onChange={setStatusFilter}
          pill
        />
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={cn('p-1.5 rounded-md transition-colors', viewMode === 'cards' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-1.5 rounded-md transition-colors', viewMode === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={statusFilter === 'all' ? 'No giveaways yet' : `No ${statusFilter} giveaways`}
          description={statusFilter === 'all' ? 'Run your first social giveaway to grow your audience and drive engagement.' : `You have no giveaways with status "${statusFilter}".`}
          action={statusFilter === 'all' ? {
            label: '+ New Giveaway',
            onClick: () => { setEditGiveaway(null); setShowNew(true) },
          } : undefined}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(g => (
            <GiveawayCard
              key={g.id}
              giveaway={g}
              onEdit={gw => { setEditGiveaway(gw); setShowNew(true) }}
              onEnd={gw => setEndTarget(gw)}
              onArchive={gw => setArchiveTarget(gw)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Title', 'Platform', 'Prize', 'Status', 'Entries', 'Dates', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <GiveawayTableRow
                  key={g.id}
                  giveaway={g}
                  onEdit={gw => { setEditGiveaway(gw); setShowNew(true) }}
                  onEnd={gw => setEndTarget(gw)}
                  onArchive={gw => setArchiveTarget(gw)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New / Edit Modal */}
      <GiveawayFormModal
        open={showNew}
        onClose={() => { setShowNew(false); setEditGiveaway(null) }}
        onSaved={() => fetchGiveaways(workspaceId)}
        editGiveaway={editGiveaway}
        campaigns={campaigns}
        brands={brands}
        workspaceId={workspaceId}
      />

      {/* End Confirm */}
      <ConfirmModal
        open={!!endTarget}
        onClose={() => setEndTarget(null)}
        onConfirm={handleEnd}
        title="End Giveaway"
        description={`Are you sure you want to end "${endTarget?.title}"? This will close entries and mark it as ended.`}
        confirmLabel="End Giveaway"
        danger
        loading={actionLoading}
      />

      {/* Archive Confirm */}
      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Giveaway"
        description={`Archive "${archiveTarget?.title}"? It will be hidden from active views but not deleted.`}
        confirmLabel="Archive"
        loading={actionLoading}
      />
    </div>
  )
}
