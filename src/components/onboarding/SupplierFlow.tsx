'use client'

import { Building2, CalendarClock, Clock, Eye, FileText, Globe, Hourglass, LayoutGrid, Link2, MapPin, MessageSquare, Plus, Rocket, Video } from 'lucide-react'
import { Checkbox, FormAlert, SelectField, TextField } from '@/components/auth/fields'
import {
  CAPACITY, CONTACT_PREFS, COUNTRIES, DELIVERABLES, LEAD_TIMES, REGIONS, SERVICE_CATEGORIES, SUPPLIER_TYPES, TURNAROUND, optionLabel,
  type UploadRef,
} from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import {
  ChangeTypeLink, Field, FlowCard, FlowNav, MultiChips, OnboardingFrame, PageIntro, ProgressRing, StepBody, StepHeading, Stepper, TagSelect,
  TextArea, UploadDrop, UploadError, UploadThumbs, useUploader,
} from './ui'
import { useOnboardingFlow, type FlowApi, type FlowProps } from './useOnboardingFlow'

export default function SupplierFlow(props: FlowProps) {
  const api = useOnboardingFlow(props)
  return (
    <OnboardingFrame>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_456px] xl:gap-6">
        <div className="min-w-0">
          <PageIntro
            eyebrow="Supplier onboarding"
            title={<>Set up your <span className="text-cf-blue sm:block">supplier profile.</span></>}
            intro="Tell us about your company, the services you offer and showcase your work. Get discovered by brands looking for creative partners."
            className="max-w-[640px]"
          />
          <Stepper api={api} variant="line" dense indent className="mt-5" />
          <FlowCard className="mt-3 sm:!px-5 sm:!pt-5">
            <StepBody api={api}>
              {api.step === 1 && <CompanyStep api={api} />}
              {api.step === 2 && <ServicesStep api={api} />}
              {api.step === 3 && <PortfolioStep api={api} />}
              {api.step === 4 && <AvailabilityStep api={api} />}
            </StepBody>
            <FlowNav api={api} finishLabel="Create supplier profile" />
          </FlowCard>
          <ChangeTypeLink type="supplier" />
        </div>
        <div>
          <p aria-hidden className="mb-4 hidden -rotate-[8deg] text-center font-[family-name:var(--font-hand)] text-[22px] leading-tight text-cf-body lg:block">More opportunities.<br />Brighter collaborations.</p>
          <SupplierAside api={api} />
        </div>
      </div>
    </OnboardingFrame>
  )
}

function CompanyStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading icon={<Building2 size={26} />} title="Company details" description="Basic information brands will see on your profile." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div data-field="company_name"><TextField size="compact" label={<>Company name <span aria-hidden className="text-[#E5484D]">*</span></>} autoComplete="organization" placeholder="Your company name" value={api.str('company_name')} onChange={e => api.set('company_name', e.target.value)} error={api.errors.company_name} /></div>
        <div data-field="supplier_type"><SelectField size="compact" label={<>Supplier type <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="What best describes you?" options={SUPPLIER_TYPES} value={api.str('supplier_type')} onChange={e => api.set('supplier_type', e.target.value)} error={api.errors.supplier_type} /></div>
        <div data-field="website"><TextField size="compact" label="Website" type="url" inputMode="url" autoComplete="url" placeholder="https://www.yourcompany.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} /></div>
        <div data-field="country"><SelectField size="compact" label={<>Country <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Select a country" autoComplete="country-name" icon={<Globe size={19} strokeWidth={1.8} />} options={COUNTRIES} value={api.str('country')} onChange={e => api.set('country', e.target.value)} error={api.errors.country} /></div>
        <div data-field="location" className="md:col-span-2"><TextField size="compact" label="City / location" autoComplete="address-level2" placeholder="e.g. Bristol, UK" icon={<MapPin size={19} strokeWidth={1.8} />} value={api.str('location')} onChange={e => api.set('location', e.target.value)} error={api.errors.location} /></div>
        <Field name="description" label="Company description" required className="md:col-span-2" error={api.errors.description}>
          <TextArea value={api.str('description')} onChange={v => api.set('description', v)} max={600} placeholder="What you do, who you work with and what makes your work stand out." />
        </Field>
      </div>
    </>
  )
}

