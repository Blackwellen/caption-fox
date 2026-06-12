'use client'

import Link from 'next/link'
import {
  Sparkles,
  CalendarDays,
  BarChart2,
  Users,
  Inbox,
  TrendingUp,
  Shield,
  Briefcase,
  Check,
  ArrowRight,
  Zap,
  Camera,
  AtSign,
  PlayCircle,
  Star,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Public Nav ───────────────────────────────────────────────────────────────

function PublicNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Caption Fox</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">Home</Link>
            <Link href="/features" className="text-sm text-blue-600 font-semibold border-b-2 border-blue-600 pb-0.5">Features</Link>
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
            <Link href="/contact" className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">Contact</Link>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Get started <ArrowRight size={14} />
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen(o => !o)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pb-4 space-y-1">
          {[
            { href: '/', label: 'Home' },
            { href: '/features', label: 'Features' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/contact', label: 'Contact' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="block px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              {l.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" className="block text-center py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Sign in</Link>
            <Link href="/register" className="block text-center py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Get started</Link>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Feature Section ─────────────────────────────────────────────────────────

interface FeatureItem {
  id: string
  icon: React.ElementType
  headline: string
  subline: string
  bullets: string[]
  mockup: React.ReactNode
  flip?: boolean
}

function FeatureSection({ item }: { item: FeatureItem }) {
  const Icon = item.icon
  const textCol = (
    <div className="flex flex-col justify-center gap-5">
      <div className="inline-flex w-12 h-12 rounded-xl bg-blue-600 items-center justify-center shrink-0">
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight">{item.headline}</h2>
        <p className="mt-2 text-base text-slate-500 leading-relaxed">{item.subline}</p>
      </div>
      <ul className="space-y-3">
        {item.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Check size={11} className="text-blue-600" strokeWidth={3} />
            </span>
            <span className="text-sm text-slate-600 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
      <div>
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm hover:gap-2.5 transition-all"
        >
          Learn more <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )

  const mockupCol = (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-md">{item.mockup}</div>
    </div>
  )

  return (
    <section className="py-16 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {item.flip ? (
            <>
              {mockupCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {mockupCol}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Mockup primitives ────────────────────────────────────────────────────────

function MockupShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden', className)}>
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 h-5 bg-slate-200 rounded-md mx-4" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// 1. AI Content Studio mockup
function AIMockup() {
  return (
    <MockupShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-slate-700">Fox AI — Caption Generator</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Prompt</p>
          <p className="text-sm text-slate-700">Summer skincare launch — playful, Gen Z tone</p>
        </div>
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 w-3/4 rounded-full" />
        </div>
        {[
          'Your glow era starts NOW. ☀️ Introducing our summer routine that hits different — SPF, serum & soul.',
          'Hot girl summer but make it skincare. ✨ We obsessively tested so you don\'t have to.',
        ].map((t, i) => (
          <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-start gap-2">
            <p className="text-xs text-slate-700 leading-relaxed">{t}</p>
            <button className="shrink-0 text-xs text-blue-600 font-semibold hover:underline">Use</button>
          </div>
        ))}
      </div>
    </MockupShell>
  )
}

// 2. Content Calendar mockup
function CalendarMockup() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const posts = [
    { day: 1, color: 'bg-blue-500', label: 'IG Reel — Summer Launch' },
    { day: 2, color: 'bg-violet-500', label: 'TikTok — Tutorial' },
    { day: 4, color: 'bg-emerald-500', label: 'Tweet thread' },
    { day: 5, color: 'bg-amber-500', label: 'Story poll' },
    { day: 6, color: 'bg-rose-500', label: 'LinkedIn article' },
  ]
  return (
    <MockupShell>
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">June 2026</span>
          <span className="text-xs text-slate-400">5 posts scheduled</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(d => (
            <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
          ))}
          {Array.from({ length: 7 }, (_, i) => {
            const post = posts.find(p => p.day === i)
            return (
              <div key={i} className={cn(
                'min-h-[52px] rounded-lg border p-1.5 flex flex-col gap-1',
                post ? 'border-slate-200 bg-white' : 'border-dashed border-slate-150 bg-slate-50',
              )}>
                <span className="text-xs text-slate-400">{i + 10}</span>
                {post && (
                  <div className={cn('rounded text-white text-[9px] font-medium px-1 py-0.5 leading-tight', post.color)}>
                    {post.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </MockupShell>
  )
}

// 3. Campaign Management mockup
function CampaignMockup() {
  const tasks = [
    { name: 'Brief designers', done: true, assignee: 'KL' },
    { name: 'Write 10 captions', done: true, assignee: 'JT' },
    { name: 'Record product video', done: false, assignee: 'MS' },
    { name: 'Schedule posts', done: false, assignee: 'KL' },
  ]
  return (
    <MockupShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-900">Summer 2026 Launch</p>
            <p className="text-xs text-slate-400 mt-0.5">4 tasks · Due Jun 30</p>
          </div>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">On track</span>
        </div>
        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="absolute left-0 top-0 h-full bg-blue-600 rounded-full" style={{ width: '50%' }} />
        </div>
        <p className="text-xs text-slate-400">50% complete</p>
        <div className="space-y-1.5">
          {tasks.map((t, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50">
              <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                t.done ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white')}>
                {t.done && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <span className={cn('text-xs flex-1', t.done ? 'line-through text-slate-400' : 'text-slate-700')}>{t.name}</span>
              <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                {t.assignee.slice(0, 1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MockupShell>
  )
}

// 4. UGC Workflow mockup
function UGCMockup() {
  const creators = [
    { name: 'Sofia R.', status: 'Submitted', avatar: 'S', color: 'bg-violet-500' },
    { name: 'Jake M.', status: 'In review', avatar: 'J', color: 'bg-blue-500' },
    { name: 'Priya K.', status: 'Approved', avatar: 'P', color: 'bg-emerald-500' },
    { name: 'Chloe B.', status: 'Briefed', avatar: 'C', color: 'bg-amber-500' },
  ]
  const statusColor: Record<string, string> = {
    Submitted: 'bg-violet-100 text-violet-700',
    'In review': 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Briefed: 'bg-blue-100 text-blue-700',
  }
  return (
    <MockupShell>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-700">UGC Campaign — Summer Creators</p>
        <div className="space-y-2">
          {creators.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', c.color)}>
                {c.avatar}
              </div>
              <span className="text-sm text-slate-700 flex-1">{c.name}</span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusColor[c.status])}>{c.status}</span>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 flex items-center gap-2">
          <Camera size={14} className="text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700">3 submissions awaiting your review</p>
          <button className="ml-auto text-xs font-semibold text-blue-600">Review</button>
        </div>
      </div>
    </MockupShell>
  )
}

// 5. Unified Inbox mockup
function InboxMockup() {
  const messages = [
    { from: 'lisa_styles', text: 'Omg I\'m obsessed with this product!! 😍', time: '2m', unread: true, icon: AtSign },
    { from: 'brandcollab_', text: 'Hi! Would love to partner on a campaign', time: '15m', unread: true, icon: AtSign },
    { from: 'sarah.beauty', text: 'What\'s the shade in the last photo?', time: '1h', unread: false, icon: AtSign },
    { from: 'techbrand99', text: 'Replying to your story — great content!', time: '2h', unread: false, icon: PlayCircle },
  ]
  return (
    <MockupShell>
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-700">Unified Inbox</p>
          <span className="text-xs bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full">2</span>
        </div>
        {messages.map((m, i) => {
          const Icon = m.icon
          return (
            <div key={i} className={cn(
              'flex items-start gap-2.5 p-2 rounded-lg',
              m.unread ? 'bg-blue-50' : 'hover:bg-slate-50',
            )}>
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <Icon size={13} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-800 truncate">@{m.from}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{m.time}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{m.text}</p>
              </div>
              {m.unread && <div className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />}
            </div>
          )
        })}
      </div>
    </MockupShell>
  )
}

// 6. Analytics mockup
function AnalyticsMockup() {
  const bars = [40, 65, 50, 80, 55, 90, 70]
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <MockupShell>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Impressions', value: '284K', delta: '+12%', up: true },
            { label: 'Eng Rate', value: '4.8%', delta: '+0.6%', up: true },
            { label: 'Reach', value: '192K', delta: '-2%', up: false },
          ].map((k, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-slate-400">{k.label}</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{k.value}</p>
              <p className={cn('text-[10px] font-semibold', k.up ? 'text-emerald-600' : 'text-red-500')}>{k.delta}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-2">Impressions this week</p>
          <div className="flex items-end gap-1.5 h-20">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm bg-blue-600 opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-slate-400">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupShell>
  )
}

// 7. Team Collaboration mockup
function TeamMockup() {
  const members = [
    { name: 'Kayla Lee', role: 'Brand Manager', avatar: 'K', color: 'bg-blue-500', status: 'Approved 3 posts' },
    { name: 'James T.', role: 'Content Writer', avatar: 'J', color: 'bg-violet-500', status: 'Drafted 5 captions' },
    { name: 'Maria S.', role: 'Designer', avatar: 'M', color: 'bg-rose-500', status: 'Uploaded 8 assets' },
  ]
  return (
    <MockupShell>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-700">Team Activity — Today</p>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', m.color)}>
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">{m.name}</p>
                <p className="text-[10px] text-slate-400">{m.role}</p>
              </div>
              <p className="text-[10px] text-slate-500 text-right">{m.status}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
          <Shield size={13} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">Brand voice check — 2 posts flagged for review</p>
        </div>
      </div>
    </MockupShell>
  )
}

// 8. Brand Management mockup
function BrandMockup() {
  const brands = [
    { name: 'Lumia Skin', posts: 142, color: 'bg-rose-500', initial: 'L' },
    { name: 'FitCore Co.', posts: 88, color: 'bg-blue-600', initial: 'F' },
    { name: 'GreenLeaf', posts: 56, color: 'bg-emerald-500', initial: 'G' },
  ]
  return (
    <MockupShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Your Brands</p>
          <button className="text-xs text-blue-600 font-semibold">+ Add brand</button>
        </div>
        {brands.map((b, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shrink-0', b.color)}>
              {b.initial}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{b.name}</p>
              <p className="text-xs text-slate-400">{b.posts} posts published</p>
            </div>
            <ArrowRight size={14} className="text-slate-300" />
          </div>
        ))}
        <p className="text-xs text-center text-slate-400 pt-1">All brands, one workspace</p>
      </div>
    </MockupShell>
  )
}

// ─── Features list ────────────────────────────────────────────────────────────

const features: FeatureItem[] = [
  {
    id: 'ai',
    icon: Sparkles,
    headline: 'AI Content Studio',
    subline: 'Generate scroll-stopping captions, hooks, and video scripts in seconds with Fox AI — trained on high-performing social content.',
    bullets: [
      'Generate captions for any platform with the right tone and length',
      'Create full video scripts, hook sequences, and story arcs',
      'Rewrite, tone-shift, and A/B test variations instantly',
    ],
    mockup: <AIMockup />,
    flip: false,
  },
  {
    id: 'calendar',
    icon: CalendarDays,
    headline: 'Content Calendar',
    subline: 'Visualise your entire publishing strategy in one place. Drag, drop, and deploy content across every channel without switching tabs.',
    bullets: [
      'Drag-and-drop scheduler with multi-platform support',
      'Colour-coded content types for at-a-glance clarity',
      'Team visibility into who\'s publishing what and when',
    ],
    mockup: <CalendarMockup />,
    flip: true,
  },
  {
    id: 'campaigns',
    icon: Briefcase,
    headline: 'Campaign Management',
    subline: 'Plan, execute, and track every campaign end-to-end — from first brief to final performance report — without leaving Caption Fox.',
    bullets: [
      'End-to-end campaign timelines with milestone tracking',
      'Assign tasks, set deadlines, and monitor progress',
      'Link posts, assets, and budgets to a single campaign',
    ],
    mockup: <CampaignMockup />,
    flip: false,
  },
  {
    id: 'ugc',
    icon: Camera,
    headline: 'UGC Workflow',
    subline: 'Brief creators, collect submissions, review content, and publish approved UGC — all managed inside a single, seamless pipeline.',
    bullets: [
      'Send creative briefs to creators directly from the platform',
      'Collect video, photo, and text submissions in one hub',
      'Approve, reject, and request revisions with one click',
    ],
    mockup: <UGCMockup />,
    flip: true,
  },
  {
    id: 'inbox',
    icon: Inbox,
    headline: 'Unified Inbox',
    subline: 'Never miss a comment, DM, or mention again. Caption Fox consolidates all social engagement into one intelligent inbox.',
    bullets: [
      'All comments, DMs, and @mentions across platforms',
      'Priority scoring to surface high-value interactions first',
      'Assign conversations to team members with one click',
    ],
    mockup: <InboxMockup />,
    flip: false,
  },
  {
    id: 'analytics',
    icon: TrendingUp,
    headline: 'Analytics & Reporting',
    subline: 'Move beyond vanity metrics. Caption Fox surfaces the insights that actually drive content strategy — across every platform you use.',
    bullets: [
      'Cross-platform performance dashboard in real time',
      'Per-post analytics with engagement rate, reach, and saves',
      'Exportable reports for stakeholders and clients',
    ],
    mockup: <AnalyticsMockup />,
    flip: true,
  },
  {
    id: 'team',
    icon: Users,
    headline: 'Team Collaboration',
    subline: 'Keep your whole content team aligned with role-based access, approval workflows, and built-in brand voice guardrails.',
    bullets: [
      'Role-based permissions for writers, designers, and managers',
      'Approval workflows before anything goes live',
      'Brand voice checker flags off-brand content automatically',
    ],
    mockup: <TeamMockup />,
    flip: false,
  },
  {
    id: 'brands',
    icon: Shield,
    headline: 'Brand Management',
    subline: 'Run multiple brands from one workspace without the chaos. Each brand gets its own calendar, inbox, analytics, and team.',
    bullets: [
      'Separate workspaces per brand under one login',
      'Brand kit with colours, tone, hashtags, and guidelines',
      'Switch between brands in two clicks — no re-login required',
    ],
    mockup: <BrandMockup />,
    flip: true,
  },
]

// ─── Social Proof Strip ───────────────────────────────────────────────────────

function SocialProofStrip() {
  const logos = [
    'Lumia Skin', 'FitCore Co.', 'GreenLeaf Media', 'Apex Studios',
    'NovaWear', 'CloudNine PR', 'Vibe Agency', 'Sparkle Brand',
  ]
  return (
    <div className="bg-slate-50 border-y border-slate-200 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6">
          Trusted by 500+ brands worldwide
        </p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {logos.map((l, i) => (
            <span key={i} className="text-slate-400 font-semibold text-sm hover:text-slate-600 transition-colors">
              {l}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1 mt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
          ))}
          <span className="text-sm text-slate-600 ml-2 font-medium">4.9 / 5 from 200+ reviews</span>
        </div>
      </div>
    </div>
  )
}

// ─── CTA Section ─────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-20 lg:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700" />
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          Free 14-day trial — no credit card required
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
          Ready to grow your brand<br className="hidden sm:block" /> on social media?
        </h2>
        <p className="mt-4 text-base text-blue-100 max-w-xl mx-auto leading-relaxed">
          Join hundreds of brands using Caption Fox to create better content, faster — powered by AI, built for teams.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-white/20 transition-colors"
          >
            View pricing
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Public Footer ────────────────────────────────────────────────────────────

function PublicFooter() {
  const cols = [
    {
      heading: 'Product',
      links: ['Features', 'Pricing', 'Changelog', 'Roadmap', 'Integrations', 'API Docs'],
    },
    {
      heading: 'Company',
      links: ['About', 'Blog', 'Careers', 'Press Kit', 'Affiliates', 'Contact'],
    },
    {
      heading: 'Legal',
      links: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR', 'Acceptable Use'],
    },
    {
      heading: 'Support',
      links: ['Help Center', 'Status Page', 'Community', 'Onboarding', 'Live Chat', 'Feature Requests'],
    },
  ]

  return (
    <footer className="bg-[#0C1A2E] text-slate-400 py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <span className="font-bold text-white text-base">Caption Fox</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500 max-w-[200px]">
              The all-in-one content platform for ambitious brands and teams.
            </p>
          </div>

          {cols.map(col => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-4">{col.heading}</h4>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l}>
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">© 2026 Caption Fox, Inc. All rights reserved.</p>
          <p className="text-xs text-slate-600">Made with care for content teams everywhere.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-16 pb-20 bg-gradient-to-b from-blue-50 to-white relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, #2563eb 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 text-blue-700 bg-blue-100 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          <Sparkles size={12} />
          8 powerful features in one platform
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight">
          Everything your<br className="hidden sm:block" />
          <span className="text-blue-600"> content team </span>needs
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          From AI-powered caption generation to UGC workflows, analytics, and team collaboration — Caption Fox brings your entire content operation under one roof.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            Start free trial <ArrowRight size={16} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-slate-700 bg-white border border-slate-200 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <Hero />
      <SocialProofStrip />

      <div className="divide-y divide-slate-100">
        {features.map(f => (
          <FeatureSection key={f.id} item={f} />
        ))}
      </div>

      <CTASection />
      <PublicFooter />
    </div>
  )
}
