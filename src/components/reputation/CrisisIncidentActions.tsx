'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { useToast } from './Toast'
import { addCrisisTimelineEvent, aiDraftCrisisStatement, createCrisisStatement, setCrisisIncidentStatus, setCrisisStatementStatus } from '@/app/app/reputation/actions'

interface Props {
  incidentId: string
  incidentStatus: string
  latestStatement?: { id: string; status: string } | null
  canManage: boolean
  canEditStatement: boolean
  canApproveStatement: boolean
}

const BTN = 'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50'
const INCIDENT_STATUSES = ['detected', 'assessing', 'active_response', 'monitoring', 'recovering', 'resolved']

export function CrisisIncidentActions({ incidentId, incidentStatus, latestStatement, canManage, canEditStatement, canApproveStatement }: Props) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [statementOpen, setStatementOpen] = useState(false)
  const [statementBody, setStatementBody] = useState('')

  function aiDraft() {
    if (pending) return
    setStatementOpen(true)
    startTransition(async () => {
      const result = await aiDraftCrisisStatement(incidentId)
      if (!result.ok) { notify('error', result.error ?? 'AI draft failed.'); return }
      setStatementBody(result.text ?? '')
      notify('success', 'AI draft ready — review before saving.')
    })
  }

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>, onDone?: () => void) {
    if (pending) return
    startTransition(async () => {
      const result = await action()
      if (!result.ok) { notify('error', result.error ?? 'Action failed.'); return }
      notify('success', result.message ?? 'Done.')
      onDone?.()
      router.refresh()
    })
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {pending && <Loader2 size={13} className="animate-spin text-slate-400" />}
        {canManage && (
          <select
            value={incidentStatus} disabled={pending}
            onChange={e => run(() => setCrisisIncidentStatus(incidentId, e.target.value))}
            className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-600"
          >
            {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        )}
        {canManage && <button type="button" disabled={pending} className={BTN} onClick={() => setNoteOpen(v => !v)}>Add timeline note</button>}
        {canEditStatement && !latestStatement && <button type="button" disabled={pending} className={BTN} onClick={() => setStatementOpen(v => !v)}>Draft statement</button>}
        {canEditStatement && !latestStatement && <button type="button" disabled={pending} className={BTN} onClick={aiDraft}><Sparkles size={12} />AI draft</button>}
        {latestStatement?.status === 'draft' && canEditStatement && (
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => setCrisisStatementStatus(latestStatement.id, 'legal_review'))}>Send for legal review</button>
        )}
        {latestStatement?.status === 'legal_review' && canApproveStatement && (
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => setCrisisStatementStatus(latestStatement.id, 'approved'))}>Approve statement</button>
        )}
        {latestStatement?.status === 'approved' && canApproveStatement && (
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => setCrisisStatementStatus(latestStatement.id, 'published'))}>Publish statement</button>
        )}
      </div>

      {noteOpen && (
        <div className="flex items-center gap-1.5">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What happened?" className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <button type="button" disabled={pending || !note.trim()} className={BTN} onClick={() => run(() => addCrisisTimelineEvent(incidentId, note), () => { setNote(''); setNoteOpen(false) })}>Add</button>
        </div>
      )}

      {statementOpen && (
        <div className="space-y-1.5">
          <textarea value={statementBody} onChange={e => setStatementBody(e.target.value)} rows={2} placeholder="Draft a holding statement..." className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <button type="button" disabled={pending || !statementBody.trim()} className={BTN} onClick={() => run(() => createCrisisStatement(incidentId, statementBody), () => { setStatementBody(''); setStatementOpen(false) })}>Save draft</button>
        </div>
      )}
    </div>
  )
}
