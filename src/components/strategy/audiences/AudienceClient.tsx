'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bookmark, ChevronDown, Download, FileSpreadsheet, Mail, Mic, Monitor, MoreVertical, MonitorPlay, PlusCircle, RefreshCw, Search, Share2, Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { connectHubSpot, createAudience, disconnectCrm, importAudiences, setAudienceArchived, syncAudiencesFromCrm, updateAudience } from '@/lib/strategy/actions/audiences'
import { saveView } from '@/lib/strategy/actions/common'
import { AUDIENCE_CHANNELS, CHANNEL_LABELS, LIFECYCLE_LABELS, LIFECYCLE_STAGES } from '@/lib/strategy/constants'
import type { AudienceRow, PersonLite } from '@/lib/strategy/types'
import { BUTTON, ICON } from '../buttons'
import { Menu, type MenuItem } from '../client/menu'
import { ConfirmDialog, Dialog, DialogButton } from '../client/dialog'
import { FormError, FormGrid, formValues, SelectField, TextField } from '../client/fields'
import { useStrategyAction } from '../client/use-action'

interface Can { create: boolean; edit: boolean; import: boolean; sync: boolean; export: boolean }

const BRANDED = new Set(['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'pinterest', 'google'])
const GENERIC: Record<string, typeof Mail> = { email: Mail, search: Search, display: Monitor, podcast: Mic, video: MonitorPlay, social: Share2 }

/** Channel mark: the brand's own logo where one exists, a neutral glyph otherwise. */
export function ChannelMark({ channel, size = 16 }: { channel: string; size?: number }) {
  const label = CHANNEL_LABELS[channel] ?? channel
  if (BRANDED.has(channel)) return <BrandLogo brand={channel} size={size} title={label} />
  const Icon = GENERIC[channel] ?? Share2
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex items-center justify-center rounded-[4px] border border-slate-300 text-slate-600" style={{ width: size, height: size }}>
      <Icon aria-hidden style={{ width: size * 0.66, height: size * 0.66 }} />
    </span>
  )
}

export interface CrmConnectionSummary {
  account_label: string | null
  token_tail: string
  status: string
  last_synced_at: string | null
  last_sync_status: string | null
  last_sync_error: string | null
  last_sync_count: number | null
}

export function AudiencesHeaderActions({ people, can, crm, canManageCrm }: { people: PersonLite[]; can: Can; crm: CrmConnectionSummary | null; canManageCrm: boolean }) {
  const params = useSearchParams()
  const { run, pending } = useStrategyAction()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const crmConnected = Boolean(crm)
  const syncTitle = crm
    ? `Sync lists from ${crm.account_label ?? 'HubSpot'}${crm.last_synced_at ? ` — last synced ${new Date(crm.last_synced_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}${crm.last_sync_error ? ` (last attempt failed: ${crm.last_sync_error})` : ''}`
    : canManageCrm ? 'Connect HubSpot with your own private-app token first' : 'Ask a workspace owner or admin to connect HubSpot'
  const exportHref = (format: string) => {
    const qs = new URLSearchParams(params.toString())
    qs.set('module', 'audiences'); qs.set('format', format)
    return `/api/strategy/export?${qs}`
  }
  return (
    <>
      {can.create && <button type="button" className={BUTTON.primary} onClick={() => setCreateOpen(true)}><PlusCircle aria-hidden className={ICON} /> New audience</button>}
      {can.import && <button type="button" className={BUTTON.secondary} onClick={() => setImportOpen(true)}><Upload aria-hidden className={ICON} /> Import segments</button>}
      {can.sync && (
        <button type="button" className={BUTTON.secondary} disabled={pending} aria-busy={pending} title={syncTitle}
          onClick={() => { if (crmConnected) void run(() => syncAudiencesFromCrm()); else if (canManageCrm) setConnectOpen(true); else void run(() => syncAudiencesFromCrm()) }}>
          <RefreshCw aria-hidden className={cn(ICON, pending && 'animate-spin')} /> Sync CRM
        </button>
      )}
      {can.export && (
        <Menu label="Export" items={[
          { id: 'csv', label: 'Export CSV', description: 'Aggregated segments only — no personal data', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, href: exportHref('csv'), download: true },
          { id: 'json', label: 'Export JSON', icon: <Download className="h-3.5 w-3.5" />, href: exportHref('json'), download: true },
        ]} trigger={({ ref, toggle, open, ...aria }) => (
          <button ref={ref} type="button" onClick={toggle} {...aria} className={BUTTON.secondary}>
            <Download aria-hidden className={ICON} /> Export
            <ChevronDown aria-hidden className={cn(ICON, 'ml-2 text-slate-500 transition-transform lg:ml-[9px]', open && 'rotate-180')} />
          </button>
        )} />
      )}
      <Menu label="More actions" items={[
        { id: 'archived', label: 'View archived audiences', href: '?view=table&archived=1' },
        ...(canManageCrm && !crm ? [{ id: 'connect', label: 'Connect HubSpot', description: 'Uses your own private-app token', onSelect: () => setConnectOpen(true) }] : []),
        ...(canManageCrm && crm ? [
          { id: 'reconnect', label: 'Replace HubSpot token', description: `${crm.account_label ?? 'HubSpot'} · token ${crm.token_tail}`, onSelect: () => setConnectOpen(true) },
          { id: 'disconnect', label: 'Disconnect HubSpot', description: 'Synced audiences are kept', danger: true, onSelect: () => setDisconnectOpen(true) },
        ] : []),
      ] as MenuItem[]} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label="More actions" className={BUTTON.icon}><MoreVertical aria-hidden className={ICON} /></button>
      )} />
      <AudienceDialog open={createOpen} onClose={() => setCreateOpen(false)} people={people} />
      <ImportAudiencesDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {canManageCrm && <ConnectHubSpotDialog open={connectOpen} onClose={() => setConnectOpen(false)} replacing={Boolean(crm)} />}
      {canManageCrm && crm && (
        <ConfirmDialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)} title="Disconnect HubSpot?"
          description="The stored token is deleted. Audiences already synced stay in Strategy but stop updating."
          confirmLabel="Disconnect" danger busy={pending}
          onConfirm={() => { void run(() => disconnectCrm(), { onSuccess: () => setDisconnectOpen(false) }) }} />
      )}
    </>
  )
}

export function AudienceDialog({ open, onClose, people, audience }: { open: boolean; onClose: () => void; people: PersonLite[]; audience?: AudienceRow }) {
  const { run, pending } = useStrategyAction()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [channels, setChannels] = useState<string[]>(audience?.channels ?? [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = { ...formValues(event.currentTarget), channels }
    const result = await run(() => (audience ? updateAudience(audience.id, values) : createAudience(values)))
    if (result.ok) { setFieldErrors({}); setFormError(null); onClose() }
    else { setFieldErrors(result.fieldErrors ?? {}); setFormError(result.fieldErrors ? null : result.error ?? null) }
  }

  return (
    <Dialog open={open} onClose={onClose} busy={pending} size="lg" title={audience ? 'Edit audience' : 'New audience'}
      description="Audiences hold aggregated segment data only — never individual contact records."
      footer={<><DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton><DialogButton variant="primary" type="submit" form="strategy-audience-form" disabled={pending}>{pending ? 'Saving…' : audience ? 'Save changes' : 'Create audience'}</DialogButton></>}>
      <FormError message={formError} />
      <form id="strategy-audience-form" onSubmit={submit} noValidate>
        <FormGrid>
          <TextField className="sm:col-span-2" label="Audience name" name="name" required maxLength={120} defaultValue={audience?.name} error={fieldErrors.name} />
          <TextField className="sm:col-span-2" label="Short description" name="description" maxLength={500} defaultValue={audience?.description ?? ''} error={fieldErrors.description} placeholder="e.g. High-intent, value seekers" />
          <SelectField label="Status" name="status" defaultValue={audience?.status ?? 'draft'} options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }]} error={fieldErrors.status} />
          <SelectField label="Lifecycle stage" name="lifecycle_stage" defaultValue={audience?.lifecycle_stage ?? 'awareness'} options={LIFECYCLE_STAGES.map(value => ({ value, label: LIFECYCLE_LABELS[value] }))} error={fieldErrors.lifecycle_stage} />
          <TextField label="Audience size" name="audience_size" type="number" min={0} step={1} defaultValue={audience?.audience_size ?? ''} error={fieldErrors.audience_size} />
          <TextField label="Growth (%)" name="growth_rate" type="number" step="0.1" defaultValue={audience?.growth_rate ?? ''} error={fieldErrors.growth_rate} />
          <TextField label="Fit score (0–100)" name="fit_score" type="number" min={0} max={100} defaultValue={audience?.fit_score ?? ''} error={fieldErrors.fit_score} />
          <TextField label="Data completeness (%)" name="data_completeness" type="number" min={0} max={100} defaultValue={audience?.data_completeness ?? ''} error={fieldErrors.data_completeness} />
          <SelectField label="Owner" name="owner_id" defaultValue={audience?.owner_id ?? ''} placeholder="Me" options={people.map(person => ({ value: person.id, label: person.full_name ?? person.email ?? 'Member' }))} error={fieldErrors.owner_id} />
          <TextField label="Tags" name="tags" defaultValue={audience?.tags?.join(', ') ?? ''} hint="Comma separated" />
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-[12.5px] font-medium text-sg-body">Channels</legend>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCE_CHANNELS.map(channel => {
                const on = channels.includes(channel)
                return (
                  <button key={channel} type="button" aria-pressed={on} onClick={() => setChannels(list => on ? list.filter(item => item !== channel) : [...list, channel])}
                    className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px]', on ? 'border-sg-blue bg-sg-blue-soft text-sg-blue' : 'border-sg-line text-sg-body hover:bg-slate-50')}>
                    <ChannelMark channel={channel} size={14} /> {CHANNEL_LABELS[channel] ?? channel}
                  </button>
                )
              })}
            </div>
            {fieldErrors.channels && <p role="alert" className="mt-1 text-[12px] text-red-600">{fieldErrors.channels}</p>}
          </fieldset>
        </FormGrid>
      </form>
    </Dialog>
  )
}

function ConnectHubSpotDialog({ open, onClose, replacing }: { open: boolean; onClose: () => void; replacing: boolean }) {
  const { run, pending } = useStrategyAction()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    if (!token.trim()) { setError('Paste your HubSpot private-app access token.'); return }
    const result = await run(() => connectHubSpot(token))
    if (result.ok) { setToken(''); setError(null); onClose() } else setError(result.error ?? null)
  }
  return (
    <Dialog open={open} onClose={onClose} busy={pending} title={replacing ? 'Replace HubSpot token' : 'Connect HubSpot'} size="md"
      description="Strategy reads your HubSpot contact list names and sizes to keep audiences current. Individual contacts are never copied."
      footer={<><DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton><DialogButton variant="primary" onClick={() => { void submit() }} disabled={pending || !token.trim()}>{pending ? 'Verifying…' : replacing ? 'Replace token' : 'Connect'}</DialogButton></>}>
      <form onSubmit={event => { void submit(event) }}>
        <FormError message={error} />
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-[13px] text-sg-body">
          <li>In HubSpot, open Settings → Integrations → Private Apps and create an app.</li>
          <li>Under Scopes, tick <span className="font-medium">crm.lists.read</span> only.</li>
          <li>Create the app, copy its access token and paste it below.</li>
        </ol>
        <TextField label="Private-app access token" name="token" type="password" autoComplete="off" spellCheck={false} required
          value={token} onChange={event => { setToken(event.target.value); setError(null) }} placeholder="pat-eu1-…"
          hint="Verified with HubSpot, then stored encrypted. Nobody in the workspace can read it back." />
      </form>
    </Dialog>
  )
}

function ImportAudiencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run, pending } = useStrategyAction()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    if (!file) { setError('Choose a CSV file.'); return }
    if (!/\.csv$/i.test(file.name)) { setError('Only .csv files can be imported.'); return }
    if (file.size > 1_000_000) { setError('Import files must be under 1 MB.'); return }
    const result = await run(async () => importAudiences(await file.text()))
    if (result.ok) { setFile(null); setError(null); onClose() } else setError(result.error ?? null)
  }
  return (
    <Dialog open={open} onClose={onClose} busy={pending} title="Import segments" size="md"
      description="CSV with a header row. Required: name. Optional: description, status, lifecycle_stage, audience_size, growth_rate, fit_score, data_completeness, channels (use ; between), tags."
      footer={<><DialogButton onClick={onClose} disabled={pending}>Cancel</DialogButton><DialogButton variant="primary" onClick={submit} disabled={pending || !file}>{pending ? 'Importing…' : 'Import'}</DialogButton></>}>
      <FormError message={error} />
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-sg-line bg-slate-50 px-4 py-8 text-center hover:border-sg-blue">
        <Upload aria-hidden className="h-5 w-5 text-slate-400" />
        <span className="text-[13px] font-medium text-sg-ink">{file ? file.name : 'Choose a CSV file'}</span>
        <span className="text-[12px] text-sg-muted">Aggregated segments only · up to 1,000 rows · all-or-nothing</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(null) }} />
      </label>
    </Dialog>
  )
}

export function AudienceMenu({ audience, people, can }: { audience: AudienceRow; people: PersonLite[]; can: Can }) {
  const { run, pending } = useStrategyAction()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const archived = Boolean(audience.archived_at)
  const items: MenuItem[] = [
    { id: 'compare', label: 'Compare with others', href: `?view=compare&compare=${audience.id}` },
    ...(can.edit && !archived ? [{ id: 'edit', label: 'Edit audience', onSelect: () => setEditOpen(true) }] : []),
    ...(can.edit ? [archived
      ? { id: 'restore', label: 'Restore', separatorBefore: true, onSelect: () => { void run(() => setAudienceArchived(audience.id, false)) } }
      : { id: 'archive', label: 'Archive', separatorBefore: true, onSelect: () => setConfirm(true) }] : []),
  ]
  return (
    <>
      <Menu label={`Actions for ${audience.name}`} items={items} trigger={({ ref, toggle, ...aria }) => (
        <button ref={ref} type="button" onClick={toggle} {...aria} aria-label={`Actions for ${audience.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:h-5 lg:w-5">
          <MoreVertical aria-hidden className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
        </button>
      )} />
      {editOpen && <AudienceDialog open onClose={() => setEditOpen(false)} people={people} audience={audience} />}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={pending} title={`Archive “${audience.name}”?`}
        description="Archived audiences leave KPIs, maps and pickers but can be restored." confirmLabel="Archive"
        onConfirm={async () => { const result = await run(() => setAudienceArchived(audience.id, true)); if (result.ok) setConfirm(false) }} />
    </>
  )
}

export function SaveViewButton({ module }: { module: 'audiences' | 'research' | 'objectives' | 'plans' }) {
  const params = useSearchParams()
  const { run, pending } = useStrategyAction()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-sg-line bg-white px-3 text-[13px] font-medium text-sg-blue hover:bg-sg-blue-soft lg:h-[26px] lg:rounded-[6px] lg:px-[10px] lg:text-[10px]">
        <Bookmark aria-hidden className="h-3.5 w-3.5 lg:h-3 lg:w-3" /> Save view
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} busy={pending} size="sm" title="Save this view" description="Saves the current filters and view for you only."
        footer={<><DialogButton onClick={() => setOpen(false)}>Cancel</DialogButton><DialogButton variant="primary" disabled={pending || !name.trim()}
          onClick={async () => { const result = await run(() => saveView(module, name, params.toString())); if (result.ok) { setOpen(false); setName('') } }}>Save view</DialogButton></>}>
        <TextField label="View name" name="view_name" required maxLength={60} value={name} onChange={event => setName(event.target.value)} />
      </Dialog>
    </>
  )
}
