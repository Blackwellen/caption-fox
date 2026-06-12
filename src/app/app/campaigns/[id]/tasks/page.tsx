'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Plus, ArrowLeft, AlertCircle, CheckCircle2, Clock, User,
  List, LayoutGrid, GripVertical, MoreVertical, Pencil, Trash2,
  ChevronRight, Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, initials } from '@/lib/utils'
import type { CampaignTask, Campaign } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = 'urgent' | 'high' | 'medium' | 'low'
type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

interface TaskWithMeta extends CampaignTask {
  priority?: Priority
  assignee_name?: string | null
}

interface TaskForm {
  title: string
  description: string
  priority: Priority
  due_date: string
  assigned_to: string
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  priority: 'medium',
  due_date: '',
  assigned_to: '',
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'todo',        label: 'To Do',       color: 'text-slate-600',   bg: 'bg-slate-50' },
  { id: 'in_progress', label: 'In Progress', color: 'text-blue-600',    bg: 'bg-blue-50'  },
  { id: 'review',      label: 'Review',      color: 'text-amber-600',   bg: 'bg-amber-50' },
  { id: 'done',        label: 'Done',        color: 'text-emerald-600', bg: 'bg-emerald-50' },
]

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: string; color: string }> = {
  urgent: { label: 'Urgent', variant: 'red',   color: 'text-red-600'    },
  high:   { label: 'High',   variant: 'amber', color: 'text-amber-600'  },
  medium: { label: 'Medium', variant: 'slate', color: 'text-slate-500'  },
  low:    { label: 'Low',    variant: 'blue',  color: 'text-sky-600'    },
}

// ─── Priority Badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority?: Priority }) {
  if (!priority) return null
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
      priority === 'urgent' ? 'bg-red-100 text-red-700'
        : priority === 'high' ? 'bg-amber-100 text-amber-700'
        : priority === 'medium' ? 'bg-slate-100 text-slate-500'
        : 'bg-sky-100 text-sky-700',
    )}>
      <Flag size={10} />
      {cfg.label}
    </span>
  )
}

// ─── Kanban Task Card ─────────────────────────────────────────────────────────

