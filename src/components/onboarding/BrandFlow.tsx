'use client'

import { BookOpen, Building2, Feather, FileText, Gem, Image as ImageIcon, Link2, Smile, Sparkles, Users, Zap, CalendarDays } from 'lucide-react'
import { FormAlert, SelectField, TextField } from '@/components/auth/fields'
import { BrandGlyph } from '@/components/auth/BrandGlyph'
import { AUDIENCE_PRIORITIES, BRAND_CHANNELS, BRAND_GOALS, CADENCES, INDUSTRIES, TONES, type UploadRef } from '@/lib/onboarding/schema'
import { cn } from '@/lib/utils'
import {
  ChangeTypeLink, ColorSwatches, Field, FlowCard, FlowNav, MultiChips, OnboardingFrame, PageIntro, StepBody, StepHeading, Stepper, TextArea,
  UploadDrop, UploadError, UploadThumbs, useUploader,
} from './ui'
import { useOnboardingFlow, type FlowApi, type FlowProps } from './useOnboardingFlow'

const TONE_ICON: Record<string, React.ReactNode> = {
  Bold: <Zap size={19} />, Playful: <Smile size={19} />, Premium: <Gem size={19} />, Informative: <BookOpen size={19} />, Minimal: <Feather size={19} />,
}

export default function BrandFlow(props: FlowProps) {
  const api = useOnboardingFlow(props)
  return (
    <OnboardingFrame>
      <Stepper api={api} variant="pill" className="-mt-1 mb-6 lg:-mt-2" />
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_446px] xl:gap-8">
        <div className="min-w-0">
          <PageIntro
            eyebrow="Brand onboarding"
            title={<>Build your brand <span className="text-cf-blue">workspace.</span></>}
            intro="Tell us about your brand, add key details and assets, and we’ll set up your workspace for smarter, on-brand content from day one."
          />
          <FlowCard className="mt-5">
            <StepBody api={api}>
              {api.step === 1 && <BrandStep api={api} />}
              {api.step === 2 && <VoiceStep api={api} />}
              {api.step === 3 && <GoalsStep api={api} />}
              {api.step === 4 && <ChannelsStep api={api} />}
            </StepBody>
            <FlowNav api={api} finishLabel="Create workspace" backStyle="plain" divider={false} />
          </FlowCard>
          <ChangeTypeLink type="brand" />
        </div>
        <BrandKitPreview api={api} />
      </div>
    </OnboardingFrame>
  )
}

function NameWebsite({ api }: { api: FlowApi }) {
  return (
    <>
      <div data-field="brand_name"><TextField size="compact" label="Brand name" autoComplete="organization" placeholder="Your brand name" icon={<Building2 size={19} strokeWidth={1.8} />} value={api.str('brand_name')} onChange={e => api.set('brand_name', e.target.value)} error={api.errors.brand_name} hint="This will be used across your workspace." /></div>
      <div data-field="website"><TextField size="compact" label="Website" type="url" inputMode="url" autoComplete="url" placeholder="https://www.yourbrand.com" icon={<Link2 size={19} strokeWidth={1.8} />} value={api.str('website')} onChange={e => api.set('website', e.target.value)} error={api.errors.website} hint="Help us learn about your brand." /></div>
    </>
  )
}

function BrandStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Brand basics" description="The essentials we’ll use across your workspace." />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <NameWebsite api={api} />
        <div data-field="industry"><SelectField size="compact" label="Industry" placeholder="Select your industry" options={INDUSTRIES} value={api.str('industry')} onChange={e => api.set('industry', e.target.value)} error={api.errors.industry} /></div>
        <Field name="description" label="Brand description (optional)" className="md:col-span-2" error={api.errors.description}>
          <TextArea value={api.str('description')} onChange={v => api.set('description', v)} max={280} placeholder="What does your brand make or do, and for whom?" />
        </Field>
      </div>
    </>
  )
}

