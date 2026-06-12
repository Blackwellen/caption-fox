'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Edit2, Archive, FileText, BarChart2, CheckSquare,
  Calendar, DollarSign, Image, AlertCircle, User, Clock,
  Megaphone, Target, MessageSquare, ExternalLink, Download,
  CheckCircle2, Video, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatRelative, truncate, initials } from '@/lib/utils'
import { CAMPAIGN_STATUS_LABELS } from '@/lib/constants'
import type { Campaign, ContentPost, CampaignTask, AuditLog } from '@/types/database'

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'brief', label: 'Brief' },
  { id: 'content', label: 'Content' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'ugc', label: 'UGC' },
  { id: 'budget', label: 'Budget' },
  { id: 'assets', label: 'Assets' },
  { id: 'results', label: 'Results' },
  { id: 'audit', label: 'Audit' },
]

interface BriefData {
  goal: string
  audience: string
  message: string
  tone: string
  cta: string
  channels: string
}

interface BudgetLine {
  id: string
  item: string
  amount: number
  status: string
}

interface TaskForm {
  title: string
  assignee: string
  due_date: string
}

function StatusBadgeVariant(status: string) {
  const map: Record<string, string> = {
    idea: 'slate', briefing: 'blue', in_production: 'blue', in_review: 'amber',
    scheduled: 'blue', live: 'green', reporting: 'violet', completed: 'green', archived: 'slate',
  }
  return (map[status] ?? 'default') as any
}

