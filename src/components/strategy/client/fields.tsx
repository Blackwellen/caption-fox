'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

const CONTROL = 'block w-full rounded-lg border bg-white px-3 text-[14px] text-sg-ink placeholder:text-slate-400 focus:border-sg-blue focus:outline-none focus:ring-2 focus:ring-sg-blue/20 disabled:bg-slate-50 disabled:text-slate-400 sm:text-[13px]'

function Wrapper({
  label, error, hint, required, children, id, className,
}: { label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode; id: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-[12.5px] font-medium text-sg-body">
        {label}{required && <span aria-hidden className="ml-0.5 text-red-500">*</span>}
        {!required && <span className="ml-1 font-normal text-sg-subtle">(optional)</span>}
      </label>
      {children}
      {error
        ? <p id={`${id}-error`} role="alert" className="mt-1 text-[12px] text-red-600">{error}</p>
        : hint && <p id={`${id}-hint`} className="mt-1 text-[12px] text-sg-muted">{hint}</p>}
    </div>
  )
}

type Base = { label: string; error?: string; hint?: string; required?: boolean; className?: string }

export function TextField({ label, error, hint, required, className, ...props }: Base & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <input id={id} required={required} aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props} className={cn(CONTROL, 'h-10', error ? 'border-red-300' : 'border-sg-line')} />
    </Wrapper>
  )
}

export function TextArea({ label, error, hint, required, className, ...props }: Base & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <textarea id={id} required={required} aria-invalid={!!error || undefined} rows={3}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props} className={cn(CONTROL, 'py-2', error ? 'border-red-300' : 'border-sg-line')} />
    </Wrapper>
  )
}

export function SelectField({
  label, error, hint, required, className, options, placeholder, ...props
}: Base & React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId()
  return (
    <Wrapper label={label} error={error} hint={hint} required={required} id={id} className={className}>
      <select id={id} required={required} aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props} className={cn(CONTROL, 'h-10', error ? 'border-red-300' : 'border-sg-line')}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Wrapper>
  )
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3.5 sm:grid-cols-2', className)}>{children}</div>
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{message}</p>
}

/** Reads a FormData into a plain string record (trimmed, blank → omitted). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === 'string' && value.trim() !== '') values[key] = value.trim()
  }
  return values
}