function VoiceStep({ api }: { api: FlowApi }) {
  const logo = useUploader(api, 'logo')
  const assets = useUploader(api, 'brand_assets')
  const tone = api.str('tone')
  return (
    <>
      <StepHeading title="Voice & Assets" description="Define how your brand sounds and looks." />
      <div className="mt-4 space-y-3.5">
        <div className="grid gap-5 md:grid-cols-2"><NameWebsite api={api} /></div>
        <Field name="tone" label="Tone of voice" info="Fox AI uses this to write on-brand captions." error={api.errors.tone}>
          <div role="radiogroup" aria-label="Tone of voice" className="flex flex-wrap gap-2.5">
            {TONES.map(t => (
              <label key={t.value} className={cn('inline-flex h-11 min-w-[110px] cursor-pointer sm:h-10 items-center justify-center gap-2.5 rounded-[10px] border px-4 text-[15px] transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20 sm:min-w-[122px]', tone === t.value ? 'border-cf-blue/70 bg-cf-tint font-medium text-cf-blue' : 'border-cf-line-strong text-cf-ink hover:border-cf-blue/40')}>
                <input type="radio" name="tone" className="sr-only" checked={tone === t.value} onChange={() => api.set('tone', t.value)} />
                <span aria-hidden>{TONE_ICON[t.value]}</span>{t.label}
              </label>
            ))}
          </div>
        </Field>
        <Field name="key_messaging" label="Key messaging" info="The core message you want every post to reinforce." error={api.errors.key_messaging}>
          <TextArea value={api.str('key_messaging')} onChange={v => api.set('key_messaging', v)} max={500} rows={2} placeholder="e.g. Helping modern teams do more with less." />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field name="brand_colors" label="Brand colours" info="Click a colour to change it." error={api.errors.brand_colors}>
            <ColorSwatches value={api.arr('brand_colors')} onChange={v => api.set('brand_colors', v)} />
          </Field>
          <Field name="logo" label="Brand assets" info="Stored privately until your workspace is created.">
            <div className="grid grid-cols-2 gap-2.5">
              {logo.items.length === 0
                ? <UploadDrop uploader={logo} title="Upload logo" subtitle="PNG, JPG or WebP" icon={<ImageIcon size={24} />} compact />
                : <div className="flex min-h-[96px] items-center justify-center rounded-xl border border-cf-line p-2"><UploadThumbs uploader={logo} previews={api.previews} size="lg" /></div>}
              <UploadDrop uploader={assets} title="Upload brand assets" subtitle={`Images · ${assets.items.length}/6`} icon={<FileText size={24} />} compact />
            </div>
            {assets.items.length > 0 && <div className="mt-2.5"><UploadThumbs uploader={assets} previews={api.previews} /></div>}
            <UploadError uploader={logo} /><UploadError uploader={assets} />
          </Field>
        </div>
        <div data-field="target_audience"><TextField size="compact" label="Target audience" placeholder="e.g. Marketing teams at small to mid-sized businesses" icon={<Users size={19} strokeWidth={1.8} />} value={api.str('target_audience')} onChange={e => api.set('target_audience', e.target.value)} error={api.errors.target_audience} maxLength={200} /></div>
      </div>
    </>
  )
}

function GoalsStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Goals" description="Tell us what success looks like so we can tailor recommendations." />
      <div className="mt-6 space-y-6">
        <Field name="goals" label="Marketing goals" required error={api.errors.goals}>
          <MultiChips options={BRAND_GOALS} value={api.arr('goals')} onChange={v => api.set('goals', v)} />
        </Field>
        <Field name="objectives" label="Campaign objectives (optional)" error={api.errors.objectives}>
          <TextArea value={api.str('objectives')} onChange={v => api.set('objectives', v)} max={500} placeholder="e.g. Launch our spring range and grow Instagram engagement by 20% this quarter." />
        </Field>
        <Field name="audience_priorities" label="Audience priorities (optional)">
          <MultiChips options={AUDIENCE_PRIORITIES} value={api.arr('audience_priorities')} onChange={v => api.set('audience_priorities', v)} />
        </Field>
      </div>
    </>
  )
}

function ChannelsStep({ api }: { api: FlowApi }) {
  return (
    <>
      <StepHeading title="Channels" description="Where will your brand publish?" />
      <div className="mt-6 space-y-6">
        <Field name="channels" label="Publishing channels" required error={api.errors.channels}>
          <MultiChips variant="plain" options={BRAND_CHANNELS} value={api.arr('channels')} onChange={v => api.set('channels', v)} iconFor={v => <BrandGlyph platform={v} size={22} />} />
        </Field>
        <div data-field="cadence" className="max-w-md"><SelectField size="compact" label="Publishing cadence" placeholder="How often will you publish?" icon={<CalendarDays size={19} strokeWidth={1.8} />} options={CADENCES} value={api.str('cadence')} onChange={e => api.set('cadence', e.target.value)} error={api.errors.cadence} /></div>
        <FormAlert tone="info">Selecting a channel doesn’t connect it. You’ll connect each account securely from Social › Connections after setup.</FormAlert>
      </div>
    </>
  )
}

