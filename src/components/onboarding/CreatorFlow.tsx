'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Bell, CalendarDays, ChartColumn, ChevronRight, Globe, Image as ImageIcon, MapPin, MonitorPlay, Plus, User, Users, Video } from 'lucide-react'
import { Checkbox, SelectField, TextField } from '@/components/auth/fields'
import { BrandGlyph } from '@/components/auth/BrandGlyph'
import { AUDIENCE_FOCUS, COLLAB_TYPES, CONTENT_CATEGORIES, CONTENT_FORMATS, CREATOR_TYPES, PLATFORMS, POSTING_FREQUENCY, optionLabel } from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import {
  ChangeTypeLink, CheckChip, Field, FlowCard, FlowNav, HeaderProgress, MultiChips, OnboardingFrame, PageIntro, ProgressBar, RadioCards,
  StepBody, StepHeading, Stepper, TextArea, UploadDrop, UploadError, UploadThumbs, useUploader,
} from './ui'
import { ReviewSection } from './ReviewList'
import { useOnboardingFlow, type FlowApi, type FlowProps } from './useOnboardingFlow'

const FEATURED = ['instagram', 'tiktok', 'youtube', 'x']
const labels = (options: { value: string; label: string }[], values: string[]) => values.map(v => optionLabel(options, v)).join(', ')

export default function CreatorFlow(props: FlowProps) {
  const api = useOnboardingFlow(props)
  return (
    <OnboardingFrame headerRight={<HeaderProgress step={api.step} label="Creator Onboarding" />}>
      <PageIntro
        eyebrow="Creator onboarding"
        title={<>Set up your <span className="text-cf-blue">creator workspace</span></>}
        intro="Tell us about your channels so we can match you with the right brand opportunities."
      />
      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <Stepper api={api} variant="inline" />
          <FlowCard className="mt-7">
            <StepBody api={api}>
              {api.step === 1 && <ProfileStep api={api} />}
              {api.step === 2 && <ChannelsStep api={api} />}
              {api.step === 3 && <ContentStep api={api} />}
              {api.step === 4 && <ReviewStep api={api} />}
            </StepBody>
            <FlowNav api={api} finishLabel="Create workspace" />
          </FlowCard>
          <ChangeTypeLink type="creator" />
        </div>
        <CreatorAside api={api} />
      </div>
    </OnboardingFrame>
  )
}

function ProfileStep({ api }: { api: FlowApi }) {
  const avatar = useUploader(api, 'avatar')
  return (
    <>
      <StepHeading title="About you" description="Tell us what kind of creator you are." />
      <div className="mt-6 space-y-5">
        <Field name="creator_type" label="Creator type" required error={api.errors.creator_type}>
          <RadioCards name="creator_type" options={CREATOR_TYPES} value={api.str('creator_type')} onChange={v => api.set('creator_type', v)} />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <div data-field="location"><TextField size="compact" label="Location" autoComplete="address-level2" placeholder="e.g. Manchester, UK" icon={<MapPin size={19} strokeWidth={1.8} />} value={api.str('location')} onChange={e => api.set('location', e.target.value)} error={api.errors.location} /></div>
          <div data-field="website"><TextField size="compact" label="Website or portfolio" type="url" inputMode="url" autoComplete="url" placeholder="https://yoursite.com" icon={<Globe size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} /></div>
        </div>
        <Field name="bio" label="Short bio" hint="A line or two brands will see on your profile." error={api.errors.bio}>
          <TextArea value={api.str('bio')} onChange={v => api.set('bio', v)} max={280} placeholder="I make short-form beauty and lifestyle content for Gen Z audiences." />
        </Field>
        <Field name="avatar" label="Profile photo" hint="PNG, JPG or WebP up to 5 MB. Optional.">
          <div className="flex flex-wrap items-center gap-3">
            <UploadThumbs uploader={avatar} previews={api.previews} size="lg" />
            {avatar.items.length === 0 && <UploadDrop uploader={avatar} title="Upload photo" subtitle="PNG, JPG or WebP" icon={<ImageIcon size={22} />} className="w-[180px]" compact />}
          </div>
          <UploadError uploader={avatar} />
        </Field>
      </div>
    </>
  )
}

