'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import {
  createFollowUpSequence, createPodcastEpisode, createSponsor, createSponsorship,
} from '@/lib/events/actions'

/**
 * Lightweight, single-step creation forms for Sponsorships, Podcast Episodes
 * and Follow-up Sequences — real inserts through the same permission-checked
 * server actions as everything else, not a link to a route that doesn't exist.
 */

function ModalShell({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-6"
      role="dialog" aria-modal="true" aria-labelledby="create-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <h2 id="create-modal-title" className="text-[16px] font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-slate-700">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 px-3 text-[13.5px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

/* ---------------------------------------------------------- sponsorship */

export function CreateSponsorshipModal({
  routeSegment, events, sponsors, onClose,
}: {
  routeSegment: string
  events: { id: string; name: string }[]
  sponsors: { id: string; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newSponsor, setNewSponsor] = useState(sponsors.length === 0)
  const [form, setForm] = useState({
    sponsorId: sponsors[0]?.id ?? '', sponsorName: '', eventId: '', tier: 'bronze', value: '', currency: 'GBP',
  })

  function submit() {
    setError(null)
    startTransition(async () => {
      let sponsorId = form.sponsorId
      if (newSponsor) {
        const result = await createSponsor(routeSegment, { name: form.sponsorName })
        if (!result.ok) { setError(result.error); return }
        sponsorId = result.id
      }
      const result = await createSponsorship(routeSegment, {
        sponsorId, eventId: form.eventId || null, tier: form.tier,
        value: Number(form.value) || 0, currency: form.currency,
      })
      if (!result.ok) { setError(result.error); return }
      onClose()
      router.refresh()
    })
  }

  const canSubmit = newSponsor ? form.sponsorName.trim().length > 1 : Boolean(form.sponsorId)

  return (
    <ModalShell title="Create sponsorship" subtitle="Attach a sponsor, tier and value to an event." onClose={onClose}>
      <div className="space-y-4 p-5">
        <Field label="Sponsor" required>
          {sponsors.length > 0 && (
            <div className="mb-2 flex gap-1.5 text-[12px]">
              <button type="button" onClick={() => setNewSponsor(false)} className={!newSponsor ? 'font-semibold text-blue-700' : 'text-slate-500'}>Existing</button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => setNewSponsor(true)} className={newSponsor ? 'font-semibold text-blue-700' : 'text-slate-500'}>New sponsor</button>
            </div>
          )}
          {newSponsor ? (
            <input value={form.sponsorName} onChange={e => setForm(f => ({ ...f, sponsorName: e.target.value }))} placeholder="Sponsor company name" className={inputClass} />
          ) : (
            <select value={form.sponsorId} onChange={e => setForm(f => ({ ...f, sponsorId: e.target.value }))} className={inputClass}>
              {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Event">
          <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className={inputClass}>
            <option value="">Not linked to an event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier" required>
            <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} className={inputClass}>
              {['premier', 'platinum', 'gold', 'silver', 'bronze', 'community'].map(t => (
                <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Value (GBP)" required>
            <input type="number" min={0} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputClass} />
          </Field>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
        <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || !canSubmit} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? 'Creating…' : 'Create sponsorship'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ------------------------------------------------------------- podcasts */

export function CreatePodcastEpisodeModal({
  routeSegment, shows, onClose,
}: { routeSegment: string; shows: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', showName: shows[0]?.name ?? '', recordingType: 'remote', scheduledAt: '', summary: '',
  })

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createPodcastEpisode(routeSegment, {
        title: form.title, showName: form.showName || null, recordingType: form.recordingType,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        summary: form.summary || null,
      })
      if (!result.ok) { setError(result.error); return }
      onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title="Create episode" subtitle="Plan a new podcast episode and its show." onClose={onClose}>
      <div className="space-y-4 p-5">
        <Field label="Episode title" required>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={200} className={inputClass} />
        </Field>
        <Field label="Show">
          <input
            value={form.showName} onChange={e => setForm(f => ({ ...f, showName: e.target.value }))}
            placeholder="Show name (existing or new)" list="podcast-shows" className={inputClass}
          />
          <datalist id="podcast-shows">{shows.map(s => <option key={s.id} value={s.name} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recording type" required>
            <select value={form.recordingType} onChange={e => setForm(f => ({ ...f, recordingType: e.target.value }))} className={inputClass}>
              <option value="remote">Remote</option>
              <option value="in_studio">In-studio</option>
              <option value="live">Live</option>
              <option value="field">Field</option>
            </select>
          </Field>
          <Field label="Scheduled">
            <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className={inputClass} />
          </Field>
        </div>
        <Field label="Summary">
          <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
        <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || form.title.trim().length < 2} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? 'Creating…' : 'Create episode'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ------------------------------------------------------------ sequences */

export function CreateSequenceModal({
  routeSegment, events, onClose,
}: { routeSegment: string; events: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', eventId: '', conversionGoal: 'meeting_booked' })

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await createFollowUpSequence(routeSegment, {
        name: form.name, eventId: form.eventId || null, conversionGoal: form.conversionGoal,
      })
      if (!result.ok) { setError(result.error); return }
      onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title="Create sequence" subtitle="Starts as a draft with the standard 5-touch cadence, ready to edit." onClose={onClose}>
      <div className="space-y-4 p-5">
        <Field label="Sequence name" required>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. AI Marketing Trends Webinar" maxLength={160} className={inputClass} />
        </Field>
        <Field label="Event">
          <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} className={inputClass}>
            <option value="">Not linked to an event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </Field>
        <Field label="Conversion goal">
          <select value={form.conversionGoal} onChange={e => setForm(f => ({ ...f, conversionGoal: e.target.value }))} className={inputClass}>
            <option value="meeting_booked">Meeting booked</option>
            <option value="replied">Replied</option>
            <option value="converted">Converted</option>
          </select>
        </Field>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-5">
        <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button type="button" onClick={submit} disabled={pending || form.name.trim().length < 2} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {pending ? 'Creating…' : 'Create sequence'}
        </button>
      </div>
    </ModalShell>
  )
}

/* -------------------------------------------------------------- launchers */

const launcherClass = 'inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[13.5px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300'

export function CreateSponsorshipButton({
  routeSegment, events, sponsors, disabledReason,
}: { routeSegment: string; events: { id: string; name: string }[]; sponsors: { id: string; name: string }[]; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false)
  if (disabledReason) {
    return <button type="button" disabled title={disabledReason} className={launcherClass}><Plus size={16} aria-hidden />Create Sponsorship</button>
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={launcherClass}><Plus size={16} aria-hidden />Create Sponsorship</button>
      {open && <CreateSponsorshipModal routeSegment={routeSegment} events={events} sponsors={sponsors} onClose={() => setOpen(false)} />}
    </>
  )
}

export function CreatePodcastEpisodeButton({
  routeSegment, shows, disabledReason,
}: { routeSegment: string; shows: { id: string; name: string }[]; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false)
  if (disabledReason) {
    return <button type="button" disabled title={disabledReason} className={launcherClass}><Plus size={16} aria-hidden />Create Episode</button>
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={launcherClass}><Plus size={16} aria-hidden />Create Episode</button>
      {open && <CreatePodcastEpisodeModal routeSegment={routeSegment} shows={shows} onClose={() => setOpen(false)} />}
    </>
  )
}

export function CreateSequenceButton({
  routeSegment, events, disabledReason,
}: { routeSegment: string; events: { id: string; name: string }[]; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false)
  if (disabledReason) {
    return <button type="button" disabled title={disabledReason} className={launcherClass}><Plus size={16} aria-hidden />Create Sequence</button>
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={launcherClass}><Plus size={16} aria-hidden />Create Sequence</button>
      {open && <CreateSequenceModal routeSegment={routeSegment} events={events} onClose={() => setOpen(false)} />}
    </>
  )
}
