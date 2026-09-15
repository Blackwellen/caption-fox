'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Image as ImageIcon, LoaderCircle, Plus, Trash2, Upload, Video, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { FLOWS, INVITE_ROLES, type AccountType, type InviteRef, type Option, type UploadRef } from '@/lib/onboarding/schema'
import { AuthHeader, Atmosphere, BackToHome } from '@/components/auth/AuthShell'
import { authFontClass } from '@/components/auth/fonts'
import { FormAlert } from '@/components/auth/fields'
import type { FlowApi } from './useOnboardingFlow'
import { saveOnboardingStep } from '@/app/onboarding/actions'

// ── Frame & header ───────────────────────────────────────────────────────────
export function OnboardingFrame({ headerRight, children }: { headerRight?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-h-screen flex-col bg-white text-cf-ink', authFontClass)}>
      <AuthHeader right={headerRight ?? <BackToHome />} />
      <main id="main" className="relative flex-1 bg-gradient-to-b from-white via-cf-tint/50 to-white">
        <Atmosphere />
        <div className="relative mx-auto max-w-[1448px] px-4 pb-14 pt-7 sm:px-8 lg:px-[60px] lg:pt-9">{children}</div>
      </main>
    </div>
  )
}

export function HeaderProgress({ step, label, barFirst }: { step: number; label?: string; barFirst?: boolean }) {
  const bar = (
    <span aria-hidden className="h-[7px] w-24 overflow-hidden rounded-full bg-cf-line sm:w-[170px] lg:w-[200px]">
      <span className="block h-full rounded-full bg-cf-blue transition-[width] duration-500 ease-[var(--ease-cf)]" style={{ width: `${(step / 4) * 100 - 12.5}%` }} />
    </span>
  )
  return (
    <div className={cn('flex items-center gap-4', barFirst ? 'sm:gap-8' : 'sm:gap-6')} role="status" aria-label={`Step ${step} of 4`}>
      {label && <span className="hidden text-[16px] font-medium text-cf-ink md:inline">{label}</span>}
      {barFirst && bar}
      <span className="whitespace-nowrap text-[14px] text-cf-body sm:text-[15px]">Step {step} of 4</span>
      {!barFirst && bar}
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-[10px] overflow-hidden rounded-full bg-cf-line">
      <div className="h-full rounded-full bg-cf-blue transition-[width] duration-700 ease-[var(--ease-cf)]" style={{ width: `${value}%` }} />
    </div>
  )
}

export function ProgressRing({ value, size = 96, label }: { value: number; size?: number; label: string }) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E4EBF5" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1769FF" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} className="transition-[stroke-dashoffset] duration-700 ease-[var(--ease-cf)]" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-cf-ink sm:text-[22px]">{value}%</span>
    </div>
  )
}

export function PageIntro({ eyebrow, title, intro, className, titleClassName }: { eyebrow: string; title: React.ReactNode; intro: string; className?: string; titleClassName?: string }) {
  return (
    <div className={cn('cf-rise', className)}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-cf-blue sm:text-[13px]">{eyebrow}</p>
      <h1 className={cn('mt-2.5 text-[36px] font-extrabold leading-[1.04] tracking-[-0.025em] text-cf-ink sm:text-[48px]', titleClassName ?? 'xl:text-[58px]')}>{title}</h1>
      <p className="mt-3 max-w-[840px] text-[16px] leading-[1.45] text-cf-muted sm:text-[19px]">{intro}</p>
    </div>
  )
}

// ── Stepper ──────────────────────────────────────────────────────────────────
type StepperVariant = 'inline' | 'line' | 'pill'