function ChannelsStep({ api }: { api: FlowApi }) {
  const others = api.arr('other_channels')
  const [showAll, setShowAll] = useState(others.some(v => !FEATURED.includes(v)))
  const visible = showAll ? PLATFORMS : PLATFORMS.filter(p => FEATURED.includes(p.value))
  const categories = api.arr('content_categories')
  const categoryOptions = [...CONTENT_CATEGORIES, ...categories.filter(c => !CONTENT_CATEGORIES.some(o => o.value === c)).map(c => ({ value: c, label: c }))]
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')
  const primary = api.str('primary_platform')

  function addCustom() {
    const v = custom.trim().slice(0, 40)
    if (v && !categories.some(c => c.toLowerCase() === v.toLowerCase()) && categories.length < 12) api.set('content_categories', [...categories, v])
    setCustom('')
    setAdding(false)
  }

  return (
    <>
      <StepHeading title="Your channels" description="Add the platforms you create on and tell us what you focus on." />
      <div className="mt-6 space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div data-field="display_name"><TextField size="compact" label="Display name" autoComplete="nickname" placeholder="Your creator name" icon={<User size={19} strokeWidth={1.8} />} value={api.str('display_name')} onChange={e => api.set('display_name', e.target.value)} error={api.errors.display_name} hint="This is how brands will see you." /></div>
          <div data-field="primary_platform"><SelectField size="compact" label="Primary platform" placeholder="Select a platform" icon={primary ? <BrandGlyph platform={primary} size={20} /> : <MonitorPlay size={19} strokeWidth={1.8} />} options={PLATFORMS} value={primary} onChange={e => api.set('primary_platform', e.target.value)} error={api.errors.primary_platform} hint="Your main platform for brand opportunities." /></div>
        </div>
        <Field name="other_channels" label="Other channels (optional)" hint="Select all platforms where you create content. You’ll connect accounts securely after setup.">
          <div className="flex flex-wrap gap-2.5">
            {visible.map(p => {
              const on = others.includes(p.value)
              return (
                <CheckChip key={p.value} variant="plain" checked={on} icon={<BrandGlyph platform={p.value} size={22} />} onChange={() => api.set('other_channels', on ? others.filter(v => v !== p.value) : [...others, p.value])}>{p.label}</CheckChip>
              )
            })}
            {!showAll && (
              <button type="button" onClick={() => setShowAll(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-cf-line-strong px-4 text-[15px] text-cf-body hover:border-cf-blue/40"><Plus size={18} aria-hidden /> Add more</button>
            )}
          </div>
        </Field>
        <div className="grid gap-6 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <div data-field="audience_focus"><SelectField size="compact" label="Audience focus" placeholder="Select an audience" icon={<Users size={19} strokeWidth={1.8} />} options={AUDIENCE_FOCUS} value={api.str('audience_focus')} onChange={e => api.set('audience_focus', e.target.value)} error={api.errors.audience_focus} hint="Helps us match you with relevant brands." /></div>
            <div data-field="posting_frequency"><SelectField size="compact" label="Posting frequency" placeholder="How often do you post?" icon={<CalendarDays size={19} strokeWidth={1.8} />} options={POSTING_FREQUENCY} value={api.str('posting_frequency')} onChange={e => api.set('posting_frequency', e.target.value)} error={api.errors.posting_frequency} hint="This helps brands understand your availability." /></div>
          </div>
          <Field name="content_categories" label="Content categories" required error={api.errors.content_categories}>
            <div className="flex flex-wrap gap-2.5">
              <MultiChips options={categoryOptions} value={categories} onChange={v => api.set('content_categories', v)} />
              {adding ? (
                <span className="inline-flex items-center gap-1.5">
                  <label className="sr-only" htmlFor="custom-category">New category</label>
                  <input id="custom-category" autoFocus value={custom} maxLength={40} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } if (e.key === 'Escape') setAdding(false) }} className="h-11 w-36 rounded-[10px] border border-cf-blue px-3 text-[15px] focus:outline-none focus:ring-4 focus:ring-cf-blue/12" placeholder="e.g. Gaming" />
                  <button type="button" onClick={addCustom} className="h-11 rounded-[10px] bg-cf-blue px-3 text-[14px] font-medium text-white">Add</button>
                </span>
              ) : categories.length < 12 && (
                <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-cf-line-strong px-3.5 text-[15px] text-cf-body hover:border-cf-blue/40"><Plus size={18} aria-hidden /> Add another</button>
              )}
            </div>
          </Field>
        </div>
      </div>
    </>
  )
}

function ContentStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Your content" description="What you create and how you like to work with brands." />
      <div className="mt-6 space-y-6">
        <Field name="content_formats" label="Formats you create" required error={api.errors.content_formats}>
          <MultiChips options={CONTENT_FORMATS} value={api.arr('content_formats')} onChange={v => api.set('content_formats', v)} />
        </Field>
        <Field name="collab_types" label="How you work with brands" required error={api.errors.collab_types}>
          <MultiChips options={COLLAB_TYPES} value={api.arr('collab_types')} onChange={v => api.set('collab_types', v)} />
        </Field>
        <Field name="topics" label="Topics you cover (optional)" error={api.errors.topics}>
          <TextArea value={api.str('topics')} onChange={v => api.set('topics', v)} max={280} placeholder="e.g. sustainable fashion, budget travel, home workouts" />
        </Field>
        <div data-field="ugc_available">
          <Checkbox checked={api.data.ugc_available === true} onChange={e => api.set('ugc_available', e.target.checked)} label="I’m available for UGC briefs (content brands post on their own channels)" />
        </div>
      </div>
    </>
  )
}

function ReviewStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Review and go live" description="Check your details, then create your creator workspace." />
      <div className="mt-6 space-y-4">
        <ReviewSection api={api} title="Profile" step={1} rows={[
          { label: 'Creator type', value: optionLabel(CREATOR_TYPES, api.str('creator_type')) },
          { label: 'Location', value: api.str('location') },
          { label: 'Website', value: api.str('website') },
          { label: 'Bio', value: api.str('bio') },
        ]} />
        <ReviewSection api={api} title="Channels" step={2} rows={[
          { label: 'Display name', value: api.str('display_name') },
          { label: 'Primary platform', value: optionLabel(PLATFORMS, api.str('primary_platform')) },
          { label: 'Other channels', value: labels(PLATFORMS, api.arr('other_channels')) },
          { label: 'Audience focus', value: api.str('audience_focus') },
          { label: 'Content categories', value: api.arr('content_categories').join(', ') },
          { label: 'Posting frequency', value: api.str('posting_frequency') },
        ]} />
        <ReviewSection api={api} title="Content" step={3} rows={[
          { label: 'Formats', value: api.arr('content_formats').join(', ') },
          { label: 'Collaborations', value: api.arr('collab_types').join(', ') },
          { label: 'Topics', value: api.str('topics') },
          { label: 'UGC briefs', value: api.data.ugc_available ? 'Available' : 'Not right now' },
        ]} />
        <p className="text-[14px] leading-snug text-cf-muted">Your workspace starts on the Starter plan — upgrade any time from Billing. Nothing is published publicly until you choose to.</p>
      </div>
    </>
  )
}

const EXAMPLES = [
  { brand: 'Vertex Footwear', brief: 'UGC video series', fee: '£400', age: '2d ago', tone: 'from-[#C9DCFF] to-[#5A8DEB]', icon: Video },
  { brand: 'Lume Skincare', brief: 'Product review', fee: '£250', age: '3d ago', tone: 'from-[#F6E3D6] to-[#D9A88A]', icon: ImageIcon },
  { brand: 'Solara Travel', brief: 'Destination content', fee: '£800', age: '5d ago', tone: 'from-[#9FE3E6] to-[#2A9DB5]', icon: ImageIcon },
]

