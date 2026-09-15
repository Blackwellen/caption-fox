'use client'

import Image from 'next/image'
import { Building2, CalendarDays, ChartColumn, ChartPie, ExternalLink, FileText, Globe, Layers, Link2, Pencil, Plus, Settings, Users, Video } from 'lucide-react'
import { SelectField, TextField } from '@/components/auth/fields'
import {
  AGENCY_DELIVERABLES, APPROVAL_WORKFLOWS, CLIENT_COUNTS, CLIENT_MODELS, INDUSTRIES, PRICING_MODELS, REGIONS, REPORTING_PREFS, SERVICE_LINES,
  TEAM_ROLE_MODELS, TEAM_SIZES, optionLabel,
} from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import {
  ChangeTypeLink, Field, FlowCard, FlowNav, HeaderProgress, InviteEditor, MultiChips, OnboardingFrame, PageIntro, RadioCards,
  StepBody, StepHeading, Stepper, TextArea,
} from './ui'
import { useOnboardingFlow, type FlowApi, type FlowProps } from './useOnboardingFlow'

const SERVICE_ICON: Record<string, { icon: React.ReactNode; chip: string }> = {
  Campaigns: { icon: <CalendarDays size={18} />, chip: 'bg-cf-tint text-cf-blue' },
  Content: { icon: <FileText size={18} />, chip: 'bg-[#E7F8EF] text-[#15803D]' },
  'Paid Media': { icon: <ChartColumn size={18} />, chip: 'bg-[#FFF1E6] text-[#C2410C]' },
  Reporting: { icon: <ChartPie size={18} />, chip: 'bg-cf-violet-soft text-[#5B3DF5]' },
  UGC: { icon: <Users size={18} />, chip: 'bg-[#FDECF4] text-[#BE185D]' },
}

export default function AgencyFlow(props: FlowProps) {
  const api = useOnboardingFlow(props)
  return (
    <OnboardingFrame headerRight={<HeaderProgress step={api.step} label="Agency Onboarding" />}>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_450px] xl:gap-7">
        <div className="min-w-0">
          <PageIntro
            eyebrow="Agency onboarding"
            title={<>Set up your <span className="text-cf-blue">agency workspace.</span></>}
            intro="Get your agency up and running in minutes. Define your clients, services and workflows and invite your team — all in one place."
          />
          <FlowCard className="mt-7">
            <Stepper api={api} variant="inline" />
            <div className="mt-6">
              <StepBody api={api}>
                {api.step === 1 && <AgencyStep api={api} />}
                {api.step === 2 && <ClientsStep api={api} />}
                {api.step === 3 && <ServicesStep api={api} />}
                {api.step === 4 && <TeamStep api={api} />}
              </StepBody>
            </div>
            <FlowNav api={api} finishLabel="Create workspace" divider={false} />
          </FlowCard>
          <ChangeTypeLink type="agency" />
        </div>
        <div className="space-y-5">
          <div className="hidden items-center gap-4 rounded-[20px] border border-cf-line bg-white/80 p-5 shadow-cf-card lg:flex">
            <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue"><Users size={30} /></span>
            <div><p className="text-[18px] font-semibold text-cf-ink">Built for agencies</p><p className="text-[15px] leading-snug text-cf-muted">Manage multiple clients, campaigns and teams from one place.</p></div>
          </div>
          <AgencyAside api={api} />
        </div>
      </div>
    </OnboardingFrame>
  )
}

function AgencyStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Agency basics" description="Tell us who you are." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div data-field="agency_name"><TextField size="compact" label="Agency name" autoComplete="organization" placeholder="Your agency name" icon={<Building2 size={19} strokeWidth={1.8} />} value={api.str('agency_name')} onChange={e => api.set('agency_name', e.target.value)} error={api.errors.agency_name} /></div>
        <div data-field="website"><TextField size="compact" label="Website" type="url" inputMode="url" autoComplete="url" placeholder="https://www.youragency.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} /></div>
        <div data-field="team_size"><SelectField size="compact" label="Team size" placeholder="Select team size" icon={<Users size={19} strokeWidth={1.8} />} options={TEAM_SIZES} value={api.str('team_size')} onChange={e => api.set('team_size', e.target.value)} error={api.errors.team_size} /></div>
        <div data-field="region"><SelectField size="compact" label="Main region" placeholder="Where are your clients?" icon={<Globe size={19} strokeWidth={1.8} />} options={REGIONS} value={api.str('region')} onChange={e => api.set('region', e.target.value)} /></div>
        <Field name="description" label="What your agency does (optional)" className="md:col-span-2" error={api.errors.description}>
          <TextArea value={api.str('description')} onChange={v => api.set('description', v)} max={280} placeholder="e.g. Social-first creative agency for DTC brands." />
        </Field>
      </div>
    </>
  )
}

function ClientsStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Client setup" description="Tell us about your clients and how you want to organise their workspaces." />
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-0">
        <div className="md:border-r md:border-cf-line md:pr-6" data-field="client_count">
          <SelectField size="compact" label="Number of clients" placeholder="Select a range" icon={<Users size={19} strokeWidth={1.8} />} options={CLIENT_COUNTS} value={api.str('client_count')} onChange={e => api.set('client_count', e.target.value)} error={api.errors.client_count} hint="How many clients do you typically work with?" />
        </div>
        <Field name="client_model" label="Client workspace setup" hint="How do you want to structure client spaces?" className="md:pl-6" error={api.errors.client_model}>
          <RadioCards name="client_model" options={CLIENT_MODELS} value={api.str('client_model')} onChange={v => api.set('client_model', v)} />
        </Field>
      </div>
      <div className="my-6 h-px bg-cf-line" />
      <Field name="service_lines" label="Service lines" hint="Select the services you offer to clients." error={api.errors.service_lines}>
        <MultiChips variant="trailing" size="sm" options={SERVICE_LINES} value={api.arr('service_lines')} onChange={v => api.set('service_lines', v)} iconFor={v => <span className="text-cf-blue">{SERVICE_ICON[v]?.icon}</span>} />
      </Field>
      <div className="my-6 h-px bg-cf-line" />
      <div className="grid gap-5 md:grid-cols-3">
        <div data-field="approval_workflow"><SelectField size="compact" label="Approval workflow" placeholder="Select" icon={<FileText size={19} strokeWidth={1.8} />} options={APPROVAL_WORKFLOWS} value={api.str('approval_workflow')} onChange={e => api.set('approval_workflow', e.target.value)} error={api.errors.approval_workflow} hint="How do you handle client approvals?" /></div>
        <div data-field="reporting"><SelectField size="compact" label="Reporting preferences" placeholder="Select" icon={<ChartColumn size={19} strokeWidth={1.8} />} options={REPORTING_PREFS} value={api.str('reporting')} onChange={e => api.set('reporting', e.target.value)} error={api.errors.reporting} hint="What do you want to share with clients?" /></div>
        <div data-field="team_roles"><SelectField size="compact" label="Team roles" placeholder="Select" icon={<Users size={19} strokeWidth={1.8} />} options={TEAM_ROLE_MODELS} value={api.str('team_roles')} onChange={e => api.set('team_roles', e.target.value)} error={api.errors.team_roles} hint="Who will manage client work?" /></div>
      </div>
    </>
  )
}

function ServicesStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Services" description="What you deliver and how you price it." />
      <div className="mt-6 space-y-6">
        <Field name="deliverable_types" label="What you deliver" required error={api.errors.deliverable_types}>
          <MultiChips options={AGENCY_DELIVERABLES} value={api.arr('deliverable_types')} onChange={v => api.set('deliverable_types', v)} />
        </Field>
        <Field name="client_industries" label="Client industries (optional)">
          <MultiChips options={INDUSTRIES.filter(i => i.value !== 'Other')} value={api.arr('client_industries')} onChange={v => api.set('client_industries', v)} />
        </Field>
        <div data-field="pricing_model" className="max-w-md"><SelectField size="compact" label="Pricing model" placeholder="Select how you charge" options={PRICING_MODELS} value={api.str('pricing_model')} onChange={e => api.set('pricing_model', e.target.value)} error={api.errors.pricing_model} /></div>
      </div>
    </>
  )
}

function TeamStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Invite your team" description="Add account managers and teammates now — or later from Settings › Team." />
      <div className="mt-6"><InviteEditor api={api} /></div>
    </>
  )
}

function Row({ icon, title, children, aside }: { icon: React.ReactNode; title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cf-tint-2 text-cf-blue">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><p className="text-[15px] font-semibold text-cf-ink">{title}</p>{aside && <span className="text-[13px] text-cf-muted">{aside}</span>}</div>
        {children}
      </div>
    </div>
  )
}