function ServicesStep({ api }: { api: FlowApi }) {
  const portfolio = useUploader(api, 'portfolio')
  return (
    <>
      <StepHeading icon={<LayoutGrid size={26} />} title="Your services" description="Tell us what you do and how you can help brands." />
      <div className="mt-4 grid gap-x-5 gap-y-4 md:grid-cols-2">
        <div data-field="company_name"><TextField size="compact" label={<>Company name <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Your company name" value={api.str('company_name')} onChange={e => api.set('company_name', e.target.value)} error={api.errors.company_name} /></div>
        <div data-field="website"><TextField size="compact" label="Website" type="url" inputMode="url" placeholder="https://www.yourcompany.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} /></div>
        <Field name="service_categories" label="Service categories" required hint="Select all that apply." error={api.errors.service_categories}>
          <MultiChips size="sm" chipClassName="!gap-1.5 !px-2 !text-[13.5px] sm:!min-h-9" options={SERVICE_CATEGORIES} value={api.arr('service_categories')} onChange={v => api.set('service_categories', v)} />
        </Field>
        <Field name="regions_served" label="Regions served" required hint="Where do you work with clients?" error={api.errors.regions_served}>
          <TagSelect label="Regions" options={REGIONS} value={api.arr('regions_served')} onChange={v => api.set('regions_served', v)} icon={<Globe size={20} />} />
        </Field>
        <Field name="deliverables" label="Typical deliverables" hint="What do you deliver to clients?">
          <TagSelect label="Deliverables" options={DELIVERABLES} value={api.arr('deliverables')} onChange={v => api.set('deliverables', v)} icon={<FileText size={20} />} />
        </Field>
        <Field name="portfolio" label="Portfolio" hint="Upload a few examples of your work (image or video)." error={api.errors.portfolio}>
          <div className="flex flex-wrap gap-2.5">
            <UploadThumbs uploader={portfolio} previews={api.previews} size="lg" />
            <UploadDrop uploader={portfolio} title="Upload" subtitle="JPG, PNG, WebP or MP4" icon={<Plus size={22} className="text-cf-blue" />} className="h-[90px] w-[96px]" compact />
          </div>
          <UploadError uploader={portfolio} />
        </Field>
        <div data-field="turnaround_hours"><SelectField size="compact" label={<>Typical turnaround time <span aria-hidden className="text-[#E5484D]">*</span></>} placeholder="Select turnaround" icon={<Clock size={19} strokeWidth={1.8} />} options={TURNAROUND} value={api.str('turnaround_hours')} onChange={e => api.set('turnaround_hours', e.target.value)} error={api.errors.turnaround_hours} hint="How quickly can you deliver after a project is confirmed?" /></div>
      </div>
    </>
  )
}

function PortfolioStep({ api }: { api: FlowApi }) {
  const portfolio = useUploader(api, 'portfolio')
  const services = api.arr('service_categories')
  const updateItem = (path: string, patch: Partial<UploadRef>) => api.set('portfolio', portfolio.items.map(i => (i.path === path ? { ...i, ...patch } : i)))
  return (
    <>
      <StepHeading icon={<Eye size={26} />} title="Portfolio" description="Showcase your best work and link it to the services you offer." />
      <div className="mt-6 space-y-5">
        <Field name="portfolio" label="Portfolio examples" hint="Add a caption and the service each example shows." error={api.errors.portfolio}>
          <ul className="space-y-3">
            {portfolio.items.map(item => (
              <li key={item.path} className="flex flex-col gap-3 rounded-xl border border-cf-line p-3 sm:flex-row sm:items-center">
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.type.startsWith('image/') && api.previews[item.path] ? <img src={api.previews[item.path]} alt={item.name} className="h-16 w-16 rounded-lg object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-cf-surface text-cf-muted"><Video size={20} aria-hidden /><span className="sr-only">{item.name}</span></span>}
                </div>
                <label className="sr-only" htmlFor={`cap-${item.path}`}>Caption for {item.name}</label>
                <input id={`cap-${item.path}`} value={item.caption ?? ''} maxLength={140} onChange={e => updateItem(item.path, { caption: e.target.value })} placeholder="Caption, e.g. Launch film for Vertex" className="h-11 min-w-0 flex-1 rounded-[10px] border border-cf-line-strong px-3 text-[15px] focus:border-cf-blue focus:outline-none focus:ring-4 focus:ring-cf-blue/12" />
                <label className="sr-only" htmlFor={`svc-${item.path}`}>Service for {item.name}</label>
                <select id={`svc-${item.path}`} value={item.service ?? ''} onChange={e => updateItem(item.path, { service: e.target.value })} className="h-11 rounded-[10px] border border-cf-line-strong bg-white px-3 text-[15px] focus:border-cf-blue focus:outline-none">
                  <option value="">Service…</option>
                  {services.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => void portfolio.remove(item.path)} className="h-11 rounded-[10px] px-3 text-[14px] font-medium text-[#C62828] hover:bg-[#FFF5F5]">Remove</button>
              </li>
            ))}
          </ul>
          <UploadDrop uploader={portfolio} title="Add portfolio examples" subtitle={`JPG, PNG, WebP or MP4 up to 25 MB · ${portfolio.items.length}/8`} icon={<Plus size={22} className="text-cf-blue" />} className={cn(portfolio.items.length > 0 && 'mt-3')} />
          <UploadError uploader={portfolio} />
        </Field>
        <div data-field="portfolio_link"><TextField size="compact" label="External portfolio link (optional)" type="url" inputMode="url" placeholder="https://behance.net/yourstudio" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('portfolio_link')} onChange={e => api.set('portfolio_link', e.target.value)} error={api.errors.portfolio_link} /></div>
        <div data-field="headline"><TextField size="compact" label="Profile headline (optional)" placeholder="e.g. Creative production and content for modern brands" maxLength={140} value={api.str('headline')} onChange={e => api.set('headline', e.target.value)} error={api.errors.headline} /></div>
      </div>
    </>
  )
}

function AvailabilityStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading icon={<CalendarClock size={26} />} title="Availability" description="Let brands know when and how you can deliver." />
      <div className="mt-6 space-y-5">
        <div data-field="available_now"><Checkbox checked={api.data.available_now === true} onChange={e => api.set('available_now', e.target.checked)} label="I’m available for new projects now" /></div>
        <div className="grid gap-5 md:grid-cols-3">
          <div data-field="lead_time_days"><SelectField size="compact" label="Lead time" placeholder="Select" icon={<Hourglass size={19} strokeWidth={1.8} />} options={LEAD_TIMES} value={api.str('lead_time_days')} onChange={e => api.set('lead_time_days', e.target.value)} error={api.errors.lead_time_days} /></div>
          <div data-field="capacity"><SelectField size="compact" label="Capacity" placeholder="Select" icon={<LayoutGrid size={19} strokeWidth={1.8} />} options={CAPACITY} value={api.str('capacity')} onChange={e => api.set('capacity', e.target.value)} error={api.errors.capacity} /></div>
          <div data-field="contact_preference"><SelectField size="compact" label="Contact preference" placeholder="Select" icon={<MessageSquare size={19} strokeWidth={1.8} />} options={CONTACT_PREFS} value={api.str('contact_preference')} onChange={e => api.set('contact_preference', e.target.value)} error={api.errors.contact_preference} /></div>
        </div>
        <div data-field="publish_profile" className="rounded-2xl border border-cf-line bg-cf-surface/60 p-4">
          <Checkbox checked={api.data.publish_profile === true} onChange={e => api.set('publish_profile', e.target.checked)} label={<span><strong className="font-semibold text-cf-ink">Publish my profile to the Caption Fox marketplace now</strong><span className="mt-0.5 block text-[14px] text-cf-muted">Leave unticked to keep it private while you add listings. You can publish or pause it any time.</span></span>} />
        </div>
        <FormAlert tone="info">New supplier profiles show as <strong>Pending verification</strong> until our marketplace team reviews them. Verification can’t be self-applied.</FormAlert>
      </div>
    </>
  )
}

