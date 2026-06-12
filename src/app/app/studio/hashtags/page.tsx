'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Hash, Search, Filter, Grid, List, Star, Plus, Copy, Edit, Trash2,
  Sparkles, RefreshCw, X, Check, Tag, Wand2, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HashtagSet {
  id: string
  workspace_id: string
  brand_id: string | null
  name: string
  description: string | null
  hashtags: string[]
  platforms: string[]
  category: string
  avg_reach_estimate: number | null
  usage_count: number
  is_favorite: boolean
  created_at: string
}

interface Brand {
  id: string
  name: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'branded', label: 'Branded' },
  { value: 'niche', label: 'Niche' },
  { value: 'trending', label: 'Trending' },
  { value: 'ugc', label: 'UGC' },
  { value: 'location', label: 'Location' },
  { value: 'industry', label: 'Industry' },
]

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
]

const CATEGORY_COLOURS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-700',
  branded: 'bg-blue-100 text-blue-700',
  niche: 'bg-violet-100 text-violet-700',
  trending: 'bg-rose-100 text-rose-700',
  ugc: 'bg-amber-100 text-amber-700',
  location: 'bg-emerald-100 text-emerald-700',
  industry: 'bg-cyan-100 text-cyan-700',
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible, onHide }: { message: string; visible: boolean; onHide: () => void }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 3000)
      return () => clearTimeout(t)
    }
  }, [visible, onHide])

  return (
    <div className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
    )}>
      <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-xl shadow-lg">
        <Check size={15} />
        {message}
      </div>
    </div>
  )
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({ sets }: { sets: HashtagSet[] }) {
  const totalHashtags = sets.reduce((s, x) => s + x.hashtags.length, 0)
  const mostUsed = sets.reduce<HashtagSet | null>((best, x) => (!best || x.usage_count > best.usage_count) ? x : best, null)
  const avgReach = sets.filter(x => x.avg_reach_estimate).reduce((s, x) => s + (x.avg_reach_estimate ?? 0), 0)
  const avgReachCount = sets.filter(x => x.avg_reach_estimate).length

  const cards = [
    { label: 'Total Sets', value: sets.length.toString(), colour: 'bg-blue-50 text-blue-700' },
    { label: 'Total Hashtags', value: totalHashtags.toString(), colour: 'bg-violet-50 text-violet-700' },
    {
      label: 'Most Used Set',
      value: mostUsed ? mostUsed.name : '—',
      sub: mostUsed ? `${mostUsed.usage_count} uses` : undefined,
      colour: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Avg Reach Estimate',
      value: avgReachCount > 0 ? Math.round(avgReach / avgReachCount).toLocaleString() : '—',
      colour: 'bg-emerald-50 text-emerald-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500 font-medium mb-1">{c.label}</p>
          <p className={cn('text-2xl font-bold truncate', c.colour.split(' ')[1])}>{c.value}</p>
          {c.sub && <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Hashtag Tag Input ────────────────────────────────────────────────────────

function HashtagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  const add = (raw: string) => {
    const vals = raw.split(/[\s,]+/).map(v => v.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean)
    if (!vals.length) return
    const next = [...tags]
    for (const v of vals) {
      if (!next.includes(v)) next.push(v)
    }
    onChange(next)
    setInput('')
  }

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag))

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(input)
            }
          }}
          placeholder="Type a hashtag and press Enter…"
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => add(input)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[48px]">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              #{tag}
              <button type="button" onClick={() => remove(tag)} className="ml-0.5 hover:text-red-600">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">{tags.length} hashtags · {tags.reduce((s, t) => s + t.length + 2, 0)} characters total</p>
    </div>
  )
}

// ─── AI Hashtag Generator (inside modal) ─────────────────────────────────────

