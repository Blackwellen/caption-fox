'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Flag, Loader2, RefreshCw, Send, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  assignConversation, cancelScheduledPost, disconnectChannel, duplicatePost, publishNow, resolveConnectionIssue,
  retryFailedDeliveries, sendReply, setApprovalDecision, submitForApproval, syncChannelNow, updateChannelTeam,
  updateConversation, updateMention, type ActionResult,
} from '@/lib/social/actions'
import { Dialog, FormError, fieldInput, fieldLabel, primaryButton, secondaryButton } from '../Dialog'
import { ConnectButton } from '../connections/ConnectionsClient'

// Client actions for the Social detail routes. Every button calls a server
// action that re-checks the session, surface, permission and record ownership;
// the UI only shows what the member is allowed to attempt, and disabled
// controls carry the reason. Buttons lock while a request is in flight, so a
// double click cannot submit twice.

const btn = 'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:h-8 lg:text-[12px]'
const primary = cn(btn, 'bg-blue-600 text-white shadow-sm hover:bg-blue-700')
const secondary = cn(btn, 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
const danger = cn(btn, 'border border-red-200 bg-white text-red-600 hover:bg-red-50')

function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<ActionResult<unknown> | null>(null)
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: (result: ActionResult<unknown>) => void) => {
    if (pending) return
    setResult(null)
    start(async () => {
      const outcome = await fn()
      setResult(outcome)
      if (outcome.ok) { after?.(outcome); router.refresh() }
    })
  }
  return { pending, result, run, clear: () => setResult(null) }
}

function Status({ result }: { result: ActionResult<unknown> | null }) {
  if (!result) return null
  return result.ok
    ? <p role="status" className="text-[12.5px] text-emerald-700">{result.message}</p>
    : <FormError message={result.message} reference={result.reference} />
}

function ActionButton({ onClick, disabledReason, pending, className, children }: {
  onClick: () => void; disabledReason?: string | null; pending: boolean; className: string; children: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={pending || Boolean(disabledReason)} title={disabledReason ?? undefined} className={className}>
      {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
      {children}
      {disabledReason && <span className="sr-only">Unavailable: {disabledReason}</span>}
    </button>
  )
}

function ConfirmDialog({ open, onClose, title, body, confirmLabel, onConfirm, pending, result }: {
  open: boolean; onClose: () => void; title: string; body: string; confirmLabel: string
  onConfirm: () => void; pending: boolean; result: ActionResult<unknown> | null
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm" footer={(
      <>
        <button type="button" onClick={onClose} className={secondaryButton}>Keep it</button>
        <button type="button" onClick={onConfirm} disabled={pending} className={cn(primaryButton, 'bg-red-600 hover:bg-red-700')} data-autofocus>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}{confirmLabel}
        </button>
      </>
    )}>
      <p className="text-[13.5px] leading-relaxed text-slate-600">{body}</p>
      {result && !result.ok && <div className="mt-3"><Status result={result} /></div>}
    </Dialog>
  )
}

// ── Post ─────────────────────────────────────────────────────────────────────

