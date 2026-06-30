'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload, Camera, Plus, Edit2, Trash2, Users, ShieldCheck, Bell,
  CreditCard, Plug, ClipboardList, FileArchive, PlayCircle,
  Briefcase, AtSign, Hash, Link2, CheckCircle2, AlertCircle,
  RefreshCw, Loader2, Lock, Eye, EyeOff, ChevronRight, X,
  Building2, Globe, DollarSign, UserCircle2, Mail,
  Settings, Sparkles, BarChart2, MessageSquare, Clock, Key,
  Smartphone, Shield, Webhook, Zap, BookOpen, PieChart, Tag,
  ToggleLeft, ExternalLink, Palette,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs } from '@/components/ui/Tabs'
import { canManageWorkspace } from '@/lib/workspace-shared'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn, formatDate, formatRelative, initials, slugify } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string
  bio: string | null
  job_title: string | null
  avatar_url: string | null
  email: string
  notification_preferences: Record<string, unknown>
}

interface Workspace {
  id: string
  name: string
  slug: string
  industry: string | null
  website_url: string | null
  type: string | null
  logo_url: string | null
}

interface Member {
  id: string
  user_id: string
  role: string
  joined_at: string
  profiles: { full_name: string; email: string; avatar_url: string | null }
}

interface Invitation {
  id: string
  email: string
  role: string
  invited_at: string
  expires_at: string
  status: string
}

interface Channel {
  id: string
  platform: string
  account_name: string
  follower_count: number | null
  connected_at: string
  status: string
}

interface Integration {
  id: string
  provider: string
  status: string
  account_name: string | null
  last_synced_at: string | null
}

interface AuditLog {
  id: string
  created_at: string
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  profiles: { full_name: string; email: string } | null
}

interface BrandVoice {
  id: string
  brand_id: string
  tones: string[]
  style_rules: string | null
  do_not_use: string[]
  example_captions: string[]
}

interface Subscription {
  id: string
  plan: string
  status: string
  renewal_date: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Three settings sections (audit §21 / founder requirement):
//   • Account  — visible to everyone (also linked from the avatar dropdown)
//   • Workspace — admin / workspace-manager only
//   • Billing   — admin / workspace-manager only
const SETTINGS_GROUPS: { group: string; manage: boolean; items: { id: string; label: string; icon: React.ReactNode }[] }[] = [
  { group: 'Account', manage: false, items: [
    { id: 'profile',       label: 'Profile',       icon: <UserCircle2 size={14} /> },
    { id: 'security',      label: 'Security',       icon: <ShieldCheck size={14} /> },
    { id: 'notifications', label: 'Notifications',  icon: <Bell size={14} /> },
  ] },
  { group: 'Workspace', manage: true, items: [
    { id: 'workspace',    label: 'General',      icon: <Building2 size={14} /> },
    { id: 'channels',     label: 'Channels',     icon: <Link2 size={14} /> },
    { id: 'team',         label: 'Team',         icon: <Users size={14} /> },
    { id: 'brand-voice',  label: 'Brand Voice',  icon: <Sparkles size={14} /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug size={14} /> },
    { id: 'audit-log',    label: 'Audit Log',    icon: <ClipboardList size={14} /> },
    { id: 'danger',       label: 'Danger Zone',  icon: <AlertCircle size={14} /> },
  ] },
  { group: 'Billing', manage: true, items: [
    { id: 'billing', label: 'Plan & Billing', icon: <CreditCard size={14} /> },
  ] },
]
const ALL_TABS = SETTINGS_GROUPS.flatMap(g => g.items)
const MANAGE_TAB_IDS = new Set(SETTINGS_GROUPS.filter(g => g.manage).flatMap(g => g.items.map(i => i.id)))

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={16} className="text-pink-500" />,
  tiktok: <PlayCircle size={16} className="text-black" />,
  linkedin: <Briefcase size={16} className="text-blue-600" />,
  twitter: <AtSign size={16} className="text-sky-500" />,
  x: <AtSign size={16} className="text-sky-500" />,
  threads: <Hash size={16} className="text-slate-700" />,
  facebook: <Users size={16} className="text-blue-700" />,
  youtube: <PlayCircle size={16} className="text-red-600" />,
}

const TONE_OPTIONS = [
  'Professional', 'Casual', 'Playful', 'Bold', 'Inspiring',
  'Minimalist', 'Witty', 'Empathetic', 'Authoritative', 'Conversational',
]

const INDUSTRIES = [
  { value: '', label: 'Select industry' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'health_wellness', label: 'Health & Wellness' },
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'agency', label: 'Marketing Agency' },
  { value: 'other', label: 'Other' },
]

const WORKSPACE_TYPES = [
  { value: '', label: 'Select type' },
  { value: 'brand', label: 'Brand' },
  { value: 'agency', label: 'Agency' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'personal', label: 'Personal' },
]

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: <Camera size={18} className="text-pink-500" /> },
  { id: 'tiktok', label: 'TikTok', icon: <PlayCircle size={18} className="text-black" /> },
  { id: 'linkedin', label: 'LinkedIn', icon: <Briefcase size={18} className="text-blue-600" /> },
  { id: 'twitter', label: 'X (Twitter)', icon: <AtSign size={18} className="text-sky-500" /> },
  { id: 'threads', label: 'Threads', icon: <Hash size={18} className="text-slate-700" /> },
  { id: 'youtube', label: 'YouTube', icon: <PlayCircle size={18} className="text-red-600" /> },
]