export function Stepper({ api, variant, className, dense, indent }: { api: FlowApi; variant: StepperVariant; className?: string; dense?: boolean; indent?: boolean }) {
  const { flow, step, maxStep, goTo } = api
  const current = flow.steps[step - 1]
  return (
    <>
    {/* Phones get a compact indicator; the full stepper shows from sm up. */}
    <div className={cn('sm:hidden', className)}>
      <p className="text-[14px] font-medium text-cf-muted"><span className="font-semibold text-cf-blue">Step {step} of 4</span> — {current.label}</p>
      <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-cf-line"><div className="h-full rounded-full bg-cf-blue transition-[width] duration-500" style={{ width: `${(step / 4) * 100}%` }} /></div>
    </div>
    <nav aria-label="Setup progress" className={cn('cf-hide-scrollbar hidden overflow-x-auto sm:block', className)}>
      <ol className={cn('flex', variant === 'pill' ? 'min-w-max items-center justify-center gap-3' : 'items-start', variant === 'line' && 'w-full min-w-[560px]', variant === 'inline' && 'w-full min-w-[640px] items-center')}>
        {flow.steps.map((s, i) => {
          const n = i + 1
          const state = n < step ? 'done' : n === step ? 'current' : 'todo'
          const reachable = n <= maxStep && n !== step
          const circle = (
            <span
              className={cn(
                'relative flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors',
                variant === 'pill' || dense ? 'h-9 w-9 text-[15px]' : variant === 'inline' ? 'h-10 w-10 text-[16px]' : 'h-10 w-10 text-[16px] sm:h-11 sm:w-11 sm:text-[18px]',
                state === 'current' && 'bg-cf-blue text-white shadow-[0_0_0_5px_rgb(23_105_255/0.14)]',
                state === 'done' && (variant === 'pill' ? 'bg-cf-tint-2 text-cf-blue' : 'border-2 border-cf-blue bg-white text-cf-blue'),
                state === 'todo' && 'border border-cf-line-strong bg-cf-tint text-cf-body',
              )}
            >
              {state === 'done' && variant !== 'pill' ? <Check size={18} strokeWidth={3} aria-hidden /> : n}
            </span>
          )
          const text = (
            <span className={cn('min-w-0 text-left', variant === 'line' && (indent ? '-mt-1.5 block pl-9' : dense ? 'mt-1.5 block' : 'mt-2 block'))}>
              <span className={cn('block whitespace-nowrap font-semibold', variant === 'pill' ? 'text-[15px]' : 'text-[15px] sm:text-[16px]', state === 'current' ? 'text-cf-blue' : 'text-cf-ink', variant === 'pill' && state !== 'current' && 'font-medium text-cf-body')}>{s.label}</span>
              {variant !== 'pill' && <span className={cn('mt-0.5 whitespace-nowrap text-[13px]', variant === 'inline' ? 'hidden xl:block' : 'block', variant === 'line' && 'sm:text-[14px]', state === 'current' && variant === 'inline' ? 'text-cf-blue' : 'text-cf-muted')}>{s.description}</span>}
            </span>
          )
          const content = variant === 'line'
            ? <span className="flex flex-col items-start">{circle}{text}</span>
            : <span className={cn('flex items-center', variant === 'inline' ? 'gap-2.5' : 'gap-3')}>{circle}{text}</span>
          return (
            <li key={s.key} className={cn('flex items-center', variant === 'line' ? 'relative flex-1 items-start' : 'gap-3', variant === 'inline' && i < 3 && 'flex-1')} aria-current={state === 'current' ? 'step' : undefined}>
              {reachable ? (
                <button type="button" onClick={() => goTo(n)} className="rounded-xl text-left focus-visible:outline-offset-4" aria-label={`${s.label}${state === 'done' ? ' (complete)' : ''} — go to step ${n}`}>{content}</button>
              ) : content}
              {i < 3 && variant === 'inline' && <span aria-hidden className="mx-2 h-px min-w-3 flex-1 bg-cf-line-strong xl:mx-3" />}
              {i < 3 && variant === 'pill' && <span aria-hidden className={cn('ml-3 h-px w-10 sm:w-28 xl:w-[118px]', n < step ? 'bg-cf-blue' : 'bg-cf-line-strong')} />}
              {i < 3 && variant === 'line' && <span aria-hidden className={cn('absolute right-2 h-[2px] rounded-full', dense ? 'left-11 top-[17px]' : 'left-12 top-5 sm:top-[22px]', n < step ? 'bg-cf-blue' : 'bg-cf-line')} />}
            </li>
          )
        })}
      </ol>
    </nav>
    </>
  )
}