export function PostActions({ postId, status, can, hasFailures, basePath }: {
  postId: string
  status: string
  can: { edit: boolean; approve: boolean; publish: boolean; cancel: boolean; create: boolean }
  hasFailures: boolean
  basePath: string
}) {
  const router = useRouter()
  const { pending, result, run } = useAction()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const locked = ['published', 'publishing', 'cancelled', 'archived'].includes(status)
  const role = (allowed: boolean, what: string) => (allowed ? null : `Your role cannot ${what}.`)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'pending_approval' && (
          <>
            <ActionButton pending={pending} className={primary} disabledReason={role(can.approve, 'approve posts')}
              onClick={() => run(() => setApprovalDecision(postId, 'approve'))}><Check size={14} aria-hidden /> Approve</ActionButton>
            <ActionButton pending={pending} className={secondary} disabledReason={role(can.approve, 'review posts')}
              onClick={() => setRejecting(true)}><X size={14} aria-hidden /> Request changes</ActionButton>
          </>
        )}
        {['draft', 'approved', 'scheduled', 'queued'].includes(status) && (
          <ActionButton pending={pending} className={status === 'pending_approval' ? secondary : primary} disabledReason={role(can.publish, 'publish posts')}
            onClick={() => run(() => publishNow(postId))}><Send size={14} aria-hidden /> Publish now</ActionButton>
        )}
        {['draft', 'scheduled'].includes(status) && (
          <ActionButton pending={pending} className={secondary} disabledReason={role(can.edit, 'edit posts')}
            onClick={() => run(() => submitForApproval(postId))}>Send for approval</ActionButton>
        )}
        {!locked && (
          <button type="button" disabled={!can.edit} title={role(can.edit, 'edit posts') ?? undefined} className={secondary}
            onClick={() => router.push(`${basePath}/publishing?compose=${postId}`)}>Edit or reschedule</button>
        )}
        {hasFailures && (
          <ActionButton pending={pending} className={secondary} disabledReason={role(can.publish, 'retry deliveries')}
            onClick={() => run(() => retryFailedDeliveries(postId))}><RefreshCw size={14} aria-hidden /> Retry failed channels</ActionButton>
        )}
        <ActionButton pending={pending} className={secondary} disabledReason={role(can.create, 'create posts')}
          onClick={() => run(() => duplicatePost(postId), outcome => {
            const id = (outcome.data as { postId?: string } | undefined)?.postId
            if (id) router.push(`${basePath}/posts/${id}`)
          })}><Copy size={14} aria-hidden /> Duplicate</ActionButton>
        {!locked && (
          <ActionButton pending={pending} className={danger} disabledReason={role(can.cancel, 'cancel posts')}
            onClick={() => setConfirmCancel(true)}><Trash2 size={14} aria-hidden /> Cancel post</ActionButton>
        )}
      </div>
      <Status result={result} />

      <ConfirmDialog
        open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this post?"
        body="Queued deliveries for every channel are cancelled. Channels that already published are not affected. This is recorded in the activity log."
        confirmLabel="Cancel post" pending={pending} result={result}
        onConfirm={() => run(() => cancelScheduledPost(postId), () => setConfirmCancel(false))}
      />
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Request changes" size="sm" footer={(
        <>
          <button type="button" onClick={() => setRejecting(false)} className={secondaryButton}>Cancel</button>
          <button type="button" disabled={pending || !note.trim()} className={primaryButton}
            onClick={() => run(() => setApprovalDecision(postId, 'request_changes', note.trim()), () => { setRejecting(false); setNote('') })}>
            Send feedback
          </button>
        </>
      )}>
        <label htmlFor="review-note" className={fieldLabel}>What needs to change?</label>
        <textarea id="review-note" data-autofocus rows={4} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} className={fieldInput} />
      </Dialog>
    </div>
  )
}

// ── Conversation ─────────────────────────────────────────────────────────────