function AgencyAside({ api }: { api: FlowApi }) {
  const services = api.arr('service_lines')
  const name = api.str('agency_name')
  return (
    <aside aria-label="Agency setup summary">
      <div className="rounded-[22px] border border-cf-line-strong/70 bg-white p-5 shadow-cf-card sm:p-6 lg:sticky lg:top-6">
        <h2 className="text-[22px] font-bold tracking-tight text-cf-ink">Your agency setup</h2>
        <p className="mt-1 text-[15px] text-cf-muted">Here’s what you’ve configured so far.</p>
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-cf-surface p-4">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cf-tint-2 text-cf-blue"><Building2 size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-cf-ink">{name || 'Your agency'} <span className="rounded-full bg-cf-tint-2 px-2 py-0.5 text-[11px] font-medium text-cf-blue">Agency</span></p>
            {api.str('website') && <p className="flex items-center gap-1 truncate text-[13px] text-cf-blue">{api.str('website').replace(/^https?:\/\//, '')} <ExternalLink size={12} aria-hidden /></p>}
            <p className="mt-0.5 text-[13px] text-cf-muted">{api.str('client_count') || 'Client count not set'}</p>
          </div>
          {api.step !== 1 && <button type="button" onClick={() => api.goTo(1)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cf-line-strong bg-white px-3 text-[14px] font-medium text-cf-blue"><Pencil size={13} aria-hidden /> Edit</button>}
        </div>
        <div className="mt-2 divide-y divide-cf-line">
          <Row icon={<Layers size={16} />} title="Client spaces" aside={api.str('client_count') || '—'}>
            <p className="mt-0.5 text-[13px] text-cf-muted">{api.str('client_model') ? optionLabel(CLIENT_MODELS, api.str('client_model')) : 'Choose how to organise clients'} · you’ll add clients after setup</p>
          </Row>
          <Row icon={<Settings size={16} />} title="Service setup" aside={`${services.length} service${services.length === 1 ? '' : 's'}`}>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {services.length ? services.map(s => <span key={s} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium', SERVICE_ICON[s]?.chip)}>{SERVICE_ICON[s]?.icon}{s}</span>) : <span className="text-[13px] text-cf-muted">No services selected</span>}
            </div>
          </Row>
          <Row icon={<Settings size={16} />} title="Workflow" aside={api.str('approval_workflow') || '—'} />
          <Row icon={<ChartColumn size={16} />} title="Reporting" aside={api.str('reporting') || '—'} />
          <Row icon={<Users size={16} />} title="Team" aside={api.str('team_roles') || '—'} />
        </div>
        <div className="mt-3 border-t border-cf-line pt-4">
          <div className="flex items-center justify-between"><p className="text-[15px] font-semibold text-cf-ink">Preview: your agency workspace</p><span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-medium text-cf-body">Example</span></div>
          <div aria-hidden className="mt-3 flex overflow-hidden rounded-xl border border-cf-line">
            <div className="hidden w-[92px] shrink-0 space-y-1 bg-cf-surface p-2 text-[9px] text-cf-body sm:block">
              <p className="mb-1.5 flex items-center gap-1 font-semibold text-cf-blue"><Image src="/caption fox favicon.png" alt="" width={12} height={12} className="rounded-sm" />Caption Fox</p>
              {['Home', 'Clients', 'Campaigns', 'Content', 'Reporting', 'Team', 'Settings'].map(i => <p key={i} className={cn('rounded px-1.5 py-1', i === 'Clients' && 'bg-cf-tint-2 font-medium text-cf-blue')}>{i}</p>)}
            </div>
            <div className="min-w-0 flex-1 p-2.5">
              <div className="flex items-center justify-between"><p className="text-[12px] font-semibold text-cf-ink">Clients</p><span className="inline-flex items-center gap-1 rounded bg-cf-blue px-1.5 py-0.5 text-[9px] font-medium text-white"><Plus size={9} />Add client</span></div>
              {[['A', 'Acme Co.', '12 campaigns'], ['L', 'Lumen', '8 campaigns'], ['P', 'Peak Fitness', '6 campaigns']].map(([i, n, c]) => (
                <div key={n} className="mt-1.5 flex items-center gap-2 rounded-md border border-cf-line px-1.5 py-1 text-[9.5px]">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-cf-tint-2 font-bold text-cf-blue">{i}</span>
                  <span className="flex-1 font-medium text-cf-ink">{n}</span><span className="text-cf-muted">{c}</span>
                  <span className="rounded-full bg-[#E7F8EF] px-1 text-[8.5px] text-[#15803D]">Active</span>
                </div>
              ))}
              <p className="mt-1.5 flex items-center gap-1 text-[9px] text-cf-muted"><Video size={9} /> Sample clients for illustration</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