function CreatorAside({ api }: { api: FlowApi }) {
  const type = CREATOR_TYPES.find(t => t.value === api.str('creator_type'))
  const primary = api.str('primary_platform') || 'instagram'
  const name = api.str('display_name')
  return (
    <aside aria-label="Profile summary and preview" className="lg:-mt-12">
      <div className="rounded-[22px] border border-cf-line-strong/70 bg-white p-5 shadow-cf-card sm:p-7 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between"><h2 className="text-[20px] font-bold tracking-tight text-cf-ink">Profile completion</h2><span className="text-[20px] font-bold text-cf-ink">{api.percent}%</span></div>
        <div className="mt-3"><ProgressBar value={api.percent} label="Profile completion" /></div>
        <div className="mt-5 flex gap-4 rounded-2xl bg-cf-tint p-4 sm:p-5">
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cf-tint-2 text-cf-blue"><Users size={26} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-[14px] text-cf-muted">Creator type</p><p className="text-[17px] font-bold text-cf-ink">{type?.label ?? 'Not chosen yet'}</p></div>
              {api.step !== 1 && <button type="button" onClick={() => api.goTo(1)} className="h-9 rounded-full border border-cf-line-strong bg-white px-4 text-[14px] font-medium text-cf-blue hover:border-cf-blue/50">Edit</button>}
            </div>
            <p className="mt-2 text-[14px] leading-snug text-cf-body">{type?.description ?? 'Choose the type that best describes your work.'}</p>
          </div>
        </div>
        <div className="my-5 h-px bg-cf-line" />
        <h2 className="text-[20px] font-bold tracking-tight text-cf-ink">Preview</h2>
        <p className="text-[15px] text-cf-muted">Here’s a look at your creator workspace.</p>
        <div className="mt-4 rounded-2xl border border-cf-line bg-white p-4" aria-label="Illustrative workspace preview">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Image src="/caption fox favicon.png" alt="" width={26} height={26} className="rounded-md" /><span className="text-[15px] font-semibold text-cf-blue">Caption Fox</span></span>
            <Bell size={17} aria-hidden className="text-cf-body" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-cf-ink">Brand opportunities</p>
            <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-medium text-cf-body">Examples</span>
          </div>
          {name && <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-cf-muted">For {name} · <BrandGlyph platform={primary} size={13} /> {optionLabel(PLATFORMS, primary)}</p>}
          <ul className="mt-3 space-y-2.5">
            {EXAMPLES.map(o => (
              <li key={o.brand} className="flex items-center gap-3 rounded-xl border border-cf-line p-2.5">
                <span aria-hidden className={cn('flex h-14 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white', o.tone)}><o.icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="truncate text-[13px] font-semibold text-cf-ink">{o.brand}</p><span className="shrink-0 text-[11px] text-cf-muted">{o.age}</span></div>
                  <p className="text-[12px] text-cf-muted">{o.brief}</p>
                  <div className="mt-1 flex gap-1.5">
                    <span className="rounded-full bg-[#E7F8EF] px-1.5 py-0.5 text-[10px] font-medium text-[#15803D]">{o.fee}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cf-tint px-1.5 py-0.5 text-[10px] font-medium text-cf-body"><BrandGlyph platform={primary} size={10} />{optionLabel(PLATFORMS, primary)}</span>
                  </div>
                </div>
                <ChevronRight size={16} aria-hidden className="text-cf-muted" />
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex gap-4 rounded-2xl bg-cf-tint p-4">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cf-blue"><ChartColumn size={22} /></span>
          <div><p className="text-[15px] font-semibold text-cf-ink">Get matched with brands</p><p className="mt-0.5 text-[14px] leading-snug text-cf-body">Complete your setup to build your creator profile and start receiving briefs.</p></div>
        </div>
      </div>
    </aside>
  )
}
