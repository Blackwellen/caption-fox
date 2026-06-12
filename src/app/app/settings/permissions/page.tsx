'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield, Crown, CheckSquare, Square, ChevronDown, AlertCircle,
  Info, Edit, Trash2, Plus, X, Check, Settings, Key, Users,
  UserCheck, Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  Permission,
} from '@/lib/permissions'
import { cn, formatRelative, initials } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string
  user_id: string
  role: string
  permissions: string[] | null
  joined_at: string
  profiles: { full_name: string; email: string; avatar_url: string | null }
}

interface AuditLog {
  id: string
  created_at: string
  action: string
  metadata: Record<string, unknown> | null
  profiles: { full_name: string; email: string } | null
  target_profiles?: { full_name: string; email: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['owner', 'admin', 'manager', 'creator', 'approver', 'analyst', 'client', 'external_creator'] as const
type RoleId = typeof ROLES[number]

const ROLE_DISPLAY: Record<RoleId, { label: string; color: string; bgColor: string; textColor: string }> = {
  owner:            { label: 'Owner',           color: 'amber',  bgColor: 'bg-amber-50',   textColor: 'text-amber-700' },
  admin:            { label: 'Admin',            color: 'red',    bgColor: 'bg-red-50',     textColor: 'text-red-700' },
  manager:          { label: 'Manager',          color: 'blue',   bgColor: 'bg-blue-50',    textColor: 'text-blue-700' },
  creator:          { label: 'Creator',          color: 'green',  bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  approver:         { label: 'Approver',         color: 'purple', bgColor: 'bg-violet-50',  textColor: 'text-violet-700' },
  analyst:          { label: 'Analyst',          color: 'cyan',   bgColor: 'bg-cyan-50',    textColor: 'text-cyan-700' },
  client:           { label: 'Client',           color: 'slate',  bgColor: 'bg-slate-100',  textColor: 'text-slate-600' },
  external_creator: { label: 'Ext. Creator',     color: 'orange', bgColor: 'bg-orange-50',  textColor: 'text-orange-700' },
}

const APPROVAL_TYPES = [
  { id: 'posts',     label: 'Post Approvals',     desc: 'Require approval before publishing posts', perm: PERMISSIONS.APPROVE_POST },
  { id: 'campaigns', label: 'Campaign Approvals', desc: 'Require approval before launching campaigns', perm: PERMISSIONS.APPROVE_POST },
  { id: 'ugc',       label: 'UGC Approvals',      desc: 'Require approval before accepting UGC submissions', perm: PERMISSIONS.APPROVE_UGC },
]

// ─── Toast Hook ───────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])
  return { toast, show }
}

// ─── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        value ? 'bg-blue-600' : 'bg-slate-200',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm',
        value ? 'translate-x-4' : 'translate-x-1',
      )} />
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast, show: showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('viewer')

  // Edit permissions modal
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Approval config (localStorage)
  const [approvalConfig, setApprovalConfig] = useState<Record<string, { enabled: boolean; approvers: string[] }>>({
    posts:     { enabled: false, approvers: [] },
    campaigns: { enabled: false, approvers: [] },
    ugc:       { enabled: false, approvers: [] },
  })

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const wsRes = await supabase.from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!wsRes.data) { setLoading(false); return }

      const wsId = wsRes.data.workspace_id
      setWorkspaceId(wsId)
      setCurrentUserRole(wsRes.data.role)

      const [membersRes, auditRes] = await Promise.all([
        supabase.from('workspace_members')
          .select('id, user_id, role, permissions, joined_at, profiles(full_name, email, avatar_url)')
          .eq('workspace_id', wsId),
        supabase.from('audit_logs')
          .select('id, created_at, action, metadata, profiles(full_name, email)')
          .eq('workspace_id', wsId)
          .eq('action', 'permissions_updated')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      if (membersRes.data) setMembers(membersRes.data as unknown as Member[])
      if (auditRes.data) setAuditLogs(auditRes.data as unknown as AuditLog[])

      // Load approval config from localStorage
      const saved = localStorage.getItem(`caption_fox_approval_config_${wsId}`)
      if (saved) {
        try { setApprovalConfig(JSON.parse(saved)) } catch { /* ignore */ }
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Edit Permissions Modal ─────────────────────────────────────────────────

  function openEditModal(member: Member) {
    const perms = member.permissions ?? ROLE_PERMISSIONS[member.role] ?? []
    setEditPerms([...perms])
    setEditTarget(member)
  }

  function closeEditModal() {
    setEditTarget(null)
    setEditPerms([])
  }

  function togglePerm(perm: string) {
    setEditPerms(p => p.includes(perm) ? p.filter(x => x !== perm) : [...p, perm])
  }

  function resetToDefaults() {
    if (!editTarget) return
    setEditPerms([...(ROLE_PERMISSIONS[editTarget.role] ?? [])])
  }

  async function savePermissions() {
    if (!editTarget) return
    setSaving(true)
    const { error } = await supabase.from('workspace_members')
      .update({ permissions: editPerms })
      .eq('id', editTarget.id)

    if (!error) {
      setMembers(prev => prev.map(m => m.id === editTarget.id ? { ...m, permissions: editPerms } : m))
      // Log audit
      if (workspaceId) {
        await supabase.from('audit_logs').insert({
          workspace_id: workspaceId,
          action: 'permissions_updated',
          resource_type: 'workspace_member',
          resource_id: editTarget.id,
          metadata: {
            target_user: editTarget.profiles?.full_name,
            target_email: editTarget.profiles?.email,
            permissions_count: editPerms.length,
          },
        })
      }
      showToast('Permissions saved')
      closeEditModal()
    } else {
      showToast(error.message, 'error')
    }
    setSaving(false)
  }

  // ── Approval Config ────────────────────────────────────────────────────────

  function updateApprovalConfig(typeId: string, field: 'enabled' | 'approvers', value: boolean | string[]) {
    const next = {
      ...approvalConfig,
      [typeId]: { ...approvalConfig[typeId], [field]: value },
    }
    setApprovalConfig(next)
    if (workspaceId) {
      localStorage.setItem(`caption_fox_approval_config_${workspaceId}`, JSON.stringify(next))
    }
    showToast('Approval settings saved')
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getMemberCustomCount(member: Member): number {
    if (!member.permissions) return 0
    const defaults = ROLE_PERMISSIONS[member.role] ?? []
    const added = member.permissions.filter(p => !defaults.includes(p as Permission))
    const removed = defaults.filter(p => !member.permissions!.includes(p))
    return added.length + removed.length
  }

  const approvers = members.filter(m =>
    (m.permissions ?? ROLE_PERMISSIONS[m.role] ?? []).includes(PERMISSIONS.APPROVE_POST) ||
    (m.permissions ?? ROLE_PERMISSIONS[m.role] ?? []).includes(PERMISSIONS.APPROVE_UGC)
  )

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-slate-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
          toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/app/settings')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronDown size={14} className="rotate-90" />
              Settings
            </button>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Shield size={14} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Roles &amp; Permissions</h1>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-500 -mt-4">
          Control what each team member can access and do in Caption Fox.
        </p>

        {/* ── Section 1: Role Permission Matrix ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Key size={15} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Role Permission Matrix</h2>
            <span className="ml-auto text-xs text-slate-400">Read-only overview of default role permissions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Permission</th>
                  {ROLES.map(role => {
                    const rd = ROLE_DISPLAY[role]
                    return (
                      <th key={role} className="px-2 py-3 text-center min-w-[80px]">
                        <div className={cn('inline-flex flex-col items-center gap-1 px-2 py-1 rounded-lg', rd.bgColor)}>
                          {role === 'owner' && <Crown size={12} className="text-amber-600" />}
                          <span className={cn('font-semibold text-xs', rd.textColor)}>{rd.label}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group, gi) => (
                  <>
                    <tr key={`group-${gi}`} className="bg-slate-50/60">
                      <td colSpan={ROLES.length + 1} className="px-4 py-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</span>
                      </td>
                    </tr>
                    {group.permissions.map((perm, pi) => (
                      <tr key={perm} className={cn('border-t border-slate-100 hover:bg-slate-50/50 transition-colors', pi % 2 === 0 ? 'bg-white' : 'bg-slate-50/20')}>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">
                          {PERMISSION_LABELS[perm]}
                        </td>
                        {ROLES.map(role => {
                          const hasIt = ROLE_PERMISSIONS[role]?.includes(perm)
                          const isOwner = role === 'owner'
                          return (
                            <td key={role} className="px-2 py-2.5 text-center">
                              {isOwner ? (
                                <div className="flex justify-center">
                                  <CheckSquare size={15} className="text-amber-500" />
                                </div>
                              ) : hasIt ? (
                                <div className="flex justify-center">
                                  <CheckSquare size={15} className="text-blue-600" />
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  <Square size={15} className="text-slate-200" />
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Section 2: Custom Member Permissions ──────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <UserCheck size={15} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Custom Member Overrides</h2>
            <span className="ml-auto text-xs text-slate-400">Override individual member permissions beyond their role defaults</span>
          </div>

          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users size={32} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No team members yet</p>
              <p className="text-xs text-slate-400 mt-1">Invite team members to manage their permissions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Overrides</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map(m => {
                    const name = m.profiles?.full_name ?? 'Unknown'
                    const email = m.profiles?.email ?? ''
                    const rd = ROLE_DISPLAY[m.role as RoleId] ?? ROLE_DISPLAY.client
                    const customCount = getMemberCustomCount(m)
                    const isOwner = m.role === 'owner'

                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {m.profiles?.avatar_url
                              ? <img src={m.profiles.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover" />
                              : <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">{initials(name)}</div>}
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{name}</p>
                              <p className="text-xs text-slate-400">{email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', rd.bgColor, rd.textColor)}>
                            {isOwner && <Crown size={10} />}
                            {rd.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {customCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Edit size={10} />
                              {customCount} override{customCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Using role defaults</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isOwner ? (
                            <span className="text-xs text-slate-300 flex items-center justify-end gap-1">
                              <Lock size={11} />
                              All permissions
                            </span>
                          ) : (
                            <button
                              onClick={() => openEditModal(m)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                            >
                              <Edit size={12} />
                              Edit Permissions
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Section 3: Approval Workflow Configuration ─────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Settings size={15} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Approval Workflow Configuration</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {APPROVAL_TYPES.map(at => {
              const config = approvalConfig[at.id] ?? { enabled: false, approvers: [] }
              const eligibleApprovers = members.filter(m => {
                const perms = m.permissions ?? ROLE_PERMISSIONS[m.role] ?? []
                return perms.includes(at.perm)
              })

              return (
                <div key={at.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-800">{at.label}</p>
                        <Toggle
                          value={config.enabled}
                          onChange={v => updateApprovalConfig(at.id, 'enabled', v)}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{at.desc}</p>

                      {config.enabled && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2">Designated Approvers</p>
                          {eligibleApprovers.length === 0 ? (
                            <p className="text-xs text-amber-600 flex items-center gap-1.5">
                              <AlertCircle size={12} />
                              No members with approval permissions found. Assign the &apos;approver&apos; role to team members first.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {eligibleApprovers.map(m => {
                                const name = m.profiles?.full_name ?? 'Unknown'
                                const selected = config.approvers.includes(m.id)
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      const next = selected
                                        ? config.approvers.filter(id => id !== m.id)
                                        : [...config.approvers, m.id]
                                      updateApprovalConfig(at.id, 'approvers', next)
                                    }}
                                    className={cn(
                                      'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all',
                                      selected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300',
                                    )}
                                  >
                                    {selected && <Check size={10} />}
                                    {name}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* AI Content — always on, non-removable */}
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800">AI Content Approval</p>
                    <Toggle value={true} onChange={() => {}} disabled />
                    <div className="relative group">
                      <Info size={13} className="text-slate-400 cursor-help" />
                      <div className="absolute left-5 top-0 w-56 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Required by platform policy. All AI-generated content must be reviewed by a human before publishing.
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Require human approval for all AI-generated content</p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg">
                    <Lock size={11} />
                    Required by platform policy — cannot be disabled
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Permission Audit ────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Shield size={15} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Permission Change Audit</h2>
            <span className="ml-auto text-xs text-slate-400">Last 10 permission changes</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Shield size={28} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">No permission changes recorded yet.</p>
              <p className="text-xs text-slate-300 mt-1">Changes made via &quot;Edit Permissions&quot; will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditLogs.map(log => {
                const meta = log.metadata as Record<string, unknown> | null
                const actorName = log.profiles?.full_name ?? 'Unknown'
                const targetName = (meta?.target_user as string) ?? 'a team member'
                const permCount = (meta?.permissions_count as number) ?? null

                return (
                  <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Key size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold">{actorName}</span>
                        {' '}updated permissions for{' '}
                        <span className="font-semibold">{targetName}</span>
                        {permCount !== null && (
                          <span className="text-slate-500"> ({permCount} permissions)</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{log.profiles?.email ?? ''}</p>
                    </div>
                    <p className="text-xs text-slate-400 whitespace-nowrap shrink-0 mt-1">
                      {formatRelative(log.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Edit Permissions Modal ──────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                {editTarget.profiles?.avatar_url
                  ? <img src={editTarget.profiles.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-semibold">
                      {initials(editTarget.profiles?.full_name ?? 'U')}
                    </div>}
                <div>
                  <p className="font-semibold text-slate-900">{editTarget.profiles?.full_name ?? 'Member'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {(() => {
                      const rd = ROLE_DISPLAY[editTarget.role as RoleId] ?? ROLE_DISPLAY.client
                      return (
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', rd.bgColor, rd.textColor)}>
                          {rd.label}
                        </span>
                      )
                    })()}
                    <span className="text-xs text-slate-400">{editTarget.profiles?.email}</span>
                  </div>
                </div>
              </div>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{group.label}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.permissions.map(perm => {
                      const checked = editPerms.includes(perm)
                      return (
                        <button
                          key={perm}
                          onClick={() => togglePerm(perm)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all',
                            checked
                              ? 'bg-blue-50 border-blue-300 text-blue-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                          )}
                        >
                          {checked
                            ? <CheckSquare size={15} className="text-blue-600 shrink-0" />
                            : <Square size={15} className="text-slate-300 shrink-0" />}
                          <span className="text-xs font-medium leading-tight">{PERMISSION_LABELS[perm]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Trash2 size={12} />
                Reset to Role Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Check size={14} />
                  )}
                  Save Custom Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
