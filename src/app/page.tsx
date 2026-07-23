'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import {
  Sparkles, Calendar, Megaphone, Users, Inbox, BarChart2,
  Menu, X, Check, ChevronDown, ChevronUp, ArrowRight, Play,
  Zap, TrendingUp, MessageSquare, Target, Shield, Globe,
} from 'lucide-react'

/* ─── Public Nav ─────────────────────────────────────────── */
function PublicNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/caption-fox-logo-transparent.png"
              alt="Caption Fox"
              width={140}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</Link>
            <Link href="/marketplace" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Marketplace</Link>
            <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Pricing</Link>
            <Link href="#use-cases" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Use Cases</Link>
            <Link href="#resources" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">Resources</Link>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-slate-100 py-4 space-y-1">
            <Link href="/features" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Features</Link>
            <Link href="/marketplace" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Marketplace</Link>
            <Link href="/pricing" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Pricing</Link>
            <Link href="#use-cases" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Use Cases</Link>
            <Link href="#resources" className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 rounded-lg">Resources</Link>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 px-4">
              <Link href="/login" className="text-center py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">Sign in</Link>
              <Link href="/auth/signup" className="text-center py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Start free trial</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

/* ─── Dashboard Mockup ───────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white">
      {/* Window bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-slate-400 font-mono">app.captionfox.com</span>
      </div>
      <div className="flex h-72">
        {/* Sidebar */}
        <div className="w-14 bg-navy-900 flex flex-col items-center py-4 gap-4" style={{ backgroundColor: '#0C1A2E' }}>
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          {[Calendar, Megaphone, BarChart2, Inbox].map((Icon, i) => (
            <div key={i} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
              <Icon size={13} className="text-white/60" />
            </div>
          ))}
        </div>
        {/* Main */}
        <div className="flex-1 p-4 bg-slate-50 overflow-hidden">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Posts this month', val: '24' },
              { label: 'Avg. engagement', val: '4.2%' },
              { label: 'AI generations', val: '148' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-lg p-2.5 border border-slate-200">
                <div className="text-base font-bold text-slate-800">{k.val}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{k.label}</div>
              </div>
            ))}
          </div>
          {/* Calendar preview */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs font-medium text-slate-700 mb-2">Content Calendar — June</div>
            <div className="grid grid-cols-7 gap-1">
              {['M','T','W','T','F','S','S'].map((d,i) => (
                <div key={i} className="text-center text-[9px] text-slate-400 font-medium">{d}</div>
              ))}
              {Array.from({ length: 28 }).map((_, i) => {
                const hasPost = [2, 5, 8, 11, 14, 17, 20, 23].includes(i)
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded text-[9px] flex items-center justify-center font-medium ${
                      hasPost ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Feature Mockup ─────────────────────────────────────── */
function FeatureMockup({ color = 'blue', rows = 3 }: { color?: string; rows?: number }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100',
    violet: 'bg-violet-50 border-violet-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
    sky: 'bg-sky-50 border-sky-100',
    rose: 'bg-rose-50 border-rose-100',
  }
  const barColor: Record<string, string> = {
    blue: 'bg-blue-200',
    violet: 'bg-violet-200',
    emerald: 'bg-emerald-200',
    amber: 'bg-amber-200',
    sky: 'bg-sky-200',
    rose: 'bg-rose-200',
  }
  const accentColor: Record<string, string> = {
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
  }
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${colors[color] ?? colors.blue}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded ${accentColor[color]} flex-shrink-0`} />
          <div className={`h-2.5 rounded-full ${barColor[color]} flex-1`} style={{ width: `${60 + (i * 13) % 35}%` }} />
        </div>
      ))}
    </div>
  )
}

/* ─── FAQ Item ───────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border border-slate-200 rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors list-none">
        <span className="font-medium text-slate-800 text-sm pr-4">{q}</span>
        <ChevronDown size={16} className="text-slate-400 flex-shrink-0 group-open:hidden" />
        <ChevronUp size={16} className="text-slate-400 flex-shrink-0 hidden group-open:block" />
      </summary>
      <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{a}</div>
    </details>
  )
}

/* ─── Public Footer ──────────────────────────────────────── */
function PublicFooter() {
  const cols = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Changelog', href: '/changelog' },
        { label: 'Roadmap', href: '/roadmap' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Blog', href: '/blog' },
        { label: 'Careers', href: '/careers' },
        { label: 'Press', href: '/press' },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/legal/privacy' },
        { label: 'Terms of Service', href: '/legal/terms' },
        { label: 'Cookie Policy', href: '/legal/cookie-policy' },
        { label: 'Acceptable Use', href: '/legal/acceptable-use' },
        { label: 'DPA', href: '/legal/dpa' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help Centre', href: '/help' },
        { label: 'Contact', href: '/contact' },
        { label: 'Status', href: '/status' },
        { label: 'Affiliates', href: '/affiliates' },
      ],
    },
  ]

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <Image
              src="/caption-fox-logo-transparent.png"
              alt="Caption Fox"
              width={120}
              height={28}
              className="h-7 w-auto brightness-0 invert mb-4"
            />
            <p className="text-slate-400 text-sm leading-relaxed">
              AI-powered social media content platform for brands, creators and agencies.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">{col.heading}</h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">© 2025 Caption Fox Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {/* Social icons (SVG inline) */}
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-slate-400 hover:text-white transition-colors">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-slate-400 hover:text-white transition-colors">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-slate-400 hover:text-white transition-colors">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function LandingPage() {
  const features = [
    {
      icon: <Sparkles size={20} className="text-violet-600" />,
      badge: 'AI Content Studio',
      badgeColor: 'bg-violet-100 text-violet-700',
      heading: 'Generate on-brand content in seconds',
      desc: 'Your AI fox learns your brand voice and creates captions, hooks, scripts and hashtag sets that sound exactly like you — at scale.',
      bullets: [
        'Brand voice profiles with tone calibration',
        'Multi-format output: captions, threads, scripts, hooks',
        'Repurpose long-form content into social posts',
      ],
      mockupColor: 'violet',
      flip: false,
    },
    {
      icon: <Calendar size={20} className="text-blue-600" />,
      badge: 'Social Planning Calendar',
      badgeColor: 'bg-blue-100 text-blue-700',
      heading: 'Plan your entire content calendar visually',
      desc: 'Drag-and-drop scheduling across every platform. See best-time suggestions, schedule in bulk, and never miss a posting slot.',
      bullets: [
        'Drag-and-drop across weeks and months',
        'AI-powered best time to post suggestions',
        'Bulk scheduling and content recycling',
      ],
      mockupColor: 'blue',
      flip: true,
    },
    {
      icon: <Megaphone size={20} className="text-amber-600" />,
      badge: 'Campaign Management',
      badgeColor: 'bg-amber-100 text-amber-700',
      heading: 'Brief to publish in one seamless flow',
      desc: 'Run campaigns end-to-end: write the brief, produce content, get approvals, publish, and see the results — all in one place.',
      bullets: [
        'Campaign briefs with linked content tasks',
        'Multi-step approval workflows with comments',
        'Built-in budget tracking and reporting',
      ],
      mockupColor: 'amber',
      flip: false,
    },
    {
      icon: <Users size={20} className="text-emerald-600" />,
      badge: 'UGC Workflow',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      heading: 'Scale user-generated content effortlessly',
      desc: 'Brief creators, collect and review submissions, manage rights clearance, and repurpose the best UGC across your channels.',
      bullets: [
        'Creator briefs with deliverable specs',
        'Submission portal and review pipeline',
        'Rights management and usage tracking',
      ],
      mockupColor: 'emerald',
      flip: true,
    },
    {
      icon: <Inbox size={20} className="text-sky-600" />,
      badge: 'Unified Inbox',
      badgeColor: 'bg-sky-100 text-sky-700',
      heading: 'All your social conversations, one place',
      desc: 'Comments, mentions and DMs from every platform in a single inbox. AI drafts replies in your brand voice so you never miss an engagement.',
      bullets: [
        'Unified feed across all connected channels',
        'AI-assisted reply drafts in your brand voice',
        'Assignment, labels and response SLA tracking',
      ],
      mockupColor: 'sky',
      flip: false,
    },
    {
      icon: <BarChart2 size={20} className="text-rose-600" />,
      badge: 'Analytics & Reports',
      badgeColor: 'bg-rose-100 text-rose-700',
      heading: 'Understand what content actually works',
      desc: 'Post, campaign, channel and creator performance in clear, shareable reports. Know what to double down on and what to stop.',
      bullets: [
        'Post-level performance across all platforms',
        'Campaign ROI and budget vs. results',
        'Custom branded reports for clients and stakeholders',
      ],
      mockupColor: 'rose',
      flip: true,
    },
  ]

  const problems = [
    {
      icon: <Globe size={24} className="text-slate-500" />,
      heading: 'Scattered across apps',
      desc: "You're switching between Notion, Buffer, Canva, Slack and 3 spreadsheets just to publish one post.",
    },
    {
      icon: <Zap size={24} className="text-slate-500" />,
      heading: 'Manual, slow processes',
      desc: 'Copy-pasting captions, chasing approvals over email, manually tracking what was posted where. It never ends.',
    },
    {
      icon: <Target size={24} className="text-slate-500" />,
      heading: 'No clear content strategy',
      desc: "Posting reactively with no calendar, no data and no campaign structure. It's hard to grow what you can't plan.",
    },
  ]

  const pricingPlans = [
    {
      name: 'Free',
      price: 'Free',
      period: '',
      features: ['1 brand', '3 posts/month', 'Basic calendar', 'Fox AI (5/mo)', '1 team member'],
      cta: 'Get started free',
      href: '/auth/signup?plan=free',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '£59',
      period: '/mo',
      features: ['5 brands', 'Unlimited posts', 'Fox AI unlimited', 'Full analytics (9 tabs)', 'Campaigns (12 types)', 'Up to 5 members'],
      cta: 'Start free trial',
      href: '/auth/signup?plan=pro',
      highlight: true,
    },
    {
      name: 'Agency',
      price: '£199',
      period: '/mo',
      features: ['Unlimited brands', 'Unlimited posts', 'Social Listening', 'Competitor Analysis', 'White-label ready', 'Unlimited team'],
      cta: 'Start free trial',
      href: '/auth/signup?plan=agency',
      highlight: false,
    },
  ]

  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Background radial gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, #eff8ff 0%, white 70%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <Sparkles size={12} />
            Now with Fox AI — your content copilot
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto mb-6">
            Run campaigns, not just posts.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Caption Fox is the AI-powered platform for brands and agencies launching giveaways, contests, UGC campaigns, and influencer programs — alongside content that converts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3.5 rounded-xl text-base shadow-sm transition-colors"
            >
              Start Free <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-slate-700 font-medium px-6 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-base transition-colors"
            >
              See Pricing <ArrowRight size={16} className="text-slate-400" />
            </Link>
          </div>
          <DashboardMockup />
        </div>
      </section>

      {/* ── Social Proof ──────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-500 mb-6">Trusted by growing brands, creators and agencies</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Acme Co', 'StudioX', 'GrowthCo', 'CreativeLab', 'BrandPulse'].map((name) => (
              <span
                key={name}
                className="bg-white border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-full shadow-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Too many tools. Too much noise.</h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              Growing brands waste hours every week managing content across fragmented, disconnected tools.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {problems.map((p) => (
              <div key={p.heading} className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  {p.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{p.heading}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Everything you need. Nothing you don&apos;t.</h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              Six core capabilities, deeply integrated so your whole workflow lives in one place.
            </p>
          </div>

          <div className="space-y-24">
            {features.map((f, idx) => (
              <div
                key={f.badge}
                className={`grid lg:grid-cols-2 gap-12 items-center ${f.flip ? 'lg:flex-row-reverse' : ''}`}
              >
                <div className={f.flip ? 'lg:order-2' : ''}>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-4 ${f.badgeColor}`}>
                    {f.icon}
                    {f.badge}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{f.heading}</h3>
                  <p className="text-slate-600 leading-relaxed mb-6">{f.desc}</p>
                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <Check size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={f.flip ? 'lg:order-1' : ''}>
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="text-xs font-medium text-slate-500 mb-4 flex items-center gap-2">
                      {f.icon} {f.badge}
                    </div>
                    <FeatureMockup color={f.mockupColor} rows={4} />
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <FeatureMockup color={f.mockupColor} rows={2} />
                      <FeatureMockup color={f.mockupColor} rows={2} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Caption Fox ──────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Why Caption Fox?</h2>
            <p className="text-lg text-slate-600 max-w-xl mx-auto">
              Not just another scheduler. A complete campaign and content operating system.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-8 bg-blue-600 text-white">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-5">
                <Megaphone size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">Campaign Management</h3>
              <p className="text-blue-100 leading-relaxed text-sm">
                12 campaign types including giveaways, contests, UGC, and influencer programs. No other platform bundles this.
              </p>
            </div>
            <div className="rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-5">
                <Sparkles size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI That Goes Deep</h3>
              <p className="text-purple-100 leading-relaxed text-sm">
                Fox AI writes captions, hooks, scripts, UGC briefs, and reply drafts. Not just hashtag suggestions.
              </p>
            </div>
            <div className="rounded-2xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-5">
                <BarChart2 size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">Sprout-Level Depth, Buffer-Level Pricing</h3>
              <p className="text-amber-100 leading-relaxed text-sm">
                Social listening, competitor analysis, and 9-tab analytics from £59/mo vs. £299/mo at Sprout Social.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fox AI Section ────────────────────────────────── */}
      <section className="py-20 sm:py-24" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 bg-violet-500/20 text-violet-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <Sparkles size={12} /> Powered by AI
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Meet Fox, your AI content copilot
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-8">
                Fox is trained on your brand voice, your audience data and social best practices. It doesn&apos;t just generate content — it helps you make better decisions across your entire content operation.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: <Sparkles size={18} className="text-violet-400" />, title: 'Generate content', desc: 'Captions, hooks, scripts and threads in your brand tone' },
                  { icon: <TrendingUp size={18} className="text-violet-400" />, title: 'Analyse performance', desc: 'Understand what works and get actionable recommendations' },
                  { icon: <MessageSquare size={18} className="text-violet-400" />, title: 'Draft replies', desc: 'Respond to comments and DMs faster with AI-assisted drafts' },
                  { icon: <Target size={18} className="text-violet-400" />, title: 'Plan campaigns', desc: 'Build full campaign briefs and content plans from a single prompt' },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">{item.title}</div>
                      <div className="text-slate-400 text-sm mt-0.5">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Fox chat bubble mockup */}
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-fox-gradient flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-white font-semibold text-sm">Fox AI</span>
                <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> Online
                </span>
              </div>

              {/* Chat bubbles */}
              <div className="bg-slate-700/50 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-200 leading-relaxed">
                I&apos;ve analysed your last 30 posts. Your audience engages 3× more with behind-the-scenes content on Wednesdays. Want me to generate a 4-week behind-the-scenes content plan?
              </div>
              <div className="flex justify-end">
                <div className="bg-blue-600 rounded-2xl rounded-tr-sm p-4 text-sm text-white max-w-xs leading-relaxed">
                  Yes! Make it casual and founder-led. Target early-stage founders.
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-200 leading-relaxed">
                <div className="font-medium text-white mb-2">Week 1 — &quot;Early days&quot; series</div>
                <div className="text-slate-400 text-xs space-y-1">
                  <div>✓ 4 captions drafted</div>
                  <div>✓ Scheduled for optimal times</div>
                  <div>✓ Hashtag sets added</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing Preview ───────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Simple, honest pricing</h2>
            <p className="text-lg text-slate-600">Start free. Scale when you&apos;re ready.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 border flex flex-col ${
                  plan.highlight
                    ? 'border-blue-600 shadow-lg shadow-blue-100 bg-blue-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                } transition-all`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                    Most popular
                  </span>
                )}
                <div className={`font-semibold mb-1 ${plan.highlight ? 'text-white' : 'text-slate-800'}`}>{plan.name}</div>
                <div className={`text-3xl font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}
                  <span className={`text-sm font-normal ${plan.highlight ? 'text-blue-200' : 'text-slate-500'}`}>{plan.period}</span>
                </div>
                <ul className="mt-4 space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? 'text-blue-100' : 'text-slate-600'}`}>
                      <Check size={14} className={plan.highlight ? 'text-blue-200' : 'text-blue-600'} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    plan.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/pricing" className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
              See all 6 plans including Team, Agency & Enterprise <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Frequently asked questions</h2>
            <p className="text-slate-600">Everything you need to know before getting started.</p>
          </div>
          <div className="space-y-3">
            <FaqItem
              q="What social platforms does Caption Fox support?"
              a="Caption Fox currently supports Instagram, X (Twitter), LinkedIn, Facebook, TikTok, Pinterest and YouTube. We're adding more platforms regularly — check the roadmap for upcoming integrations."
            />
            <FaqItem
              q="Is there a free plan?"
              a="Yes! The Free plan is permanently free with 1 brand, 3 posts per month, Fox AI (5 generations/mo) and 1 team member. No credit card required to get started."
            />
            <FaqItem
              q="Can I connect multiple brands?"
              a="Absolutely. Each workspace represents one brand. You can create multiple workspaces under one account. Free supports 1 brand, Starter 2, Pro 5, Team 10, and Agency/Enterprise support unlimited brands."
            />
            <FaqItem
              q="How does the AI content generation work?"
              a="Fox AI learns your brand voice through a brief onboarding questionnaire and by analysing your existing content. It then uses that context to generate captions, scripts, hooks and replies that sound authentically like your brand."
            />
            <FaqItem
              q="Is my data secure?"
              a="Yes. Caption Fox is GDPR-compliant and stores data on EU servers. We use Supabase with row-level security, encrypted connections and regular security audits. You can export or delete your data at any time."
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Start creating smarter content today
          </h2>
          <p className="text-lg text-slate-600 mb-10">
            Join thousands of brands, creators and agencies using Caption Fox to plan, create and grow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-base shadow-sm transition-colors"
            >
              Get started free <ArrowRight size={18} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-slate-700 font-medium px-8 py-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-base transition-colors"
            >
              Talk to sales
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-400">No credit card required · Cancel any time · GDPR compliant</p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
