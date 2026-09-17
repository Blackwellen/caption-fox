'use server'

import { revalidatePath } from 'next/cache'
import { guardInbox } from './context'

// Tasks live in the canonical campaign_tasks table (campaign optional). Used by
// the Inbox rails and the Fox AI Tasks state.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

export async function createTaskFromConversation(input: { threadId: string; title?: string; dueInDays?: number }): Promise<Result<{ id: string }>> {
  const g = await guardInbox('tasks.edit')
  if (!g.ok) return g
  if (!UUID.test(input.threadId)) return { ok: false, error: 'Unknown conversation.' }
  const { data: thread } = await g.supabase.from('inbox_conversation_list')
    .select('id, subject, contact_name, sender_name, contact_id, platform, assigned_to, priority, last_message_preview')
    .eq('workspace_id', g.workspace.id).eq('id', input.threadId).maybeSingle()
  if (!thread) return { ok: false, error: 'Conversation not found.' }
  const due = new Date(Date.now() + (input.dueInDays ?? 1) * 86_400_000)
  const title = (input.title?.trim() || `Follow up with ${thread.contact_name ?? thread.sender_name ?? 'contact'}${thread.subject ? `: ${thread.subject}` : ''}`).slice(0, 160)
  const { data, error } = await g.supabase.from('campaign_tasks').insert({
    workspace_id: g.workspace.id, title, description: thread.last_message_preview?.slice(0, 500) ?? null,
    status: 'todo', priority: thread.priority === 'urgent' ? 'urgent' : thread.priority === 'high' ? 'high' : 'medium',
    due_date: due.toISOString(), assigned_to: thread.assigned_to ?? g.userId, created_by: g.userId,
    channel: thread.platform, thread_id: thread.id, contact_id: thread.contact_id, source: 'inbox',
  }).select('id').single()
  if (error || !data) return { ok: false, error: 'The task could not be created.' }
  await g.supabase.from('inbox_activity').insert({ workspace_id: g.workspace.id, thread_id: thread.id, actor_id: g.userId, action: 'task.created', summary: 'Follow-up task created', metadata: { task_id: data.id } })
  revalidatePath('/[workspaceType]/inbox', 'layout')
  return { ok: true, data: { id: data.id } }
}
