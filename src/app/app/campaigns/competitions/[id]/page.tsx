'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Trophy, Edit2, Share2, Copy, Check, Plus, Trash2,
  FileText, Award, Vote, Users, Calendar, Hash, Clock,
  CheckCircle, XCircle, Eye, Download, Filter, MoreHorizontal,
  Star, Archive, AlertTriangle, Sparkles, ExternalLink,
  BarChart2, TrendingUp, Loader2, ChevronDown, PlayCircle,
  Camera, Briefcase,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton, SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { COMPETITION_TYPE_LABELS, PLATFORM_LABELS } from '@/lib/constants'

/* ─── Types ──────────────────────────────────────────────────────────── */
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
  rules: string | null
  terms_url: string | null
  eligible_countries: string[] | null
  require_follow: boolean
  require_hashtag: boolean
  min_age: number | null
}

interface Submission {
  id: string
  competition_id: string
  handle: string
  submission_type: string
  content_url: string | null
  caption: string | null
  vote_count: number
  average_score: number | null
  rank: number | null
  status: string
  is_winner: boolean
  winner_place: number | null
  disqualification_reason: string | null
  created_at: string
}

interface Judge {
  id: string
  competition_id: string
  name: string
  email: string
  role: string
  assigned_submissions: number
  completed_reviews: number
  created_at: string
}