function AiHashtagGenerator({
  onAdd,
}: {
  onAdd: (tags: string[]) => void
}) {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!topic.trim()) return
    setLoading(true); setError(null); setSuggestions([])
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'hashtags', topic }),
      })
      if (!res.ok) throw new Error('Failed to generate hashtags')
      const data = await res.json()
      const raw: string[] = Array.isArray(data.result) ? data.result : []
      const cleaned = raw.map(t => t.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean)
      setSuggestions(cleaned)
      setSelected(new Set(cleaned))
    } catch {
      setError('Could not generate hashtags. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (tag: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  const addSelected = () => {
    onAdd(Array.from(selected))
    setSuggestions([])
    setSelected(new Set())
    setTopic('')
  }

  return (
    <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
        <Sparkles size={14} /> AI Generate Hashtags
      </p>
      <div className="flex gap-2">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && generate()}
          placeholder="Topic or niche (e.g. vegan fitness)…"
          className="flex-1 px-3 py-2 text-sm border border-violet-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-60 flex items-center gap-1.5"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Wand2 size={13} />}
          Generate
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {suggestions.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors font-medium',
                  selected.has(tag)
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-violet-400',
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={addSelected}
            className="w-full py-1.5 text-sm font-medium text-violet-700 border border-violet-300 rounded-lg hover:bg-violet-100 transition-colors"
          >
            Add {selected.size} selected hashtags
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface SetFormState {
  name: string
  description: string
  category: string
  platforms: string[]
  brand_id: string
  hashtags: string[]
}

const EMPTY_FORM: SetFormState = {
  name: '', description: '', category: 'general', platforms: [], brand_id: '', hashtags: [],
}

function SetModal({
  open,
  onClose,
  onSave,
  initial,
  brands,
  workspaceId,
}: {
  open: boolean
  onClose: () => void
  onSave: (set: HashtagSet) => void
  initial: HashtagSet | null
  brands: Brand[]
  workspaceId: string
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<SetFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      setStep(1)
      setError(null)
      if (initial) {
        setForm({
          name: initial.name,
          description: initial.description ?? '',
          category: initial.category,
          platforms: initial.platforms ?? [],
          brand_id: initial.brand_id ?? '',
          hashtags: initial.hashtags,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, initial])

  const set = <K extends keyof SetFormState>(k: K, v: SetFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const togglePlatform = (p: string) =>
    set('platforms', form.platforms.includes(p) ? form.platforms.filter(x => x !== p) : [...form.platforms, p])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); setStep(1); return }
    if (form.hashtags.length === 0) { setError('Add at least one hashtag.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        workspace_id: workspaceId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        platforms: form.platforms,
        brand_id: form.brand_id || null,
        hashtags: form.hashtags,
      }

      if (initial) {
        const { data, error: err } = await supabase
          .from('hashtag_sets')
          .update(payload)
          .eq('id', initial.id)
          .select()
          .single()
        if (err) throw err
        onSave(data as HashtagSet)
      } else {
        const { data, error: err } = await supabase
          .from('hashtag_sets')
          .insert(payload)
          .select()
          .single()
        if (err) throw err
        onSave(data as HashtagSet)
      }
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Hashtag Set' : 'New Hashtag Set'}
      size="lg"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => { if (s === 2 && !form.name.trim()) return; setStep(s as 1 | 2) }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              step === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            <span className={cn(
              'w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center',
              step === s ? 'bg-white text-blue-600' : 'bg-slate-300 text-slate-600',
            )}>{s}</span>
            {s === 1 ? 'Details' : 'Hashtags'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <X size={14} className="shrink-0" /> {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Input
            label="Set Name *"
            placeholder="e.g. Fitness Niche — High Volume"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
          <Textarea
            label="Description"
            placeholder="What is this set for?"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
          />
          <Select
            label="Category"
            value={form.category}
            onChange={e => set('category', e.target.value)}
            options={CATEGORIES}
          />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    form.platforms.includes(p.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {brands.length > 0 && (
            <Select
              label="Brand (optional)"
              value={form.brand_id}
              onChange={e => set('brand_id', e.target.value)}
              options={[{ value: '', label: 'No specific brand' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
            />
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={() => { if (!form.name.trim()) { setError('Name is required.'); return }; setError(null); setStep(2) }}
            >
              Next: Add Hashtags
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <HashtagInput tags={form.hashtags} onChange={v => set('hashtags', v)} />
          <AiHashtagGenerator onAdd={newTags => {
            const merged = [...form.hashtags]
            for (const t of newTags) { if (!merged.includes(t)) merged.push(t) }
            set('hashtags', merged)
          }} />

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to Details
            </button>
            <Button variant="primary" loading={saving} onClick={handleSave} icon={<Check size={14} />}>
              {initial ? 'Save Changes' : 'Create Set'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── AI Suggest More (inline in card) ────────────────────────────────────────

function AiSuggestMore({
  set,
  onAdd,
}: {
  set: HashtagSet
  onAdd: (id: string, newTags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'hashtags', topic: set.name + ' ' + set.category }),
      })
      const data = await res.json()
      const raw: string[] = Array.isArray(data.result) ? data.result : []
      const cleaned = raw
        .map(t => t.replace(/^#+/, '').trim().toLowerCase())
        .filter(t => t && !set.hashtags.includes(t))
      setSuggestions(cleaned.slice(0, 10))
      setSelected(new Set(cleaned.slice(0, 10)))
      setOpen(true)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const toggle = (tag: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(tag) ? next.delete(tag) : next.add(tag)
    return next
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-60"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
        AI Suggest More
      </button>
    )
  }

  return (
    <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-2">
      <p className="text-xs font-semibold text-violet-700">Select hashtags to add:</p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              'px-2 py-0.5 text-xs rounded-full border transition-colors font-medium',
              selected.has(tag)
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-700 border-slate-300',
            )}
          >
            #{tag}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { onAdd(set.id, Array.from(selected)); setOpen(false); setSuggestions([]) }}
          className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Add {selected.size} selected
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Grid Card ────────────────────────────────────────────────────────────────

function HashtagSetCard({
  set,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopy,
  onAiAdd,
}: {
  set: HashtagSet
  onEdit: (s: HashtagSet) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onCopy: (tags: string[]) => void
  onAiAdd: (id: string, tags: string[]) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{set.name}</h3>
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full capitalize', CATEGORY_COLOURS[set.category] ?? CATEGORY_COLOURS.general)}>
              {set.category}
            </span>
          </div>
          {set.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{set.description}</p>
          )}
          {set.platforms && set.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {set.platforms.map(p => (
                <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded capitalize">{p}</span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onToggleFavorite(set.id)}
          className={cn('shrink-0 p-1 rounded transition-colors', set.is_favorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300')}
          title={set.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={16} fill={set.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Hashtag cloud */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {set.hashtags.slice(0, 20).map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
            #{tag}
          </span>
        ))}
        {set.hashtags.length > 20 && (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full">
            +{set.hashtags.length - 20} more
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Hash size={11} /> {set.hashtags.length} tags</span>
        <span>{set.usage_count} uses</span>
        {set.avg_reach_estimate && (
          <span>~{set.avg_reach_estimate.toLocaleString()} reach</span>
        )}
        <span className="ml-auto">{formatDate(set.created_at)}</span>
      </div>

      {/* AI suggest */}
      <AiSuggestMore set={set} onAdd={onAiAdd} />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={() => onCopy(set.hashtags)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Copy size={11} /> Copy All
        </button>
        <button
          onClick={() => onEdit(set)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Edit size={11} /> Edit
        </button>
        <button
          onClick={() => onDelete(set.id)}
          className="ml-auto p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function HashtagSetRow({
  set,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopy,
}: {
  set: HashtagSet
  onEdit: (s: HashtagSet) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onCopy: (tags: string[]) => void
}) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => onToggleFavorite(set.id)} className={cn('shrink-0', set.is_favorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300')}>
            <Star size={13} fill={set.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <span className="text-sm font-medium text-slate-900">{set.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full capitalize', CATEGORY_COLOURS[set.category] ?? CATEGORY_COLOURS.general)}>
          {set.category}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {set.platforms?.slice(0, 3).map(p => (
            <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded capitalize">{p}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{set.hashtags.length}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{set.usage_count}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(set.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onCopy(set.hashtags)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Copy all">
            <Copy size={13} />
          </button>
          <button onClick={() => onEdit(set)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded" title="Edit">
            <Edit size={13} />
          </button>
          <button onClick={() => onDelete(set.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Research Tool ────────────────────────────────────────────────────────────

function HashtagResearchTool({ sets, onAddToSet }: { sets: HashtagSet[]; onAddToSet: (setId: string, tags: string[]) => void }) {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ tag: string; tier: 'High' | 'Medium' | 'Low' }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState<string | null>(null) // tag being added
  const [selectedSetId, setSelectedSetId] = useState('')

  const research = async () => {
    if (!topic.trim()) return
    setLoading(true); setError(null); setResults([])
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'hashtags',
          topic: `${topic} — research mode: group suggested hashtags by reach tier (high volume 1M+, medium 100K-1M, low niche under 100K)`,
        }),
      })
      if (!res.ok) throw new Error('Research failed')
      const data = await res.json()
      const raw: string[] = Array.isArray(data.result) ? data.result : []
      const total = raw.length
      const mapped = raw.map((t, i) => ({
        tag: t.replace(/^#+/, '').trim().toLowerCase(),
        tier: (i < Math.ceil(total * 0.25) ? 'High' : i < Math.ceil(total * 0.65) ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
      })).filter(x => x.tag)
      setResults(mapped)
    } catch {
      setError('Research failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const TIER_STYLES: Record<string, string> = {
    High: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-slate-100 text-slate-600',
  }

  const grouped = {
    High: results.filter(r => r.tier === 'High'),
    Medium: results.filter(r => r.tier === 'Medium'),
    Low: results.filter(r => r.tier === 'Low'),
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <Search size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Hashtag Research Tool</h3>
          <p className="text-xs text-slate-500">AI-powered hashtag discovery grouped by estimated reach</p>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && research()}
          placeholder="Enter a topic or industry to research…"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button variant="primary" loading={loading} onClick={research} icon={<Search size={14} />}>
          Research
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-4">
          {(['High', 'Medium', 'Low'] as const).map(tier => (
            grouped[tier].length > 0 && (
              <div key={tier}>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs', TIER_STYLES[tier])}>{tier} Reach</span>
                  <span className="text-slate-400 font-normal">{grouped[tier].length} tags</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {grouped[tier].map(({ tag }) => (
                    <div key={tag} className="flex items-center gap-1">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">#{tag}</span>
                      <div className="relative">
                        <button
                          onClick={() => { setPickerOpen(pickerOpen === tag ? null : tag); setSelectedSetId('') }}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title="Add to a set"
                        >
                          <Plus size={11} />
                        </button>
                        {pickerOpen === tag && sets.length > 0 && (
                          <div className="absolute z-20 top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-1">
                            <p className="text-xs font-semibold text-slate-600 px-2 mb-1">Add to set:</p>
                            {sets.map(s => (
                              <button
                                key={s.id}
                                onClick={() => { onAddToSet(s.id, [tag]); setPickerOpen(null) }}
                                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-blue-50 text-slate-700"
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HashtagManagerPage() {
  const supabase = createClient()
  const [sets, setSets] = useState<HashtagSet[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState('')

  // Filter state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<HashtagSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '' })
  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message })
  }, [])
  const hideToast = useCallback(() => setToast(prev => ({ ...prev, visible: false })), [])

  // Load data
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Get workspace
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      const wid = member?.workspace_id ?? user.id
      setWorkspaceId(wid)

      const [setsRes, brandsRes] = await Promise.all([
        supabase.from('hashtag_sets').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
        supabase.from('brands').select('id, name').eq('workspace_id', wid),
      ])

      if (setsRes.data) setSets(setsRes.data as HashtagSet[])
      if (brandsRes.data) setBrands(brandsRes.data as Brand[])
      setLoading(false)
    }
    load()
  }, [])

  // Filtered sets
  const filtered = sets.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !s.hashtags.some(t => t.includes(search.toLowerCase()))) return false
    if (categoryFilter && s.category !== categoryFilter) return false
    if (platformFilter && !s.platforms?.includes(platformFilter)) return false
    if (favoritesOnly && !s.is_favorite) return false
    return true
  })

  const handleSave = (saved: HashtagSet) => {
    setSets(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev]
    })
    showToast(editTarget ? 'Hashtag set updated.' : 'Hashtag set created!')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await supabase.from('hashtag_sets').delete().eq('id', deleteTarget)
    setSets(prev => prev.filter(s => s.id !== deleteTarget))
    setDeleteTarget(null)
    setDeleteLoading(false)
    showToast('Hashtag set deleted.')
  }

  const handleToggleFavorite = async (id: string) => {
    const current = sets.find(s => s.id === id)
    if (!current) return
    const next = !current.is_favorite
    await supabase.from('hashtag_sets').update({ is_favorite: next }).eq('id', id)
    setSets(prev => prev.map(s => s.id === id ? { ...s, is_favorite: next } : s))
  }

  const handleCopy = (tags: string[]) => {
    const text = tags.map(t => `#${t}`).join(' ')
    navigator.clipboard.writeText(text)
    showToast(`Copied ${tags.length} hashtags to clipboard!`)
  }

  const handleAiAdd = async (setId: string, newTags: string[]) => {
    const current = sets.find(s => s.id === setId)
    if (!current) return
    const merged = [...current.hashtags]
    for (const t of newTags) { if (!merged.includes(t)) merged.push(t) }
    await supabase.from('hashtag_sets').update({ hashtags: merged }).eq('id', setId)
    setSets(prev => prev.map(s => s.id === setId ? { ...s, hashtags: merged } : s))
    showToast(`Added ${newTags.length} hashtags to "${current.name}"`)
  }

  const handleAddToSet = async (setId: string, tags: string[]) => {
    await handleAiAdd(setId, tags)
  }

  return (
    <div className="p-6 space-y-6">
      <Toast message={toast.message} visible={toast.visible} onHide={hideToast} />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Hashtag Set"
        description="This hashtag set will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />

      <SetModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSave={handleSave}
        initial={editTarget}
        brands={brands}
        workspaceId={workspaceId}
      />

      {/* Page header */}
      <PageHeader
        title="Hashtag Manager"
        subtitle="Build, save and deploy strategic hashtag sets across your content."
        breadcrumbs={[{ label: 'App' }, { label: 'Studio' }, { label: 'Hashtags' }]}
      >
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setEditTarget(null); setModalOpen(true) }}>
          New Set
        </Button>
      </PageHeader>

      {/* KPI strip */}
      {!loading && <KpiStrip sets={sets} />}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sets or hashtags…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={platformFilter}
          onChange={e => setPlatformFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button
          onClick={() => setFavoritesOnly(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors font-medium',
            favoritesOnly ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-600 hover:border-amber-300',
          )}
        >
          <Star size={13} fill={favoritesOnly ? 'currentColor' : 'none'} />
          Favorites
        </button>
        <div className="flex border border-slate-300 rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
          >
            <Grid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('p-2 transition-colors', viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50')}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Hash}
            title={sets.length === 0 ? 'No hashtag sets yet' : 'No sets match your filters'}
            description={
              sets.length === 0
                ? 'Create your first set to organise your hashtags strategically.'
                : 'Try adjusting your search or filter criteria.'
            }
            action={sets.length === 0 ? {
              label: '+ New Set',
              icon: <Plus size={14} />,
              onClick: () => { setEditTarget(null); setModalOpen(true) },
            } : undefined}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(s => (
            <HashtagSetCard
              key={s.id}
              set={s}
              onEdit={set => { setEditTarget(set); setModalOpen(true) }}
              onDelete={id => setDeleteTarget(id)}
              onToggleFavorite={handleToggleFavorite}
              onCopy={handleCopy}
              onAiAdd={handleAiAdd}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Category', 'Platforms', 'Tags', 'Uses', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => (
                <HashtagSetRow
                  key={s.id}
                  set={s}
                  onEdit={set => { setEditTarget(set); setModalOpen(true) }}
                  onDelete={id => setDeleteTarget(id)}
                  onToggleFavorite={handleToggleFavorite}
                  onCopy={handleCopy}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Research tool */}
      <HashtagResearchTool sets={sets} onAddToSet={handleAddToSet} />
    </div>
  )
}
