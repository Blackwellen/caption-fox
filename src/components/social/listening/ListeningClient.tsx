'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createAlertRule, resolveListeningAlert, updateMention } from '@/lib/social/actions'
import { Dialog, FormError, fieldInput, fieldLabel, primaryButton, secondaryButton, useParamDialog } from '../Dialog'

// Client controls for Social Listening: the star toggle on mention rows, the
// resolve button on alerts and the Create Alert dialog (opened by `?alert=new`).

export function StarButton({ mentionId, starred, label }: { mentionId: string; starred: boolean; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [on, setOn] = useState(starred)
  return (
    <button
      type="button" aria-pressed={on} aria-label={on ? `Unstar mention from ${label}` : `Star mention from ${label}`} disabled={pending}
      onClick={() => {
        const next = !on
        setOn(next)
        start(async () => {
          const result = await updateMention({ mentionId, isStarred: next })
          if (!result.ok) setOn(!next)
          else router.refresh()
        })
      }}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-500 lg:h-6 lg:w-6"
    >
      <Star size={14} className={cn(on && 'fill-amber-400 text-amber-400')} aria-hidden />
    </button>
  )
}

export function ResolveAlertButton({ alertId, allowed }: { alertId: string; allowed: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button type="button" disabled={!allowed || pending} title={allowed ? 'Mark this alert resolved' : 'Your role cannot manage alerts.'}
        onClick={() => start(async () => { const result = await resolveListeningAlert(alertId); if (result.ok) router.refresh(); else setError(result.message) })}>
        {pending ? 'Resolving…' : 'Resolve alert'}
      </button>
      {error && <p role="alert" className="px-2.5 py-1 text-[12px] text-red-600">{error}</p>}
    </>
  )
}

const SENTIMENTS = ['positive', 'neutral', 'negative'] as const

export function CreateAlertDialog({ keywordSuggestions, sourceOptions }: {
  keywordSuggestions: string[]
  sourceOptions: { value: string; label: string }[]
}) {
  const { open, close } = useParamDialog('alert')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [sentiments, setSentiments] = useState<string[]>(['negative'])
  const [sources, setSources] = useState<string[]>([])
  const [volume, setVolume] = useState('')
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [frequency, setFrequency] = useState<'realtime' | 'hourly' | 'daily' | 'weekly'>('realtime')
  const [recipients, setRecipients] = useState('')
  const [error, setError] = useState<{ message: string; reference?: string } | null>(null)

  if (!open) return null
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(item => item !== value) : [...list, value]
  const keywordList = keywords.split(',').map(item => item.trim()).filter(Boolean).slice(0, 25)
  const recipientList = recipients.split(/[,\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 20)

  const submit = () => {
    if (pending) return
    setError(null)
    const volumeValue = volume ? Number.parseInt(volume, 10) : null
    if (volume && (!Number.isFinite(volumeValue) || (volumeValue ?? 0) < 1)) { setError({ message: 'Volume threshold must be a whole number above zero.' }); return }
    start(async () => {
      const result = await createAlertRule({
        name, keywords: keywordList, sentiments, sources, volumeThreshold: volumeValue,
        frequency, recipients: recipientList, severity,
      })
      if (!result.ok) { setError({ message: result.message, reference: result.reference }); return }
      close()
      router.refresh()
    })
  }

  return (
    <Dialog open onClose={close} title="Create listening alert" description="Get notified when mentions match these conditions." footer={(
      <>
        <button type="button" onClick={close} className={secondaryButton}>Cancel</button>
        <button type="button" onClick={submit} disabled={pending || !name.trim() || keywordList.length === 0 || recipientList.length === 0} className={primaryButton}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Create alert
        </button>
      </>
    )}>
      <div className="space-y-4">
        <div>
          <label htmlFor="alert-name" className={fieldLabel}>Alert name</label>
          <input id="alert-name" data-autofocus maxLength={120} value={name} onChange={event => setName(event.target.value)} className={fieldInput} placeholder="e.g. Negative sentiment spike" />
        </div>
        <div>
          <label htmlFor="alert-keywords" className={fieldLabel}>Keywords (comma separated)</label>
          <input id="alert-keywords" maxLength={600} value={keywords} onChange={event => setKeywords(event.target.value)} className={fieldInput} placeholder={keywordSuggestions.slice(0, 3).join(', ')} />
          {keywordSuggestions.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {keywordSuggestions.slice(0, 8).map(keyword => (
                <button key={keyword} type="button" onClick={() => setKeywords(current => (keywordList.includes(keyword) ? current : [...keywordList, keyword].join(', ')))}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-[12px] text-slate-600 hover:bg-slate-50">{keyword}</button>
              ))}
            </p>
          )}
        </div>
        <fieldset>
          <legend className={fieldLabel}>Sentiment</legend>
          <div className="flex flex-wrap gap-2">
            {SENTIMENTS.map(value => (
              <label key={value} className="flex items-center gap-1.5 text-[13px] capitalize text-slate-700">
                <input type="checkbox" checked={sentiments.includes(value)} onChange={() => setSentiments(toggle(sentiments, value))} /> {value}
              </label>
            ))}
          </div>
        </fieldset>
        {sourceOptions.length > 0 && (
          <fieldset>
            <legend className={fieldLabel}>Sources (none selected = all)</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {sourceOptions.map(option => (
                <label key={option.value} className="flex items-center gap-1.5 text-[13px] text-slate-700">
                  <input type="checkbox" checked={sources.includes(option.value)} onChange={() => setSources(toggle(sources, option.value))} /> {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="alert-volume" className={fieldLabel}>Volume threshold</label>
            <input id="alert-volume" inputMode="numeric" value={volume} onChange={event => setVolume(event.target.value.replace(/\D/g, '').slice(0, 7))} className={fieldInput} placeholder="Mentions / hour" />
          </div>
          <div>
            <label htmlFor="alert-severity" className={fieldLabel}>Severity</label>
            <select id="alert-severity" value={severity} onChange={event => setSeverity(event.target.value as typeof severity)} className={fieldInput}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="alert-frequency" className={fieldLabel}>Delivery</label>
            <select id="alert-frequency" value={frequency} onChange={event => setFrequency(event.target.value as typeof frequency)} className={fieldInput}>
              <option value="realtime">Real time</option><option value="hourly">Hourly digest</option><option value="daily">Daily digest</option><option value="weekly">Weekly digest</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="alert-recipients" className={fieldLabel}>Email recipients</label>
          <input id="alert-recipients" type="text" maxLength={1000} value={recipients} onChange={event => setRecipients(event.target.value)} className={fieldInput} placeholder="name@company.com, team@company.com" />
        </div>
        {error && <FormError message={error.message} reference={error.reference} />}
      </div>
    </Dialog>
  )
}