// ── Card, headings, nav ──────────────────────────────────────────────────────
export function FlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-[20px] border border-cf-line-strong/70 bg-white px-5 py-5 shadow-cf-card sm:px-7 sm:pb-7 sm:pt-6', className)}>{children}</section>
}

export function StepHeading({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      {icon && <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cf-tint-2 text-cf-blue">{icon}</span>}
      <div>
        <h2 id="onboarding-step-title" tabIndex={-1} className="text-[23px] font-bold tracking-[-0.02em] text-cf-ink focus:outline-none sm:text-[26px]">{title}</h2>
        <p className="mt-0.5 text-[15px] text-cf-muted">{description}</p>
      </div>
    </div>
  )
}

export function StepBody({ api, children }: { api: FlowApi; children: React.ReactNode }) {
  return <div key={api.step} className="cf-step-in">{children}</div>
}

export function FlowNav({ api, finishLabel, backStyle = 'arrow', divider = true }: { api: FlowApi; finishLabel: string; backStyle?: 'arrow' | 'plain'; divider?: boolean }) {
  const { step, back, next, busy, formError } = api
  const final = step === 4
  return (
    <div className={divider ? 'mt-5 border-t border-cf-line pt-4' : 'mt-5'}>
      {formError && <div className="mb-4"><FormAlert>{formError}</FormAlert></div>}
      <div className="flex items-center justify-between gap-3">
        {step > 1 ? (
          <button type="button" onClick={back} disabled={busy} className="inline-flex h-12 min-w-[120px] items-center justify-center gap-2.5 rounded-[10px] border border-cf-blue/60 bg-white px-6 text-[17px] font-medium text-cf-blue transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-cf-card disabled:opacity-60 sm:min-w-[160px]">
            {backStyle === 'arrow' && <ArrowLeft size={19} aria-hidden />} Back
          </button>
        ) : <span />}
        <button type="button" onClick={next} disabled={busy} aria-busy={busy || undefined} className="group inline-flex h-12 min-w-[150px] items-center justify-center gap-2.5 rounded-[10px] bg-cf-blue px-7 text-[17px] font-medium text-white shadow-cf-button transition-[transform,background-color] hover:-translate-y-px hover:bg-cf-blue-deep disabled:translate-y-0 disabled:opacity-75 sm:min-w-[210px]">
          {busy ? <><LoaderCircle size={19} className="animate-spin" aria-hidden />{final ? (finishLabel.includes('profile') ? 'Creating profile…' : 'Creating workspace…') : 'Saving…'}</> : <>{final ? finishLabel : 'Continue'}<ArrowRight size={19} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></>}
        </button>
      </div>
    </div>
  )
}

export function ChangeTypeLink({ type }: { type: AccountType }) {
  return (
    <p className="mt-6 text-center text-[14px] text-cf-muted">
      Not setting up a {type} workspace? <Link href="/onboarding?change=1" className="font-medium text-cf-blue hover:underline">Change account type</Link>
    </p>
  )
}

// ── Field wrapper for custom controls ───────────────────────────────────────
export function Field({ name, label, hint, error, children, required, className, info }: { name: string; label: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean; className?: string; info?: string }) {
  const id = useId()
  return (
    <div data-field={name} className={className} role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <p id={`${id}-label`} className="text-[15px] font-semibold text-cf-ink">
        {label}{required && <span aria-hidden className="ml-0.5 text-[#E5484D]"> *</span>}
        {info && <span className="ml-1.5 inline-flex h-4 w-4 translate-y-[1px] items-center justify-center rounded-full border border-cf-muted/60 text-[10px] font-bold text-cf-muted" title={info} aria-label={info}>i</span>}
      </p>
      {hint && <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-cf-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-[#C62828]">{error}</p>}
    </div>
  )
}

// ── Choice controls ──────────────────────────────────────────────────────────
export function CheckChip({ checked, onChange, children, variant = 'check', icon, size = 'md', className }: { checked: boolean; onChange: () => void; children: React.ReactNode; variant?: 'check' | 'plain' | 'trailing'; icon?: React.ReactNode; size?: 'md' | 'sm'; className?: string }) {
  return (
    <label className={cn(
      'inline-flex min-h-11 cursor-pointer select-none items-center rounded-[10px] border transition-[border-color,background-color] duration-150 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20',
      size === 'md' ? 'gap-2.5 px-3.5 text-[15px]' : 'gap-2 px-3 text-[14px]',
      checked ? 'border-cf-blue/60 bg-cf-tint font-medium text-cf-ink' : 'border-cf-line-strong bg-white text-cf-body hover:border-cf-blue/40',
      className,
    )}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {variant === 'check' && (
        checked
          ? <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-cf-blue text-white"><Check size={12} strokeWidth={3.5} /></span>
          : <span aria-hidden className="h-[18px] w-[18px] rounded-full border-[1.5px] border-[#9AA7BA]" />
      )}
      {icon}
      <span className={cn(variant !== 'plain' && checked && 'text-cf-blue')}>{children}</span>
      {variant === 'trailing' && checked && <span aria-hidden className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-cf-blue text-white"><Check size={12} strokeWidth={3.5} /></span>}
    </label>
  )
}

export function MultiChips({ options, value, onChange, variant = 'check', iconFor, size = 'md', className, chipClassName }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; variant?: 'check' | 'plain' | 'trailing'; iconFor?: (v: string) => React.ReactNode; size?: 'md' | 'sm'; className?: string; chipClassName?: string }) {
  return (
    <div className={cn(className ?? 'flex flex-wrap', size === 'md' ? 'gap-2.5' : 'gap-2')}>
      {options.map(o => {
        const on = value.includes(o.value)
        return (
          <CheckChip key={o.value} checked={on} variant={variant} size={size} className={chipClassName} icon={iconFor?.(o.value)} onChange={() => onChange(on ? value.filter(v => v !== o.value) : [...value, o.value])}>
            {o.label}
          </CheckChip>
        )
      })}
    </div>
  )
}

export function IconTiles({ options, value, onChange, iconFor, multiple = true, name }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; iconFor: (v: string) => React.ReactNode; multiple?: boolean; name: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map(o => {
        const on = value.includes(o.value)
        return (
          <label key={o.value} className={cn('flex min-h-[62px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border px-2 py-2 text-[13px] transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20', on ? 'border-cf-blue/60 bg-cf-tint font-medium text-cf-blue' : 'border-cf-line-strong text-cf-body hover:border-cf-blue/40')}>
            <input type={multiple ? 'checkbox' : 'radio'} name={name} className="sr-only" checked={on} onChange={() => onChange(multiple ? (on ? value.filter(v => v !== o.value) : [...value, o.value]) : [o.value])} />
            <span aria-hidden className={on ? 'text-cf-blue' : 'text-cf-ink'}>{iconFor(o.value)}</span>
            {o.label}
          </label>
        )
      })}
    </div>
  )
}

export function RadioCards({ options, value, onChange, name }: { options: Option[]; value: string; onChange: (v: string) => void; name: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map(o => {
        const on = value === o.value
        return (
          <label key={o.value} className={cn('flex cursor-pointer gap-2.5 rounded-xl border p-3.5 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/20', on ? 'border-cf-blue/50 bg-cf-tint' : 'border-cf-line-strong hover:border-cf-blue/40')}>
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
            <span aria-hidden className={cn('mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-cf-blue' : 'border-[#9AA7BA]')}>{on && <span className="h-2 w-2 rounded-full bg-cf-blue" />}</span>
            <span><span className="block text-[14px] font-semibold leading-snug text-cf-ink">{o.label}</span>{o.description && <span className="mt-1 block text-[13px] leading-snug text-cf-muted">{o.description}</span>}</span>
          </label>
        )
      })}
    </div>
  )
}

