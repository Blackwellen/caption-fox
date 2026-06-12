'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, AlertCircle, CheckCircle2, Clock, Users,
  RefreshCw, FileArchive, ChevronDown, X, Send, Loader2,
  Tag, BarChart2, Mail, UserCircle2, Eye,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDate, formatRelative, initials } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string
  created_at: string
  updated_at: string
  name: string
  email: string
  subject: string
  message: string
  category: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  assigned_to: string | null
  workspace_id: string | null
  reply_message?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved', 'urgent'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const PRIORITY_VARIANT: Record<string, 'red' | 'amber' | 'blue' | 'slate'> = {
  urgent: 'red',
  high: 'amber',
  normal: 'blue',
  low: 'slate',
}

const STATUS_VARIANT: Record<string, 'blue' | 'amber' | 'green' | 'slate'> = {
  open: 'blue',
  in_progress: 'amber',
  resolved: 'green',
  closed: 'slate',
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])
  return { toast, show }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const supabase = createClient()
  const { toast, show: showToast } = useToast()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [ticketForm, setTicketForm] = useState({
    status: 'open',
    priority: 'normal',
    assigned_to: '',
    reply: '',
  })
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // ── Load tickets ──────────────────────────────────────────────────────────

  const loadTickets = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) setTickets(data as SupportTicket[])
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed').length,
    resolvedToday: tickets.filter(t => {
      if (t.status !== 'resolved') return false
      const d = new Date(t.updated_at)
      const today = new Date()
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    }).length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
  }

  // ── Filtered tickets ──────────────────────────────────────────────────────

  const filtered = tickets.filter(t => {
    if (filter === 'all') return true
    if (filter === 'urgent') return t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed'
    return t.status === filter
  })

  // ── Open ticket modal ─────────────────────────────────────────────────────

  function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket)
    setTicketForm({
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: ticket.assigned_to ?? '',
      reply: '',
    })
  }

  // ── Save ticket changes ───────────────────────────────────────────────────

  async function handleSaveTicket() {
    if (!selectedTicket) return
    setSaving(true)

    const updates: Partial<SupportTicket> = {
      status: ticketForm.status as SupportTicket['status'],
      priority: ticketForm.priority as SupportTicket['priority'],
      assigned_to: ticketForm.assigned_to || null,
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', selectedTicket.id)

    if (!error) {
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, ...updates } : t))
      showToast('Ticket updated')
      if (ticketForm.reply.trim()) {
        showToast('Reply sent (email integration pending)')
      }
      setSelectedTicket(null)
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  // ── Quick resolve ─────────────────────────────────────────────────────────

  async function handleQuickResolve(ticket: SupportTicket) {
    setResolving(ticket.id)
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', ticket.id)
    if (!error) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'resolved' } : t))
      showToast('Ticket marked resolved')
    } else {
      showToast(error.message, 'error')
    }
    setResolving(null)
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function handleExport() {
    setExporting(true)
    const headers = ['ID', 'Name', 'Email', 'Subject', 'Category', 'Priority', 'Status', 'Assigned To', 'Created', 'Updated']
    const rows = filtered.map(t => [
      t.id,
      t.name,
      t.email,
      `"${t.subject.replace(/"/g, '""')}"`,
      t.category ?? '',
      t.priority,
      t.status,
      t.assigned_to ?? '',
      t.created_at,
      t.updated_at,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `support-tickets-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const filterLabels: Record<StatusFilter, string> = {
    all: 'All',
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    urgent: 'Urgent',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Support Inbox</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and respond to customer support tickets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw size={13} />}
            onClick={loadTickets}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={exporting ? <Loader2 size={13} className="animate-spin" /> : <FileArchive size={13} />}
            onClick={handleExport}
            disabled={exporting}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Open Tickets',
            value: stats.open,
            icon: <MessageSquare size={18} className="text-blue-600" />,
            bg: 'bg-blue-50',
            text: 'text-blue-700',
          },
          {
            label: 'Urgent',
            value: stats.urgent,
            icon: <AlertCircle size={18} className="text-red-600" />,
            bg: 'bg-red-50',
            text: 'text-red-700',
          },
          {
            label: 'Avg Response',
            value: '< 4 hrs',
            icon: <Clock size={18} className="text-amber-600" />,
            bg: 'bg-amber-50',
            text: 'text-amber-700',
          },
          {
            label: 'Resolved Today',
            value: stats.resolvedToday,
            icon: <CheckCircle2 size={18} className="text-emerald-600" />,
            bg: 'bg-emerald-50',
            text: 'text-emerald-700',
          },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-4 flex items-center gap-4', s.bg)}>
            <div className="shrink-0">{s.icon}</div>
            <div>
              <p className={cn('text-2xl font-bold', s.text)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
              filter === f
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50',
            )}
          >
            {filterLabels[f]}
            {f !== 'all' && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}>
                {f === 'urgent'
                  ? stats.urgent
                  : f === 'open' ? stats.open
                    : f === 'in_progress' ? stats.inProgress
                      : tickets.filter(t => t.status === f).length}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No tickets found"
          description={filter === 'all' ? 'No support tickets have been submitted yet.' : `No ${filterLabels[filter].toLowerCase()} tickets.`}
          compact
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#', 'Customer', 'Subject', 'Category', 'Priority', 'Status', 'Created', 'Assigned To', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(ticket => (
                  <tr
                    key={ticket.id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      ticket.priority === 'urgent' && ticket.status !== 'resolved' && 'bg-red-50/30',
                    )}
                  >
                    {/* ID */}
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                      #{ticket.id.slice(0, 6)}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {initials(ticket.name || ticket.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate max-w-[120px]">{ticket.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[120px]">{ticket.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-sm text-slate-700 truncate" title={ticket.subject}>{ticket.subject}</p>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      {ticket.category
                        ? <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Tag size={11} />{ticket.category}
                          </span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? 'slate'} dot className="capitalize">
                        {ticket.priority}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[ticket.status] ?? 'slate'} dot className="capitalize">
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {formatRelative(ticket.created_at)}
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {ticket.assigned_to
                        ? <div className="flex items-center gap-1"><UserCircle2 size={12} />{ticket.assigned_to}</div>
                        : <span className="text-slate-300">Unassigned</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<Eye size={12} />}
                          onClick={() => openTicket(ticket)}
                        >
                          View
                        </Button>
                        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-emerald-600 hover:bg-emerald-50"
                            icon={resolving === ticket.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <CheckCircle2 size={12} />}
                            onClick={() => handleQuickResolve(ticket)}
                            disabled={resolving === ticket.id}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ticket View Modal */}
      <Modal
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `Ticket #${selectedTicket.id.slice(0, 6)}` : ''}
        description={selectedTicket?.subject}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedTicket(null)}>Close</Button>
            <Button onClick={handleSaveTicket} loading={saving} icon={<Send size={14} />}>
              {ticketForm.reply.trim() ? 'Save & Send Reply' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {selectedTicket && (
          <div className="space-y-6">
            {/* Customer info */}
            <div className="flex items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-semibold text-sm flex items-center justify-center">
                  {initials(selectedTicket.name || selectedTicket.email)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{selectedTicket.name || 'Unknown'}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Mail size={11} />
                    <a href={`mailto:${selectedTicket.email}`} className="hover:text-blue-600 transition-colors">{selectedTicket.email}</a>
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 justify-end">
                  <Badge variant={PRIORITY_VARIANT[selectedTicket.priority] ?? 'slate'} dot className="capitalize">
                    {selectedTicket.priority}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[selectedTicket.status] ?? 'slate'} dot className="capitalize">
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">Submitted {formatDate(selectedTicket.created_at)}</p>
              </div>
            </div>

            {/* Category */}
            {selectedTicket.category && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Tag size={13} className="text-slate-400" />
                <span>Category: <span className="font-medium">{selectedTicket.category}</span></span>
              </div>
            )}

            {/* Original message */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message</h4>
              <div className="p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.message}
              </div>
            </div>

            {/* Update fields */}
            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Status"
                value={ticketForm.status}
                options={STATUS_OPTIONS}
                onChange={e => setTicketForm(p => ({ ...p, status: e.target.value }))}
              />
              <Select
                label="Priority"
                value={ticketForm.priority}
                options={PRIORITY_OPTIONS}
                onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value }))}
              />
              <Input
                label="Assigned To"
                value={ticketForm.assigned_to}
                onChange={e => setTicketForm(p => ({ ...p, assigned_to: e.target.value }))}
                placeholder="Agent name or email"
                icon={<UserCircle2 size={13} />}
              />
            </div>

            {/* Reply */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reply to Customer</h4>
              <Textarea
                value={ticketForm.reply}
                onChange={e => setTicketForm(p => ({ ...p, reply: e.target.value }))}
                rows={4}
                placeholder="Write your reply here. It will be sent to the customer's email address."
              />
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                <Mail size={11} />
                Reply will be sent to <span className="font-medium">{selectedTicket.email}</span>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