interface Props {
  campaign: Campaign
  initialPosts: ContentPost[]
  initialTasks: CampaignTask[]
  initialAuditLogs: AuditLog[]
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function CampaignDetailClient({ campaign, initialPosts, initialTasks, initialAuditLogs }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState('overview')
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts)
  const [tasks, setTasks] = useState<CampaignTask[]>(initialTasks)
  const [auditLogs] = useState<AuditLog[]>(initialAuditLogs)
  const [briefEditing, setBriefEditing] = useState(false)
  const [brief, setBrief] = useState<BriefData>({
    goal: '', audience: campaign.target_audience ?? '', message: '', tone: '', cta: '', channels: '',
  })
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>({ title: '', assignee: '', due_date: '' })
  const [taskSubmitting, setTaskSubmitting] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [addBudgetOpen, setAddBudgetOpen] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ item: '', amount: '' })
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [campaignStatus, setCampaignStatus] = useState(campaign.status)
  const [error, setError] = useState<string | null>(null)

  async function handleAddTask() {
    if (!taskForm.title.trim()) { setTaskError('Title is required'); return }
    setTaskError(null)
    setTaskSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: err } = await supabase
        .from('campaign_tasks')
        .insert({
          campaign_id: campaign.id,
          workspace_id: campaign.workspace_id,
          title: taskForm.title,
          status: 'todo',
          due_date: taskForm.due_date || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (err) throw err
      if (data) setTasks((prev) => [data, ...prev])
      setTaskModalOpen(false)
      setTaskForm({ title: '', assignee: '', due_date: '' })
    } catch (e: any) {
      setTaskError(e.message ?? 'Failed to create task')
    } finally {
      setTaskSubmitting(false)
    }
  }

  async function handleTaskStatusToggle(task: CampaignTask) {
    const nextStatus = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done'
    try {
      const supabase = createClient()
      await supabase.from('campaign_tasks').update({ status: nextStatus }).eq('id', task.id)
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: nextStatus } : t))
    } catch { /* silently fail */ }
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('campaigns').update({ status: 'archived' }).eq('id', campaign.id)
      if (err) throw err
      setCampaignStatus('archived')
      setArchiveOpen(false)
    } catch (e: any) {
      setError(e.message ?? 'Failed to archive campaign')
    } finally {
      setArchiving(false)
    }
  }

  function handleAddBudgetLine() {
    if (!budgetForm.item.trim() || !budgetForm.amount) return
    setBudgetLines((prev) => [...prev, {
      id: Math.random().toString(36).slice(2),
      item: budgetForm.item,
      amount: parseFloat(budgetForm.amount),
      status: 'pending',
    }])
    setBudgetForm({ item: '', amount: '' })
    setAddBudgetOpen(false)
  }

  const totalBudget = campaign.budget ?? 0
  const totalSpend = budgetLines.reduce((sum, l) => sum + l.amount, 0)
  const spendPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpend / totalBudget) * 100)) : 0

  const postsDone = posts.filter((p) => p.status === 'published').length
  const tasksDone = tasks.filter((t) => t.status === 'done').length

  // Mini calendar for campaign dates
  function renderMiniCalendar() {
    const start = campaign.start_date ? new Date(campaign.start_date) : null
    const end = campaign.end_date ? new Date(campaign.end_date) : null
    if (!start) return <EmptyState icon={Calendar} title="No dates set for this campaign" compact />

    const year = start.getFullYear()
    const month = start.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const firstDayMon = firstDay === 0 ? 6 : firstDay - 1

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-sm">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          {MONTH_NAMES[month]} {year}
        </h4>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-xs font-medium text-slate-400 py-1">{d}</div>
          ))}
          {Array.from({ length: firstDayMon }).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const thisDate = new Date(year, month, d)
            const inRange = start && end ? thisDate >= start && thisDate <= end : false
            const isStart = start && thisDate.toDateString() === start.toDateString()
            const isEnd = end && thisDate.toDateString() === end.toDateString()

            return (
              <div
                key={d}
                className={cn(
                  'text-xs py-1 rounded',
                  isStart || isEnd ? 'bg-blue-600 text-white font-bold' : inRange ? 'bg-blue-100 text-blue-700' : 'text-slate-600',
                )}
              >{d}</div>
            )
          })}
        </div>
        {start && end && (
          <p className="text-xs text-slate-400 mt-3 text-center">
            {formatDate(campaign.start_date!)} – {formatDate(campaign.end_date!)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/app/campaigns')}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 shrink-0"
          >
            <span>Campaigns</span>
            <span>/</span>
          </button>
          <h1 className="text-sm font-semibold text-slate-900 truncate">{campaign.name}</h1>
          <Badge status={campaignStatus} variant={StatusBadgeVariant(campaignStatus)} dot>
            {CAMPAIGN_STATUS_LABELS[campaignStatus] ?? campaignStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" icon={<Download size={14} />}>Generate Report</Button>
          <Button variant="secondary" size="sm" icon={<ExternalLink size={14} />}>Launch Approval</Button>
          <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => { setTab('brief'); setBriefEditing(true) }}>Edit Campaign</Button>
          <Button variant="danger" size="sm" icon={<Archive size={14} />} onClick={() => setArchiveOpen(true)}>Archive</Button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} className="mb-6" />

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Hero card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                    {initials(campaign.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900">{campaign.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                      {campaign.objective && <span className="flex items-center gap-1 capitalize"><Target size={12} />{campaign.objective}</span>}
                      {campaign.start_date && <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(campaign.start_date)}{campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ''}</span>}
                      {campaign.owner_id && <span className="flex items-center gap-1"><User size={12} />Owner assigned</span>}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge status={campaignStatus} variant={StatusBadgeVariant(campaignStatus)} dot className="text-sm px-3 py-1">
                    {CAMPAIGN_STATUS_LABELS[campaignStatus]}
                  </Badge>
                </div>
              </div>

              {campaign.start_date && campaign.end_date && (() => {
                const start = new Date(campaign.start_date).getTime()
                const end = new Date(campaign.end_date).getTime()
                const now = Date.now()
                const pct = Math.min(100, Math.max(0, Math.round((now - start) / (end - start) * 100)))
                return (
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span>Campaign progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Posts Created', value: posts.length, icon: <FileText size={18} className="text-blue-500" />, bg: 'bg-blue-50' },
                { label: 'Posts Published', value: postsDone, icon: <CheckCircle2 size={18} className="text-emerald-500" />, bg: 'bg-emerald-50' },
                { label: 'Tasks Complete', value: `${tasksDone}/${tasks.length}`, icon: <CheckSquare size={18} className="text-violet-500" />, bg: 'bg-violet-50' },
                { label: 'Budget Used', value: totalBudget > 0 ? `${spendPct}%` : '—', icon: <DollarSign size={18} className="text-amber-500" />, bg: 'bg-amber-50' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center shrink-0`}>{kpi.icon}</div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                    <p className="text-2xl font-bold text-slate-900 leading-none mt-0.5">{kpi.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BRIEF ── */}
        {tab === 'brief' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 max-w-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Campaign Brief</h3>
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit2 size={13} />}
                onClick={() => setBriefEditing((b) => !b)}
              >
                {briefEditing ? 'Done Editing' : 'Edit Brief'}
              </Button>
            </div>

            {(['goal', 'audience', 'message', 'tone', 'cta', 'channels'] as (keyof BriefData)[]).map((field) => {
              const labels: Record<keyof BriefData, string> = {
                goal: 'Goal', audience: 'Target Audience', message: 'Core Message / Offer',
                tone: 'Brand Tone', cta: 'Call to Action', channels: 'Channels',
              }
              return (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{labels[field]}</label>
                  {briefEditing ? (
                    <Textarea
                      rows={3}
                      className="mt-1"
                      placeholder={`Enter ${labels[field].toLowerCase()}…`}
                      value={brief[field]}
                      onChange={(e) => setBrief((p) => ({ ...p, [field]: e.target.value }))}
                    />
                  ) : (
                    <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                      {brief[field] || <span className="text-slate-400 italic">Not set</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── CONTENT ── */}
        {tab === 'content' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{posts.length} post{posts.length !== 1 ? 's' : ''} linked to this campaign</p>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => router.push(`/app/studio/new?campaign=${campaign.id}`)}>Add Post</Button>
            </div>
            {posts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <EmptyState
                  icon={FileText}
                  title="No content added yet"
                  description="Create posts and link them to this campaign."
                  action={{ label: 'Add Post', onClick: () => router.push(`/app/studio/new?campaign=${campaign.id}`), icon: <Plus size={14} /> }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/app/studio/${post.id}`)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{post.title ?? 'Untitled post'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {post.scheduled_at ? formatDate(post.scheduled_at) : 'Unscheduled'} · {post.post_type}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {(post.platforms ?? []).map((p) => (
                        <Badge key={p} variant="blue" className="capitalize">{p}</Badge>
                      ))}
                    </div>
                    <Badge status={post.status} dot>{post.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Campaign calendar filtered to campaign dates</p>
            {renderMiniCalendar()}
          </div>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} · {tasksDone} done</p>
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setTaskModalOpen(true)}>Add Task</Button>
            </div>
            {tasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks yet"
                  description="Break this campaign into tasks and assign them to your team."
                  action={{ label: 'Add Task', onClick: () => setTaskModalOpen(true), icon: <Plus size={14} /> }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button
                      className={cn(
                        'w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0',
                        task.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
                        task.status === 'in_progress' ? 'border-blue-400 bg-blue-50' : 'border-slate-300',
                      )}
                      onClick={() => handleTaskStatusToggle(task)}
                      title="Toggle status"
                    >
                      {task.status === 'done' && <CheckCircle2 size={12} className="text-white" />}
                      {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900')}>
                        {task.title}
                      </p>
                      {task.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{task.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={11} />{formatDate(task.due_date)}
                        </span>
                      )}
                      <Badge
                        variant={task.status === 'done' ? 'green' : task.status === 'in_progress' ? 'blue' : 'slate'}
                        className="capitalize"
                      >
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Task Modal */}
            <Modal
              open={taskModalOpen}
              onClose={() => { setTaskModalOpen(false); setTaskError(null) }}
              title="Add Task"
              size="md"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" loading={taskSubmitting} onClick={handleAddTask}>Create Task</Button>
                </>
              }
            >
              <div className="space-y-4">
                {taskError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={14} /> {taskError}
                  </div>
                )}
                <Input
                  label="Task Title"
                  placeholder="e.g. Write Instagram captions"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
                />
                <Input
                  label="Assignee (optional)"
                  placeholder="Team member name"
                  value={taskForm.assignee}
                  onChange={(e) => setTaskForm((p) => ({ ...p, assignee: e.target.value }))}
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
            </Modal>
          </div>
        )}

        {/* ── UGC ── */}
        {tab === 'ugc' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={Video}
              title="No UGC briefs linked"
              description="Create a UGC brief to brief creators on content for this campaign."
              action={{ label: 'Create UGC Brief', onClick: () => router.push('/app/ugc'), icon: <Plus size={14} /> }}
            />
          </div>
        )}

        {/* ── BUDGET ── */}
        {tab === 'budget' && (
          <div className="space-y-4">
            {/* Budget summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Budget Overview</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Total budget vs spend</p>
                </div>
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setAddBudgetOpen(true)}>Add Line</Button>
              </div>

              <div className="flex items-end justify-between text-xs text-slate-500 mb-2">
                <span>Spent: <span className="font-semibold text-slate-900">${totalSpend.toLocaleString()}</span></span>
                <span>Budget: <span className="font-semibold text-slate-900">${totalBudget.toLocaleString()}</span></span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', spendPct >= 90 ? 'bg-red-500' : spendPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${spendPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{spendPct}% of budget used</p>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {budgetLines.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  title="No budget lines added"
                  description="Track spend by adding budget line items."
                  action={{ label: 'Add Budget Line', onClick: () => setAddBudgetOpen(true), icon: <Plus size={14} /> }}
                  compact
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Item</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetLines.map((line) => (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{line.item}</td>
                        <td className="px-4 py-3 text-right text-slate-700">${line.amount.toLocaleString()}</td>
                        <td className="px-4 py-3"><Badge status={line.status}>{line.status}</Badge></td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-4 py-3 text-slate-900">Total</td>
                      <td className="px-4 py-3 text-right text-slate-900">${totalSpend.toLocaleString()}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Add budget line modal */}
            <Modal
              open={addBudgetOpen}
              onClose={() => setAddBudgetOpen(false)}
              title="Add Budget Line"
              size="sm"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setAddBudgetOpen(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleAddBudgetLine}>Add</Button>
                </>
              }
            >
              <div className="space-y-4">
                <Input label="Item" placeholder="e.g. Influencer fee" value={budgetForm.item} onChange={(e) => setBudgetForm((p) => ({ ...p, item: e.target.value }))} />
                <Input label="Amount ($)" type="number" placeholder="0.00" value={budgetForm.amount} onChange={(e) => setBudgetForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
            </Modal>
          </div>
        )}

        {/* ── ASSETS ── */}
        {tab === 'assets' && (
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={Image}
              title="No assets uploaded"
              description="Upload images, videos and documents for this campaign."
              action={{ label: 'Upload Asset', onClick: () => {}, icon: <Plus size={14} /> }}
            />
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === 'results' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <BarChart2 size={20} className="text-violet-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Campaign Results</h3>
                <p className="text-xs text-slate-400 mt-0.5">Connect analytics to see results</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {['Total Reach', 'Impressions', 'Engagements', 'Conversions'].map((metric) => (
                <div key={metric} className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-400 font-medium">{metric}</p>
                  <p className="text-2xl font-bold text-slate-300 mt-1">—</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Layers size={16} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Connect your analytics</p>
                <p className="text-xs text-blue-600 mt-0.5">Link your social channels to pull live metrics into this campaign.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/app/settings/channels')}>Connect</Button>
            </div>
          </div>
        )}

        {/* ── AUDIT ── */}
        {tab === 'audit' && (
          <div className="bg-white rounded-xl border border-slate-200">
            {auditLogs.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No audit history yet"
                description="Actions taken on this campaign will be recorded here."
                compact
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-500">
                      {log.user_id ? log.user_id.slice(0, 2).toUpperCase() : '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-medium">{log.action}</span>
                        {' '}on{' '}
                        <span className="font-medium">{log.resource_type}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatRelative(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive confirmation */}
      <ConfirmModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
        title="Archive Campaign"
        description="This will move the campaign to archived status. You can restore it later."
        confirmLabel="Archive"
        danger
        loading={archiving}
      />
    </div>
  )
}
