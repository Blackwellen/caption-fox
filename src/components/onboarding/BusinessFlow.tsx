'use client'

import { Building2, CalendarDays, Check, ChartColumn, ChevronRight, Globe, Heart, Link2, Mail, Megaphone, Plus, Rocket, Target, Users, Workflow } from 'lucide-react'
import { SelectField, TextField, FormAlert } from '@/components/auth/fields'
import { BrandGlyph } from '@/components/auth/BrandGlyph'
import { BUSINESS_CHANNELS, BUSINESS_GOALS, CADENCES, INDUSTRIES, PLATFORMS, REGIONS, TEAM_SIZES, workspaceNameOf } from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import {
  ChangeTypeLink, Field, FlowCard, FlowNav, HeaderProgress, IconTiles, InviteEditor, MultiChips, OnboardingFrame, PageIntro, ProgressRing,
  StepBody, StepHeading, Stepper, TextArea,
} from './ui'
import { useOnboardingFlow, type FlowApi, type FlowProps } from './useOnboardingFlow'

const GOAL_ICON: Record<string, React.ReactNode> = { Awareness: <Target size={20} />, Leads: <Users size={20} />, Sales: <ChartColumn size={20} />, Retention: <Heart size={20} /> }
const CHANNEL_ICON: Record<string, React.ReactNode> = {
  Social: <BrandGlyph platform="instagram" size={19} />, Email: <Mail size={18} className="text-cf-blue" />, Web: <Globe size={18} className="text-cf-blue" />, Paid: <Megaphone size={18} className="text-cf-blue" />,
}

export default function BusinessFlow(props: FlowProps) {
  const api = useOnboardingFlow(props)
  return (
    <OnboardingFrame headerRight={<HeaderProgress step={api.step} barFirst />}>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-8">
        <div className="min-w-0">
          <PageIntro
            eyebrow="Business onboarding"
            title={<>Set up your <span className="text-cf-blue">business workspace</span></>}
            titleClassName="xl:text-[56px]"
            intro="Tell us a bit about your business and goals so we can tailor your workspace and get you up and running faster."
          />
          <Stepper api={api} variant="line" dense className="mt-7" />
          <FlowCard className="mt-7">
            <StepBody api={api}>
              {api.step === 1 && <BusinessStep api={api} />}
              {api.step === 2 && <GoalsStep api={api} />}
              {api.step === 3 && <ChannelsStep api={api} />}
              {api.step === 4 && <TeamStep api={api} />}
            </StepBody>
            <FlowNav api={api} finishLabel="Create workspace" divider={false} />
          </FlowCard>
          <ChangeTypeLink type="business" />
        </div>
        <BusinessAside api={api} />
      </div>
    </OnboardingFrame>
  )
}

function NameWebsiteIndustry({ api, withIndustry = true }: { api: FlowApi; withIndustry?: boolean }) {
  return (
    <>
      <div data-field="business_name"><TextField size="compact" label={<>Business name <span aria-hidden className="text-[#E5484D]">*</span></>} autoComplete="organization" placeholder="Your business name" value={api.str('business_name')} onChange={e => api.set('business_name', e.target.value)} error={api.errors.business_name} /></div>
      <div data-field="website"><TextField size="compact" label="Website" type="url" inputMode="url" autoComplete="url" placeholder="https://www.yourbusiness.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} /></div>
      {withIndustry && <div data-field="industry"><SelectField size="compact" label={<>Industry <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Select your industry" icon={<Building2 size={19} strokeWidth={1.8} />} options={INDUSTRIES} value={api.str('industry')} onChange={e => api.set('industry', e.target.value)} error={api.errors.industry} /></div>}
    </>
  )
}

function BusinessStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Business details" description="Tell us about your business." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <NameWebsiteIndustry api={api} />
        <div data-field="region"><SelectField size="compact" label="Main region" placeholder="Where are your customers?" icon={<Globe size={19} strokeWidth={1.8} />} options={REGIONS} value={api.str('region')} onChange={e => api.set('region', e.target.value)} /></div>
        <Field name="description" label="What your business does (optional)" className="md:col-span-2" error={api.errors.description}>
          <TextArea value={api.str('description')} onChange={v => api.set('description', v)} max={280} placeholder="e.g. Independent coffee roaster selling online and in two London cafés." />
        </Field>
      </div>
    </>
  )
}

function GoalsStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Business details & goals" description="This information helps us personalise your workspace and recommendations." />
      <div className="mt-6 grid gap-x-7 gap-y-5 md:grid-cols-2">
        <NameWebsiteIndustry api={api} withIndustry={false} />
        <div data-field="industry"><SelectField size="compact" label={<>Industry <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Select your industry" icon={<Building2 size={19} strokeWidth={1.8} />} options={INDUSTRIES} value={api.str('industry')} onChange={e => api.set('industry', e.target.value)} error={api.errors.industry} /></div>
        <Field name="goals" label="Marketing goals" required hint="What do you want to achieve with Caption Fox?" error={api.errors.goals}>
          <IconTiles name="goals" options={BUSINESS_GOALS} value={api.arr('goals')} onChange={v => api.set('goals', v)} iconFor={v => GOAL_ICON[v]} />
        </Field>
        <Field name="primary_channels" label="Primary channels" required hint="Where do you plan to publish content?" error={api.errors.primary_channels}>
          <MultiChips variant="plain" size="sm" className="grid grid-cols-2 sm:grid-cols-4" chipClassName="justify-center !px-2" options={BUSINESS_CHANNELS} value={api.arr('primary_channels')} onChange={v => api.set('primary_channels', v)} iconFor={v => CHANNEL_ICON[v]} />
        </Field>
        <div data-field="team_size"><SelectField size="compact" label={<>Team size <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Select team size" icon={<Users size={19} strokeWidth={1.8} />} options={TEAM_SIZES} value={api.str('team_size')} onChange={e => api.set('team_size', e.target.value)} error={api.errors.team_size} /></div>
        <div data-field="cadence"><SelectField size="compact" label={<>Publishing cadence <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="How often will you publish?" icon={<CalendarDays size={19} strokeWidth={1.8} />} options={CADENCES} value={api.str('cadence')} onChange={e => api.set('cadence', e.target.value)} error={api.errors.cadence} hint="You can always change this later." /></div>
      </div>
    </>
  )
}

function ChannelsStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Your channels" description="Choose the social accounts you’ll publish to." />
      <div className="mt-6 space-y-5">
        <Field name="social_channels" label="Social channels" required error={api.errors.social_channels}>
          <MultiChips variant="plain" options={PLATFORMS} value={api.arr('social_channels')} onChange={v => api.set('social_channels', v)} iconFor={v => <BrandGlyph platform={v} size={22} />} />
        </Field>
        <FormAlert tone="info">Choosing a channel doesn’t connect it. After setup, connect each account from Social › Connections — you’ll sign in to the platform directly, and we never see your password.</FormAlert>
      </div>
    </>
  )
}

function TeamStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Invite your team" description="Bring teammates into your workspace — or skip this for now." />
      <div className="mt-6"><InviteEditor api={api} /></div>
    </>
  )
}

