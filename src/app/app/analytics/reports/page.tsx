'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Bell, Calendar, CheckCircle, Clock, Download, Mail,
  Plus, RefreshCw, Send, Settings, Trash2, X, Eye,
  BarChart2, Users, TrendingUp, ChevronDown, Info,
  ArrowUp, ArrowDown, Zap, Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatDate, formatRelative } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScheduledReport {
  id: string
  workspace_id: string
  name: string
  description: string | null
  report_type: 'analytics' | 'campaigns' | 'ugc' | 'inbox' | 'competitor' | 'full'
  frequency: 'daily' | 'weekly' | 'monthly'
  day_of_week: number | null
  day_of_month: number | null
  send_time: string
  recipients: string[]
  include_sections: string[]
  date_range_days: number
  is_active: boolean
  last_sent_at: string | null
  next_send_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface ReportHistory {
  id: string
  report_id: string
  workspace_id: string
  sent_at: string
  recipients: string[]
  status: 'sent' | 'failed' | 'pending'
  error_message: string | null
  created_at: string
  // joined
  report_name?: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: 'analytics', label: 'Analytics Overview' },
  { value: 'campaigns', label: 'Campaign Report' },
  { value: 'ugc', label: 'UGC Report' },
  { value: 'inbox', label: 'Inbox Summary' },
  { value: 'competitor', label: 'Competitor Report' },
  { value: 'full', label: 'Full Dashboard' },
] as const

const REPORT_TYPE_COLORS: Record<string, string> = {
  analytics: 'blue', campaigns: 'violet', ugc: 'green',
  inbox: 'amber', competitor: 'red', full: 'slate',
}

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const ALL_SECTIONS = [
  { id: 'kpi_summary', label: 'KPI Summary' },
  { id: 'top_posts', label: 'Top Performing Posts' },
  { id: 'campaign_progress', label: 'Campaign Progress' },
  { id: 'engagement_trends', label: 'Engagement Trends Chart' },
  { id: 'audience_growth', label: 'Audience Growth' },
  { id: 'competitor_benchmarks', label: 'Competitor Benchmarks' },
  { id: 'ugc_summary', label: 'UGC Summary' },
  { id: 'ai_usage_stats', label: 'AI Usage Stats' },
]

const DATE_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcNextSend(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  sendTime: string,
): string {
  const now = new Date()
  const [h, m] = sendTime.split(':').map(Number)
  let next = new Date(now)
  next.setSeconds(0, 0)
  next.setHours(h, m)

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1)
  } else if (frequency === 'weekly') {
    const dow = dayOfWeek ?? 0
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0
    let diff = dow - currentDay
    if (diff < 0 || (diff === 0 && next <= now)) diff += 7
    next.setDate(next.getDate() + diff)
  } else if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1
    next.setDate(dom)
    if (next <= now) {
      next.setMonth(next.getMonth() + 1)
      next.setDate(dom)
    }
  }

  return next.toISOString()
}

function getUniqueRecipients(reports: ScheduledReport[]): number {
  const all = new Set<string>()
  reports.filter(r => r.is_active).forEach(r => r.recipients.forEach(e => all.add(e)))
  return all.size
}

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
      <CheckCircle size={16} className="text-emerald-400" />
      {message}
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white"><X size={14} /></button>
    </div>
  )
}

// ─── Tag Input ───────────────────────────────────────────────────────────────

interface TagInputProps {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  hint?: string
}