const NEXT_COPY = [
  'Next, we’ll capture your voice and assets so content stays on-brand.',
  'Next, we’ll set your goals so we can tailor recommendations and content ideas.',
  'Next, choose where you publish and we’ll prepare your workspace.',
  'Create your workspace and Fox AI will write in your brand voice.',
]

function BrandKitPreview({ api }: { api: FlowApi }) {
  const name = api.str('brand_name')
  const colors = api.arr('brand_colors')
  const logo = (Array.isArray(api.data.logo) ? api.data.logo : []) as UploadRef[]
  const logoUrl = logo[0] ? api.previews[logo[0].path] : undefined
  const tone = api.str('tone')
  return (
    <aside aria-label="Brand kit preview" className="lg:mt-0">
      <div className="rounded-[22px] border border-cf-line-strong/70 bg-white p-5 shadow-cf-card sm:p-7 lg:sticky lg:top-6" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-[22px] font-bold tracking-tight text-cf-ink sm:text-[24px]">Brand kit preview</h2><p className="mt-1 text-[15px] text-cf-muted">Here’s how your brand will look in Caption Fox.</p></div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E7F8EF] px-3 py-1 text-[12px] font-medium text-[#15803D]"><span aria-hidden className="h-2 w-2 rounded-full bg-[#22A559]" /> Live preview</span>
        </div>
        <div className="mt-5 flex items-center gap-5 rounded-2xl bg-cf-surface p-4">
          <span className="flex h-[84px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-2xl text-[30px] font-bold text-white" style={{ background: colors[0] ?? '#1769FF' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl ? <img src={logoUrl} alt={`${name || 'Brand'} logo`} className="h-full w-full bg-white object-contain p-1.5" /> : (name.trim()[0]?.toUpperCase() ?? '?')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-bold text-cf-ink">{name || 'Your brand'}</p>
            <p className="truncate text-[14px] text-cf-muted">{api.str('website').replace(/^https?:\/\//, '') || 'yourbrand.com'}</p>
            {api.str('description') && <p className="mt-1 line-clamp-2 text-[14px] text-cf-body">{api.str('description')}</p>}
          </div>
        </div>
        <h3 className="mt-5 text-[15px] font-semibold text-cf-ink">Brand colours</h3>
        <div className="mt-2.5 flex gap-3">
          {colors.length ? colors.map(c => <span key={c} title={c} className="h-11 w-11 rounded-full shadow-[inset_0_0_0_1px_rgb(10_22_48/0.08)]" style={{ background: c }}><span className="sr-only">{c}</span></span>) : <span className="text-[14px] text-cf-muted">Add colours to see them here.</span>}
        </div>
        <h3 className="mt-5 text-[15px] font-semibold text-cf-ink">Tone of voice</h3>
        {tone ? <span className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-[10px] border border-cf-blue/50 bg-cf-tint px-4 text-[15px] font-medium text-cf-blue">{TONE_ICON[tone]}{tone}</span> : <p className="mt-1 text-[14px] text-cf-muted">Not set yet.</p>}
        <h3 className="mt-5 text-[15px] font-semibold text-cf-ink">Key messaging</h3>
        <p className="mt-2 rounded-xl border border-cf-line px-4 py-3 text-[14px] leading-snug text-cf-body">{api.str('key_messaging') || 'Your key message will appear here.'}</p>
        <h3 className="mt-5 text-[15px] font-semibold text-cf-ink">Target audience</h3>
        <p className="mt-2 flex gap-3 rounded-xl border border-cf-line px-4 py-3 text-[14px] leading-snug text-cf-body"><Users size={18} aria-hidden className="mt-0.5 shrink-0 text-cf-muted" />{api.str('target_audience') || 'Describe who you’re trying to reach.'}</p>
        <div className="mt-5 flex gap-4 rounded-2xl bg-cf-tint p-4">
          <Sparkles size={26} aria-hidden className="shrink-0 text-cf-blue" />
          <div><p className="text-[16px] font-semibold text-cf-blue">{api.step === 4 ? 'Last step!' : 'You’re almost there!'}</p><p className="mt-0.5 text-[14px] leading-snug text-cf-body">{NEXT_COPY[api.step - 1]}</p></div>
        </div>
      </div>
    </aside>
  )
}