function BusinessAside({ api }: { api: FlowApi }) {
  const name = workspaceNameOf('business', api.data)
  const summaries = [
    name ? [name, api.str('industry')].filter(Boolean).join(' • ') : 'Tell us about your business',
    api.arr('goals').length ? api.arr('goals').join(', ') : 'Set your goals and focus',
    api.arr('social_channels').length ? `${api.arr('social_channels').length} channel${api.arr('social_channels').length > 1 ? 's' : ''} selected` : 'Choose your channels',
    Array.isArray(api.data.invites) && api.data.invites.length ? `${api.data.invites.length} invite${api.data.invites.length > 1 ? 's' : ''} ready` : 'Invite your team members',
  ]
  const titles = ['Business details', 'Marketing goals', 'Channels', 'Team']
  const channels = api.arr('social_channels').slice(0, 3)
  return (
    <aside aria-label="Workspace summary" className="lg:pt-1">
      <div className="rounded-[22px] border border-cf-line-strong/70 bg-white p-5 shadow-cf-card sm:p-8 lg:sticky lg:top-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-cf-blue">Your workspace</p>
            <h2 className="mt-2 text-[26px] font-bold tracking-tight text-cf-ink sm:text-[28px]">{api.percent >= 100 ? 'Ready to go!' : 'Almost there!'}</h2>
            <p className="mt-1.5 text-[15px] leading-snug text-cf-muted">Complete the setup to create your personalised marketing workspace.</p>
          </div>
          <ProgressRing value={api.percent} label="Workspace setup progress" />
        </div>
        <ol className="mt-6 space-y-1 rounded-2xl border border-cf-line p-2">
          {titles.map((t, i) => {
            const n = i + 1
            const done = n < api.step
            const current = n === api.step
            return (
              <li key={t} className={cn('flex items-center gap-4 rounded-xl px-3 py-3', current && 'bg-cf-tint')} aria-current={current ? 'step' : undefined}>
                <span aria-hidden className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold', done ? 'bg-[#22A559] text-white' : current ? 'bg-cf-blue text-white' : 'bg-[#EEF2F7] text-cf-body')}>{done ? <Check size={18} strokeWidth={3} /> : n}</span>
                <div className="min-w-0"><p className="text-[16px] font-semibold text-cf-ink">{t}</p><p className="truncate text-[14px] text-cf-muted">{summaries[i]}</p></div>
              </li>
            )
          })}
        </ol>
        <div className="my-5 h-px bg-cf-line" />
        <h2 className="text-[19px] font-bold text-cf-ink">Workspace preview</h2>
        <p className="text-[15px] text-cf-muted">Here’s what you’ll unlock once setup is complete.</p>
        <div className="mt-4 divide-y divide-cf-line rounded-2xl border border-cf-line">
          <div className="flex items-center gap-3 p-3.5">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cf-tint-2 text-cf-blue"><CalendarDays size={21} /></span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-cf-ink">Campaign planning</p><p className="text-[13px] text-cf-muted">Plan, create and schedule campaigns.</p></div>
            <span className="hidden items-center gap-2 rounded-xl border border-cf-line px-3 py-2 sm:flex"><span><span className="block text-[12px] font-semibold text-cf-ink">First campaign</span><span className="mt-0.5 inline-flex rounded-full bg-[#E7F8EF] px-2 text-[11px] font-medium text-[#15803D]">Draft</span></span><ChevronRight size={15} aria-hidden className="text-cf-muted" /></span>
          </div>
          <div className="flex items-center gap-3 p-3.5">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cf-tint-2 text-cf-blue"><Workflow size={21} /></span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-cf-ink">Channel setup</p><p className="text-[13px] text-cf-muted">Connect your channels and start publishing.</p></div>
            <span className="flex items-center gap-1.5">
              {channels.map(c => <span key={c} className="flex h-8 w-8 items-center justify-center rounded-lg bg-cf-tint"><BrandGlyph platform={c} size={17} /></span>)}
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cf-tint text-cf-body"><Plus size={15} aria-hidden /></span>
            </span>
          </div>
        </div>
        <div className="mt-5 flex gap-4 rounded-2xl bg-cf-tint p-4">
          <Rocket size={30} aria-hidden className="shrink-0 text-cf-blue" />
          <div><p className="text-[15px] font-semibold text-cf-ink">A smarter marketing workspace awaits.</p><p className="mt-0.5 text-[14px] leading-snug text-cf-body">Plan campaigns, create content, collaborate with your team and measure results — all in one place.</p></div>
        </div>
      </div>
    </aside>
  )
}