function TagInput({ label, tags, onChange, placeholder, hint }: TagInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = input.trim().replace(/,$/, '')
      if (!val) return
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRx.test(val)) { setError('Invalid email address'); return }
      if (tags.includes(val)) { setError('Already added'); return }
      onChange([...tags, val])
      setInput('')
      setError('')
    } else if (e.key === 'Backspace' && !input) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="min-h-[40px] flex flex-wrap gap-1.5 items-center p-2 border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
            <Mail size={10} />
            {t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-blue-900">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? (placeholder ?? 'Type email and press Enter') : ''}
          className="flex-1 min-w-[140px] text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// ─── Preview Report Modal ────────────────────────────────────────────────────

interface PreviewReportModalProps {
  open: boolean
  onClose: () => void
  report: ScheduledReport | null
}

function PreviewReportModal({ open, onClose, report }: PreviewReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(`
      <html><head><title>${report?.name ?? 'Report'}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
        .kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .section-title { font-size: 14px; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 24px 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        th { background: #f8fafc; font-weight: 600; color: #64748b; }
      </style>
      </head><body>${content}</body></html>
    `)
    win.document.close()
    win.print()
  }

  if (!report) return null

  const typLabel = REPORT_TYPES.find(t => t.value === report.report_type)?.label ?? report.report_type
  const sections = report.include_sections
  const dateEnd = new Date()
  const dateStart = new Date()
  dateStart.setDate(dateEnd.getDate() - report.date_range_days)

  // Mock KPI data for preview
  const mockKpis = [
    { label: 'Total Impressions', value: '284,920', change: '+12%' },
    { label: 'Engagement Rate', value: '4.82%', change: '+0.3%' },
    { label: 'New Followers', value: '1,248', change: '+8%' },
    { label: 'Posts Published', value: '23', change: '+4' },
    { label: 'Link Clicks', value: '6,730', change: '+21%' },
    { label: 'Reach', value: '98,400', change: '+15%' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report Preview"
      description={`Preview of "${report.name}" — ${formatDate(dateStart.toISOString())} to ${formatDate(dateEnd.toISOString())}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button icon={<Download size={14} />} onClick={handlePrint}>Download PDF</Button>
        </>
      }
    >
      <div ref={printRef} className="space-y-6">
        {/* Report header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-blue-600 font-bold text-sm tracking-wide">CAPTION FOX</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-500">{typLabel}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{report.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDate(dateStart.toISOString())} — {formatDate(dateEnd.toISOString())}
              {' · '}{report.date_range_days} day window
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Generated</p>
            <p className="text-sm font-medium text-slate-700">{formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* KPI section */}
        {(sections.length === 0 || sections.includes('kpi_summary')) && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">KPI Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              {mockKpis.map(kpi => (
                <div key={kpi.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className="text-lg font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-emerald-600 font-medium">{kpi.change} vs prev period</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Posts */}
        {sections.includes('top_posts') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top Performing Posts</h3>
            <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Post</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Impressions</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Engagement</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Platform</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { post: 'Behind the scenes: product launch...', imp: '42,100', eng: '6.2%', platform: 'Instagram' },
                  { post: 'Tips for better content strategy', imp: '38,500', eng: '5.8%', platform: 'LinkedIn' },
                  { post: 'Weekly roundup: industry trends', imp: '29,200', eng: '4.1%', platform: 'X' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{row.post}</td>
                    <td className="px-3 py-2 text-right text-slate-600 font-mono text-xs">{row.imp}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600 text-xs">{row.eng}</td>
                    <td className="px-3 py-2 text-right text-slate-500 text-xs">{row.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Campaign Progress */}
        {sections.includes('campaign_progress') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Campaign Progress</h3>
            <div className="space-y-2">
              {[
                { name: 'Summer Launch', progress: 72, status: 'active' },
                { name: 'Brand Awareness Q2', progress: 45, status: 'active' },
                { name: 'Product Feature Highlight', progress: 100, status: 'completed' },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700 truncate">{c.name}</span>
                      <span className="text-xs font-medium text-slate-600 ml-2">{c.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                  <Badge status={c.status}>{c.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engagement Trends */}
        {sections.includes('engagement_trends') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Engagement Trends</h3>
            <div className="bg-slate-50 rounded-lg p-4 text-center text-xs text-slate-400 border border-slate-100">
              Chart renders in live email reports. Preview shows data summary only.
              <div className="mt-3 grid grid-cols-4 gap-2 text-left">
                {['Week 1: 4.2%', 'Week 2: 4.6%', 'Week 3: 5.1%', 'Week 4: 4.8%'].map(w => (
                  <div key={w} className="bg-white border border-slate-100 rounded p-2 text-xs text-slate-600">{w}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audience Growth */}
        {sections.includes('audience_growth') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Audience Growth</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { platform: 'Instagram', followers: '12.4K', change: '+248' },
                { platform: 'LinkedIn', followers: '8.1K', change: '+104' },
                { platform: 'X', followers: '5.9K', change: '+62' },
              ].map(p => (
                <div key={p.platform} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{p.platform}</p>
                  <p className="text-base font-bold text-slate-900">{p.followers}</p>
                  <p className="text-xs text-emerald-600 font-medium">{p.change} this period</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitor Benchmarks */}
        {sections.includes('competitor_benchmarks') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Competitor Benchmarks</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Competitor</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Followers</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {[{ name: 'Competitor A', followers: '89.2K', eng: '3.1%' }, { name: 'Competitor B', followers: '54.0K', eng: '5.4%' }].map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-700">{r.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-600">{r.followers}</td>
                    <td className="px-3 py-2 text-right font-medium text-xs text-slate-600">{r.eng}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* UGC Summary */}
        {sections.includes('ugc_summary') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">UGC Summary</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Submissions', value: '48' },
                { label: 'Approved', value: '31' },
                { label: 'Pending', value: '12' },
                { label: 'Rejected', value: '5' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-lg font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Usage Stats */}
        {sections.includes('ai_usage_stats') && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">AI Usage Stats</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Captions Generated', value: '124' },
                { label: 'AI Tokens Used', value: '382K' },
                { label: 'Avg. Edits per Caption', value: '1.4' },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-base font-bold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {sections.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4 italic">No sections selected. Edit the report to add sections.</p>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          Generated by Caption Fox · {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''} · {typLabel}
        </div>
      </div>
    </Modal>
  )
}

// ─── New Report Modal ─────────────────────────────────────────────────────────

interface NewReportModalProps {
  open: boolean
  onClose: () => void
  workspaceId: string
  onSaved: (report: ScheduledReport) => void
  editReport?: ScheduledReport | null
}

function NewReportModal({ open, onClose, workspaceId, onSaved, editReport }: NewReportModalProps) {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [reportType, setReportType] = useState<ScheduledReport['report_type']>('analytics')

  // Step 2
  const [frequency, setFrequency] = useState<ScheduledReport['frequency']>('weekly')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [sendTime, setSendTime] = useState('09:00')
  const [dateRangeDays, setDateRangeDays] = useState(7)

  // Step 3
  const [recipients, setRecipients] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])

  // Populate when editing
  useEffect(() => {
    if (editReport) {
      setName(editReport.name)
      setDescription(editReport.description ?? '')
      setReportType(editReport.report_type)
      setFrequency(editReport.frequency)
      setDayOfWeek(editReport.day_of_week ?? 0)
      setDayOfMonth(editReport.day_of_month ?? 1)
      setSendTime(editReport.send_time)
      setDateRangeDays(editReport.date_range_days)
      setRecipients(editReport.recipients)
      setSections(editReport.include_sections)
    } else {
      setName(''); setDescription(''); setReportType('analytics')
      setFrequency('weekly'); setDayOfWeek(0); setDayOfMonth(1)
      setSendTime('09:00'); setDateRangeDays(7); setRecipients([]); setSections([])
    }
    setStep(1); setError('')
  }, [editReport, open])

  function reset() { setStep(1); setError('') }
  function handleClose() { reset(); onClose() }

  function toggleSection(id: string) {
    setSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (recipients.length === 0) { setError('Add at least one recipient'); return }
    setLoading(true); setError('')
    try {
      const next_send_at = calcNextSend(frequency, dayOfWeek, dayOfMonth, sendTime)
      const payload = {
        workspace_id: workspaceId,
        name: name.trim(),
        description: description || null,
        report_type: reportType,
        frequency,
        day_of_week: frequency === 'weekly' ? dayOfWeek : null,
        day_of_month: frequency === 'monthly' ? dayOfMonth : null,
        send_time: sendTime,
        date_range_days: dateRangeDays,
        recipients,
        include_sections: sections,
        next_send_at,
        is_active: true,
      }

      let data: ScheduledReport
      if (editReport) {
        const { data: d, error: e } = await supabase
          .from('scheduled_reports')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editReport.id)
          .select('*')
          .single()
        if (e) throw e
        data = d
      } else {
        const { data: d, error: e } = await supabase
          .from('scheduled_reports')
          .insert(payload)
          .select('*')
          .single()
        if (e) throw e
        data = d
      }

      onSaved(data); handleClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save report')
    } finally {
      setLoading(false)
    }
  }

  const previewText = useMemo(() => {
    const parts = []
    if (sections.length === 0) return 'No sections selected.'
    const sectionLabels = sections.map(s => ALL_SECTIONS.find(x => x.id === s)?.label).filter(Boolean)
    parts.push(`This ${frequency} report will include: ${sectionLabels.join(', ')}.`)
    parts.push(`It covers the last ${dateRangeDays} days of data.`)
    if (recipients.length > 0) parts.push(`Sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}.`)
    return parts.join(' ')
  }, [sections, frequency, dateRangeDays, recipients])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${editReport ? 'Edit' : 'New'} Report — Step ${step} of 3`}
      description={
        step === 1 ? 'Name and type for your report.'
          : step === 2 ? 'Set your delivery schedule.'
            : 'Configure recipients and content.'
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('w-2 h-2 rounded-full', s === step ? 'bg-blue-600' : s < step ? 'bg-blue-300' : 'bg-slate-200')} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 1 && <Button variant="secondary" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step === 1 && <Button variant="secondary" onClick={handleClose}>Cancel</Button>}
            {step < 3 && (
              <Button onClick={() => {
                if (step === 1 && !name.trim()) { setError('Report name is required'); return }
                setError(''); setStep(s => s + 1)
              }}>Next</Button>
            )}
            {step === 3 && <Button loading={loading} onClick={handleSubmit}>
              {editReport ? 'Save Changes' : 'Create Report'}
            </Button>}
          </div>
        </div>
      }
    >
      {error && <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded-lg">{error}</p>}

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <Input label="Report Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly Marketing Report" />
          <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this report for?" rows={3} />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Report Type</label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setReportType(t.value as ScheduledReport['report_type'])}
                  className={cn(
                    'text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                    reportType === t.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <Select
            label="Frequency"
            value={frequency}
            onChange={e => setFrequency(e.target.value as ScheduledReport['frequency'])}
            options={FREQUENCIES}
          />
          {frequency === 'weekly' && (
            <Select
              label="Day of Week"
              value={String(dayOfWeek)}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              options={DAYS_OF_WEEK.map((d, i) => ({ value: String(i), label: d }))}
            />
          )}
          {frequency === 'monthly' && (
            <Select
              label="Day of Month"
              value={String(dayOfMonth)}
              onChange={e => setDayOfMonth(Number(e.target.value))}
              options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
          )}
          <Input
            label="Send Time"
            type="time"
            value={sendTime}
            onChange={e => setSendTime(e.target.value)}
          />
          <Select
            label="Data Date Range"
            value={String(dateRangeDays)}
            onChange={e => setDateRangeDays(Number(e.target.value))}
            options={DATE_RANGES}
          />
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <strong>Next send: </strong>
            {formatDate(calcNextSend(frequency, dayOfWeek, dayOfMonth, sendTime))}
            {' at '}{sendTime}
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-5">
          <TagInput
            label="Recipients *"
            tags={recipients}
            onChange={setRecipients}
            placeholder="Type email and press Enter..."
            hint="Add emails of stakeholders who should receive this report."
          />

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Include Sections</label>
            <div className="space-y-2">
              {ALL_SECTIONS.map(s => (
                <label key={s.id} className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                  sections.includes(s.id) ? 'border-blue-200 bg-blue-50' : 'border-slate-100 hover:border-slate-200',
                )}>
                  <input
                    type="checkbox"
                    checked={sections.includes(s.id)}
                    onChange={() => toggleSection(s.id)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview summary */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Report Preview Summary</p>
            <p className="text-sm text-slate-600">{previewText}</p>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null)
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [history, setHistory] = useState<ReportHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('reports')
  const [toast, setToast] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [editReport, setEditReport] = useState<ScheduledReport | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduledReport | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [previewReport, setPreviewReport] = useState<ScheduledReport | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState('')

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(id, name)')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (!member) return

      const ws = (member.workspaces as any)
      setWorkspace({ id: ws.id, name: ws.name })

      const [{ data: reps }, { data: hist }] = await Promise.all([
        supabase.from('scheduled_reports').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
        supabase.from('report_history').select('*').eq('workspace_id', ws.id).order('sent_at', { ascending: false }).limit(200),
      ])

      setReports(reps ?? [])

      // Enrich history with report names
      const enriched = (hist ?? []).map(h => ({
        ...h,
        report_name: reps?.find(r => r.id === h.report_id)?.name ?? 'Unknown Report',
      }))
      setHistory(enriched)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // ─── Toggle active ─────────────────────────────────────────────────────────

  async function toggleActive(report: ScheduledReport) {
    await supabase.from('scheduled_reports').update({ is_active: !report.is_active }).eq('id', report.id)
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, is_active: !r.is_active } : r))
  }

  // ─── Send now ──────────────────────────────────────────────────────────────

  async function sendNow(report: ScheduledReport) {
    setSendingId(report.id)
    try {
      const { error } = await supabase.from('report_history').insert({
        report_id: report.id,
        workspace_id: report.workspace_id,
        sent_at: new Date().toISOString(),
        recipients: report.recipients,
        status: 'sent',
      })
      if (!error) {
        await supabase.from('scheduled_reports').update({ last_sent_at: new Date().toISOString() }).eq('id', report.id)
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, last_sent_at: new Date().toISOString() } : r))
        setToast('Report queued!')
        loadData()
      }
    } finally {
      setSendingId(null)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    await supabase.from('scheduled_reports').delete().eq('id', deleteTarget.id)
    setDeleteLoading(false)
    setDeleteTarget(null)
    setToast('Report deleted')
    loadData()
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const activeReports = reports.filter(r => r.is_active)
  const thisMonthSent = useMemo(() => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    return history.filter(h => h.status === 'sent' && new Date(h.sent_at) >= startOfMonth).length
  }, [history])

  const uniqueRecipients = getUniqueRecipients(reports)

  const filteredHistory = useMemo(() => {
    if (!historyFilter) return history
    return history.filter(h =>
      h.report_name?.toLowerCase().includes(historyFilter.toLowerCase()) ||
      h.status.includes(historyFilter.toLowerCase())
    )
  }, [history, historyFilter])

  const tabs = [
    { id: 'reports', label: 'Scheduled Reports', count: reports.length },
    { id: 'history', label: 'Report History', count: history.length },
  ]

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scheduled Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Automatically send analytics reports to stakeholders on your schedule.</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => { setEditReport(null); setShowNewModal(true) }}>
          New Report
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Bell size={16} /></div>
          <div>
            <p className="text-xs text-slate-500">Active Reports</p>
            <p className="text-xl font-bold text-slate-900">{activeReports.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">{reports.length} total configured</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Send size={16} /></div>
          <div>
            <p className="text-xs text-slate-500">Sent This Month</p>
            <p className="text-xl font-bold text-slate-900">{thisMonthSent}</p>
            <p className="text-xs text-slate-400 mt-0.5">{history.filter(h => h.status === 'failed').length} failed</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600"><Users size={16} /></div>
          <div>
            <p className="text-xs text-slate-500">Recipients</p>
            <p className="text-xl font-bold text-slate-900">{uniqueRecipients}</p>
            <p className="text-xs text-slate-400 mt-0.5">Unique across active reports</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Reports ── */}
      {activeTab === 'reports' && (
        <div>
          {reports.length === 0 ? (
            <EmptyState
              title="No reports scheduled"
              description="Create your first automated report and keep stakeholders informed on a regular schedule."
              action={{ label: 'New Report', onClick: () => setShowNewModal(true), icon: <Plus size={14} /> }}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Frequency</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Recipients</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last Sent</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Next Send</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Active</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => {
                      const typeLabel = REPORT_TYPES.find(t => t.value === report.report_type)?.label ?? report.report_type
                      return (
                        <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900">{report.name}</p>
                              {report.description && (
                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{report.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={(REPORT_TYPE_COLORS[report.report_type] as any) ?? 'default'}>
                              {typeLabel}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="slate" className="capitalize">
                              {report.frequency}
                              {report.frequency === 'weekly' && report.day_of_week != null
                                ? ` · ${DAYS_OF_WEEK[report.day_of_week]}`
                                : ''}
                              {report.frequency === 'monthly' && report.day_of_month != null
                                ? ` · ${report.day_of_month}th`
                                : ''}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {report.recipients.slice(0, 2).map(r => (
                                <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-xs text-slate-600">
                                  <Mail size={9} />{r.split('@')[0]}
                                </span>
                              ))}
                              {report.recipients.length > 2 && (
                                <span className="text-xs text-slate-400">+{report.recipients.length - 2}</span>
                              )}
                              {report.recipients.length === 0 && <span className="text-xs text-slate-400">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {report.last_sent_at ? formatRelative(report.last_sent_at) : <span className="text-slate-300">Never</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {report.is_active && report.next_send_at
                              ? formatDate(report.next_send_at)
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {/* Toggle */}
                            <button
                              onClick={() => toggleActive(report)}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                                report.is_active ? 'bg-blue-600' : 'bg-slate-200',
                              )}
                            >
                              <span className={cn(
                                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                                report.is_active ? 'translate-x-[18px]' : 'translate-x-[2px]',
                              )} />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => setPreviewReport(report)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Preview"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => sendNow(report)}
                                disabled={sendingId === report.id}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Send Now"
                              >
                                <Send size={13} />
                              </button>
                              <button
                                onClick={() => { setEditReport(report); setShowNewModal(true) }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Settings size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(report)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: History ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Filter by report name or status..."
              value={historyFilter}
              onChange={e => setHistoryFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {filteredHistory.length === 0 ? (
            <EmptyState
              title={historyFilter ? 'No results' : 'No report history yet'}
              description={historyFilter ? 'Try a different filter.' : 'Report history will appear here when reports are sent.'}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Report</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Sent At</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Recipients</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map(h => {
                      const parentReport = reports.find(r => r.id === h.report_id)
                      return (
                        <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{h.report_name}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {formatDate(h.sent_at)} · {new Date(h.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-600">{h.recipients?.length ?? 0} recipient{(h.recipients?.length ?? 0) !== 1 ? 's' : ''}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              status={h.status}
                              dot
                            >
                              {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
                            </Badge>
                            {h.error_message && (
                              <p className="text-xs text-red-500 mt-0.5">{h.error_message}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {parentReport && (
                              <button
                                onClick={() => setPreviewReport(parentReport)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                              >
                                <Eye size={11} />
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <NewReportModal
        open={showNewModal}
        onClose={() => { setShowNewModal(false); setEditReport(null) }}
        workspaceId={workspace?.id ?? ''}
        onSaved={() => { loadData(); setToast(editReport ? 'Report updated' : 'Report created') }}
        editReport={editReport}
      />

      <PreviewReportModal
        open={!!previewReport}
        onClose={() => setPreviewReport(null)}
        report={previewReport}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Report"
        description={`Delete "${deleteTarget?.name}"? This will remove all history for this report and cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