function SupplierAside({ api }: { api: FlowApi }) {
  const services = api.arr('service_categories')
  const regions = api.arr('regions_served')
  const turnaround = optionLabel(TURNAROUND, api.str('turnaround_hours'))
  const name = api.str('company_name')
  const portfolio = (Array.isArray(api.data.portfolio) ? api.data.portfolio : []) as UploadRef[]
  const imgs = portfolio.filter(p => p.type.startsWith('image/') && api.previews[p.path])
  const edit = (n: number) => (n <= api.maxStep && n !== api.step ? <button type="button" onClick={() => api.goTo(n)} className="min-h-9 rounded-md px-2 text-[14px] font-medium text-cf-blue hover:bg-cf-tint">Edit</button> : null)
  return (
    <aside aria-label="Supplier profile summary">
      <div className="rounded-[22px] border border-cf-line-strong/70 bg-white p-5 shadow-cf-card sm:p-6 lg:sticky lg:top-6">
        <div className="flex items-center gap-5">
          <ProgressRing value={api.percent} size={100} label="Supplier profile completion" />
          <div><h2 className="text-[18px] font-semibold text-cf-ink">Supplier profile completion</h2><p className="mt-1 text-[14px] leading-snug text-cf-muted">Complete your profile to get discovered by brands and start receiving opportunities.</p></div>
        </div>
        <div className="mt-5 divide-y divide-cf-line rounded-2xl border border-cf-line px-4">
          <div className="py-4">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[16px] font-semibold text-cf-ink"><LayoutGrid size={19} aria-hidden className="text-cf-blue" /> Selected services</p>{edit(2)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{services.length ? services.map(s => <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-cf-tint px-3 py-1.5 text-[14px] text-cf-blue"><span aria-hidden className="h-3.5 w-3.5 rounded-full bg-cf-blue" />{s}</span>) : <span className="text-[14px] text-cf-muted">None selected yet</span>}</div>
          </div>
          <div className="py-4">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[16px] font-semibold text-cf-ink"><Globe size={19} aria-hidden className="text-cf-blue" /> Regions served</p>{edit(2)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{regions.length ? regions.map(r => <span key={r} className="rounded-lg bg-[#EEF2F7] px-3 py-1.5 text-[14px] text-cf-ink">{r}</span>) : <span className="text-[14px] text-cf-muted">None selected yet</span>}</div>
          </div>
          <div className="py-4">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[16px] font-semibold text-cf-ink"><Clock size={19} aria-hidden className="text-cf-blue" /> Turnaround time</p>{edit(2)}</div>
            <p className="mt-3">{turnaround ? <span className="rounded-lg bg-[#EEF2F7] px-3 py-1.5 text-[14px] text-cf-ink">{turnaround}</span> : <span className="text-[14px] text-cf-muted">Not set</span>}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-cf-tint-2 text-cf-blue"><Eye size={21} /></span>
          <div><p className="text-[16px] font-semibold text-cf-ink">Profile preview</p><p className="text-[14px] text-cf-muted">This is how you’ll appear in the Caption Fox marketplace.</p></div>
        </div>
        <div className="mt-3 rounded-2xl border border-cf-line p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[12px] font-bold tracking-wide text-white">{(name || 'You').slice(0, 4).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-cf-ink">{name || 'Your company'}<span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4E0] px-2 py-0.5 text-[11px] font-medium text-[#B45309]"><Hourglass size={11} aria-hidden /> Pending verification</span></p>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-cf-muted">{api.str('headline') || api.str('description') || 'Your headline will appear here.'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {services.slice(0, 3).map(s => <span key={s} className="rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[12px] text-cf-body">{s}</span>)}
                {services.length > 3 && <span className="rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[12px] text-cf-body">+{services.length - 3}</span>}
              </div>
              <p className="mt-2 flex flex-wrap gap-4 text-[12px] text-cf-muted"><span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{regions.includes('Global') ? 'Global' : api.str('country') || 'Location'}</span>{turnaround && <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden />{turnaround}</span>}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {imgs.slice(0, 4).map((p, i) => (
              <span key={p.path} className="relative block aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.previews[p.path]} alt="" className="h-full w-full object-cover" />
                {i === 3 && imgs.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[14px] font-semibold text-white">+{imgs.length - 3}</span>}
              </span>
            ))}
            {imgs.length === 0 && [0, 1, 2, 3].map(i => <span key={i} aria-hidden className="block aspect-square rounded-lg bg-gradient-to-br from-cf-tint to-cf-tint-2" />)}
          </div>
        </div>
        {api.step === 4 && <p className="mt-4 flex items-center gap-2 text-[13px] text-cf-muted"><Rocket size={15} aria-hidden className="text-cf-blue" /> {api.data.publish_profile ? 'Your profile will be listed as soon as you finish.' : 'Your profile stays private until you publish it.'}</p>}
      </div>
    </aside>
  )
}
