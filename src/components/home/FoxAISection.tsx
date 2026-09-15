'use client'

import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowRight, BarChart3, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, ChevronsUpDown, CircleCheck, Clock3, Copy, FileText,
  Link2, MessageSquareText, MoreVertical, Send, Share2, Sparkles, Users, X, Zap,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AUTH_LINKS } from '@/lib/marketing-links'
import { ChannelIcon } from './brand-icons'
import { FOX, TEAM } from './demo-data'
import { InView } from './motion'
import { Accent, AppSidebar, AvatarStack, CONTAINER, Cta, FoxMark, IconTile, Lead, MediaThumb, Pill, SectionTitle, toneFor } from './primitives'

const CONTEXT_ICONS = { brief: FileText, voice: MessageSquareText, audience: Users, feedback: BookOpen, assets: Link2 } as const
const TAG_CONTEXT: Record<string, keyof typeof CONTEXT_ICONS | undefined> = {
  'Uses campaign brief': 'brief', 'Uses linked assets': 'assets', 'Uses recent feedback': 'feedback', 'On-brand': 'voice',
}

/** SECTION 06 — Fox AI inside the work. Light section; violet appears only on AI markers. */
export default function FoxAISection() {
  const [actionId, setActionId] = useState(FOX.actions[1].id)
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(FOX.context.map((c) => c.id)))
  const [copied, setCopied] = useState(false)
  const action = FOX.actions.find((a) => a.id === actionId) ?? FOX.actions[0]
  const tags = action.tags.filter((t) => {
    const ctx = TAG_CONTEXT[t]
    return !ctx || enabled.has(ctx)
  })

  const toggle = (id: string) => setEnabled((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(action.result.join('\n\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable — nothing to do */ }
  }

  return (
    <section aria-labelledby="fox-title" className="relative overflow-hidden bg-gradient-to-b from-white via-[#FBFCFF] to-cf-tint">
      <div aria-hidden className="pointer-events-none absolute right-[4%] top-[240px] h-[120px] w-[220px] bg-[radial-gradient(#C9D7EE_1px,transparent_1px)] bg-[size:12px_12px] opacity-60" />
      <div className={cn(CONTAINER, 'relative pb-16 pt-12 lg:pb-[56px] lg:pt-[40px]')}>
        <div className="mx-auto max-w-[1290px]">
          <div className="grid gap-10 xl:grid-cols-[1fr_640px] xl:gap-6">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-cf-violet-soft px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#4B37C9]">
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-cf-violet" strokeWidth={2.2} />Fox AI
              </p>
              <SectionTitle id="fox-title" className="mt-5 max-w-[560px]">
                Fox works where <Accent>your marketing work happens.</Accent>
              </SectionTitle>
              <Lead className="mt-4 max-w-[500px] text-[17px]">
                Use AI inside campaigns, content, research, replies and analysis instead of moving work into a separate chatbot.
              </Lead>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Cta href="/features#ai" className="h-[46px] px-7">Explore Fox AI</Cta>
                <Cta href={AUTH_LINKS.startFree} variant="secondary" className="h-[46px] px-7">Try Fox AI free</Cta>
              </div>
            </div>
            <ul className="grid gap-6 sm:grid-cols-3 xl:pt-[78px]">
              {[
                { t: 'Understands context', d: 'Works with your campaigns, brand, audience and assets.', I: FileText },
                { t: 'Helps you create', d: 'Drafts, ideas and variations for every channel.', I: Zap },
                { t: 'Supports better decisions', d: 'Analyses performance and surfaces what to do next.', I: BarChart3 },
              ].map(({ t, d, I }) => (
                <li key={t}>
                  <IconTile className="h-[48px] w-[48px]"><I className="h-6 w-6" strokeWidth={1.8} /></IconTile>
                  <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.015em] text-cf-ink">{t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-[1.5] text-cf-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>

          <InView className="relative mt-10 grid grid-cols-[minmax(0,1fr)] gap-4 xl:mt-[18px] xl:grid-cols-[766px_136px_minmax(0,1fr)] xl:items-start xl:gap-2">
            <Workspace />

            {/* Context rail */}
            <div className="cf-reveal xl:pt-[58px]" style={{ '--d': '120ms' } as React.CSSProperties}>
              <p id="fox-context-label" className="mb-2 text-[12px] font-medium text-cf-muted xl:sr-only">Context Fox can use</p>
              <ul aria-labelledby="fox-context-label" className="cf-hide-scrollbar flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
                {FOX.context.map((c) => {
                  const I = CONTEXT_ICONS[c.id as keyof typeof CONTEXT_ICONS]
                  const on = enabled.has(c.id)
                  return (
                    <li key={c.id} className="shrink-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(c.id)}
                        className={cn(
                          'flex min-h-11 w-[150px] items-center gap-2 rounded-[10px] border bg-white px-2 py-2 text-left shadow-cf-card transition-colors xl:w-full',
                          on ? 'border-cf-line' : 'border-dashed border-cf-line-strong opacity-60',
                        )}
                      >
                        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]', on ? 'bg-cf-violet-soft text-cf-violet' : 'bg-cf-surface text-cf-subtle')}><I className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-[10.5px] font-medium text-cf-ink">{c.label}</span>
                          <span className="block truncate text-[9px] text-cf-muted">{c.detail}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p aria-hidden className="mt-8 hidden -rotate-6 pl-3 font-[family-name:var(--font-caveat)] text-[22px] leading-[1.1] text-cf-blue/80 xl:block">From strategy<br />to results.</p>
            </div>

            {/* Fox panel */}
            <div className="cf-reveal rounded-[20px] border border-cf-line bg-white p-4 shadow-cf-float xl:-mt-[18px]" style={{ '--d': '200ms' } as React.CSSProperties}>
              <div className="flex items-center gap-2.5">
                <FoxMark size={32} />
                <p className="text-[16px] font-semibold text-cf-ink">Fox AI</p>
                <span className="flex items-center gap-1.5 rounded-full bg-cf-violet-soft px-2 py-0.5 text-[10.5px] font-medium text-[#4B37C9]">
                  <Sparkles aria-hidden className="h-3 w-3" />{enabled.size} of {FOX.context.length} context sources
                </span>
                <span aria-hidden className="ml-auto flex gap-3 text-cf-subtle"><Clock3 className="h-4 w-4" /><X className="h-4 w-4" /></span>
              </div>
              <p className="mt-4 text-[17px] font-semibold text-cf-ink">Hi there! <span aria-hidden>👋</span></p>
              <p className="text-[14px] text-cf-muted">I can help you with this campaign.</p>

              <ul className="mt-3 space-y-2" aria-label="Suggested Fox AI actions">
                {FOX.actions.map((a) => {
                  const on = a.id === actionId
                  const Icon = a.id === 'compare' ? Sparkles : a.id === 'draft' ? FileText : MessageSquareText
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setActionId(a.id)}
                        className={cn('flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors', on ? 'border-cf-blue/40 bg-cf-tint' : 'border-cf-line bg-white hover:bg-cf-surface')}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-cf-violet-soft text-cf-violet"><Icon aria-hidden className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-cf-ink">{a.title}</span>
                          <span className="block text-[11.5px] text-cf-muted">{a.detail}</span>
                        </span>
                        <ChevronRight aria-hidden className="h-4 w-4 text-cf-subtle" />
                      </button>
                    </li>
                  )
                })}
              </ul>

              <div className="mt-2 rounded-[14px] border border-cf-line p-3" aria-live="polite">
                <AnimatePresence mode="wait">
                  <m.div key={action.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}>
                    <p className="flex items-center gap-2 text-[13.5px] font-semibold text-cf-ink"><Sparkles aria-hidden className="h-4 w-4 text-cf-violet" />{action.resultTitle}</p>
                    <p className="text-[11.5px] text-cf-muted">Example output — adjust or use as a starting point.</p>
                    <div className="mt-2.5 space-y-2 rounded-[10px] border border-cf-line bg-cf-surface/60 p-3 text-[12.5px] leading-[1.55] text-cf-body">
                      {action.result.map((r) => <p key={r}>{r}</p>)}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {tags.length ? tags.map((t) => <span key={t} className="flex items-center gap-1 rounded-full bg-cf-surface px-2 py-0.5 text-[10px] text-cf-body"><CircleCheck aria-hidden className="h-3 w-3 text-cf-blue" />{t}</span>) : <span className="text-[10.5px] text-cf-muted">No linked context selected — Fox would ask for more detail.</span>}
                    </div>
                  </m.div>
                </AnimatePresence>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.6fr]">
                  <button type="button" onClick={copy} className="flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border border-cf-line-strong text-[12.5px] font-medium text-cf-blue hover:bg-cf-tint">
                    {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}
                  </button>
                  <Cta href={AUTH_LINKS.startFree} size="sm" className="h-10 min-h-10 rounded-[9px] text-[12.5px]">Try it in your workspace</Cta>
                </div>
              </div>

              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-cf-muted">
                <Send aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />Fox drafts and suggests. Publishing, sending replies and approvals stay with your team.
              </p>
            </div>

            <p aria-hidden className="pointer-events-none absolute -bottom-12 left-0 hidden -rotate-6 font-[family-name:var(--font-caveat)] text-[22px] leading-[1.1] text-cf-blue/80 xl:block">Your campaign.<br />With AI at every step.</p>
          </InView>
        </div>
      </div>
    </section>
  )
}

function Workspace() {
  const f = FOX.campaign
  return (
    <div aria-hidden className="cf-reveal overflow-x-auto rounded-[18px] border border-cf-line bg-white shadow-cf-float">
      <div className="flex">
        <AppSidebar
          active="campaigns"
          className="hidden md:flex"
          footer={<span className="flex items-center gap-2 rounded-[10px] border border-cf-line p-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-cf-blue text-[11px] font-semibold text-white">A</span><span className="text-[10.5px] leading-tight text-cf-ink">Acme Co<span className="block text-[9px] text-cf-muted">Workspace</span></span><ChevronsUpDown className="ml-auto h-3 w-3 text-cf-subtle" /></span>}
        />
        <div className="min-w-0 flex-1 p-4">
          <p className="flex items-center gap-1.5 text-[10.5px] text-cf-muted"><ChevronLeft className="h-3 w-3" />Campaigns <ChevronRight className="h-3 w-3" /><span className="text-cf-body">{f.name}</span></p>
          <div className="mt-2 flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em] text-cf-ink">{f.name}<Pill tone="green">Active</Pill></p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-cf-muted"><Calendar className="h-3 w-3" />{f.dates} · Product · Multi-channel <AvatarStack people={TEAM} size={20} extra="+3" /></p>
            </div>
            <span className="flex items-center gap-2"><span className="flex h-7 items-center gap-1 rounded-[7px] border border-cf-line px-2.5 text-[10.5px] text-cf-body"><Share2 className="h-3 w-3" />Share</span><span className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-cf-line"><MoreVertical className="h-3.5 w-3.5 text-cf-subtle" /></span></span>
          </div>
          <div className="mt-3 flex gap-5 overflow-hidden border-b border-cf-line text-[11px] text-cf-muted">
            {['Overview', 'Brief', 'Audience', 'Content', 'Calendar', 'Budget', 'Approvals', 'Results'].map((t) => <span key={t} className={cn('shrink-0 pb-2', t === 'Overview' && 'border-b-2 border-cf-blue font-medium text-cf-blue')}>{t}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { l: 'Content', v: f.content, s: 'Published', sc: 'text-[#157A45]' },
              { l: 'Channels', v: f.channels, s: 'Connected', sc: 'text-cf-muted' },
              { l: 'Next milestone', v: f.milestone, s: f.milestoneDate, sc: 'text-cf-muted', icon: <Calendar className="h-3.5 w-3.5 text-cf-blue" /> },
              { l: 'Budget', v: f.budget, s: f.budgetDetail, sc: 'text-cf-muted', icon: <CircleCheck className="h-3.5 w-3.5 text-[#1DB954]" /> },
            ].map((s) => (
              <div key={s.l} className="rounded-[10px] border border-cf-line p-2.5">
                <p className="text-[9.5px] text-cf-muted">{s.l}</p>
                <p className={cn('mt-1 flex items-center gap-1 font-semibold text-cf-ink', s.icon ? 'text-[11.5px]' : 'text-[15px]')}>{s.icon}{s.v}</p>
                <p className={cn('text-[9.5px]', s.sc)}>{s.s}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-[10px] border border-cf-line p-2.5">
              <p className="flex justify-between text-[11.5px] font-semibold text-cf-ink">Recent content<span className="flex items-center gap-1 font-medium text-cf-blue">View all<ArrowRight className="h-3 w-3" /></span></p>
              <ul className="mt-2 space-y-2">
                {FOX.recent.map((r) => (
                  <li key={r.title} className="flex items-center gap-2.5">
                    <MediaThumb kind={r.thumb} className="h-[44px] w-[62px] shrink-0 text-[7px]" />
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-cf-ink">{r.title}</span><span className="mt-0.5 flex gap-1">{r.tags.map((t) => <span key={t} className="rounded-[4px] bg-cf-surface px-1 text-[8.5px] text-cf-muted">{t}</span>)}</span></span>
                    <Pill tone={r.tone} className="text-[9px]">{r.state}</Pill>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[10px] border border-cf-line p-2.5">
              <p className="flex justify-between text-[11.5px] font-semibold text-cf-ink">Campaign timeline<span className="flex items-center gap-1 font-medium text-cf-blue">View timeline<ArrowRight className="h-3 w-3" /></span></p>
              <ul className="mt-2 space-y-[7px]">
                {FOX.timeline.map((t) => (
                  <li key={t.label} className="flex items-center gap-2 text-[10.5px] text-cf-body">
                    <CircleCheck className={cn('h-4 w-4', t.state === 'Completed' ? 'text-[#1DB954]' : t.state === 'In progress' ? 'text-cf-blue' : t.state === 'Pending' ? 'text-[#F59E0B]' : 'text-[#C5CFDD]')} />
                    <span className="flex-1">{t.label}</span>
                    <Pill tone={toneFor(t.state)} dot={false} className="text-[9px]">{t.state}</Pill>
                    <span className="w-[38px] text-right text-[9.5px] text-cf-muted">{t.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 rounded-[10px] border border-cf-line p-2.5">
            <p className="text-[11.5px] font-semibold text-cf-ink">Connected channels</p>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {FOX.connected.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  <ChannelIcon channel={c.channel} size={18} />
                  <span className="text-[9.5px] leading-tight text-cf-ink">{c.label}<span className={cn('block text-[8.5px]', c.connected ? 'text-[#157A45]' : 'text-cf-subtle')}>{c.connected ? 'Connected' : 'Not connected'}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
