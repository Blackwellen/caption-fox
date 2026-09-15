'use client'

import { forwardRef, useId, useState } from 'react'
import { ArrowRight, ChevronDown, CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// `compact` is the onboarding density: 40px on desktop, 44px touch target below sm.
export type FieldSize = 'lg' | 'md' | 'sm' | 'compact'

const HEIGHT: Record<FieldSize, string> = { lg: 'h-14', md: 'h-12', sm: 'h-11', compact: 'h-11 sm:h-10' }
const LABEL: Record<FieldSize, string> = { lg: 'text-[16px] mb-2.5', md: 'text-[15px] mb-2', sm: 'text-[14px] mb-1.5', compact: 'text-[15px] mb-1.5' }
const TEXT: Record<FieldSize, string> = { lg: 'text-[17px]', md: 'text-[16px]', sm: 'text-[16px]', compact: 'text-[15px]' }

interface FieldShellProps {
  id: string
  label: React.ReactNode
  error?: string | null
  hint?: React.ReactNode
  size?: FieldSize
  children: React.ReactNode
  className?: string
  labelAside?: React.ReactNode
}

export function FieldShell({ id, label, error, hint, size = 'lg', children, className, labelAside }: FieldShellProps) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={cn('block font-semibold text-cf-ink', LABEL[size])}>{label}</label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#C62828]">
          <CircleAlert size={14} aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-cf-muted">{hint}</p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-[10px] border bg-white text-cf-ink placeholder:text-[#8593A8] transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-cf-blue focus:ring-4 focus:ring-cf-blue/12 disabled:bg-cf-surface disabled:text-cf-muted'

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: React.ReactNode
  icon?: React.ReactNode
  error?: string | null
  hint?: React.ReactNode
  size?: FieldSize
  trailing?: React.ReactNode
  labelAside?: React.ReactNode
  wrapperClassName?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, icon, error, hint, size = 'lg', trailing, labelAside, wrapperClassName, id: idProp, className, ...props },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} size={size} className={wrapperClassName} labelAside={labelAside}>
      <div className="relative">
        {icon && <span aria-hidden className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-cf-muted">{icon}</span>}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            inputBase, HEIGHT[size], TEXT[size],
            icon ? (size === 'lg' ? 'pl-[54px]' : 'pl-[50px]') : 'pl-4',
            trailing ? 'pr-12' : 'pr-4',
            error ? 'border-[#E5484D]' : 'border-cf-line-strong',
            className,
          )}
          {...props}
        />
        {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </FieldShell>
  )
})

export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type' | 'trailing'>>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-cf-muted transition-colors hover:bg-cf-tint hover:text-cf-ink"
        >
          {visible ? <EyeOff size={21} aria-hidden /> : <Eye size={21} aria-hidden />}
        </button>
      }
    />
  )
})

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: React.ReactNode
  icon?: React.ReactNode
  error?: string | null
  hint?: React.ReactNode
  size?: FieldSize
  placeholder?: string
  options: { value: string; label: string }[]
  wrapperClassName?: string
}

export function SelectField({ label, icon, error, hint, size = 'lg', placeholder, options, wrapperClassName, id: idProp, className, value, ...props }: SelectFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const empty = value === '' || value === undefined
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} size={size} className={wrapperClassName}>
      <div className="relative">
        {icon && <span aria-hidden className="pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-cf-muted">{icon}</span>}
        <select
          id={id}
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            inputBase, HEIGHT[size], TEXT[size], 'cursor-pointer appearance-none pr-11',
            icon ? (size === 'lg' ? 'pl-[54px]' : 'pl-[50px]') : 'pl-4',
            empty ? 'text-[#8593A8]' : 'text-cf-ink',
            error ? 'border-[#E5484D]' : 'border-cf-line-strong',
            className,
          )}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={20} aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cf-body" />
      </div>
    </FieldShell>
  )
}

export function Checkbox({ label, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: React.ReactNode }) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={props.id ?? id} type="checkbox" className="mt-[1px] h-[22px] w-[22px] shrink-0 cursor-pointer rounded-[5px] accent-cf-blue" {...props} />
      <label htmlFor={props.id ?? id} className="cursor-pointer text-[15px] leading-snug text-cf-body sm:text-[16px]">{label}</label>
    </div>
  )
}

export function FormAlert({ tone = 'error', children, action }: { tone?: 'error' | 'info' | 'success' | 'warning'; children: React.ReactNode; action?: React.ReactNode }) {
  const styles = {
    error: 'border-[#F5C2C0] bg-[#FFF5F5] text-[#9B1C1C]',
    info: 'border-cf-rail bg-cf-tint text-cf-body',
    success: 'border-[#BBE7CC] bg-[#F1FBF5] text-[#166534]',
    warning: 'border-[#F7DDA6] bg-[#FFFAEB] text-[#8A5A00]',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[14px] leading-snug', styles)}>
      <CircleAlert size={17} aria-hidden className="mt-[1px] shrink-0" />
      <div className="min-w-0 flex-1">
        {children}
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  size?: 'lg' | 'md'
  arrow?: boolean
}

export function PrimaryButton({ loading, loadingText, size = 'lg', arrow = true, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'group inline-flex w-full items-center justify-center gap-2.5 rounded-[10px] bg-cf-blue font-medium text-white shadow-cf-button transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-cf)]',
        'hover:-translate-y-px hover:bg-cf-blue-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70',
        size === 'lg' ? 'h-14 text-[18px] sm:h-[60px] sm:text-[19px]' : 'h-12 text-[17px] sm:h-[52px] sm:text-[18px]',
        className,
      )}
    >
      {loading ? (
        <><LoaderCircle size={20} className="animate-spin" aria-hidden />{loadingText ?? children}</>
      ) : (
        <>{children}{arrow && <ArrowRight size={21} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />}</>
      )}
    </button>
  )
}

export function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2.5 rounded-[10px] border border-cf-line-strong bg-white px-6 text-[17px] font-medium text-cf-ink transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-cf-blue/50 hover:shadow-cf-card disabled:opacity-60 sm:h-[52px]',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-6 text-[13px] font-medium uppercase tracking-[0.12em] text-cf-muted" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-cf-line-strong" />OR<span className="h-px flex-1 bg-cf-line-strong" />
    </div>
  )
}
