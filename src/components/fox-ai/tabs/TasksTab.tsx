'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckSquare, Plus, Circle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatRelative, formatDate, cn } from '@/lib/utils'
import type { CampaignTask, Campaign } from '@/types/database'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

export function TasksTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [tasks, setTasks] = useState<(CampaignTask & { campaigns?: { name: string } | null })[] | null>(null)
  const [filter, setFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [title, setTitle] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb.from('campaign_tasks').select('*, campaigns(name)').eq('workspace_id', workspaceId).order('due_date', { ascending: true, nullsFirst: false }).limit(100)
    setTasks((data as (CampaignTask & { campaigns?: { name: string } | null })[]) ?? [])
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sb = createClient()
    sb.from('campaigns').select('*').eq('workspace_id', workspaceId).order('name').then(({ data }) => setCampaigns((data as Campaign[]) ?? []))
  }, [workspaceId])

  async function toggleStatus(task: CampaignTask) {
    const next = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'in_progress' : 'done'
    const sb = createClient()
    await sb.from('campaign_tasks').update({ status: next }).eq('id', task.id)
    load()
  }

  async function createTask() {
    if (!title.trim() || !campaignId) return
    setSaving(true)
    const sb = createClient()
    await sb.from('campaign_tasks').insert({
      campaign_id: campaignId, workspace_id: workspaceId, title: title.trim(),
      description: null, status: 'todo', priority: 'medium',
      due_date: dueDate || null, assignee_id: userId, created_by: userId,
    })
    setTitle(''); setDueDate(''); setCreateOpen(false)
    setSaving(false)
    load()
  }

  const filtered = (tasks ?? []).filter(t => filter === 'all' || t.status === filter)

  return (
    <div className="max-h-[560px] overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><CheckSquare size={16} /></div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Tasks</p>
            <p className="text-xs text-slate-500">View and manage your tasks</p>
          </div>
        </div>
        <Button size="xs" icon={<Plus size={12} />} onClick={() => setCreateOpen(true)}>New</Button>
      </div>

      <div className="mb-3 flex gap-1.5">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', filter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>{f.label}</button>
        ))}
      </div>

      {tasks === null ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks" description="Create a task from a campaign to see it here." compact />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
            return (
              <div key={t.id} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
                <button onClick={() => toggleStatus(t)} className="mt-0.5 shrink-0 text-slate-400 hover:text-blue-600">
                  {t.status === 'done' ? <CheckCircle2 size={16} className="text-emerald-500" /> : t.status === 'in_progress' ? <Clock size={16} className="text-amber-500" /> : <Circle size={16} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm', t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    {t.campaigns?.name && <span className="truncate">{t.campaigns.name}</span>}
                    {t.due_date && <span className={cn(overdue && 'font-medium text-red-600')}>· {overdue ? 'Overdue' : 'Due'} {formatDate(t.due_date)}</span>}
                  </div>
                </div>
                {t.priority && <Badge variant={t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'amber' : 'slate'} className="!px-1.5 !py-0 text-[10px] shrink-0">{t.priority}</Badge>}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Task" size="sm">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Campaign</label>
            <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select a campaign…</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {campaigns.length === 0 && <p className="mt-1 text-xs text-amber-600">Create a campaign first — tasks must belong to one.</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Draft launch captions" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Due date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <Button className="w-full" loading={saving} disabled={!title.trim() || !campaignId} onClick={createTask}>Create Task</Button>
        </div>
      </Modal>
    </div>
  )
}