function KanbanCard({
  task,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: TaskWithMeta
  onStatusChange: (task: TaskWithMeta, status: TaskStatus) => void
  onEdit: (task: TaskWithMeta) => void
  onDelete: (task: TaskWithMeta) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const otherStatuses = COLUMNS.filter(c => c.id !== task.status)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">{task.title}</p>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-1 rounded text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 text-sm"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Move to</p>
              {otherStatuses.map(col => (
                <button
                  key={col.id}
                  onClick={() => { onStatusChange(task, col.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <ChevronRight size={12} className="text-slate-400" />
                  {col.label}
                </button>
              ))}
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => { onEdit(task); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={() => { onDelete(task); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description snippet */}
      {task.description && (
        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{task.description}</p>
      )}

      {/* Bottom meta */}
      <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <PriorityBadge priority={task.priority} />
        <div className="flex items-center gap-2 ml-auto">
          {task.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={10} />
              {formatDate(task.due_date)}
            </span>
          )}
          {(task.assignee_name || task.assignee_id) && (
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
              {initials(task.assignee_name ?? task.assignee_id ?? '??')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignTasksPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [tasks, setTasks] = useState<TaskWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View mode
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  // New task modal
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Edit task modal
  const [editTask, setEditTask] = useState<TaskWithMeta | null>(null)
  const [editForm, setEditForm] = useState<TaskForm>(EMPTY_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TaskWithMeta | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      const [campaignRes, tasksRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', campaignId).single(),
        supabase.from('campaign_tasks').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
      ])

      if (campaignRes.error) throw campaignRes.error
      if (tasksRes.error) throw tasksRes.error

      setCampaign(campaignRes.data)
      setTasks((tasksRes.data ?? []) as TaskWithMeta[])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  // ── Get workspace id ───────────────────────────────────────────────────────

  async function getWorkspaceId(): Promise<string | null> {
    const local = localStorage.getItem('cf_workspace_id')
    if (local) return local
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()
    return data?.workspace_id ?? null
  }

  // ── Create task ────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    setFormError(null)
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const workspaceId = await getWorkspaceId()
      if (!workspaceId) throw new Error('Could not determine workspace')

      const { data, error: err } = await supabase
        .from('campaign_tasks')
        .insert({
          campaign_id: campaignId,
          workspace_id: workspaceId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: 'todo',
          due_date: form.due_date || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (err) throw err

      const newTask: TaskWithMeta = {
        ...(data as CampaignTask),
        priority: form.priority,
        assignee_name: form.assigned_to.trim() || null,
      }
      setTasks(prev => [newTask, ...prev])
      setNewTaskOpen(false)
      setForm(EMPTY_FORM)
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update task status ─────────────────────────────────────────────────────

  async function handleStatusChange(task: TaskWithMeta, newStatus: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('campaign_tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
      if (err) throw err
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  // ── Edit task ──────────────────────────────────────────────────────────────

  function openEdit(task: TaskWithMeta) {
    setEditTask(task)
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority ?? 'medium',
      due_date: task.due_date ?? '',
      assigned_to: task.assignee_name ?? '',
    })
    setEditError(null)
  }

  async function handleEdit() {
    if (!editTask) return
    if (!editForm.title.trim()) { setEditError('Title is required'); return }
    setEditError(null)
    setEditSubmitting(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('campaign_tasks')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          due_date: editForm.due_date || null,
        })
        .eq('id', editTask.id)
      if (err) throw err

      setTasks(prev => prev.map(t => t.id === editTask.id ? {
        ...t,
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        due_date: editForm.due_date || null,
        priority: editForm.priority,
        assignee_name: editForm.assigned_to.trim() || null,
      } : t))
      setEditTask(null)
    } catch (e: any) {
      setEditError(e.message ?? 'Failed to update task')
    } finally {
      setEditSubmitting(false)
    }
  }

  // ── Delete task ────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('campaign_tasks')
        .delete()
        .eq('id', deleteTarget.id)
      if (err) throw err
      setTasks(prev => prev.filter(t => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete task')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ── Status badge helper ────────────────────────────────────────────────────

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      todo: 'bg-slate-100 text-slate-600',
      in_progress: 'bg-blue-100 text-blue-700',
      review: 'bg-amber-100 text-amber-700',
      done: 'bg-emerald-100 text-emerald-700',
    }
    const labels: Record<string, string> = {
      todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done',
    }
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full', map[status] ?? 'bg-slate-100 text-slate-500')}>
        {labels[status] ?? status}
      </span>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const tasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status)
  const donePct = tasks.length > 0 ? Math.round((tasksByStatus('done').length / tasks.length) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/app/campaigns/${campaignId}`)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors shrink-0"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">
                {campaign?.name ?? 'Campaign'}
              </span>
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-sm font-semibold text-slate-900 truncate">Campaign Tasks</h1>
            {tasks.length > 0 && (
              <span className="shrink-0 text-xs text-slate-400">
                {tasksByStatus('done').length}/{tasks.length} done
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600',
                )}
                title="Kanban view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600',
                )}
                title="List view"
              >
                <List size={15} />
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => { setForm(EMPTY_FORM); setFormError(null); setNewTaskOpen(true) }}
            >
              New Task
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>Overall progress</span>
                <span className="font-semibold text-slate-700">{donePct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${donePct}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 shrink-0">
              {COLUMNS.map(col => (
                <div key={col.id} className="text-center">
                  <p className={cn('text-lg font-bold', col.color)}>{tasksByStatus(col.id).length}</p>
                  <p className="text-xs text-slate-400">{col.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-4 gap-4">
            {COLUMNS.map(col => (
              <div key={col.id} className="space-y-3">
                <Skeleton className="h-6 w-24" />
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex justify-between">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200">
            <EmptyState
              icon={CheckCircle2}
              title="No tasks yet"
              description="Break this campaign into tasks, assign them to your team, and track progress through the Kanban board."
              action={{
                label: 'Create First Task',
                icon: <Plus size={14} />,
                onClick: () => { setForm(EMPTY_FORM); setFormError(null); setNewTaskOpen(true) },
              }}
            />
          </div>
        )}

        {/* ── KANBAN VIEW ── */}
        {!loading && tasks.length > 0 && view === 'kanban' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map(col => {
              const colTasks = tasksByStatus(col.id)
              return (
                <div key={col.id} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className={cn('flex items-center justify-between px-3 py-2 rounded-lg', col.bg)}>
                    <span className={cn('text-xs font-semibold uppercase tracking-wide', col.color)}>
                      {col.label}
                    </span>
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/70', col.color)}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div className="flex flex-col gap-2 min-h-[120px]">
                    {colTasks.length === 0 ? (
                      <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 text-xs text-slate-400">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map(task => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          onEdit={openEdit}
                          onDelete={t => setDeleteTarget(t)}
                        />
                      ))
                    )}
                  </div>

                  {/* Add task shortcut */}
                  <button
                    onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(null); setNewTaskOpen(true) }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus size={12} /> Add task
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {!loading && tasks.length > 0 && view === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3">
                      {(task.assignee_name || task.assignee_id) ? (
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(task.assignee_name ?? task.assignee_id ?? '?')}
                          </span>
                          <span className="text-sm text-slate-700">{task.assignee_name ?? '—'}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <User size={12} /> Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {task.due_date ? (
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(task.due_date)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(task.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(task)}
                          className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(task)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Task Modal ── */}
      <Modal
        open={newTaskOpen}
        onClose={() => { setNewTaskOpen(false); setFormError(null) }}
        title="New Task"
        description="Add a task to this campaign"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNewTaskOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={submitting} onClick={handleCreate}>Create Task</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              {formError}
            </div>
          )}

          <Input
            label="Title *"
            placeholder="e.g. Write Instagram captions for launch week"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />

          <Textarea
            label="Description"
            placeholder="Additional details, context, or acceptance criteria..."
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={form.priority}
              onChange={e => setForm(p => ({ ...p, priority: e.target.value as Priority }))}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high',   label: 'High'   },
                { value: 'medium', label: 'Medium' },
                { value: 'low',    label: 'Low'    },
              ]}
            />
            <Input
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>

          <Input
            label="Assignee"
            placeholder="Team member name"
            value={form.assigned_to}
            onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}
          />
        </div>
      </Modal>

      {/* ── Edit Task Modal ── */}
      <Modal
        open={!!editTask}
        onClose={() => { setEditTask(null); setEditError(null) }}
        title="Edit Task"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTask(null)}>Cancel</Button>
            <Button variant="primary" loading={editSubmitting} onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              {editError}
            </div>
          )}

          <Input
            label="Title *"
            value={editForm.title}
            onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
          />

          <Textarea
            label="Description"
            value={editForm.description}
            onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={editForm.priority}
              onChange={e => setEditForm(p => ({ ...p, priority: e.target.value as Priority }))}
              options={[
                { value: 'urgent', label: 'Urgent' },
                { value: 'high',   label: 'High'   },
                { value: 'medium', label: 'Medium' },
                { value: 'low',    label: 'Low'    },
              ]}
            />
            <Input
              label="Due Date"
              type="date"
              value={editForm.due_date}
              onChange={e => setEditForm(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>

          <Input
            label="Assignee"
            value={editForm.assigned_to}
            onChange={e => setEditForm(p => ({ ...p, assigned_to: e.target.value }))}
          />

          <Select
            label="Status"
            value={(editTask?.status as TaskStatus) ?? 'todo'}
            onChange={async e => {
              const newStatus = e.target.value as TaskStatus
              if (editTask) {
                await handleStatusChange(editTask, newStatus)
                setEditTask(prev => prev ? { ...prev, status: newStatus } : prev)
              }
            }}
            options={COLUMNS.map(c => ({ value: c.id, label: c.label }))}
          />
        </div>
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Task"
        description={`"${deleteTarget?.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        danger
        loading={deleteLoading}
      />
    </div>
  )
}