/** Chips with × plus an "add" select — for regions/deliverables. */
export function TagSelect({ options, value, onChange, icon, placeholder = 'Add…', label }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; icon?: React.ReactNode; placeholder?: string; label: string }) {
  const remaining = options.filter(o => !value.includes(o.value))
  return (
    <div className="relative flex min-h-11 items-stretch rounded-[10px] border border-cf-line-strong bg-white focus-within:border-cf-blue focus-within:ring-4 focus-within:ring-cf-blue/12">
      {icon && <span aria-hidden className="flex w-10 shrink-0 items-center justify-center border-r border-cf-line text-cf-muted">{icon}</span>}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-1.5 py-2">
        {value.map(v => (
          <span key={v} className="inline-flex h-7 items-center gap-0.5 rounded-md bg-[#EEF2F7] pl-2 pr-0.5 text-[13px] text-cf-ink">
            {options.find(o => o.value === v)?.label ?? v}
            <button type="button" onClick={() => onChange(value.filter(x => x !== v))} aria-label={`Remove ${v}`} className="flex h-6 w-5 items-center justify-center rounded text-cf-muted hover:bg-white hover:text-cf-ink"><X size={12} aria-hidden /></button>
          </span>
        ))}
        {value.length === 0 && <span className="px-1 text-[14px] text-[#8593A8]">Select {label.toLowerCase()}</span>}
      </div>
      {remaining.length > 0 && (
        <>
          <span aria-hidden className="flex w-8 shrink-0 items-center justify-center text-cf-body"><ChevronDown size={18} /></span>
          {/* Native select kept for keyboard/screen readers; it covers the chevron column (or the whole field when empty). */}
          <select aria-label={`Add ${label.toLowerCase()}`} value="" onChange={e => e.target.value && onChange([...value, e.target.value])} className={cn('absolute cursor-pointer appearance-none opacity-0', value.length ? 'inset-y-0 right-0 w-8' : 'inset-0 h-full w-full')}>
            <option value="">{placeholder}</option>
            {remaining.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </>
      )}
    </div>
  )
}

export function TextArea({ id, value, onChange, max, placeholder, rows = 3, invalid }: { id?: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; rows?: number; invalid?: boolean }) {
  return (
    <div className="relative">
      <textarea id={id} value={value} onChange={e => onChange(e.target.value)} maxLength={max} rows={rows} placeholder={placeholder} aria-invalid={invalid || undefined}
        className={cn('w-full resize-none rounded-[10px] border bg-white px-4 pb-7 pt-3 text-[15px] leading-snug text-cf-ink placeholder:text-[#8593A8] focus:border-cf-blue focus:outline-none focus:ring-4 focus:ring-cf-blue/12', invalid ? 'border-[#E5484D]' : 'border-cf-line-strong')} />
      <span aria-hidden className="absolute bottom-2.5 right-3.5 text-[12px] text-cf-muted">{value.length}/{max}</span>
    </div>
  )
}

// ── Colours ──────────────────────────────────────────────────────────────────
const SUGGESTED = ['#1769FF', '#0A1630', '#B9D7FF', '#EEF2F7', '#16A34A', '#F59E0B']

export function ColorSwatches({ value, onChange, max = 6 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      {value.map((c, i) => (
        <div key={`${c}-${i}`} className="group relative">
          <label className="block h-[52px] w-[52px] cursor-pointer rounded-full border border-black/5 shadow-[inset_0_0_0_1px_rgb(10_22_48/0.06)] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-cf-blue/25 sm:h-[58px] sm:w-[58px]" style={{ background: c }}>
            <span className="sr-only">Brand colour {i + 1}: {c}. Change colour</span>
            <input type="color" value={c.toLowerCase()} onChange={e => onChange(value.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))} className="sr-only" />
          </label>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove colour ${c}`} className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-cf-line bg-white text-cf-muted opacity-100 shadow-sm transition-opacity hover:text-cf-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
            <X size={12} aria-hidden />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, SUGGESTED.find(s => !value.includes(s)) ?? '#1769FF'])} aria-label="Add brand colour" className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9AA7BA] text-cf-body hover:border-cf-blue hover:text-cf-blue sm:h-[58px] sm:w-[58px]">
          <Plus size={22} aria-hidden />
        </button>
      )}
    </div>
  )
}

// ── Uploads (private bucket, owner folder) ───────────────────────────────────
export function useUploader(api: FlowApi, field: 'avatar' | 'logo' | 'brand_assets' | 'portfolio') {
  const spec = FLOWS[api.type].fields[field]
  const items = (Array.isArray(api.data[field]) ? api.data[field] : []) as UploadRef[]
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const accept: readonly string[] = spec?.kind === 'uploads' ? spec.accept : []
  const maxBytes = spec?.kind === 'uploads' ? spec.maxBytes : 0
  const maxItems = spec?.kind === 'uploads' ? spec.maxItems : 0

  async function add(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files).slice(0, Math.max(0, maxItems - items.length))
    if (list.length === 0) { setError(`You can add up to ${maxItems} file${maxItems === 1 ? '' : 's'}.`); return }
    const supabase = createClient()
    const added: UploadRef[] = []
    for (const file of list) {
      if (!accept.includes(file.type)) { setError(`${file.name}: this file type isn’t supported.`); continue }
      if (file.size > maxBytes) { setError(`${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`); continue }
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' } as Record<string, string>)[file.type]
      const path = `${api.userId}/${field}/${crypto.randomUUID()}.${ext}`
      setUploading(n => n + 1)
      const { error: upErr } = await supabase.storage.from('onboarding-uploads').upload(path, file, { contentType: file.type, upsert: false })
      setUploading(n => n - 1)
      if (upErr) { setError(`${file.name} couldn’t be uploaded. Try again.`); continue }
      const { data: signed } = await supabase.storage.from('onboarding-uploads').createSignedUrl(path, 3600)
      if (signed?.signedUrl) api.setPreviews(p => ({ ...p, [path]: signed.signedUrl }))
      added.push({ path, name: file.name.slice(0, 120), type: file.type, size: file.size })
    }
    if (added.length) {
      const next = maxItems === 1 ? added.slice(0, 1) : [...items, ...added]
      api.set(field, next)
      persist(next)
    }
  }

  // Record upload references in the draft straight away, so a refresh or
  // abandoned step never leaves a stored file the draft doesn't know about.
  function persist(next: UploadRef[]) {
    const values = Object.fromEntries(api.flow.steps[api.step - 1].fields.map(f => [f, f === field ? next : api.data[f]]))
    void saveOnboardingStep(api.type, api.step, values, false)
  }

  async function remove(path: string) {
    const next = items.filter(i => i.path !== path)
    api.set(field, next)
    persist(next)
    await createClient().storage.from('onboarding-uploads').remove([path])
  }

  return { items, add, remove, uploading: uploading > 0, error, accept, maxItems }
}

export function UploadDrop({ uploader, title, subtitle, icon, className, compact }: { uploader: ReturnType<typeof useUploader>; title: string; subtitle: string; icon: React.ReactNode; className?: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const full = uploader.items.length >= uploader.maxItems
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (!full) void uploader.add(e.dataTransfer.files) }}
      className={cn('relative flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed text-center transition-colors', over ? 'border-cf-blue bg-cf-tint' : 'border-[#C5D3E6] bg-white', compact ? 'min-h-[96px] px-2 py-3' : 'min-h-[100px] px-3 py-4', className)}
    >
      <button type="button" disabled={full || uploader.uploading} onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg text-cf-ink disabled:cursor-not-allowed disabled:opacity-60">
        <span aria-hidden className="text-cf-body">{uploader.uploading ? <LoaderCircle size={24} className="animate-spin" /> : icon}</span>
        <span className="text-[14px] font-medium text-cf-ink">{uploader.uploading ? 'Uploading…' : full ? 'Limit reached' : title}</span>
        <span className="text-[12px] text-cf-muted">{subtitle}</span>
      </button>
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} aria-hidden accept={uploader.accept.join(',')} multiple={uploader.maxItems > 1} onChange={e => { if (e.target.files) void uploader.add(e.target.files); e.target.value = '' }} />
    </div>
  )
}

export function UploadThumbs({ uploader, previews, size = 'md' }: { uploader: ReturnType<typeof useUploader>; previews: Record<string, string>; size?: 'md' | 'lg' }) {
  if (uploader.items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2.5" aria-label="Uploaded files">
      {uploader.items.map(item => (
        <li key={item.path} className={cn('group relative overflow-hidden rounded-lg border border-cf-line bg-cf-surface', size === 'lg' ? 'h-[90px] w-[90px]' : 'h-16 w-16')}>
          {item.type.startsWith('image/') && previews[item.path]
            // Private signed URL (1h); next/image can't optimise these.
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={previews[item.path]} alt={item.name} className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-cf-muted">{item.type.startsWith('video/') ? <Video size={20} aria-hidden /> : <ImageIcon size={20} aria-hidden />}<span className="sr-only">{item.name}</span></span>}
          {item.type.startsWith('video/') && <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 text-[10px] font-medium text-white">Video</span>}
          <button type="button" onClick={() => void uploader.remove(item.path)} aria-label={`Remove ${item.name}`} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-cf-ink shadow">
            <Trash2 size={13} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function UploadError({ uploader }: { uploader: ReturnType<typeof useUploader> }) {
  return uploader.error ? <p role="alert" className="mt-1.5 text-[13px] font-medium text-[#C62828]">{uploader.error}</p> : null
}

export { Upload }

// ── Team invites ─────────────────────────────────────────────────────────────
export function InviteEditor({ api }: { api: FlowApi }) {
  const invites = (Array.isArray(api.data.invites) ? api.data.invites : []) as InviteRef[]
  const update = (next: InviteRef[]) => api.set('invites', next)
  return (
    <div data-field="invites" className="space-y-3">
      {invites.length === 0 && <p className="rounded-xl border border-dashed border-cf-line-strong bg-cf-surface/60 px-4 py-5 text-center text-[15px] text-cf-muted">No invites yet. You can also invite people later from Settings › Team.</p>}
      {invites.map((inv, i) => (
        <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label className="sr-only" htmlFor={`invite-email-${i}`}>Invite {i + 1} email</label>
            <input id={`invite-email-${i}`} type="email" autoComplete="off" placeholder="colleague@company.com" value={inv.email} onChange={e => update(invites.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
              aria-invalid={!!api.errors[`invites.${i}`] || undefined}
              className={cn('h-12 w-full rounded-[10px] border px-4 text-[15px] focus:border-cf-blue focus:outline-none focus:ring-4 focus:ring-cf-blue/12', api.errors[`invites.${i}`] ? 'border-[#E5484D]' : 'border-cf-line-strong')} />
            {api.errors[`invites.${i}`] && <p className="mt-1 text-[13px] font-medium text-[#C62828]">{api.errors[`invites.${i}`]}</p>}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <label className="sr-only" htmlFor={`invite-role-${i}`}>Invite {i + 1} role</label>
              <select id={`invite-role-${i}`} value={inv.role} onChange={e => update(invites.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} className="h-12 appearance-none rounded-[10px] border border-cf-line-strong bg-white pl-4 pr-10 text-[15px] text-cf-ink focus:border-cf-blue focus:outline-none">
                {INVITE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={18} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cf-body" />
            </div>
            <button type="button" onClick={() => update(invites.filter((_, j) => j !== i))} aria-label={`Remove invite ${i + 1}`} className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-cf-line-strong text-cf-muted hover:text-[#C62828]"><Trash2 size={17} aria-hidden /></button>
          </div>
        </div>
      ))}
      {invites.length < 10 && (
        <button type="button" onClick={() => update([...invites, { email: '', role: 'member' }])} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-cf-line-strong px-4 text-[15px] font-medium text-cf-ink hover:border-cf-blue/50">
          <Plus size={17} aria-hidden /> Add a teammate
        </button>
      )}
      <p className="text-[13px] leading-snug text-cf-muted">Invitations are created when setup finishes. Each person gets a link from Settings › Team and must sign in with the invited email. Roles: Admin manages the workspace, Manager runs campaigns and approvals, Member creates content, Viewer has read-only access.</p>
    </div>
  )
}
