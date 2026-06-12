'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Trophy, Calendar, Users, Hash, Edit2, Archive, StopCircle,
  PlayCircle, ChevronLeft, Check, Copy, Download, ExternalLink,
  RefreshCw, Shuffle, Search, AlertTriangle, Globe, FileText,
  BarChart2, Clock, CheckCircle2, XCircle, Gift, Star, Megaphone,
  Trash2, Plus, Eye, Settings, Activity,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  GIVEAWAY_ENTRY_METHODS,
  GIVEAWAY_ENTRY_LABELS,
  SOCIAL_PLATFORMS,
  PLATFORM_LABELS,
} from '@/lib/constants'

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  rules?: string | null
  terms_url?: string | null
  announcement_post_url?: string | null
}

interface GiveawayEntry {
  id: string
  giveaway_id: string
  participant_handle: string
  platform: string | null
  entry_method: string | null
  entry_data: string | null
  is_valid: boolean
  is_winner: boolean
  disqualification_reason: string | null
  created_at: string
}

interface AuditLog {
  id: string
  action: string
  resource_type: string
  resource_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  user_id: string
}

interface ContentPost {
  id: string
  title: string | null
  caption: string | null
  platform: string | null
  status: string
  created_at: string
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

const currencySymbol = (c: string) => c === 'GBP' ? '£' : c === 'USD' ? '$' : '€'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysRemaining(end: string | null): number | null {
  if (!end) return null
  const diff = new Date(end).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1', '#14b8a6', '#a855f7']

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'entries', label: 'Entries' },
  { id: 'winners', label: 'Pick Winners' },
  { id: 'announce', label: 'Announce' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'content', label: 'Content' },
  { id: 'settings', label: 'Settings' },
  { id: 'audit', label: 'Audit Log' },
]

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ giveaway, onEnd, onArchive }: { giveaway: Giveaway; onEnd: () => void; onArchive: () => void }) {
  const days = daysRemaining(giveaway.end_date)

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy size={32} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Prize</p>
            <h2 className="text-xl font-bold text-amber-900">{giveaway.prize_title}</h2>
            {giveaway.prize_value && (
              <p className="text-2xl font-extrabold text-amber-700 mt-1">
                {currencySymbol(giveaway.prize_currency)}{giveaway.prize_value.toLocaleString()}
              </p>
            )}
            {giveaway.prize_quantity > 1 && (
              <p className="text-sm text-amber-600 mt-1">{giveaway.prize_quantity} prizes available</p>
            )}
          </div>
          {days !== null && (
            <div className="text-center shrink-0">
              <p className="text-3xl font-extrabold text-amber-700">{days}</p>
              <p className="text-xs text-amber-600 font-medium">{days === 1 ? 'day' : 'days'} left</p>
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">Platform</p>
          <p className="font-semibold text-slate-900">{giveaway.platform ? PLATFORM_LABELS[giveaway.platform] ?? giveaway.platform : '—'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">Start Date</p>
          <p className="font-semibold text-slate-900">{fmtDate(giveaway.start_date)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">End Date</p>
          <p className="font-semibold text-slate-900">{fmtDate(giveaway.end_date)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">Winners</p>
          <p className="font-semibold text-slate-900">{giveaway.winner_count} ({giveaway.winner_selection})</p>
        </div>
      </div>

      {/* Entry hashtag */}
      {giveaway.entry_hashtag && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Hash size={18} className="text-blue-600 shrink-0" />
          <div>
            <p className="text-xs text-blue-600 font-medium mb-0.5">Entry Hashtag</p>
            <p className="font-semibold text-blue-900">{giveaway.entry_hashtag}</p>
          </div>
        </div>
      )}

      {/* Entry methods */}
      {giveaway.entry_methods?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-900 mb-3">Entry Methods</p>
          <div className="flex flex-wrap gap-2">
            {giveaway.entry_methods.map(m => (
              <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg">
                <Check size={13} className="text-emerald-500" />
                {GIVEAWAY_ENTRY_LABELS[m] ?? m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {giveaway.rules && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-900 mb-2">Rules & Conditions</p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{giveaway.rules}</p>
        </div>
      )}

      {/* Terms */}
      {giveaway.terms_url && (
        <a href={giveaway.terms_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ExternalLink size={13} />
          View full terms & conditions
        </a>
      )}

      {/* Danger zone */}
      <div className="border border-red-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-red-700 mb-1">Danger Zone</p>
        <p className="text-xs text-slate-500 mb-4">These actions are irreversible. Proceed with caution.</p>
        <div className="flex flex-wrap gap-2">
          {giveaway.status === 'active' && (
            <Button variant="danger" size="sm" icon={<StopCircle size={13} />} onClick={onEnd}>
              End Giveaway
            </Button>
          )}
          {giveaway.status !== 'archived' && (
            <Button variant="secondary" size="sm" icon={<Archive size={13} />} onClick={onArchive}
              className="text-slate-600 border-slate-300">
              Archive Giveaway
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Entries Tab ───────────────────────────────────────────────────────────────

function EntriesTab({ giveaway }: { giveaway: Giveaway }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<GiveawayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [winnerTarget, setWinnerTarget] = useState<GiveawayEntry | null>(null)
  const [disqualifyTarget, setDisqualifyTarget] = useState<GiveawayEntry | null>(null)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('giveaway_entries')
      .select('*')
      .eq('giveaway_id', giveaway.id)
      .order('created_at', { ascending: false })
    setEntries(data ?? [])
    setLoading(false)
  }, [giveaway.id])

  useEffect(() => { fetch() }, [fetch])

  const filtered = entries.filter(e => {
    if (filter === 'valid') return e.is_valid && !e.is_winner
    if (filter === 'winners') return e.is_winner
    if (filter === 'disqualified') return !e.is_valid
    return true
  })

  const exportCSV = () => {
    const headers = ['Handle', 'Platform', 'Entry Method', 'Entry Data', 'Valid', 'Winner', 'Entered At']
    const rows = entries.map(e => [
      e.participant_handle,
      e.platform ?? '',
      e.entry_method ? (GIVEAWAY_ENTRY_LABELS[e.entry_method] ?? e.entry_method) : '',
      e.entry_data ?? '',
      e.is_valid ? 'Yes' : 'No',
      e.is_winner ? 'Yes' : 'No',
      fmtDateTime(e.created_at),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `giveaway-entries-${giveaway.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const markWinner = async () => {
    if (!winnerTarget) return
    setActionLoading(true)
    await supabase.from('giveaway_entries').update({ is_winner: true }).eq('id', winnerTarget.id)
    await fetch()
    setWinnerTarget(null)
    setActionLoading(false)
  }

  const disqualify = async () => {
    if (!disqualifyTarget) return
    setActionLoading(true)
    await supabase.from('giveaway_entries').update({ is_valid: false, disqualification_reason: disqualifyReason || null }).eq('id', disqualifyTarget.id)
    await fetch()
    setDisqualifyTarget(null)
    setDisqualifyReason('')
    setActionLoading(false)
  }

  const totalValid = entries.filter(e => e.is_valid).length
  const totalDQ = entries.filter(e => !e.is_valid).length
  const totalWinners = entries.filter(e => e.is_winner).length
  const totalUnique = new Set(entries.map(e => e.participant_handle)).size

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries', value: entries.length, color: 'text-blue-600 bg-blue-50' },
          { label: 'Unique Participants', value: totalUnique, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Valid Entries', value: totalValid, color: 'text-slate-600 bg-slate-50' },
          { label: 'Disqualified', value: totalDQ, color: 'text-red-600 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color.split(' ')[0])}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {[
            { id: 'all', label: `All (${entries.length})` },
            { id: 'valid', label: `Valid (${totalValid})` },
            { id: 'winners', label: `Winners (${totalWinners})` },
            { id: 'disqualified', label: `Disqualified (${totalDQ})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn('px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
                filter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >{f.label}</button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={exportCSV}>
          Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="space-y-1">{[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No entries found" description="Entries will appear here as participants enter your giveaway." compact />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['#', 'Handle', 'Platform', 'Method', 'Entry Data', 'Valid', 'Winner', 'Entered', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">@{e.participant_handle}</td>
                  <td className="px-3 py-2.5">
                    {e.platform ? <Badge variant="blue">{PLATFORM_LABELS[e.platform] ?? e.platform}</Badge> : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {e.entry_method ? (GIVEAWAY_ENTRY_LABELS[e.entry_method] ?? e.entry_method) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[140px] truncate">{e.entry_data ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    {e.is_valid
                      ? <CheckCircle2 size={15} className="text-emerald-500" />
                      : <XCircle size={15} className="text-red-400" />}
                  </td>
                  <td className="px-3 py-2.5">
                    {e.is_winner
                      ? <Star size={15} className="text-amber-500 fill-amber-400" />
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(e.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {!e.is_winner && e.is_valid && (
                        <Button size="xs" variant="ghost" className="text-amber-600 hover:bg-amber-50" onClick={() => setWinnerTarget(e)}>
                          <Star size={12} />
                        </Button>
                      )}
                      {e.is_valid && (
                        <Button size="xs" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { setDisqualifyTarget(e); setDisqualifyReason('') }}>
                          <XCircle size={12} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!winnerTarget}
        onClose={() => setWinnerTarget(null)}
        onConfirm={markWinner}
        title="Mark as Winner"
        description={`Mark @${winnerTarget?.participant_handle} as a winner of this giveaway?`}
        confirmLabel="Mark Winner"
        loading={actionLoading}
      />

      <Modal
        open={!!disqualifyTarget}
        onClose={() => { setDisqualifyTarget(null); setDisqualifyReason('') }}
        title="Disqualify Entry"
        description={`Disqualify @${disqualifyTarget?.participant_handle} from this giveaway?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setDisqualifyTarget(null); setDisqualifyReason('') }}>Cancel</Button>
            <Button variant="danger" size="sm" loading={actionLoading} onClick={disqualify}>Disqualify</Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          placeholder="e.g. Fake account, violated rules…"
          value={disqualifyReason}
          onChange={e => setDisqualifyReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  )
}

// ─── Pick Winners Tab ──────────────────────────────────────────────────────────

function PickWinnersTab({ giveaway }: { giveaway: Giveaway }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<GiveawayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [drawPreview, setDrawPreview] = useState<GiveawayEntry[]>([])
  const [confirmDraw, setConfirmDraw] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState<GiveawayEntry | null | 'notfound'>('notfound')
  const [removeTarget, setRemoveTarget] = useState<GiveawayEntry | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('giveaway_entries')
      .select('*')
      .eq('giveaway_id', giveaway.id)
    setEntries(data ?? [])
    setLoading(false)
  }, [giveaway.id])

  useEffect(() => { fetch() }, [fetch])

  const winners = entries.filter(e => e.is_winner)
  const validPool = entries.filter(e => e.is_valid && !e.is_winner)
  const needed = Math.max(0, giveaway.winner_count - winners.length)

  const randomDraw = () => {
    const shuffled = [...validPool].sort(() => Math.random() - 0.5)
    setDrawPreview(shuffled.slice(0, needed))
  }

  const confirmWinners = async () => {
    setActionLoading(true)
    await supabase
      .from('giveaway_entries')
      .update({ is_winner: true })
      .in('id', drawPreview.map(e => e.id))
    await fetch()
    setDrawPreview([])
    setConfirmDraw(false)
    setActionLoading(false)
  }

  const removeWinner = async () => {
    if (!removeTarget) return
    setActionLoading(true)
    await supabase.from('giveaway_entries').update({ is_winner: false }).eq('id', removeTarget.id)
    await fetch()
    setRemoveTarget(null)
    setActionLoading(false)
  }

  const handleSearch = () => {
    if (!search.trim()) return
    const handle = search.trim().replace(/^@/, '').toLowerCase()
    const found = validPool.find(e => e.participant_handle.toLowerCase() === handle)
    setSearchResult(found ?? 'notfound')
  }

  const addManual = async (entry: GiveawayEntry) => {
    setActionLoading(true)
    await supabase.from('giveaway_entries').update({ is_winner: true }).eq('id', entry.id)
    await fetch()
    setSearch('')
    setSearchResult('notfound')
    setActionLoading(false)
  }

  if (loading) return <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>

  return (
    <div className="space-y-6">
      {/* Safety banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">Winners will need to be announced separately on your social channel. Use the Announce tab to generate announcement captions.</p>
      </div>

      {/* Current winners */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Current Winners</h3>
          <span className={cn('text-sm font-semibold px-2.5 py-1 rounded-full',
            winners.length >= giveaway.winner_count ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          )}>
            {winners.length} / {giveaway.winner_count} selected
          </span>
        </div>
        {winners.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No winners selected yet.</p>
        ) : (
          <div className="space-y-2">
            {winners.map(w => (
              <div key={w.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Star size={14} className="text-amber-500 fill-amber-400" />
                  <span className="font-medium text-slate-900">@{w.participant_handle}</span>
                  {w.entry_method && (
                    <span className="text-xs text-slate-500">{GIVEAWAY_ENTRY_LABELS[w.entry_method] ?? w.entry_method}</span>
                  )}
                </div>
                <Button size="xs" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setRemoveTarget(w)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {needed > 0 && (
        <>
          {/* Random draw */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Random Draw</h3>
            <p className="text-sm text-slate-500">{validPool.length} valid entries in pool. Need {needed} more winner{needed !== 1 ? 's' : ''}.</p>
            <Button
              variant="primary"
              icon={<Shuffle size={15} />}
              onClick={randomDraw}
              disabled={validPool.length === 0}
            >
              Draw {needed} Winner{needed !== 1 ? 's' : ''} Randomly
            </Button>

            {drawPreview.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Preview — Not yet confirmed</p>
                {drawPreview.map(e => (
                  <div key={e.id} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                    <Shuffle size={13} className="text-blue-500" />
                    <span className="font-medium text-slate-900">@{e.participant_handle}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button variant="primary" size="sm" loading={actionLoading} onClick={() => setConfirmDraw(true)}>
                    Confirm Winners
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setDrawPreview([])}>Re-draw</Button>
                </div>
              </div>
            )}
          </div>

          {/* Manual selection */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Manual Selection</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Search by handle (e.g. john_doe)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                icon={<Search size={14} />}
                className="flex-1"
              />
              <Button variant="secondary" size="md" onClick={handleSearch}>Search</Button>
            </div>
            {searchResult !== 'notfound' && searchResult !== null && typeof searchResult === 'object' && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">@{searchResult.participant_handle}</p>
                  <p className="text-xs text-slate-500">{searchResult.entry_method ? GIVEAWAY_ENTRY_LABELS[searchResult.entry_method] : '—'}</p>
                </div>
                <Button size="sm" variant="primary" loading={actionLoading} onClick={() => addManual(searchResult as GiveawayEntry)}>
                  Add as Winner
                </Button>
              </div>
            )}
            {search && searchResult === null && (
              <p className="text-sm text-red-500">No valid entry found for that handle.</p>
            )}
          </div>
        </>
      )}

      {winners.length >= giveaway.winner_count && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">All {giveaway.winner_count} winner{giveaway.winner_count !== 1 ? 's' : ''} selected! Head to the Announce tab to generate your announcement.</p>
        </div>
      )}

      <ConfirmModal
        open={confirmDraw}
        onClose={() => setConfirmDraw(false)}
        onConfirm={confirmWinners}
        title="Confirm Winners"
        description={`Confirm these ${drawPreview.length} randomly selected winner${drawPreview.length !== 1 ? 's' : ''}? This will update their entries.`}
        confirmLabel="Confirm Winners"
        loading={actionLoading}
      />

      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeWinner}
        title="Remove Winner"
        description={`Remove @${removeTarget?.participant_handle} from the winners list?`}
        confirmLabel="Remove"
        danger
        loading={actionLoading}
      />
    </div>
  )
}

// ─── Announce Winners Tab ──────────────────────────────────────────────────────

function AnnounceTab({ giveaway, onRefresh }: { giveaway: Giveaway; onRefresh: () => void }) {
  const supabase = createClient()
  const [winners, setWinners] = useState<GiveawayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [captions, setCaptions] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [postUrl, setPostUrl] = useState(giveaway.announcement_post_url ?? '')
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    const fetchWinners = async () => {
      const { data } = await supabase
        .from('giveaway_entries')
        .select('*')
        .eq('giveaway_id', giveaway.id)
        .eq('is_winner', true)
      setWinners(data ?? [])
      setLoading(false)
    }
    fetchWinners()
  }, [giveaway.id])

  const generateCaptions = async () => {
    setGenerating(true)
    try {
      const winnerHandles = winners.map(w => `@${w.participant_handle}`).join(', ')
      const topic = `Giveaway winner announcement for "${giveaway.title}". Prize: ${giveaway.prize_title}. Winners: ${winnerHandles || 'TBD'}. Platform: ${giveaway.platform ? PLATFORM_LABELS[giveaway.platform] : 'social media'}.`
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', topic, count: 3 }),
      })
      const json = await res.json()
      if (json.captions) {
        setCaptions(Array.isArray(json.captions) ? json.captions : [json.captions])
      } else if (json.caption) {
        setCaptions(Array.isArray(json.caption) ? json.caption : [json.caption])
      } else if (json.result) {
        setCaptions([json.result])
      }
    } catch {
      setCaptions(['Could not generate captions. Please try again.'])
    } finally {
      setGenerating(false)
    }
  }

  const copyCaption = (idx: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  const markAnnounced = async () => {
    setAnnouncing(true)
    await supabase
      .from('giveaways')
      .update({ winners_announced_at: new Date().toISOString(), announcement_post_url: postUrl || null })
      .eq('id', giveaway.id)
    onRefresh()
    setAnnouncing(false)
  }

  if (loading) return <Skeleton className="h-40 rounded-xl" />

  return (
    <div className="space-y-6">
      {/* Winners list */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Selected Winners ({winners.length})</h3>
        {winners.length === 0 ? (
          <EmptyState icon={Trophy} title="No winners selected" description="Go to Pick Winners tab to select your winners first." compact />
        ) : (
          <div className="space-y-2">
            {winners.map(w => (
              <div key={w.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <Star size={15} className="text-amber-500 fill-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">@{w.participant_handle}</p>
                  <p className="text-xs text-slate-500">{w.entry_method ? GIVEAWAY_ENTRY_LABELS[w.entry_method] : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI caption generator */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Announcement Caption</h3>
          <Button
            variant="ai"
            size="sm"
            loading={generating}
            icon={<Megaphone size={13} />}
            onClick={generateCaptions}
          >
            Generate Announcement Caption
          </Button>
        </div>

        {captions.length > 0 && (
          <div className="space-y-3">
            {captions.map((c, i) => (
              <div key={i} className="relative bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pr-8">{c}</p>
                <button
                  onClick={() => copyCaption(i, c)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {copied === i ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark announced */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Mark as Announced</h3>
        {giveaway.winners_announced_at ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Winners announced on {fmtDateTime(giveaway.winners_announced_at)}</p>
              {giveaway.announcement_post_url && (
                <a href={giveaway.announcement_post_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                  <ExternalLink size={11} /> View announcement post
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            <Input
              label="Announcement Post URL (optional)"
              placeholder="https://instagram.com/p/..."
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
            />
            <Button variant="primary" loading={announcing} icon={<CheckCircle2 size={14} />} onClick={markAnnounced} disabled={winners.length === 0}>
              Mark as Announced
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ giveaway }: { giveaway: Giveaway }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<GiveawayEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('giveaway_entries')
        .select('*')
        .eq('giveaway_id', giveaway.id)
        .order('created_at', { ascending: true })
      setEntries(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [giveaway.id])

  if (loading) return (
    <div className="space-y-4">
      {[0,1,2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  )

  if (entries.length === 0) {
    return <EmptyState icon={BarChart2} title="No analytics yet" description="Analytics will appear once entries start coming in." />
  }

  // Entries per day
  const dayMap: Record<string, number> = {}
  entries.forEach(e => {
    const day = e.created_at.slice(0, 10)
    dayMap[day] = (dayMap[day] ?? 0) + 1
  })
  const dailyData = Object.entries(dayMap).map(([date, count]) => ({ date: fmtDate(date), count }))

  // Entry method breakdown
  const methodMap: Record<string, number> = {}
  entries.forEach(e => {
    const m = e.entry_method ?? 'unknown'
    methodMap[m] = (methodMap[m] ?? 0) + 1
  })
  const methodData = Object.entries(methodMap).map(([method, count]) => ({
    name: GIVEAWAY_ENTRY_LABELS[method] ?? method,
    value: count,
  }))

  const avgPerDay = entries.length > 0 && dailyData.length > 0
    ? Math.round(entries.length / dailyData.length)
    : 0

  const uniqueParticipants = new Set(entries.map(e => e.participant_handle)).size

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: entries.length },
          { label: 'Unique Participants', value: uniqueParticipants },
          { label: 'Avg Entries / Day', value: avgPerDay },
          { label: 'Entry Methods Used', value: Object.keys(methodMap).length },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-medium">{k.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{k.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Entries per day bar chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Entries Per Day</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" name="Entries" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Method breakdown pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Entries by Method</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {methodData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Entry Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" name="Entries" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Content Tab ───────────────────────────────────────────────────────────────

function ContentTab({ giveaway }: { giveaway: Giveaway }) {
  const supabase = createClient()
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [quickCaption, setQuickCaption] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiCaptions, setAiCaptions] = useState<string[]>([])
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    const fetch = async () => {
      if (!giveaway.campaign_id) { setLoading(false); return }
      const { data } = await supabase
        .from('content_posts')
        .select('id, title, caption, platform, status, created_at')
        .eq('campaign_id', giveaway.campaign_id)
        .order('created_at', { ascending: false })
      setPosts(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [giveaway.campaign_id, giveaway.id])

  const generateIdeas = async () => {
    setGenerating(true)
    const methods = giveaway.entry_methods?.map(m => GIVEAWAY_ENTRY_LABELS[m] ?? m).join(', ')
    const topic = `Caption ideas to announce the "${giveaway.title}" giveaway. Prize: ${giveaway.prize_title}. Entry methods: ${methods || 'follow & like'}. Hashtag: ${giveaway.entry_hashtag ?? 'none'}.`
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'caption', topic, count: 3 }),
      })
      const json = await res.json()
      if (json.captions) setAiCaptions(Array.isArray(json.captions) ? json.captions : [json.captions])
      else if (json.caption) setAiCaptions(Array.isArray(json.caption) ? json.caption : [json.caption])
      else if (json.result) setAiCaptions([json.result])
    } catch {
      setAiCaptions(['Could not generate captions.'])
    } finally {
      setGenerating(false)
    }
  }

  const copy = (i: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  const defaultCaption = giveaway.entry_methods?.length
    ? `🎉 GIVEAWAY TIME! Win ${giveaway.prize_title}!\n\nTo enter:\n${giveaway.entry_methods.map(m => `✅ ${GIVEAWAY_ENTRY_LABELS[m] ?? m}`).join('\n')}${giveaway.entry_hashtag ? `\n✅ Use ${giveaway.entry_hashtag}` : ''}\n\nGiveaway ends ${fmtDate(giveaway.end_date)}. Good luck!`
    : ''

  return (
    <div className="space-y-6">
      {/* Linked campaign posts */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Campaign Posts {giveaway.campaign_id ? '' : '(No campaign linked)'}</h3>
        {loading ? (
          <div className="space-y-1">{[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : posts.length === 0 ? (
          <EmptyState icon={FileText} title="No posts yet" description="Posts linked to this campaign will appear here." compact />
        ) : (
          <div className="space-y-2">
            {posts.map(p => (
              <div key={p.id} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{p.title ?? p.caption?.slice(0, 60) ?? 'Untitled post'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.platform && <Badge variant="blue" className="text-xs">{PLATFORM_LABELS[p.platform] ?? p.platform}</Badge>}
                    <Badge status={p.status}>{p.status}</Badge>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{fmtDate(p.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick post creator */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Quick Caption Creator</h3>
        <Textarea
          label="Caption (pre-filled with entry instructions)"
          value={quickCaption || defaultCaption}
          onChange={e => setQuickCaption(e.target.value)}
          rows={8}
        />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Copy size={13} />} onClick={() => {
            navigator.clipboard.writeText(quickCaption || defaultCaption)
          }}>
            Copy Caption
          </Button>
        </div>
      </div>

      {/* AI caption ideas */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">AI Caption Ideas</h3>
          <Button variant="ai" size="sm" loading={generating} onClick={generateIdeas} icon={<Megaphone size={13} />}>
            Generate Ideas
          </Button>
        </div>
        {aiCaptions.length > 0 ? (
          <div className="space-y-3">
            {aiCaptions.map((c, i) => (
              <div key={i} className="relative bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pr-8">{c}</p>
                <button onClick={() => copy(i, c)} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  {copied === i ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Click Generate Ideas to get AI-powered caption suggestions for announcing your giveaway.</p>
        )}
      </div>
    </div>
  )
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ giveaway, onRefresh, onDelete }: { giveaway: Giveaway; onRefresh: () => void; onDelete: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({
    title: giveaway.title,
    description: giveaway.description ?? '',
    platform: giveaway.platform ?? '',
    entry_methods: giveaway.entry_methods ?? [],
    entry_hashtag: giveaway.entry_hashtag ?? '',
    rules: giveaway.rules ?? '',
    terms_url: giveaway.terms_url ?? '',
    start_date: giveaway.start_date ? giveaway.start_date.slice(0, 16) : '',
    end_date: giveaway.end_date ? giveaway.end_date.slice(0, 16) : '',
    winner_count: giveaway.winner_count.toString(),
    winner_selection: giveaway.winner_selection,
    prize_title: giveaway.prize_title,
    prize_value: giveaway.prize_value?.toString() ?? '',
    prize_currency: giveaway.prize_currency,
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const set = (k: keyof typeof form, v: string | string[]) => setForm(f => ({ ...f, [k]: v }))

  const toggleMethod = (m: string) => {
    set('entry_methods', form.entry_methods.includes(m)
      ? form.entry_methods.filter(x => x !== m)
      : [...form.entry_methods, m],
    )
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('giveaways').update({
      title: form.title,
      description: form.description || null,
      platform: form.platform || null,
      entry_methods: form.entry_methods,
      entry_hashtag: form.entry_hashtag || null,
      rules: form.rules || null,
      terms_url: form.terms_url || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      winner_count: parseInt(form.winner_count) || 1,
      winner_selection: form.winner_selection,
      prize_title: form.prize_title,
      prize_value: form.prize_value ? parseFloat(form.prize_value) : null,
      prize_currency: form.prize_currency,
    }).eq('id', giveaway.id)
    onRefresh()
    setSaving(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('giveaways').delete().eq('id', giveaway.id)
    router.push('/app/campaigns/giveaways')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">General</h3>
        <Input label="Title" value={form.title} onChange={e => set('title', e.target.value)} />
        <Textarea label="Description" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
        <Select
          label="Platform"
          value={form.platform}
          onChange={e => set('platform', e.target.value)}
          options={[{ value: '', label: '— Select platform —' }, ...SOCIAL_PLATFORMS.map(p => ({ value: p, label: PLATFORM_LABELS[p] }))]}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Prize</h3>
        <Input label="Prize Title" value={form.prize_title} onChange={e => set('prize_title', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prize Value" type="number" value={form.prize_value} onChange={e => set('prize_value', e.target.value)} />
          <Select label="Currency" value={form.prize_currency} onChange={e => set('prize_currency', e.target.value)}
            options={[{ value: 'GBP', label: 'GBP (£)' }, { value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Winner Count" type="number" value={form.winner_count} onChange={e => set('winner_count', e.target.value)} />
          <Select label="Selection Method" value={form.winner_selection} onChange={e => set('winner_selection', e.target.value)}
            options={[{ value: 'random', label: 'Random draw' }, { value: 'manual', label: 'Manual selection' }]} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Entry Rules</h3>
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">Entry Methods</label>
          <div className="grid grid-cols-2 gap-2">
            {GIVEAWAY_ENTRY_METHODS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                  form.entry_methods.includes(m) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  form.entry_methods.includes(m) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                )}>
                  {form.entry_methods.includes(m) && <Check size={10} className="text-white" />}
                </div>
                {GIVEAWAY_ENTRY_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <Input label="Entry Hashtag" value={form.entry_hashtag} onChange={e => set('entry_hashtag', e.target.value)} placeholder="#YourHashtag" icon={<Hash size={14} />} />
        <Textarea label="Rules & Conditions" value={form.rules} onChange={e => set('rules', e.target.value)} rows={4} />
        <Input label="Terms URL" value={form.terms_url} onChange={e => set('terms_url', e.target.value)} placeholder="https://..." />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-semibold text-slate-900">Schedule</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date & Time" type="datetime-local" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          <Input label="End Date & Time" type="datetime-local" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>

      <Button variant="primary" loading={saving} onClick={save}>Save Changes</Button>

      {/* Danger zone */}
      <div className="border border-red-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-red-700 mb-1">Danger Zone</p>
        <p className="text-xs text-slate-500 mb-4">Destructive actions. These cannot be undone.</p>
        <div className="flex flex-wrap gap-2">
          {giveaway.status === 'active' && (
            <Button variant="danger" size="sm" icon={<StopCircle size={13} />} onClick={onDelete}>
              End Giveaway
            </Button>
          )}
          {giveaway.status !== 'archived' && (
            <Button variant="secondary" size="sm" icon={<Archive size={13} />} className="text-slate-600"
              onClick={async () => {
                await supabase.from('giveaways').update({ status: 'archived' }).eq('id', giveaway.id)
                onRefresh()
              }}>
              Archive
            </Button>
          )}
          <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setConfirmDelete(true)}>
            Delete Giveaway
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete Giveaway"
        description={`Permanently delete "${giveaway.title}"? This will delete all entries, winners, and data associated with this giveaway.`}
        confirmLabel="Delete Permanently"
        danger
        loading={deleting}
      />
    </div>
  )
}

// ─── Audit Log Tab ─────────────────────────────────────────────────────────────

function AuditLogTab({ giveaway }: { giveaway: Giveaway }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('resource_type', 'giveaway')
        .eq('resource_id', giveaway.id)
        .order('created_at', { ascending: false })
      setLogs(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [giveaway.id])

  if (loading) return <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>

  if (logs.length === 0) {
    return <EmptyState icon={Activity} title="No audit events" description="Actions performed on this giveaway will be tracked here." />
  }

  return (
    <div className="space-y-1">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-4 py-3 px-4 bg-white border border-slate-200 rounded-xl">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center shrink-0">
              <Activity size={13} className="text-blue-600" />
            </div>
            {i < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-medium text-slate-900">{log.action}</p>
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5 font-mono bg-slate-50 rounded px-2 py-1">
                {JSON.stringify(log.metadata, null, 0)}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">{fmtDateTime(log.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Detail Page ──────────────────────────────────────────────────────────

export default function GiveawayDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const supabase = createClient()

  const [giveaway, setGiveaway] = useState<Giveaway | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEdit, setShowEdit] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchGiveaway = useCallback(async () => {
    const { data } = await supabase
      .from('giveaways')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setGiveaway(data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchGiveaway() }, [fetchGiveaway])

  const handleEnd = async () => {
    if (!giveaway) return
    setActionLoading(true)
    await supabase.from('giveaways').update({ status: 'ended' }).eq('id', id)
    await fetchGiveaway()
    setConfirmEnd(false)
    setActionLoading(false)
  }

  const handleGoLive = async () => {
    if (!giveaway) return
    setActionLoading(true)
    await supabase.from('giveaways').update({ status: 'active' }).eq('id', id)
    await fetchGiveaway()
    setActionLoading(false)
  }

  const handleArchive = async () => {
    if (!giveaway) return
    setActionLoading(true)
    await supabase.from('giveaways').update({ status: 'archived' }).eq('id', id)
    await fetchGiveaway()
    setConfirmArchive(false)
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-2">
          {[0,1,2,3,4,5,6,7].map(i => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!giveaway) {
    return (
      <div className="p-6">
        <EmptyState icon={Gift} title="Giveaway not found" description="This giveaway doesn't exist or you don't have access." action={{ label: 'Back to Giveaways', onClick: () => router.push('/app/campaigns/giveaways') }} />
      </div>
    )
  }

  const tabsWithCounts = DETAIL_TABS.map(t => ({ ...t }))

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <PageHeader
        title={giveaway.title}
        breadcrumbs={[
          { label: 'Campaigns', href: '/app/campaigns' },
          { label: 'Giveaways', href: '/app/campaigns/giveaways' },
          { label: giveaway.title },
        ]}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge status={giveaway.status} dot>{giveaway.status.charAt(0).toUpperCase() + giveaway.status.slice(1)}</Badge>
          {giveaway.platform && <Badge variant="blue">{PLATFORM_LABELS[giveaway.platform] ?? giveaway.platform}</Badge>}
          <Button variant="secondary" size="sm" icon={<Edit2 size={13} />} onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          {giveaway.status === 'draft' && (
            <Button variant="primary" size="sm" icon={<PlayCircle size={13} />} loading={actionLoading} onClick={handleGoLive}>
              Go Live
            </Button>
          )}
          {giveaway.status === 'active' && (
            <Button variant="secondary" size="sm" icon={<StopCircle size={13} />} onClick={() => setConfirmEnd(true)}
              className="text-amber-600 border-amber-300 hover:bg-amber-50">
              End Giveaway
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Tabs */}
      <Tabs tabs={tabsWithCounts} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab giveaway={giveaway} onEnd={() => setConfirmEnd(true)} onArchive={() => setConfirmArchive(true)} />
        )}
        {activeTab === 'entries' && <EntriesTab giveaway={giveaway} />}
        {activeTab === 'winners' && <PickWinnersTab giveaway={giveaway} />}
        {activeTab === 'announce' && <AnnounceTab giveaway={giveaway} onRefresh={fetchGiveaway} />}
        {activeTab === 'analytics' && <AnalyticsTab giveaway={giveaway} />}
        {activeTab === 'content' && <ContentTab giveaway={giveaway} />}
        {activeTab === 'settings' && (
          <SettingsTab
            giveaway={giveaway}
            onRefresh={fetchGiveaway}
            onDelete={() => setConfirmEnd(true)}
          />
        )}
        {activeTab === 'audit' && <AuditLogTab giveaway={giveaway} />}
      </div>

      {/* Edit Modal — inline quick edit for key fields */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Giveaway"
        description="Quick edit — for full settings use the Settings tab."
        size="lg"
        footer={
          <Button variant="primary" size="sm" loading={actionLoading} onClick={async () => {
            setActionLoading(true)
            await fetchGiveaway()
            setShowEdit(false)
            setActionLoading(false)
          }}>
            Done
          </Button>
        }
      >
        <p className="text-sm text-slate-500">Use the Settings tab for full editing capabilities.</p>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => { setShowEdit(false); setActiveTab('settings') }}>
            Go to Settings Tab
          </Button>
        </div>
      </Modal>

      {/* End Confirm */}
      <ConfirmModal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={handleEnd}
        title="End Giveaway"
        description={`End "${giveaway.title}"? This will close entries and mark it as ended.`}
        confirmLabel="End Giveaway"
        danger
        loading={actionLoading}
      />

      {/* Archive Confirm */}
      <ConfirmModal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={handleArchive}
        title="Archive Giveaway"
        description={`Archive "${giveaway.title}"? It will be hidden from active views.`}
        confirmLabel="Archive"
        loading={actionLoading}
      />
    </div>
  )
}
