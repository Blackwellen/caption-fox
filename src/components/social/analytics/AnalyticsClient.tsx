'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { saveReportPreset, scheduleReport, setReportScheduleActive } from '@/lib/social/actions'
import { Dialog, FormError, fieldInput, fieldLabel, primaryButton, secondaryButton, useParamDialog } from '../Dialog'

// Client controls for Social Analytics: the Create Report dialog (`?report=new`)
// that saves a preset and optionally schedules it, and the pause/resume control
// on scheduled report shortcuts.

const METRICS = [
  { value: 'reach', label: 'Reach' }, { value: 'impressions', label: 'Impressions' }, { value: 'engagements', label: 'Engagements' },
  { value: 'engagementRate', label: 'Engagement rate' }, { value: 'followers', label: 'New followers' }, { value: 'linkClicks', label: 'Link clicks' },
]

export function CreateReportDialog({ defaultDays, canSchedule }: { defaultDays: number; canSchedule: boolean }) {
  const { open, close } = useParamDialog('report')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState(String(defaultDays))
  const [metrics, setMetrics] = useState<string[]>(['reach', 'engagements', 'engagementRate'])
  const [schedule, setSchedule] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none')
  const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf')
  const [recipients, setRecipients] = useState('')
  const [error, setError] = useState<{ message: string; reference?: string } | null>(null)
  if (!open) return null

  const recipientList = recipients.split(/[,\s]+/).map(item => item.trim()).filter(Boolean).slice(0, 20)
  const submit = () => {
    if (pending) return
    setError(null)
    start(async () => {
      const saved = await saveReportPreset({ name, description: description.trim() || undefined, config: { days: Number(days), metrics } })
      if (!saved.ok || !saved.data) { setError({ message: saved.message, reference: saved.reference }); return }
      if (schedule !== 'none') {
        const scheduled = await scheduleReport({
          presetId: saved.data.id, name, frequency: schedule, recipients: recipientList, format, sendTime: '09:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        })
        if (!scheduled.ok) { setError({ message: `Report saved, but the schedule failed: ${scheduled.message}`, reference: scheduled.reference }); router.refresh(); return }
      }
      close()
      router.refresh()
    })
  }

  return (
    <Dialog open onClose={close} title="Create report" description="Save the metrics you track so the team can export or receive them on a schedule." footer={(
      <>
        <button type="button" onClick={close} className={secondaryButton}>Cancel</button>
        <button type="button" onClick={submit} disabled={pending || !name.trim() || metrics.length === 0 || (schedule !== 'none' && recipientList.length === 0)} className={primaryButton}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}{schedule === 'none' ? 'Save report' : 'Save and schedule'}
        </button>
      </>
    )}>
      <div className="space-y-4">
        <div>
          <label htmlFor="report-name" className={fieldLabel}>Report name</label>
          <input id="report-name" data-autofocus maxLength={120} value={name} onChange={event => setName(event.target.value)} className={fieldInput} placeholder="e.g. Weekly Performance Report" />
        </div>
        <div>
          <label htmlFor="report-description" className={fieldLabel}>Description (optional)</label>
          <input id="report-description" maxLength={300} value={description} onChange={event => setDescription(event.target.value)} className={fieldInput} />
        </div>
        <fieldset>
          <legend className={fieldLabel}>Metrics</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {METRICS.map(metric => (
              <label key={metric.value} className="flex items-center gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={metrics.includes(metric.value)} onChange={() => setMetrics(current => current.includes(metric.value) ? current.filter(item => item !== metric.value) : [...current, metric.value])} />
                {metric.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="report-days" className={fieldLabel}>Date range</label>
            <select id="report-days" value={days} onChange={event => setDays(event.target.value)} className={fieldInput}>
              <option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-schedule" className={fieldLabel}>Send automatically</label>
            <select id="report-schedule" value={schedule} disabled={!canSchedule} title={canSchedule ? undefined : 'Your role or plan cannot schedule reports.'} onChange={event => setSchedule(event.target.value as typeof schedule)} className={fieldInput}>
              <option value="none">Don’t schedule</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-format" className={fieldLabel}>Format</label>
            <select id="report-format" value={format} disabled={schedule === 'none'} onChange={event => setFormat(event.target.value as typeof format)} className={fieldInput}>
              <option value="pdf">PDF</option><option value="csv">CSV</option><option value="xlsx">Excel</option>
            </select>
          </div>
        </div>
        {schedule !== 'none' && (
          <div>
            <label htmlFor="report-recipients" className={fieldLabel}>Recipients</label>
            <input id="report-recipients" maxLength={1000} value={recipients} onChange={event => setRecipients(event.target.value)} className={fieldInput} placeholder="name@company.com, team@company.com" />
            <p className="mt-1 text-[12px] text-slate-500">Sent at 09:00 in your timezone.</p>
          </div>
        )}
        {error && <FormError message={error.message} reference={error.reference} />}
      </div>
    </Dialog>
  )
}

export function ScheduleToggle({ scheduleId, active, allowed }: { scheduleId: string; active: boolean; allowed: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button type="button" disabled={!allowed || pending} title={allowed ? undefined : 'Your role or plan cannot manage scheduled reports.'}
        onClick={() => start(async () => { const result = await setReportScheduleActive(scheduleId, !active); if (result.ok) router.refresh(); else setError(result.message) })}>
        {pending ? 'Saving…' : active ? 'Pause schedule' : 'Resume schedule'}
      </button>
      {error && <p role="alert" className="px-2.5 py-1 text-[12px] text-red-600">{error}</p>}
    </>
  )
}