export function ConversationActions({ conversationId, status, isFlagged, assignedTo, members, templates, can }: {
  conversationId: string
  status: string
  isFlagged: boolean
  assignedTo: string | null
  members: { id: string; name: string }[]
  templates: { id: string; title: string; content: string }[]
  can: { reply: boolean; assign: boolean; resolve: boolean; moderate: boolean }
}) {
  const { pending, result, run } = useAction()
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'reply' | 'note'>('reply')
  const resolved = status === 'resolved' || status === 'done'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="assignee" className="sr-only">Assign to</label>
        <select id="assignee" disabled={!can.assign || pending} title={can.assign ? undefined : 'Your role cannot assign conversations.'}
          value={assignedTo ?? ''} onChange={event => run(() => assignConversation(conversationId, event.target.value || null))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700 disabled:opacity-50 lg:h-8 lg:text-[12px]">
          <option value="">Unassigned</option>
          {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <ActionButton pending={pending} className={resolved ? secondary : primary}
          disabledReason={can.resolve ? null : 'Your role cannot resolve conversations.'}
          onClick={() => run(() => updateConversation({ conversationId, status: resolved ? 'open' : 'resolved' }))}>
          <Check size={14} aria-hidden /> {resolved ? 'Reopen' : 'Mark resolved'}
        </ActionButton>
        <ActionButton pending={pending} className={secondary}
          disabledReason={can.moderate ? null : 'Your role cannot flag conversations.'}
          onClick={() => run(() => updateConversation({ conversationId, isFlagged: !isFlagged }))}>
          <Flag size={14} aria-hidden /> {isFlagged ? 'Remove flag' : 'Flag for review'}
        </ActionButton>
      </div>

      <form
        className="rounded-xl border border-slate-200 bg-white p-3"
        onSubmit={event => {
          event.preventDefault()
          if (!body.trim()) return
          run(() => sendReply({ conversationId, body, mode }), () => setBody(''))
        }}
      >
        <div role="tablist" aria-label="Message type" className="mb-2 flex gap-1">
          {(['reply', 'note'] as const).map(value => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)}
              className={cn('h-8 rounded-md px-3 text-[12.5px] font-medium', mode === value ? (value === 'note' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700') : 'text-slate-500 hover:bg-slate-50')}>
              {value === 'reply' ? 'Public reply' : 'Internal note'}
            </button>
          ))}
          {templates.length > 0 && (
            <select aria-label="Insert saved reply" value="" onChange={event => {
              const template = templates.find(item => item.id === event.target.value)
              if (template) setBody(template.content)
            }} className="ml-auto h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-600">
              <option value="">Saved replies</option>
              {templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
            </select>
          )}
        </div>
        <label htmlFor="reply-body" className="sr-only">{mode === 'reply' ? 'Reply' : 'Internal note'}</label>
        <textarea id="reply-body" rows={3} maxLength={5000} value={body} onChange={event => setBody(event.target.value)}
          placeholder={mode === 'reply' ? 'Write a reply. It is sent when the provider confirms delivery.' : 'Only your team can see internal notes.'}
          className={cn(fieldInput, mode === 'note' && 'bg-amber-50/40')} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Status result={result} />
          <button type="submit" disabled={pending || !body.trim() || (mode === 'reply' && !can.reply)}
            title={mode === 'reply' && !can.reply ? 'Your role cannot reply to conversations.' : undefined}
            className={cn(primary, 'ml-auto')}>
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
            {mode === 'reply' ? 'Send reply' : 'Add note'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Connection ───────────────────────────────────────────────────────────────

export function ConnectionActions({ channelId, accountName, provider, teamLabel, basePath, can }: {
  channelId: string; accountName: string; provider: string; teamLabel: string | null; basePath: string
  can: { sync: boolean; edit: boolean; disconnect: boolean; connect: boolean }
}) {
  const router = useRouter()
  const { pending, result, run } = useAction()
  const [confirm, setConfirm] = useState(false)
  const [team, setTeam] = useState(teamLabel ?? '')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton pending={pending} className={primary} disabledReason={can.sync ? null : 'Your role cannot sync channels.'}
          onClick={() => run(() => syncChannelNow(channelId))}><RefreshCw size={14} aria-hidden /> Sync now</ActionButton>
        {can.connect
          ? <ConnectButton provider={provider} channelId={channelId} returnTo={`${basePath}/connections/${channelId}`} className={secondary}>Reconnect</ConnectButton>
          : <button type="button" disabled title="Your role cannot connect channels." className={secondary}>Reconnect</button>}
        <ActionButton pending={pending} className={danger} disabledReason={can.disconnect ? null : 'Your role cannot disconnect channels.'}
          onClick={() => setConfirm(true)}>Disconnect</ActionButton>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); run(() => updateChannelTeam(channelId, team)) }}>
        <div>
          <label htmlFor="team-label" className={fieldLabel}>Team</label>
          <input id="team-label" value={team} maxLength={60} disabled={!can.edit} onChange={event => setTeam(event.target.value)} className={cn(fieldInput, 'h-9 w-56 py-1.5')} />
        </div>
        <button type="submit" disabled={pending || !can.edit || !team.trim() || team.trim() === (teamLabel ?? '')} className={secondary}>Save team</button>
      </form>
      <Status result={result} />
      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} title={`Disconnect ${accountName}?`}
        body="Stored tokens are deleted and queued posts for this account are cancelled. Historic analytics stay. You can reconnect at any time."
        confirmLabel="Disconnect" pending={pending} result={result}
        onConfirm={() => run(() => disconnectChannel(channelId), () => { setConfirm(false); router.push(`${basePath}/connections`) })}
      />
    </div>
  )
}

export function ResolveIssueButton({ issueId, allowed }: { issueId: string; allowed: boolean }) {
  const { pending, result, run } = useAction()
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <ActionButton pending={pending} className={cn(secondary, 'h-8 text-[12px]')} disabledReason={allowed ? null : 'Your role cannot resolve issues.'}
        onClick={() => run(() => resolveConnectionIssue(issueId))}>Mark resolved</ActionButton>
      {result && !result.ok && <Status result={result} />}
    </span>
  )
}

// ── Mention ──────────────────────────────────────────────────────────────────

export function MentionActions({ mentionId, isStarred, isRead, isActioned }: {
  mentionId: string; isStarred: boolean; isRead: boolean; isActioned: boolean
}) {
  const { pending, result, run } = useAction()
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton pending={pending} className={secondary} onClick={() => run(() => updateMention({ mentionId, isStarred: !isStarred }))}>
          <Star size={14} className={isStarred ? 'fill-amber-400 text-amber-400' : undefined} aria-hidden /> {isStarred ? 'Unstar' : 'Star'}
        </ActionButton>
        <ActionButton pending={pending} className={secondary} onClick={() => run(() => updateMention({ mentionId, isRead: !isRead }))}>
          Mark as {isRead ? 'unread' : 'read'}
        </ActionButton>
        <ActionButton pending={pending} className={isActioned ? secondary : primary} onClick={() => run(() => updateMention({ mentionId, isActioned: !isActioned }))}>
          <Check size={14} aria-hidden /> {isActioned ? 'Reopen' : 'Mark actioned'}
        </ActionButton>
      </div>
      <Status result={result} />
    </div>
  )
}