interface JudgeScore {
  id: string
  submission_id: string
  judge_id: string
  score: number
  notes: string | null
  criteria_scores: Record<string, number>
  created_at: string
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function countdown(deadline: string | null) {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days} days left`
  const hours = Math.floor(diff / 3600000)
  return `${hours} hours left`
}

function judgingLabel(t: string) {
  return t === 'panel' ? 'Panel Judging' : t === 'public_vote' ? 'Public Vote' : 'Hybrid'
}

const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2']

/* ─── Sub-components ─────────────────────────────────────────────────── */

/* Overview Tab */
function OverviewTab({ comp, onCopyLink }: { comp: Competition; onCopyLink: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}/competitions/${comp.id}/enter`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopyLink()
  }

  const prizes = Array.isArray(comp.prizes) && comp.prizes.length > 0
    ? comp.prizes
    : comp.prize_title
      ? [{ place: 1, title: comp.prize_title, value: comp.prize_value ?? 0 }]
      : []

  const placeColors = ['from-amber-400 to-yellow-500', 'from-slate-300 to-slate-400', 'from-orange-400 to-amber-500']
  const placeLabels = ['1st Place', '2nd Place', '3rd Place']

  return (
    <div className="space-y-6">
      {/* Prize Cards */}
      {prizes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Prizes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prizes.slice(0, 3).map((p, i) => (
              <div key={i} className={cn('rounded-xl p-4 bg-gradient-to-br text-white', placeColors[i] ?? 'from-blue-500 to-blue-600')}>
                <p className="text-xs font-semibold opacity-80 uppercase tracking-wide">{placeLabels[i] ?? `${p.place}th Place`}</p>
                <p className="text-base font-bold mt-1">{p.title || '—'}</p>
                {p.value > 0 && <p className="text-sm opacity-90 mt-0.5">${p.value.toLocaleString()} value</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Competition Type', value: COMPETITION_TYPE_LABELS[comp.competition_type] ?? comp.competition_type },
          { label: 'Judging Type', value: judgingLabel(comp.judging_type) },
          { label: 'Platform', value: comp.platform ? PLATFORM_LABELS[comp.platform] : 'All Platforms' },
          { label: 'Max Entries / Person', value: comp.max_submissions_per_person?.toString() ?? '1' },
        ].map(d => (
          <div key={d.label} className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs text-slate-500">{d.label}</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{d.value}</p>
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Timeline</h3>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Start Date', value: fmt(comp.start_date), icon: <Calendar size={14} className="text-blue-600" /> },
            { label: 'Submission Deadline', value: fmt(comp.submission_deadline), note: countdown(comp.submission_deadline), icon: <Clock size={14} className="text-amber-600" /> },
            { label: 'End Date', value: fmt(comp.end_date), icon: <CheckCircle size={14} className="text-emerald-600" /> },
          ].map(d => (
            <div key={d.label} className="flex items-start gap-3">
              <div className="mt-0.5">{d.icon}</div>
              <div>
                <p className="text-xs text-slate-500">{d.label}</p>
                <p className="text-sm font-semibold text-slate-900">{d.value}</p>
                {d.note && <p className="text-xs text-amber-600 font-medium">{d.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{comp.submission_count}</p>
          <p className="text-xs text-blue-600 mt-1">Submissions</p>
        </div>
        <div className="bg-violet-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-700">{comp.vote_count}</p>
          <p className="text-xs text-violet-600 mt-1">Total Votes</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">
            {Math.round(comp.submission_count * 0.7)}
          </p>
          <p className="text-xs text-emerald-600 mt-1">Est. Participants</p>
        </div>
      </div>

      {/* Entry Hashtag */}
      {comp.entry_hashtag && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
          <Hash size={16} className="text-slate-500" />
          <div>
            <p className="text-xs text-slate-500">Entry Hashtag</p>
            <p className="text-sm font-semibold text-slate-900">{comp.entry_hashtag}</p>
          </div>
        </div>
      )}

      {/* Judging Criteria */}
      {Array.isArray(comp.judging_criteria) && comp.judging_criteria.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Judging Criteria</h3>
          <div className="flex flex-wrap gap-2">
            {comp.judging_criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
                <span className="text-xs font-medium text-blue-800">{c.name}</span>
                <span className="text-xs text-blue-600 font-bold">{c.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules */}
      {comp.rules && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Competition Rules</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{comp.rules}</p>
          {comp.terms_url && (
            <a href={comp.terms_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-3">
              <ExternalLink size={12} /> View full terms & conditions
            </a>
          )}
        </div>
      )}

      {/* Share CTA */}
      <div className="flex items-center justify-between p-4 border border-dashed border-blue-300 rounded-xl bg-blue-50">
        <div>
          <p className="text-sm font-semibold text-blue-900">Share Competition Entry Link</p>
          <p className="text-xs text-blue-600 mt-0.5 font-mono truncate max-w-xs">
            {`/competitions/${comp.id}/enter`}
          </p>
        </div>
        <Button variant="outline" size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy}>
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
      </div>
    </div>
  )
}

/* Submissions Tab */
function SubmissionsTab({ comp }: { comp: Competition }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [previewSub, setPreviewSub] = useState<Submission | null>(null)
  const [disqualifyTarget, setDisqualifyTarget] = useState<Submission | null>(null)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [winnerTarget, setWinnerTarget] = useState<Submission | null>(null)
  const [winnerPlace, setWinnerPlace] = useState(1)
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('competition_submissions')
      .select('*')
      .eq('competition_id', comp.id)
      .order('created_at', { ascending: false })
    setSubmissions(data ?? [])
    setLoading(false)
  }, [comp.id])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? submissions : submissions.filter(s => {
    if (filter === 'winners') return s.is_winner
    return s.status === filter
  })

  const stats = {
    total: submissions.length,
    approved: submissions.filter(s => s.status === 'approved').length,
    disqualified: submissions.filter(s => s.status === 'disqualified').length,
    pending: submissions.filter(s => s.status === 'pending').length,
  }

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function updateStatus(id: string, status: string, extra?: Record<string, any>) {
    const supabase = createClient()
    await supabase.from('competition_submissions').update({ status, ...extra }).eq('id', id)
    load()
  }

  async function bulkApprove() {
    setBulkLoading(true)
    const supabase = createClient()
    await supabase.from('competition_submissions')
      .update({ status: 'approved' })
      .in('id', [...selected])
    setSelected(new Set())
    setBulkLoading(false)
    load()
  }

  async function bulkDisqualify() {
    setBulkLoading(true)
    const supabase = createClient()
    await supabase.from('competition_submissions')
      .update({ status: 'disqualified' })
      .in('id', [...selected])
    setSelected(new Set())
    setBulkLoading(false)
    load()
  }

  async function doDisqualify() {
    if (!disqualifyTarget) return
    await updateStatus(disqualifyTarget.id, 'disqualified', { disqualification_reason: disqualifyReason })
    setDisqualifyTarget(null)
    setDisqualifyReason('')
  }

  async function doMarkWinner() {
    if (!winnerTarget) return
    const supabase = createClient()
    await supabase.from('competition_submissions')
      .update({ is_winner: true, winner_place: winnerPlace, status: 'approved' })
      .eq('id', winnerTarget.id)
    setWinnerTarget(null)
    load()
  }

  function exportCSV() {
    const rows = [
      ['Handle', 'Type', 'Votes', 'Avg Score', 'Rank', 'Status', 'Winner', 'Submitted'],
      ...submissions.map(s => [
        s.handle, s.submission_type, s.vote_count,
        s.average_score ?? '', s.rank ?? '', s.status,
        s.is_winner ? 'Yes' : 'No', new Date(s.created_at).toLocaleString(),
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `submissions-${comp.id}.csv`
    a.click()
  }

  const filters = ['all', 'pending', 'approved', 'disqualified', 'winners']

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'slate' },
          { label: 'Approved', value: stats.approved, color: 'emerald' },
          { label: 'Disqualified', value: stats.disqualified, color: 'red' },
          { label: 'Pending Review', value: stats.pending, color: 'amber' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={cn('text-xl font-bold mt-1',
              s.color === 'emerald' ? 'text-emerald-600' :
              s.color === 'red' ? 'text-red-600' :
              s.color === 'amber' ? 'text-amber-600' : 'text-slate-900')}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg border transition-all capitalize',
                filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300')}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="secondary" loading={bulkLoading} onClick={bulkApprove}>
                Approve {selected.size}
              </Button>
              <Button size="sm" variant="danger" loading={bulkLoading} onClick={bulkDisqualify}>
                Disqualify {selected.size}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No submissions" description="No submissions match the selected filter." compact />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(s => s.id)) : new Set())}
                    className="rounded border-slate-300" />
                </th>
                {['#', 'Handle', 'Type', 'Votes', 'Avg Score', 'Rank', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id} className={cn('border-b border-slate-100 hover:bg-slate-50 transition-colors',
                  s.is_winner && 'bg-amber-50')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.is_winner && <Trophy size={12} className="text-amber-500 shrink-0" />}
                      <span className="text-sm font-medium text-slate-900">@{s.handle}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="slate" className="capitalize">{s.submission_type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.vote_count}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {s.average_score != null ? s.average_score.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {s.rank != null ? `#${s.rank}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={s.status} className="capitalize">{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewSub(s)} title="View"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => updateStatus(s.id, 'approved')} title="Approve"
                        className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600">
                        <CheckCircle size={13} />
                      </button>
                      <button onClick={() => setDisqualifyTarget(s)} title="Disqualify"
                        className="p-1.5 rounded hover:bg-red-50 text-red-500">
                        <XCircle size={13} />
                      </button>
                      <button onClick={() => setWinnerTarget(s)} title="Mark Winner"
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-500">
                        <Trophy size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      <Modal open={!!previewSub} onClose={() => setPreviewSub(null)} title="Submission Preview" size="lg">
        {previewSub && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                {previewSub.handle.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">@{previewSub.handle}</p>
                <p className="text-xs text-slate-500">{new Date(previewSub.created_at).toLocaleString()}</p>
              </div>
              <Badge status={previewSub.status} className="ml-auto capitalize">{previewSub.status}</Badge>
            </div>
            {previewSub.content_url && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 h-48 flex items-center justify-center">
                {previewSub.submission_type === 'image'
                  ? <img src={previewSub.content_url} alt="submission" className="w-full h-full object-contain" />
                  : <a href={previewSub.content_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 text-sm hover:underline">
                    <ExternalLink size={14} /> View Submission
                  </a>
                }
              </div>
            )}
            {previewSub.caption && (
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">{previewSub.caption}</p>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-900">{previewSub.vote_count}</p>
                <p className="text-xs text-slate-500">Votes</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-900">{previewSub.average_score?.toFixed(1) ?? '—'}</p>
                <p className="text-xs text-slate-500">Avg Score</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-900">{previewSub.rank != null ? `#${previewSub.rank}` : '—'}</p>
                <p className="text-xs text-slate-500">Rank</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Disqualify Modal */}
      <Modal open={!!disqualifyTarget} onClose={() => setDisqualifyTarget(null)}
        title="Disqualify Submission" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDisqualifyTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={doDisqualify}>Disqualify</Button>
          </>
        }>
        {disqualifyTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Disqualifying @{disqualifyTarget.handle}'s submission.</p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
              <textarea className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3} value={disqualifyReason} placeholder="Reason for disqualification..."
                onChange={e => setDisqualifyReason(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>

      {/* Mark Winner Modal */}
      <Modal open={!!winnerTarget} onClose={() => setWinnerTarget(null)}
        title="Mark as Winner" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setWinnerTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={doMarkWinner}>Mark Winner</Button>
          </>
        }>
        {winnerTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Mark @{winnerTarget.handle} as a winner.</p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Winner Place</label>
              <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={winnerPlace} onChange={e => setWinnerPlace(Number(e.target.value))}>
                <option value={1}>1st Place</option>
                <option value={2}>2nd Place</option>
                <option value={3}>3rd Place</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* Judging Panel Tab */
function JudgingPanelTab({ comp }: { comp: Competition }) {
  const [judges, setJudges] = useState<Judge[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [scores, setScores] = useState<JudgeScore[]>([])
  const [loading, setLoading] = useState(true)
  const [addJudgeOpen, setAddJudgeOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Judge | null>(null)
  const [scoreCell, setScoreCell] = useState<{ sub: Submission; judge: Judge } | null>(null)
  const [scoreValue, setScoreValue] = useState(5)
  const [scoreNotes, setScoreNotes] = useState('')
  const [scoreLoading, setScoreLoading] = useState(false)
  const [judgeForm, setJudgeForm] = useState({ name: '', email: '', role: 'judge' })
  const [judgeLoading, setJudgeLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [jRes, sRes, scRes] = await Promise.all([
      supabase.from('competition_judges').select('*').eq('competition_id', comp.id),
      supabase.from('competition_submissions').select('*').eq('competition_id', comp.id).eq('status', 'approved').limit(20),
      supabase.from('competition_judge_scores').select('*').eq('competition_id', comp.id),
    ])
    setJudges(jRes.data ?? [])
    setSubmissions(sRes.data ?? [])
    setScores(scRes.data ?? [])
    setLoading(false)
  }, [comp.id])

  useEffect(() => { load() }, [load])

  async function addJudge() {
    setJudgeLoading(true)
    const supabase = createClient()
    await supabase.from('competition_judges').insert({
      competition_id: comp.id,
      name: judgeForm.name,
      email: judgeForm.email,
      role: judgeForm.role,
      assigned_submissions: submissions.length,
      completed_reviews: 0,
    })
    setAddJudgeOpen(false)
    setJudgeForm({ name: '', email: '', role: 'judge' })
    setJudgeLoading(false)
    load()
  }

  async function removeJudge() {
    if (!removeTarget) return
    const supabase = createClient()
    await supabase.from('competition_judges').delete().eq('id', removeTarget.id)
    setRemoveTarget(null)
    load()
  }

  async function saveScore() {
    if (!scoreCell) return
    setScoreLoading(true)
    const supabase = createClient()
    await supabase.from('competition_judge_scores').upsert({
      competition_id: comp.id,
      submission_id: scoreCell.sub.id,
      judge_id: scoreCell.judge.id,
      score: scoreValue,
      notes: scoreNotes,
      criteria_scores: {},
    }, { onConflict: 'submission_id,judge_id' })
    // Recalculate average
    const subScores = scores.filter(sc => sc.submission_id === scoreCell.sub.id)
    const allScores = [...subScores.filter(sc => sc.judge_id !== scoreCell.judge.id), { score: scoreValue }]
    const avg = allScores.reduce((s, sc) => s + sc.score, 0) / allScores.length
    await supabase.from('competition_submissions')
      .update({ average_score: Math.round(avg * 10) / 10 })
      .eq('id', scoreCell.sub.id)
    setScoreCell(null)
    setScoreLoading(false)
    load()
  }

  function getScore(subId: string, judgeId: string) {
    return scores.find(sc => sc.submission_id === subId && sc.judge_id === judgeId)
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>

  return (
    <div className="space-y-6">
      {/* Judges List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Judges ({judges.length})</h3>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddJudgeOpen(true)}>
            Add Judge
          </Button>
        </div>
        {judges.length === 0 ? (
          <EmptyState icon={Users} title="No judges assigned" description="Add judges to score submissions." compact
            action={{ label: 'Add Judge', onClick: () => setAddJudgeOpen(true), icon: <Plus size={14} /> }} />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Name', 'Email', 'Role', 'Assigned', 'Completed', 'Progress', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {judges.map(j => {
                const pct = j.assigned_submissions > 0 ? Math.round((j.completed_reviews / j.assigned_submissions) * 100) : 0
                return (
                  <tr key={j.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{j.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{j.email}</td>
                    <td className="px-4 py-3"><Badge variant="blue" className="capitalize">{j.role}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{j.assigned_submissions}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{j.completed_reviews}</td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-8">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setRemoveTarget(j)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Score Matrix */}
      {judges.length > 0 && submissions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Score Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click any cell to add or edit a score</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Submission</th>
                  {judges.map(j => (
                    <th key={j.id} className="px-3 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{j.name}</th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Avg</th>
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 15).map(sub => (
                  <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium">@{sub.handle}</td>
                    {judges.map(j => {
                      const sc = getScore(sub.id, j.id)
                      return (
                        <td key={j.id} className="px-3 py-3">
                          <button
                            onClick={() => { setScoreCell({ sub, judge: j }); setScoreValue(sc?.score ?? 5); setScoreNotes(sc?.notes ?? '') }}
                            className={cn(
                              'w-10 h-8 rounded text-xs font-semibold transition-colors',
                              sc ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600',
                            )}>
                            {sc ? sc.score : '—'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {sub.average_score != null ? sub.average_score.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Judge Modal */}
      <Modal open={addJudgeOpen} onClose={() => setAddJudgeOpen(false)} title="Add Judge" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddJudgeOpen(false)}>Cancel</Button>
            <Button size="sm" loading={judgeLoading} onClick={addJudge} disabled={!judgeForm.name || !judgeForm.email}>
              Add Judge
            </Button>
          </>
        }>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
            <input className={inputCls} value={judgeForm.name} placeholder="Judge name"
              onChange={e => setJudgeForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
            <input className={inputCls} type="email" value={judgeForm.email} placeholder="judge@email.com"
              onChange={e => setJudgeForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
            <select className={inputCls} value={judgeForm.role}
              onChange={e => setJudgeForm(f => ({ ...f, role: e.target.value }))}>
              <option value="judge">Judge</option>
              <option value="head_judge">Head Judge</option>
              <option value="guest">Guest Judge</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Score Modal */}
      <Modal open={!!scoreCell} onClose={() => setScoreCell(null)} title="Score Submission" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setScoreCell(null)}>Cancel</Button>
            <Button size="sm" loading={scoreLoading} onClick={saveScore}>Save Score</Button>
          </>
        }>
        {scoreCell && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Submission by</p>
              <p className="text-sm font-semibold text-slate-900">@{scoreCell.sub.handle}</p>
              <p className="text-xs text-slate-500 mt-1">Judge: {scoreCell.judge.name}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Score: {scoreValue}/10</label>
              <input type="range" min="1" max="10" value={scoreValue}
                onChange={e => setScoreValue(Number(e.target.value))}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1 (Poor)</span><span>5 (Average)</span><span>10 (Excellent)</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
              <textarea className={cn(inputCls, 'resize-none')} rows={3} value={scoreNotes}
                placeholder="Optional scoring notes..."
                onChange={e => setScoreNotes(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!removeTarget} onClose={() => setRemoveTarget(null)} onConfirm={removeJudge}
        title="Remove Judge" description={`Remove ${removeTarget?.name} from judging panel?`}
        confirmLabel="Remove" danger />
    </div>
  )
}

/* Leaderboard Tab */
function LeaderboardTab({ comp }: { comp: Competition }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('competition_submissions')
      .select('*')
      .eq('competition_id', comp.id)
      .eq('status', 'approved')
      .order(comp.judging_type === 'public_vote' ? 'vote_count' : 'average_score', { ascending: false })
    setSubmissions(data ?? [])
    setLoading(false)
  }, [comp.id, comp.judging_type])

  useEffect(() => { load() }, [load])

  async function finalizeWinners() {
    setFinalizing(true)
    const supabase = createClient()
    const prizeCount = Array.isArray(comp.prizes) ? comp.prizes.length : 1
    const topN = submissions.slice(0, prizeCount)
    for (let i = 0; i < topN.length; i++) {
      await supabase.from('competition_submissions')
        .update({ is_winner: true, winner_place: i + 1, rank: i + 1, status: 'approved' })
        .eq('id', topN[i].id)
    }
    setFinalizing(false)
    load()
  }

  const podiumColors = [
    'bg-gradient-to-b from-amber-400 to-yellow-500 text-white',
    'bg-gradient-to-b from-slate-300 to-slate-400 text-white',
    'bg-gradient-to-b from-orange-400 to-amber-500 text-white',
  ]

  const scoreKey = comp.judging_type === 'public_vote' ? 'vote_count' : 'average_score'

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>

  if (submissions.length === 0) return (
    <EmptyState icon={Trophy} title="No approved submissions" description="Approve submissions to see the leaderboard." compact />
  )

  return (
    <div className="space-y-6">
      {/* Podium - top 3 */}
      {submissions.length >= 2 && (
        <div className="flex items-end justify-center gap-4 pt-4">
          {[submissions[1], submissions[0], submissions[2]].filter(Boolean).map((s, i) => {
            const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3
            const heights = ['h-20', 'h-28', 'h-16']
            return (
              <div key={s.id} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {s.handle.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs font-medium text-slate-700">@{s.handle}</p>
                <p className="text-xs text-slate-500">
                  {scoreKey === 'vote_count' ? `${s.vote_count} votes` : `${s.average_score?.toFixed(1) ?? '—'} pts`}
                </p>
                <div className={cn('flex items-center justify-center rounded-t-lg font-bold text-lg w-16', heights[i], podiumColors[actualRank - 1])}>
                  {actualRank}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Full Rankings</h3>
          <Button size="sm" variant="secondary" loading={finalizing} onClick={finalizeWinners}
            icon={<Trophy size={14} />}>
            Finalize Winners
          </Button>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Rank', 'Handle', 'Preview', comp.judging_type === 'public_vote' ? 'Votes' : 'Score', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, idx) => (
              <tr key={s.id} className={cn('border-b border-slate-100 hover:bg-slate-50 transition-colors',
                s.is_winner && 'bg-amber-50')}>
                <td className="px-4 py-3">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-slate-100 text-slate-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500')}>
                    {idx + 1}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.is_winner && <Trophy size={12} className="text-amber-500" />}
                    <span className="text-sm font-medium text-slate-900">@{s.handle}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {s.content_url
                    ? <a href={s.content_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <ExternalLink size={10} /> View
                    </a>
                    : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                  {scoreKey === 'vote_count'
                    ? s.vote_count
                    : s.average_score?.toFixed(1) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {s.is_winner
                    ? <Badge variant="amber">{s.winner_place === 1 ? '1st Place' : s.winner_place === 2 ? '2nd Place' : '3rd Place'}</Badge>
                    : <Badge status={s.status} className="capitalize">{s.status}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* Voting Tab */
function VotingTab({ comp }: { comp: Competition }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('competition_submissions')
      .select('*')
      .eq('competition_id', comp.id)
      .eq('status', 'approved')
      .order('vote_count', { ascending: false })
    setSubmissions(data ?? [])
    setLoading(false)
  }, [comp.id])

  useEffect(() => { load() }, [load])

  async function vote(subId: string) {
    setVoting(subId)
    const supabase = createClient()
    const sub = submissions.find(s => s.id === subId)
    if (!sub) return
    await supabase.from('competition_submissions')
      .update({ vote_count: (sub.vote_count ?? 0) + 1 })
      .eq('id', subId)
    setVoting(null)
    load()
  }

  const isOpen = comp.status === 'open'
  const deadline = comp.submission_deadline ? new Date(comp.submission_deadline) : null
  const votingOpen = isOpen && (!deadline || deadline > new Date())

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  if (comp.judging_type === 'panel') return (
    <EmptyState icon={Vote} title="Public voting not enabled"
      description="This competition uses panel judging. Switch to Public Vote or Hybrid to enable public voting." compact />
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
            votingOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            <div className={cn('w-1.5 h-1.5 rounded-full', votingOpen ? 'bg-emerald-500' : 'bg-slate-400')} />
            {votingOpen ? 'Voting Open' : 'Voting Closed'}
          </div>
          {comp.vote_count > 0 && (
            <span className="text-sm text-slate-500">{comp.vote_count.toLocaleString()} total votes</span>
          )}
        </div>
      </div>

      {submissions.length === 0 ? (
        <EmptyState icon={Vote} title="No submissions available for voting"
          description="Approve submissions to make them available for public voting." compact />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {submissions.map(sub => (
            <div key={sub.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-36 bg-slate-100 flex items-center justify-center">
                {sub.content_url
                  ? <img src={sub.content_url} alt="submission" className="w-full h-full object-cover" />
                  : <Camera size={28} className="text-slate-300" />}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-slate-900 truncate">@{sub.handle}</p>
                {sub.caption && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sub.caption}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Vote size={12} /> {sub.vote_count}
                  </span>
                  <button
                    disabled={!votingOpen || voting === sub.id}
                    onClick={() => vote(sub.id)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-lg transition-all',
                      votingOpen
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                    )}>
                    {voting === sub.id ? '...' : 'Vote'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* Announce Winners Tab */
function AnnounceWinnersTab({ comp, onRefresh }: { comp: Competition; onRefresh: () => void }) {
  const [winners, setWinners] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCopy, setAiCopy] = useState<string[]>([])
  const [announcing, setAnnouncing] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('competition_submissions')
      .select('*')
      .eq('competition_id', comp.id)
      .eq('is_winner', true)
      .order('winner_place', { ascending: true })
    setWinners(data ?? [])
    setLoading(false)
  }, [comp.id])

  useEffect(() => { load() }, [load])

  async function generateAI() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'competition_winner_announcement',
          competition: { title: comp.title, type: comp.competition_type },
          winners: winners.map(w => ({ handle: w.handle, place: w.winner_place })),
        }),
      })
      const data = await res.json()
      setAiCopy(data.copies ?? [data.copy ?? ''])
    } catch {
      setAiCopy(['Congratulations to all our winners! Thank you to everyone who participated in our competition.'])
    } finally {
      setAiLoading(false)
    }
  }

  async function markAnnounced() {
    setAnnouncing(true)
    const supabase = createClient()
    await supabase.from('competitions')
      .update({ winner_announced_at: new Date().toISOString() })
      .eq('id', comp.id)
    setAnnouncing(false)
    onRefresh()
  }

  function copyText(text: string, i: number) {
    navigator.clipboard.writeText(text)
    setCopied(i)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>

  return (
    <div className="space-y-6">
      {/* Winners */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Winners</h3>
        </div>
        {winners.length === 0 ? (
          <EmptyState icon={Trophy} title="No winners announced"
            description="Finalize the leaderboard to mark winners." compact />
        ) : (
          <div className="divide-y divide-slate-100">
            {winners.map(w => (
              <div key={w.id} className="flex items-center gap-4 px-5 py-4">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  w.winner_place === 1 ? 'bg-amber-100 text-amber-700' :
                  w.winner_place === 2 ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700')}>
                  {w.winner_place}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">@{w.handle}</p>
                  <p className="text-xs text-slate-500">
                    {w.winner_place === 1 ? '1st Place' : w.winner_place === 2 ? '2nd Place' : '3rd Place'}
                    {Array.isArray(comp.prizes) && comp.prizes[w.winner_place! - 1] && (
                      <> — {comp.prizes[w.winner_place! - 1].title}</>
                    )}
                  </p>
                </div>
                <Badge variant="amber">Winner</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Caption Generator */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">AI Announcement Generator</h3>
            <p className="text-xs text-slate-500 mt-0.5">Generate winner announcement copy for social media</p>
          </div>
          <Button variant="ai" size="sm" loading={aiLoading} icon={<Sparkles size={14} />} onClick={generateAI}
            disabled={winners.length === 0}>
            Generate Copy
          </Button>
        </div>
        {aiCopy.length > 0 && (
          <div className="space-y-3">
            {aiCopy.map((copy, i) => (
              <div key={i} className="relative group bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-700 leading-relaxed pr-10">{copy}</p>
                <button onClick={() => copyText(copy, i)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {copied === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Announce Actions */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {comp.winner_announced_at ? 'Winners Announced' : 'Ready to Announce?'}
          </p>
          <p className="text-xs text-slate-500">
            {comp.winner_announced_at
              ? `Announced ${fmt(comp.winner_announced_at)}`
              : 'Mark winners as officially announced'}
          </p>
        </div>
        <div className="flex gap-2">
          {!comp.winner_announced_at && (
            <Button size="sm" loading={announcing} onClick={markAnnounced}
              icon={<CheckCircle size={14} />} disabled={winners.length === 0}>
              Mark Announced
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}
            onClick={() => window.open('/app/studio', '_blank')}>
            Post to Studio
          </Button>
        </div>
      </div>
    </div>
  )
}

/* Analytics Tab */
function AnalyticsTab({ comp }: { comp: Competition }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const [sRes, jRes] = await Promise.all([
        supabase.from('competition_submissions').select('*').eq('competition_id', comp.id),
        supabase.from('competition_judges').select('*').eq('competition_id', comp.id),
      ])
      setSubmissions(sRes.data ?? [])
      setJudges(jRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [comp.id])

  // Build chart data
  const submissionsOverTime = (() => {
    const map: Record<string, number> = {}
    submissions.forEach(s => {
      const day = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      map[day] = (map[day] ?? 0) + 1
    })
    return Object.entries(map).map(([date, count]) => ({ date, count }))
  })()

  const scoreDistribution = (() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    submissions.forEach(s => {
      if (s.average_score != null) {
        const idx = Math.min(Math.floor(s.average_score) - 1, 9)
        if (idx >= 0) buckets[idx]++
      }
    })
    return buckets.map((count, i) => ({ score: `${i + 1}`, count }))
  })()

  const judgeActivity = judges.map(j => ({
    name: j.name.split(' ')[0],
    completed: j.completed_reviews,
    assigned: j.assigned_submissions,
  }))

  const platformData = [
    { name: comp.platform ? PLATFORM_LABELS[comp.platform] : 'Direct', value: submissions.length },
  ]

  if (loading) return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Submissions', value: submissions.length, icon: <FileText size={18} className="text-blue-600" /> },
          { label: 'Total Votes', value: comp.vote_count, icon: <Vote size={18} className="text-violet-600" /> },
          { label: 'Judges', value: judges.length, icon: <Users size={18} className="text-emerald-600" /> },
          {
            label: 'Avg Score', icon: <Star size={18} className="text-amber-600" />,
            value: submissions.filter(s => s.average_score != null).length > 0
              ? (submissions.reduce((s, sub) => s + (sub.average_score ?? 0), 0) / submissions.filter(s => s.average_score != null).length).toFixed(1)
              : '—'
          },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{k.label}</p>
              <div className="p-2 bg-slate-50 rounded-lg">{k.icon}</div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submissions Over Time */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Submissions Over Time</h3>
          {submissionsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={submissionsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">No submission data yet</div>
          )}
        </div>

        {/* Score Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="score" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Judge Activity */}
        {judges.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Judge Activity</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={judgeActivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill="#059669" radius={[0, 4, 4, 0]} />
                <Bar dataKey="assigned" name="Assigned" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Platform Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Platform Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* Content Tab */
function ContentTab({ comp }: { comp: Competition }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const q = supabase.from('content_posts').select('*').order('created_at', { ascending: false })
      if (comp.campaign_id) q.eq('campaign_id', comp.campaign_id)
      const { data } = await q.limit(20)
      setPosts(data ?? [])
      setLoading(false)
    }
    load()
  }, [comp.id, comp.campaign_id])

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{posts.length} content posts linked to this competition's campaign</p>
        <Button size="sm" icon={<Plus size={14} />}
          onClick={() => window.open(`/app/studio?competition=${comp.id}`, '_blank')}>
          Create Post
        </Button>
      </div>
      {posts.length === 0 ? (
        <EmptyState icon={FileText} title="No content posts"
          description="Create posts to promote this competition across platforms." compact
          action={{ label: 'Open Studio', onClick: () => window.open('/app/studio', '_blank') }} />
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge status={p.status}>{p.status}</Badge>
                  {p.platform && <Badge variant="outline">{PLATFORM_LABELS[p.platform] ?? p.platform}</Badge>}
                </div>
                <p className="text-sm text-slate-700 line-clamp-2">{p.caption || p.content || 'No caption'}</p>
                <p className="text-xs text-slate-400 mt-1">{fmt(p.created_at)}</p>
              </div>
              <a href={`/app/studio/${p.id}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* Settings Tab */
function SettingsTab({ comp, onRefresh }: { comp: Competition; onRefresh: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({ ...comp })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)

  function set(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('competitions').update({
        title: form.title,
        description: form.description,
        competition_type: form.competition_type,
        platform: form.platform,
        entry_hashtag: form.entry_hashtag,
        prize_title: form.prize_title,
        prize_value: form.prize_value,
        judging_type: form.judging_type,
        judging_criteria: form.judging_criteria,
        max_submissions_per_person: form.max_submissions_per_person,
        rules: form.rules,
        terms_url: form.terms_url,
        start_date: form.start_date,
        end_date: form.end_date,
        submission_deadline: form.submission_deadline,
        status: form.status,
      }).eq('id', comp.id)
      if (err) throw err
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      onRefresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    setArchiving(true)
    const supabase = createClient()
    await supabase.from('competitions').update({ status: 'archived' }).eq('id', comp.id)
    setArchiving(false)
    onRefresh()
  }

  async function deleteComp() {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('competitions').delete().eq('id', comp.id)
    setDeleting(false)
    setDeleteOpen(false)
    router.push('/app/campaigns/competitions')
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-slate-700 mb-1'

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-emerald-700 p-3 bg-emerald-50 rounded-lg flex items-center gap-2"><Check size={14} /> Changes saved</p>}

      {/* General */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">General</h3>
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={3}
            value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {['draft', 'active', 'open', 'judging', 'completed', 'archived'].map(s => (
                <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Judging Type</label>
            <select className={inputCls} value={form.judging_type} onChange={e => set('judging_type', e.target.value)}>
              <option value="panel">Panel Judging</option>
              <option value="public_vote">Public Vote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Entry Hashtag</label>
          <input className={inputCls} value={form.entry_hashtag ?? ''} placeholder="#MyContest2026"
            onChange={e => set('entry_hashtag', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Rules</label>
          <textarea className={cn(inputCls, 'resize-none')} rows={4}
            value={form.rules ?? ''} onChange={e => set('rules', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Terms URL</label>
          <input className={inputCls} value={form.terms_url ?? ''}
            onChange={e => set('terms_url', e.target.value)} />
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input className={inputCls} type="datetime-local"
              value={form.start_date ? form.start_date.slice(0, 16) : ''}
              onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Submission Deadline</label>
            <input className={inputCls} type="datetime-local"
              value={form.submission_deadline ? form.submission_deadline.slice(0, 16) : ''}
              onChange={e => set('submission_deadline', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input className={inputCls} type="datetime-local"
              value={form.end_date ? form.end_date.slice(0, 16) : ''}
              onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>Save Changes</Button>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} /> Danger Zone
        </h3>
        <div className="flex items-center justify-between py-3 border-t border-red-100">
          <div>
            <p className="text-sm font-medium text-slate-900">Archive Competition</p>
            <p className="text-xs text-slate-500">Hide from active views. Recoverable.</p>
          </div>
          <Button variant="secondary" size="sm" loading={archiving} onClick={archive}>Archive</Button>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-red-100">
          <div>
            <p className="text-sm font-medium text-red-700">Delete Competition</p>
            <p className="text-xs text-slate-500">Permanently delete all data. This cannot be undone.</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Competition" size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleting}
              disabled={deleteConfirm !== comp.title} onClick={deleteComp}>
              Delete Forever
            </Button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            This will permanently delete <strong>{comp.title}</strong> and all associated submissions, judge scores, and votes.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Type <span className="font-mono bg-slate-100 px-1 rounded">{comp.title}</span> to confirm
            </label>
            <input className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={comp.title} />
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Main Detail Page ───────────────────────────────────────────────── */
export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [comp, setComp] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [statusLoading, setStatusLoading] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('competitions').select('*').eq('id', id).single()
    setComp(data)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: string) {
    setStatusLoading(true)
    const supabase = createClient()
    await supabase.from('competitions').update({ status }).eq('id', id)
    setStatusLoading(false)
    load()
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'submissions', label: 'Submissions', count: comp?.submission_count },
    { id: 'judging', label: 'Judging Panel' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'voting', label: 'Voting' },
    { id: 'announce', label: 'Announce Winners' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'content', label: 'Content' },
    { id: 'settings', label: 'Settings' },
  ]

  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  if (!comp) return (
    <div className="p-6">
      <EmptyState icon={Trophy} title="Competition not found"
        description="This competition may have been deleted."
        action={{ label: 'Back to Competitions', onClick: () => router.push('/app/campaigns/competitions') }} />
    </div>
  )

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <a href="/app/campaigns" className="hover:text-slate-600">Campaigns</a>
          <span>/</span>
          <a href="/app/campaigns/competitions" className="hover:text-slate-600">Competitions</a>
          <span>/</span>
          <span className="text-slate-600 font-medium">{comp.title}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => router.push('/app/campaigns/competitions')}
              className="mt-0.5 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{comp.title}</h1>
                <Badge status={comp.status} dot>{comp.status.charAt(0).toUpperCase() + comp.status.slice(1)}</Badge>
                <Badge variant="slate">{COMPETITION_TYPE_LABELS[comp.competition_type] ?? comp.competition_type}</Badge>
                {comp.platform && <Badge variant="outline">{PLATFORM_LABELS[comp.platform]}</Badge>}
              </div>
              {comp.description && <p className="text-sm text-slate-500 mt-1 max-w-xl">{comp.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {comp.status === 'draft' && (
              <Button size="sm" variant="secondary" loading={statusLoading}
                onClick={() => updateStatus('open')}>
                Open Submissions
              </Button>
            )}
            {comp.status === 'open' && (
              <Button size="sm" variant="secondary" loading={statusLoading}
                onClick={() => updateStatus('judging')}>
                Close Submissions
              </Button>
            )}
            {comp.status === 'judging' && (
              <Button size="sm" loading={statusLoading}
                onClick={() => updateStatus('completed')}>
                Announce Winners
              </Button>
            )}
            {comp.status === 'completed' && !comp.winner_announced_at && (
              <Badge variant="amber" className="text-xs">Winners not yet announced</Badge>
            )}
            <Button size="sm" variant="ghost" icon={<Edit2 size={14} />}
              onClick={() => setActiveTab('settings')}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-6" />

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab comp={comp} onCopyLink={() => {}} />}
        {activeTab === 'submissions' && <SubmissionsTab comp={comp} />}
        {activeTab === 'judging' && <JudgingPanelTab comp={comp} />}
        {activeTab === 'leaderboard' && <LeaderboardTab comp={comp} />}
        {activeTab === 'voting' && <VotingTab comp={comp} />}
        {activeTab === 'announce' && <AnnounceWinnersTab comp={comp} onRefresh={load} />}
        {activeTab === 'analytics' && <AnalyticsTab comp={comp} />}
        {activeTab === 'content' && <ContentTab comp={comp} />}
        {activeTab === 'settings' && <SettingsTab comp={comp} onRefresh={load} />}
      </div>
    </div>
  )
}