// ─── Password Strength ────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-500' }
  if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' }
  return { score, label: 'Strong', color: 'bg-emerald-500' }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])
  return { toast, show }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { toast, show: showToast } = useToast()

  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('viewer')

  // Deep-link: avatar dropdown links to ?tab=account → Account/Profile. Also honour ?tab=<id>.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (!t) return
    const resolved = t === 'account' ? 'profile' : t
    if (ALL_TABS.some(i => i.id === resolved)) setActiveTab(resolved)
  }, [])

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setCurrentUserId(user.id)

      const [profileRes, workspaceRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('workspace_members')
          .select('workspace_id, role, workspaces(*)')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
      ])

      if (profileRes.data) {
        setProfile({
          ...profileRes.data,
          email: user.email ?? '',
          notification_preferences: profileRes.data.notification_preferences ?? {},
        })
      }

      if (workspaceRes.data) {
        const ws = (workspaceRes.data.workspaces as unknown) as Workspace
        setWorkspace(ws)
        setCurrentUserRole(workspaceRes.data.role)

        const [membersRes, channelsRes, invitesRes, integrationsRes, subRes, auditRes, brandRes] = await Promise.all([
          supabase.from('workspace_members')
            .select('id, user_id, role, joined_at, profiles(full_name, email, avatar_url)')
            .eq('workspace_id', ws.id),
          supabase.from('social_channels')
            .select('id, platform, account_name, follower_count, connected_at, status')
            .eq('workspace_id', ws.id),
          supabase.from('team_invitations')
            .select('*')
            .eq('workspace_id', ws.id)
            .eq('status', 'pending'),
          supabase.from('integrations')
            .select('*')
            .eq('workspace_id', ws.id),
          supabase.from('subscriptions')
            .select('id, plan, status, renewal_date')
            .eq('workspace_id', ws.id)
            .limit(1)
            .maybeSingle(),
          supabase.from('audit_logs')
            .select('id, created_at, action, resource_type, resource_id, ip_address, profiles(full_name, email)')
            .eq('workspace_id', ws.id)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('brands')
            .select('id')
            .eq('workspace_id', ws.id)
            .limit(1)
            .maybeSingle(),
        ])

        if (membersRes.data) setMembers(membersRes.data as unknown as Member[])
        if (channelsRes.data) setChannels(channelsRes.data)
        if (invitesRes.data) setInvitations(invitesRes.data)
        if (integrationsRes.data) setIntegrations(integrationsRes.data)
        if (subRes.data) setSubscription(subRes.data)
        if (auditRes.data) setAuditLogs(auditRes.data as unknown as AuditLog[])

        if (brandRes.data) {
          const bvRes = await supabase.from('brand_voice_profiles')
            .select('*')
            .eq('brand_id', brandRes.data.id)
            .maybeSingle()
          if (bvRes.data) setBrandVoice(bvRes.data)
          else setBrandVoice({
            id: '', brand_id: brandRes.data.id,
            tones: [], style_rules: '', do_not_use: [], example_captions: [],
          })
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  // ─── Tab Components ──────────────────────────────────────────────────────────

  function WorkspaceTab() {
    const [form, setForm] = useState({
      name: workspace?.name ?? '',
      industry: workspace?.industry ?? '',
      website_url: workspace?.website_url ?? '',
      type: workspace?.type ?? '',
    })
    const [logoUploading, setLogoUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const slug = slugify(form.name)

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file || !workspace) return
      setLogoUploading(true)
      const path = `workspaces/${workspace.id}/logo.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
        await supabase.from('workspaces').update({ logo_url: urlData.publicUrl }).eq('id', workspace.id)
        setWorkspace(prev => prev ? { ...prev, logo_url: urlData.publicUrl } : prev)
        showToast('Logo updated')
      } else {
        showToast('Upload failed', 'error')
      }
      setLogoUploading(false)
    }

    async function handleSave() {
      if (!workspace) return
      setSaving(true)
      const { error } = await supabase.from('workspaces')
        .update({ ...form, slug })
        .eq('id', workspace.id)
      if (!error) {
        setWorkspace(prev => prev ? { ...prev, ...form, slug } : prev)
        showToast('Workspace saved')
      } else {
        showToast(error.message, 'error')
      }
      setSaving(false)
    }

    return (
      <div className="space-y-8 max-w-2xl">
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Workspace Identity</h3>
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
              {workspace?.logo_url
                ? <img src={workspace.logo_url} alt="logo" className="w-full h-full object-cover" />
                : <Building2 size={28} className="text-slate-400" />}
              {logoUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
                Upload Logo
              </Button>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2MB. Recommended 256×256px.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Workspace Name"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Acme Corp"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Workspace Slug</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                <Globe size={14} className="text-slate-400" />
                <span>app.captionfox.com/</span>
                <span className="font-medium text-slate-700">{slug || 'your-workspace'}</span>
              </div>
              <p className="text-xs text-slate-400">Auto-generated from workspace name</p>
            </div>
            <Select
              label="Industry"
              options={INDUSTRIES}
              value={form.industry}
              onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
            />
            <Input
              label="Website URL"
              value={form.website_url}
              onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
              placeholder="https://yourwebsite.com"
              icon={<Globe size={14} />}
            />
            <Select
              label="Workspace Type"
              options={WORKSPACE_TYPES}
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            />
          </div>
        </section>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    )
  }

  function ProfileTab() {
    const [form, setForm] = useState({
      full_name: profile?.full_name ?? '',
      bio: profile?.bio ?? '',
      job_title: profile?.job_title ?? '',
    })
    const np = profile?.notification_preferences as Record<string, boolean> | undefined
    const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
      approval_requests: np?.approval_requests ?? true,
      mentions: np?.mentions ?? true,
      campaign_updates: np?.campaign_updates ?? true,
      weekly_digest: np?.weekly_digest ?? false,
    })
    const [avatarUploading, setAvatarUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file || !currentUserId) return
      setAvatarUploading(true)
      const path = `avatars/${currentUserId}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', currentUserId)
        setProfile(prev => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev)
        showToast('Avatar updated')
      } else {
        showToast('Upload failed', 'error')
      }
      setAvatarUploading(false)
    }

    async function handleSave() {
      if (!currentUserId) return
      setSaving(true)
      const { error } = await supabase.from('profiles')
        .update({ ...form, notification_preferences: notifPrefs })
        .eq('id', currentUserId)
      if (!error) {
        setProfile(prev => prev ? { ...prev, ...form, notification_preferences: notifPrefs } : prev)
        showToast('Profile saved')
      } else {
        showToast(error.message, 'error')
      }
      setSaving(false)
    }

    const avatarInitials = initials(form.full_name || profile?.email || 'U')

    return (
      <div className="space-y-8 max-w-2xl">
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Personal Details</h3>
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden text-white font-semibold text-lg">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : avatarInitials}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 size={14} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button variant="secondary" size="sm" icon={<Camera size={14} />} onClick={() => fileRef.current?.click()}>
                Change Photo
              </Button>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2MB</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input label="Full Name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            <Input label="Job Title" value={form.job_title} onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))} placeholder="e.g. Content Manager" />
            <Textarea label="Bio" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder="A short bio about yourself" />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Email Address</h3>
          <p className="text-xs text-slate-500 mb-3">Your current email is <span className="font-medium text-slate-700">{profile?.email}</span>. To change your email, contact support.</p>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">Email changes require identity verification. Please contact <a href="mailto:support@captionfox.com" className="underline">support@captionfox.com</a>.</p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Email Notifications</h3>
          <div className="space-y-3">
            {[
              { key: 'approval_requests', label: 'Approval Requests', desc: 'When content is submitted for your review' },
              { key: 'mentions', label: 'Mentions', desc: 'When someone @mentions you in a comment' },
              { key: 'campaign_updates', label: 'Campaign Updates', desc: 'Status changes to campaigns you manage' },
              { key: 'weekly_digest', label: 'Weekly Digest', desc: 'A summary of activity every Monday morning' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <button
                  onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    notifPrefs[key] ? 'bg-blue-600' : 'bg-slate-200',
                  )}
                >
                  <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm', notifPrefs[key] ? 'translate-x-4' : 'translate-x-1')} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    )
  }

  function ChannelsTab() {
    const [connectModal, setConnectModal] = useState(false)
    const [disconnectTarget, setDisconnectTarget] = useState<Channel | null>(null)
    const [redirectingPlatform, setRedirectingPlatform] = useState<string | null>(null)
    const [reconnecting, setReconnecting] = useState<string | null>(null)

    async function handleDisconnect() {
      if (!disconnectTarget) return
      const { error } = await supabase.from('social_channels').delete().eq('id', disconnectTarget.id)
      if (!error) {
        setChannels(prev => prev.filter(c => c.id !== disconnectTarget.id))
        showToast(`${disconnectTarget.platform} disconnected`)
      } else {
        showToast(error.message, 'error')
      }
      setDisconnectTarget(null)
    }

    async function handleReconnect(channel: Channel) {
      setReconnecting(channel.id)
      await new Promise(r => setTimeout(r, 1200))
      showToast(`Redirecting to ${channel.platform} authentication…`)
      setReconnecting(null)
    }

    function handleConnectPlatform(platformId: string) {
      setRedirectingPlatform(platformId)
      setTimeout(() => {
        showToast(`Redirecting to ${platformId} authentication…`)
        setRedirectingPlatform(null)
        setConnectModal(false)
      }, 1000)
    }

    const statusVariant: Record<string, 'green' | 'amber' | 'red'> = {
      connected: 'green', expired: 'amber', error: 'red',
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Connected Channels</h3>
            <p className="text-xs text-slate-500 mt-0.5">{channels.length} channel{channels.length !== 1 ? 's' : ''} connected</p>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setConnectModal(true)}>Connect Channel</Button>
        </div>

        {channels.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No channels connected"
            description="Connect your social accounts to start publishing and tracking performance."
            action={{ label: 'Connect Channel', onClick: () => setConnectModal(true), icon: <Plus size={14} /> }}
            compact
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Followers</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Connected</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channels.map(ch => (
                  <tr key={ch.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {PLATFORM_ICONS[ch.platform.toLowerCase()] ?? <Link2 size={16} className="text-slate-400" />}
                        <span className="capitalize font-medium text-slate-700">{ch.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">@{ch.account_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {ch.follower_count ? ch.follower_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(ch.connected_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[ch.status] ?? 'default'} dot>{ch.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {ch.status !== 'connected' && (
                          <Button
                            size="xs"
                            variant="outline"
                            icon={reconnecting === ch.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            onClick={() => handleReconnect(ch)}
                            disabled={reconnecting === ch.id}
                          >
                            Reconnect
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          icon={<Trash2 size={12} />}
                          onClick={() => setDisconnectTarget(ch)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Connect Modal */}
        <Modal open={connectModal} onClose={() => setConnectModal(false)} title="Connect a Channel" description="Choose a platform to connect your account." size="sm">
          <div className="space-y-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => handleConnectPlatform(p.id)}
                disabled={redirectingPlatform === p.id}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  {p.icon}
                  <span className="text-sm font-medium text-slate-800">{p.label}</span>
                </div>
                {redirectingPlatform === p.id
                  ? <Loader2 size={14} className="animate-spin text-slate-400" />
                  : <ChevronRight size={14} className="text-slate-400" />}
              </button>
            ))}
          </div>
        </Modal>

        {/* Disconnect Confirm */}
        <ConfirmModal
          open={!!disconnectTarget}
          onClose={() => setDisconnectTarget(null)}
          onConfirm={handleDisconnect}
          title="Disconnect Channel"
          description={`Are you sure you want to disconnect @${disconnectTarget?.account_name}? Published content will not be removed.`}
          confirmLabel="Disconnect"
          danger
        />
      </div>
    )
  }

  function TeamTab() {
    const [inviteModal, setInviteModal] = useState(false)
    const [removeMemberTarget, setRemoveMemberTarget] = useState<Member | null>(null)
    const [cancelInviteTarget, setCancelInviteTarget] = useState<Invitation | null>(null)
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'editor' })
    const [inviting, setInviting] = useState(false)
    const [resending, setResending] = useState<string | null>(null)

    async function handleRemoveMember() {
      if (!removeMemberTarget) return
      const { error } = await supabase.from('workspace_members').delete().eq('id', removeMemberTarget.id)
      if (!error) {
        setMembers(prev => prev.filter(m => m.id !== removeMemberTarget.id))
        showToast('Member removed')
      } else {
        showToast(error.message, 'error')
      }
      setRemoveMemberTarget(null)
    }

    async function handleRoleChange(memberId: string, role: string) {
      const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId)
      if (!error) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
        showToast('Role updated')
      } else {
        showToast(error.message, 'error')
      }
    }

    async function handleInvite() {
      if (!workspace || !inviteForm.email) return
      setInviting(true)
      const token = crypto.randomUUID()
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase.from('team_invitations').insert({
        workspace_id: workspace.id,
        email: inviteForm.email,
        role: inviteForm.role,
        token,
        expires_at,
        status: 'pending',
      }).select().single()
      if (!error && data) {
        setInvitations(prev => [data, ...prev])
        setInviteModal(false)
        setInviteForm({ email: '', role: 'editor' })
        showToast('Invitation sent')
      } else {
        showToast(error?.message ?? 'Failed to send invitation', 'error')
      }
      setInviting(false)
    }

    async function handleCancelInvite() {
      if (!cancelInviteTarget) return
      const { error } = await supabase.from('team_invitations').delete().eq('id', cancelInviteTarget.id)
      if (!error) {
        setInvitations(prev => prev.filter(i => i.id !== cancelInviteTarget.id))
        showToast('Invitation cancelled')
      } else {
        showToast(error.message, 'error')
      }
      setCancelInviteTarget(null)
    }

    async function handleResendInvite(invite: Invitation) {
      setResending(invite.id)
      await new Promise(r => setTimeout(r, 800))
      showToast(`Invitation resent to ${invite.email}`)
      setResending(null)
    }

    return (
      <div className="space-y-8">
        {/* Members */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Team Members</h3>
              <p className="text-xs text-slate-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/app/settings/permissions"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
              >
                <ShieldCheck size={13} />
                Manage Permissions
              </a>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setInviteModal(true)}>Invite Member</Button>
            </div>
          </div>

          {members.length === 0 ? (
            <EmptyState icon={Users} title="No team members" description="Invite colleagues to collaborate on content." compact />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Member</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Joined</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map(m => {
                    const name = m.profiles?.full_name ?? 'Unknown'
                    const email = m.profiles?.email ?? ''
                    const isCurrentUser = m.user_id === currentUserId
                    const isOwner = m.role === 'owner'
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {m.profiles?.avatar_url
                              ? <img src={m.profiles.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover" />
                              : <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold">{initials(name)}</div>}
                            <div>
                              <p className="font-medium text-slate-800">{name} {isCurrentUser && <span className="text-xs text-slate-400">(you)</span>}</p>
                              <p className="text-xs text-slate-500">{email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {currentUserRole === 'owner' && !isCurrentUser && !isOwner ? (
                            <select
                              value={m.role}
                              onChange={e => handleRoleChange(m.id, e.target.value)}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {ROLE_OPTIONS.filter(r => r.value !== 'owner').map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={isOwner ? 'violet' : 'default'} className="capitalize">{m.role}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(m.joined_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {!isCurrentUser && !isOwner && currentUserRole === 'owner' && (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              icon={<Trash2 size={12} />}
                              onClick={() => setRemoveMemberTarget(m)}
                            >
                              Remove
                            </Button>
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

        {/* Pending Invitations */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Pending Invitations</h3>
          {invitations.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No pending invitations.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invited</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700">{inv.email}</td>
                      <td className="px-4 py-3"><Badge variant="default" className="capitalize">{inv.role}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.invited_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.expires_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="xs"
                            variant="ghost"
                            icon={resending === inv.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            onClick={() => handleResendInvite(inv)}
                            disabled={resending === inv.id}
                          >
                            Resend
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            icon={<X size={12} />}
                            onClick={() => setCancelInviteTarget(inv)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Invite Modal */}
        <Modal
          open={inviteModal}
          onClose={() => setInviteModal(false)}
          title="Invite Team Member"
          description="They'll receive an email with a link to join your workspace."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setInviteModal(false)}>Cancel</Button>
              <Button onClick={handleInvite} loading={inviting} icon={<Mail size={14} />}>Send Invitation</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input label="Email Address" type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} placeholder="colleague@company.com" />
            <Select
              label="Role"
              value={inviteForm.role}
              options={ROLE_OPTIONS.filter(r => r.value !== 'owner')}
              onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
            />
          </div>
        </Modal>

        <ConfirmModal
          open={!!removeMemberTarget}
          onClose={() => setRemoveMemberTarget(null)}
          onConfirm={handleRemoveMember}
          title="Remove Member"
          description={`Remove ${removeMemberTarget?.profiles?.full_name ?? 'this member'} from the workspace? They will lose access immediately.`}
          confirmLabel="Remove Member"
          danger
        />
        <ConfirmModal
          open={!!cancelInviteTarget}
          onClose={() => setCancelInviteTarget(null)}
          onConfirm={handleCancelInvite}
          title="Cancel Invitation"
          description={`Cancel the invitation sent to ${cancelInviteTarget?.email}?`}
          confirmLabel="Cancel Invitation"
          danger
        />
      </div>
    )
  }

  function BrandVoiceTab() {
    const [form, setForm] = useState<BrandVoice>(brandVoice ?? {
      id: '', brand_id: '', tones: [], style_rules: '', do_not_use: [], example_captions: [],
    })
    const [newDoNotUse, setNewDoNotUse] = useState('')
    const [newCaption, setNewCaption] = useState('')

    async function handleSave() {
      if (!form.brand_id) return
      setSaving(true)
      const payload = {
        brand_id: form.brand_id,
        tones: form.tones,
        style_rules: form.style_rules,
        do_not_use: form.do_not_use,
        example_captions: form.example_captions,
      }
      const { data, error } = form.id
        ? await supabase.from('brand_voice_profiles').update(payload).eq('id', form.id).select().single()
        : await supabase.from('brand_voice_profiles').insert(payload).select().single()
      if (!error && data) {
        setBrandVoice(data)
        setForm(data)
        showToast('Brand voice saved')
      } else {
        showToast(error?.message ?? 'Save failed', 'error')
      }
      setSaving(false)
    }

    if (!brandVoice) return (
      <EmptyState icon={Sparkles} title="No brand set up" description="Create a brand first to configure its voice." compact />
    )

    return (
      <div className="space-y-8 max-w-2xl">
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Tone of Voice</h3>
          <p className="text-xs text-slate-500 mb-3">Select all tones that represent your brand's personality.</p>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map(tone => {
              const active = form.tones.includes(tone)
              return (
                <button
                  key={tone}
                  onClick={() => setForm(p => ({
                    ...p,
                    tones: active ? p.tones.filter(t => t !== tone) : [...p.tones, tone],
                  }))}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600',
                  )}
                >
                  {tone}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <Textarea
            label="Style Rules"
            value={form.style_rules ?? ''}
            onChange={e => setForm(p => ({ ...p, style_rules: e.target.value }))}
            rows={4}
            placeholder="e.g. Always use sentence case. Avoid exclamation marks. Use first-person plural (we, our)."
          />
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Do-Not-Use Words / Phrases</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {form.do_not_use.map((word, i) => (
              <span key={i} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-full">
                {word}
                <button onClick={() => setForm(p => ({ ...p, do_not_use: p.do_not_use.filter((_, j) => j !== i) }))} className="hover:text-red-800">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newDoNotUse}
              onChange={e => setNewDoNotUse(e.target.value)}
              placeholder="Add word or phrase"
              onKeyDown={e => {
                if (e.key === 'Enter' && newDoNotUse.trim()) {
                  setForm(p => ({ ...p, do_not_use: [...p.do_not_use, newDoNotUse.trim()] }))
                  setNewDoNotUse('')
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                if (newDoNotUse.trim()) {
                  setForm(p => ({ ...p, do_not_use: [...p.do_not_use, newDoNotUse.trim()] }))
                  setNewDoNotUse('')
                }
              }}
            >
              Add
            </Button>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Example Captions</h3>
          <p className="text-xs text-slate-500 mb-3">Add example captions to guide AI content generation.</p>
          <div className="space-y-2 mb-3">
            {form.example_captions.map((cap, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-700 flex-1 leading-relaxed">{cap}</p>
                <button onClick={() => setForm(p => ({ ...p, example_captions: p.example_captions.filter((_, j) => j !== i) }))} className="text-slate-400 hover:text-red-500 mt-0.5">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              value={newCaption}
              onChange={e => setNewCaption(e.target.value)}
              rows={2}
              placeholder="Paste an example caption here…"
              className="flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              className="shrink-0"
              onClick={() => {
                if (newCaption.trim()) {
                  setForm(p => ({ ...p, example_captions: [...p.example_captions, newCaption.trim()] }))
                  setNewCaption('')
                }
              }}
            >
              Add
            </Button>
          </div>
        </section>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button onClick={handleSave} loading={saving} icon={<Sparkles size={14} />}>Save Brand Voice</Button>
        </div>
      </div>
    )
  }

  function BillingTab() {
    const [upgradeModal, setUpgradeModal] = useState(false)
    const [cancelModal, setCancelModal] = useState(false)
    const [cancelling, setCancelling] = useState(false)

    const planDetails: Record<string, { price: string; features: string[]; color: string }> = {
      starter: { price: '£19/mo', features: ['1 workspace', '5 channels', '500 AI credits/mo', 'Basic analytics'], color: 'slate' },
      pro: { price: '£49/mo', features: ['3 workspaces', '15 channels', '2,000 AI credits/mo', 'Advanced analytics'], color: 'blue' },
      team: { price: '£99/mo', features: ['10 workspaces', 'Unlimited channels', '5,000 AI credits/mo', 'Team collaboration'], color: 'violet' },
      brand: { price: '£199/mo', features: ['Unlimited workspaces', 'Unlimited channels', 'Unlimited AI credits', 'White-label exports'], color: 'amber' },
    }

    const currentPlan = subscription?.plan ?? 'pro'
    const currentDetails = planDetails[currentPlan] ?? planDetails.pro

    const billingHistory = [
      { date: 'Jun 2026', desc: 'Monthly plan', amount: '£49.00', invoice: 'CF-0042', status: 'paid' },
      { date: 'May 2026', desc: 'Monthly plan', amount: '£49.00', invoice: 'CF-0041', status: 'paid' },
      { date: 'Apr 2026', desc: 'Monthly plan', amount: '£49.00', invoice: 'CF-0040', status: 'paid' },
      { date: 'Mar 2026', desc: 'Monthly plan', amount: '£49.00', invoice: 'CF-0039', status: 'paid' },
    ]

    async function handleCancel() {
      setCancelling(true)
      await new Promise(r => setTimeout(r, 1000))
      showToast('Cancellation request submitted. Your plan remains active until the end of the billing period.')
      setCancelling(false)
      setCancelModal(false)
    }

    return (
      <div className="space-y-8 max-w-2xl">
        {/* Current plan */}
        <section className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wide">Current Plan</p>
              <p className="text-lg font-bold text-white capitalize mt-0.5">{currentPlan} Plan</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-white">{currentDetails.price}</p>
              <Badge variant="green" className="mt-1">{subscription?.status ?? 'Active'}</Badge>
            </div>
          </div>
          <div className="p-5 bg-white">
            {subscription?.renewal_date && (
              <p className="text-sm text-slate-500 mb-4">
                <Clock size={13} className="inline mr-1" />
                Renews on <span className="font-medium text-slate-700">{formatDate(subscription.renewal_date)}</span>
              </p>
            )}
            <ul className="space-y-1.5 mb-5">
              {currentDetails.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" icon={<Zap size={14} />} onClick={() => setUpgradeModal(true)}>Upgrade Plan</Button>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setCancelModal(true)}>Cancel Plan</Button>
            </div>
          </div>
        </section>

        {/* Plan overview */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">All Plans</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(planDetails).map(([name, details]) => (
              <div key={name} className={cn(
                'rounded-xl border p-4',
                name === currentPlan ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white',
              )}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-800 capitalize">{name}</p>
                  {name === currentPlan && <Badge variant="blue">Current</Badge>}
                </div>
                <p className="text-lg font-bold text-slate-900 mb-3">{details.price}</p>
                <ul className="space-y-1">
                  {details.features.slice(0, 2).map(f => (
                    <li key={f} className="text-xs text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Billing history */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Billing History</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingHistory.map(row => (
                  <tr key={row.invoice} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 text-xs">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700">{row.desc}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.amount}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{row.invoice}</td>
                    <td className="px-4 py-3"><Badge variant="green" dot>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upgrade modal */}
        <Modal open={upgradeModal} onClose={() => setUpgradeModal(false)} title="Upgrade Plan" description="You'll be redirected to Stripe to complete your upgrade." size="sm">
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
              <Loader2 size={20} className="animate-spin text-blue-600" />
            </div>
            <p className="text-sm text-slate-600">Redirecting to Stripe checkout…</p>
          </div>
        </Modal>

        <ConfirmModal
          open={cancelModal}
          onClose={() => setCancelModal(false)}
          onConfirm={handleCancel}
          title="Cancel Plan"
          description="Your plan will remain active until the end of the current billing period. You can resubscribe at any time."
          confirmLabel="Yes, Cancel Plan"
          danger
          loading={cancelling}
        />
      </div>
    )
  }

  function SecurityTab() {
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false })
    const [pwSaving, setPwSaving] = useState(false)
    const [pwError, setPwError] = useState('')
    const [signOutModal, setSignOutModal] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const [mfaModal, setMfaModal] = useState(false)
    const [disableMfaModal, setDisableMfaModal] = useState(false)
    const [mfaEnabled] = useState(false)

    const strength = passwordStrength(pwForm.next)
    const loginHistory = auditLogs.filter(l => l.action === 'auth.signin').slice(0, 10)

    async function handlePasswordChange() {
      setPwError('')
      if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
      if (pwForm.next.length < 8) { setPwError('Password must be at least 8 characters'); return }
      setPwSaving(true)
      const { error } = await supabase.auth.updateUser({ password: pwForm.next })
      if (!error) {
        setPwForm({ current: '', next: '', confirm: '' })
        showToast('Password changed successfully')
      } else {
        setPwError(error.message)
      }
      setPwSaving(false)
    }

    async function handleSignOutAll() {
      setSigningOut(true)
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (!error) {
        router.push('/auth/login')
      } else {
        showToast(error.message, 'error')
      }
      setSigningOut(false)
    }

    return (
      <div className="space-y-8 max-w-2xl">
        {/* Change Password */}
        <section className="rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Key size={15} /> Change Password</h3>
          <div className="space-y-4">
            <div className="relative">
              <Input
                label="Current Password"
                type={showPw.current ? 'text' : 'password'}
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
              />
              <button
                onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                {showPw.current ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="New Password"
                type={showPw.next ? 'text' : 'password'}
                value={pwForm.next}
                onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
              />
              <button
                onClick={() => setShowPw(p => ({ ...p, next: !p.next }))}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                {showPw.next ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {pwForm.next && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i < strength.score ? strength.color : 'bg-slate-200')} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Strength: <span className={cn('font-medium', strength.score >= 4 ? 'text-emerald-600' : strength.score >= 3 ? 'text-blue-600' : 'text-amber-600')}>{strength.label}</span></p>
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                label="Confirm New Password"
                type={showPw.confirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                error={pwError}
              />
              <button
                onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                {showPw.confirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <Button onClick={handlePasswordChange} loading={pwSaving} icon={<Lock size={14} />}>Update Password</Button>
          </div>
        </section>

        {/* MFA */}
        <section className="rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Smartphone size={15} /> Two-Factor Authentication</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">{mfaEnabled ? 'MFA is enabled on your account.' : 'Add an extra layer of security.'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{mfaEnabled ? 'Using authenticator app (TOTP).' : 'We recommend using an authenticator app.'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={mfaEnabled ? 'green' : 'slate'} dot>{mfaEnabled ? 'Enabled' : 'Disabled'}</Badge>
              {mfaEnabled
                ? <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDisableMfaModal(true)}>Disable MFA</Button>
                : <Button size="sm" variant="secondary" icon={<Shield size={13} />} onClick={() => router.push('/auth/mfa')}>Enable MFA</Button>}
            </div>
          </div>
        </section>

        {/* Active Sessions */}
        <section className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Smartphone size={15} /> Active Sessions</h3>
            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setSignOutModal(true)}>Sign out all devices</Button>
          </div>
          <div className="space-y-3">
            {[
              { device: 'Chrome on Windows 11', ip: '82.x.x.x', last: 'Active now', current: true },
              { device: 'Safari on iPhone', ip: '82.x.x.x', last: '2h ago', current: false },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Smartphone size={14} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.device}</p>
                    <p className="text-xs text-slate-500">IP: {s.ip} · Last active: {s.last}</p>
                  </div>
                </div>
                {s.current && <Badge variant="green" dot>Current</Badge>}
              </div>
            ))}
          </div>
        </section>

        {/* Login history */}
        <section className="rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Clock size={15} /> Login History</h3>
          {loginHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No login history found.</p>
          ) : (
            <div className="space-y-2">
              {loginHistory.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{log.action}</p>
                    {log.ip_address && <p className="text-xs text-slate-400">IP: {log.ip_address}</p>}
                  </div>
                  <p className="text-xs text-slate-400">{formatRelative(log.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <ConfirmModal
          open={signOutModal}
          onClose={() => setSignOutModal(false)}
          onConfirm={handleSignOutAll}
          title="Sign Out All Devices"
          description="This will immediately end all active sessions. You'll need to sign in again on each device."
          confirmLabel="Sign Out All"
          danger
          loading={signingOut}
        />
        <ConfirmModal
          open={disableMfaModal}
          onClose={() => setDisableMfaModal(false)}
          onConfirm={() => { showToast('MFA disabled'); setDisableMfaModal(false) }}
          title="Disable Two-Factor Authentication"
          description="Disabling MFA will reduce the security of your account. Are you sure?"
          confirmLabel="Disable MFA"
          danger
        />
      </div>
    )
  }

  function IntegrationsTab() {
    const INTEGRATION_CATALOG = [
      { id: 'slack', name: 'Slack', desc: 'Post approval notifications to Slack channels.', badge: 'V1.5', color: 'bg-purple-100 text-purple-700' },
      { id: 'zapier', name: 'Zapier', desc: 'Automate workflows with 5,000+ apps.', badge: 'V1.5', color: 'bg-orange-100 text-orange-700' },
      { id: 'notion', name: 'Notion', desc: 'Sync content briefs from your Notion workspace.', badge: 'V1.5', color: 'bg-slate-100 text-slate-700' },
      { id: 'hubspot', name: 'HubSpot', desc: 'Sync contacts and campaign data.', badge: null, color: 'bg-red-100 text-red-700' },
      { id: 'google_analytics', name: 'Google Analytics', desc: 'Track social referral traffic in GA4.', badge: null, color: 'bg-yellow-100 text-yellow-700' },
    ]

    const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null)
    const [connecting, setConnecting] = useState<string | null>(null)

    function getIntegration(id: string) {
      return integrations.find(i => i.provider === id)
    }

    async function handleConnect(id: string) {
      setConnecting(id)
      await new Promise(r => setTimeout(r, 1000))
      showToast(`Redirecting to ${id} authentication…`)
      setConnecting(null)
    }

    async function handleDisconnect() {
      if (!disconnectTarget || !workspace) return
      const integ = getIntegration(disconnectTarget)
      if (!integ) { setDisconnectTarget(null); return }
      const { error } = await supabase.from('integrations').delete().eq('id', integ.id)
      if (!error) {
        setIntegrations(prev => prev.filter(i => i.id !== integ.id))
        showToast(`${disconnectTarget} disconnected`)
      } else {
        showToast(error.message, 'error')
      }
      setDisconnectTarget(null)
    }

    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-sm text-slate-500">Connect Caption Fox to your other tools and platforms.</p>
        {INTEGRATION_CATALOG.map(cat => {
          const integ = getIntegration(cat.id)
          const isConnected = !!integ

          return (
            <div key={cat.id} className="flex items-start justify-between gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0', cat.color)}>
                  {cat.name.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-slate-800">{cat.name}</p>
                    {cat.badge && <Badge variant="amber">{cat.badge}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{cat.desc}</p>
                  {isConnected && (
                    <div className="mt-1.5 space-y-0.5">
                      {integ.account_name && <p className="text-xs text-slate-600">Connected as: <span className="font-medium">{integ.account_name}</span></p>}
                      {integ.last_synced_at && <p className="text-xs text-slate-400">Last synced: {formatRelative(integ.last_synced_at)}</p>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isConnected
                  ? <>
                    <Badge variant="green" dot>Connected</Badge>
                    <Button size="xs" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDisconnectTarget(cat.id)}>Disconnect</Button>
                  </>
                  : <Button
                    size="sm"
                    variant="secondary"
                    icon={connecting === cat.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                    onClick={() => handleConnect(cat.id)}
                    disabled={connecting === cat.id || !!cat.badge}
                  >
                    {cat.badge ? 'Coming Soon' : 'Connect'}
                  </Button>
                }
              </div>
            </div>
          )
        })}

        <ConfirmModal
          open={!!disconnectTarget}
          onClose={() => setDisconnectTarget(null)}
          onConfirm={handleDisconnect}
          title="Disconnect Integration"
          description={`Disconnect ${disconnectTarget}? Any active automations using this integration will stop.`}
          confirmLabel="Disconnect"
          danger
        />
      </div>
    )
  }

  function NotificationsTab() {
    const [prefs, setPrefs] = useState<Record<string, { email: boolean; in_app: boolean }>>({
      approvals: { email: true, in_app: true },
      mentions: { email: true, in_app: true },
      campaign_updates: { email: true, in_app: false },
      publish_confirmations: { email: false, in_app: true },
      weekly_digest: { email: true, in_app: false },
      security_alerts: { email: true, in_app: true },
      billing: { email: true, in_app: false },
      ...(profile?.notification_preferences ?? {}),
    })

    const categories = [
      { key: 'approvals', label: 'Approvals', desc: 'Content submitted for your review', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
      { key: 'mentions', label: 'Mentions', desc: 'When you are @mentioned', icon: <AtSign size={14} className="text-blue-500" /> },
      { key: 'campaign_updates', label: 'Campaign Updates', desc: 'Status changes to campaigns', icon: <BarChart2 size={14} className="text-violet-500" /> },
      { key: 'publish_confirmations', label: 'Publish Confirmations', desc: 'When content goes live', icon: <CheckCircle2 size={14} className="text-slate-400" /> },
      { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Summary every Monday', icon: <BookOpen size={14} className="text-amber-500" /> },
      { key: 'security_alerts', label: 'Security Alerts', desc: 'Login and suspicious activity', icon: <Shield size={14} className="text-red-500" /> },
      { key: 'billing', label: 'Billing', desc: 'Invoices and payment updates', icon: <CreditCard size={14} className="text-slate-500" /> },
    ]

    function toggle(key: string, channel: 'email' | 'in_app') {
      setPrefs(p => ({ ...p, [key]: { ...p[key], [channel]: !p[key]?.[channel] } }))
    }

    async function handleSave() {
      if (!currentUserId) return
      setSaving(true)
      const { error } = await supabase.from('profiles')
        .update({ notification_preferences: prefs })
        .eq('id', currentUserId)
      if (!error) {
        setProfile(prev => prev ? ({ ...prev, notification_preferences: prefs } as typeof prev) : prev)
        showToast('Notification preferences saved')
      } else {
        showToast(error.message, 'error')
      }
      setSaving(false)
    }

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">In-App</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(cat => (
                <tr key={cat.key} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {cat.icon}
                      <div>
                        <p className="font-medium text-slate-800">{cat.label}</p>
                        <p className="text-xs text-slate-400">{cat.desc}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => toggle(cat.key, 'email')}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        prefs[cat.key]?.email ? 'bg-blue-600' : 'bg-slate-200',
                      )}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm', prefs[cat.key]?.email ? 'translate-x-4' : 'translate-x-1')} />
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => toggle(cat.key, 'in_app')}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                        prefs[cat.key]?.in_app ? 'bg-blue-600' : 'bg-slate-200',
                      )}
                    >
                      <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm', prefs[cat.key]?.in_app ? 'translate-x-4' : 'translate-x-1')} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={saving} icon={<Bell size={14} />}>Save Preferences</Button>
        </div>
      </div>
    )
  }

  function AuditLogTab() {
    const [actionFilter, setActionFilter] = useState('all')
    const [page, setPage] = useState(0)
    const PER_PAGE = 20

    const actionTypes = ['all', ...Array.from(new Set(auditLogs.map(l => l.action)))]
    const filtered = actionFilter === 'all' ? auditLogs : auditLogs.filter(l => l.action === actionFilter)
    const totalPages = Math.ceil(filtered.length / PER_PAGE)
    const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

    function exportCSV() {
      const headers = ['Time', 'Actor', 'Action', 'Resource Type', 'Resource ID', 'IP Address']
      const rows = filtered.map(l => [
        l.created_at,
        l.profiles?.email ?? 'system',
        l.action,
        l.resource_type ?? '',
        l.resource_id ?? '',
        l.ip_address ?? '',
      ])
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click()
      URL.revokeObjectURL(url)
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {actionTypes.slice(0, 8).map(type => (
              <button
                key={type}
                onClick={() => { setActionFilter(type); setPage(0) }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                  actionFilter === type
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300',
                )}
              >
                {type === 'all' ? 'All Actions' : type}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" icon={<FileArchive size={13} />} onClick={exportCSV}>Export CSV</Button>
        </div>

        {paginated.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No audit logs" description="Actions performed in this workspace will appear here." compact />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Resource Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Resource ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatRelative(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs font-medium text-slate-700">{log.profiles?.full_name ?? 'System'}</p>
                        <p className="text-xs text-slate-400">{log.profiles?.email ?? ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-700 rounded">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{log.resource_type ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.resource_id ? log.resource_id.slice(0, 8) + '…' : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{log.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-xs text-slate-500">Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} of {filtered.length}</p>
            <div className="flex gap-2">
              <Button size="xs" variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="xs" variant="secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function DangerZoneTab() {
    const [deleteWorkspaceModal, setDeleteWorkspaceModal] = useState(false)
    const [confirmName, setConfirmName] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [exportRequested, setExportRequested] = useState(false)

    async function handleDeleteWorkspace() {
      if (confirmName !== workspace?.name) return
      setDeleting(true)
      const { error } = await supabase.from('workspaces').delete().eq('id', workspace!.id)
      if (!error) {
        showToast('Workspace deleted. Redirecting…')
        setTimeout(() => router.push('/app'), 1500)
      } else {
        showToast(error.message, 'error')
      }
      setDeleting(false)
    }

    function handleExport() {
      setExportRequested(true)
      showToast('We\'ll email you a data export within 24 hours.')
    }

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 overflow-hidden">
          <div className="px-5 py-4 border-b border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <h3 className="text-sm font-bold text-red-700">Danger Zone</h3>
          </div>
          <div className="p-5 space-y-5">
            {/* Export */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Export All Data</p>
                <p className="text-xs text-slate-500 mt-0.5">Download a full export of your workspace data (content, analytics, settings). We'll email it within 24 hours.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileArchive size={14} />}
                onClick={handleExport}
                disabled={exportRequested}
              >
                {exportRequested ? 'Export Requested' : 'Request Export'}
              </Button>
            </div>

            <div className="border-t border-red-200" />

            {/* Delete Workspace */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-700">Delete Workspace</p>
                <p className="text-xs text-red-600/70 mt-0.5">Permanently delete <span className="font-medium">{workspace?.name}</span> and all its data. This cannot be undone.</p>
              </div>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => setDeleteWorkspaceModal(true)}
                disabled={currentUserRole !== 'owner'}
              >
                Delete Workspace
              </Button>
            </div>
            {currentUserRole !== 'owner' && (
              <p className="text-xs text-red-500 flex items-center gap-1"><Lock size={11} /> Only the workspace owner can delete this workspace.</p>
            )}
          </div>
        </div>

        {/* Custom Confirm Modal (requires typing workspace name) */}
        <Modal
          open={deleteWorkspaceModal}
          onClose={() => { setDeleteWorkspaceModal(false); setConfirmName('') }}
          title="Delete Workspace"
          description="This action is permanent and cannot be undone. All content, channels, team members, and data will be deleted."
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setDeleteWorkspaceModal(false); setConfirmName('') }}>Cancel</Button>
              <Button
                variant="danger"
                disabled={confirmName !== workspace?.name || deleting}
                loading={deleting}
                onClick={handleDeleteWorkspace}
              >
                Delete Permanently
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">Type <span className="font-mono font-bold">{workspace?.name}</span> to confirm deletion.</p>
            </div>
            <Input
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={workspace?.name}
            />
          </div>
        </Modal>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const TAB_CONTENT: Record<string, React.ReactNode> = {
    workspace: <WorkspaceTab />,
    profile: <ProfileTab />,
    channels: <ChannelsTab />,
    team: <TeamTab />,
    'brand-voice': <BrandVoiceTab />,
    billing: <BillingTab />,
    security: <SecurityTab />,
    integrations: <IntegrationsTab />,
    notifications: <NotificationsTab />,
    'audit-log': <AuditLogTab />,
    danger: <DangerZoneTab />,
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Role-gating: only owners/admins/managers see Workspace + Billing sections.
  const canManage = canManageWorkspace(currentUserRole)
  const visibleGroups = SETTINGS_GROUPS.filter(g => !g.manage || canManage)
  const effectiveTab = (!MANAGE_TAB_IDS.has(activeTab) || canManage) ? activeTab : 'profile'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all',
          toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your workspace, team, and account preferences."
          breadcrumbs={[{ label: 'App', href: '/app' }, { label: 'Settings' }]}
        />

        <div className="flex gap-8">
          {/* Sidebar nav — grouped: Account / Workspace / Billing */}
          <aside className="w-52 shrink-0">
            <nav className="space-y-4">
              {visibleGroups.map(grp => (
                <div key={grp.group}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{grp.group}</p>
                  <div className="space-y-1">
                    {grp.items.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left',
                          effectiveTab === tab.id
                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                            : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm',
                          tab.id === 'danger' && effectiveTab !== tab.id && 'text-red-500 hover:bg-red-50',
                        )}
                      >
                        <span className="shrink-0">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="mb-6 pb-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {ALL_TABS.find(t => t.id === effectiveTab)?.label}
              </h2>
            </div>
            {TAB_CONTENT[effectiveTab]}
          </main>
        </div>
      </div>
    </div>
  )
}
