'use client'

import { useState, type ReactNode } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addBlock, connectDomain, removeChildLink, restorePageVersion, reviewPage, setPixelState, updateBlock, updatePageSettings,
  upsertChildLink, upsertPixel, verifyDomain, type PageSettingsPatch,
} from '@/lib/link-in-bio/actions'
import { slugify, validateDestinationUrl } from '@/lib/link-in-bio/urls'
import { buttonClass } from '../ui'
import { useAction } from '../client'
import { notify } from '../feedback'

const input = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50 disabled:text-slate-500'

export function FormRow({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[11.5px] font-medium text-slate-700">{label}</label>
      {children}
      {error ? <p className="mt-1 text-[11px] text-red-600" role="alert">{error}</p> : hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

// ------------------------------------------------------------------ links

export function AddLinkForm({ workspaceType, pageId, blocks, reusableLinks, disabledReason }: {
  workspaceType: string; pageId: string; blocks: { id: string; label: string }[]
  reusableLinks: { id: string; name: string; destination: string }[]; disabledReason: string | null
}) {
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [reusable, setReusable] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { run, pending } = useAction()

  if (disabledReason) return <p className="text-[12px] text-slate-500">{disabledReason}</p>
  if (!blocks.length) {
    return (
      <button type="button" className={buttonClass.primary} disabled={pending} onClick={() => run(() => addBlock({ workspaceType, pageId, type: 'links' }), { success: 'Link list added' })}>
        <Plus size={14} aria-hidden /> Add a link list block
      </button>
    )
  }
  return (
    <form
      className="grid items-end gap-2.5 md:grid-cols-[150px_1fr_1.4fr_170px_auto]"
      onSubmit={event => {
        event.preventDefault()
        setError(null)
        if (!title.trim()) { setError('Enter a label.'); return }
        if (!reusable) { const check = validateDestinationUrl(url); if (!check.ok) { setError(check.error); return } }
        run(() => upsertChildLink({ workspaceType, pageId, blockId, title, url, reusableLinkId: reusable || null }), { success: 'Link added' }, () => { setTitle(''); setUrl(''); setReusable('') })
      }}
    >
      <FormRow label="Block" htmlFor="add-link-block"><select id="add-link-block" value={blockId} onChange={e => setBlockId(e.target.value)} className={input}>{blocks.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></FormRow>
      <FormRow label="Label" htmlFor="add-link-title"><input id="add-link-title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} className={input} placeholder="Shop the sale" /></FormRow>
      <FormRow label="Destination URL" htmlFor="add-link-url"><input id="add-link-url" value={reusable ? reusableLinks.find(l => l.id === reusable)?.destination ?? '' : url} disabled={!!reusable} onChange={e => setUrl(e.target.value)} className={input} placeholder="https://" /></FormRow>
      <FormRow label="Or reusable link" htmlFor="add-link-reusable"><select id="add-link-reusable" value={reusable} onChange={e => setReusable(e.target.value)} className={input}><option value="">None</option>{reusableLinks.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></FormRow>
      <button type="submit" disabled={pending} className={cn(buttonClass.primary, 'h-9')}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add link</button>
      {error && <p className="text-[11.5px] text-red-600 md:col-span-5" role="alert">{error}</p>}
    </form>
  )
}

export function LinkRowActions({ workspaceType, pageId, blockId, link, disabled }: {
  workspaceType: string; pageId: string; blockId: string; disabled: boolean
  link: { id: string; title: string; url: string | null; isActive: boolean; reusableLinkId: string | null; scheduleEnd: string | null }
}) {
  const { run, pending } = useAction()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(link.title)
  const [url, setUrl] = useState(link.url ?? '')
  const [end, setEnd] = useState(link.scheduleEnd ? link.scheduleEnd.slice(0, 16) : '')
  if (editing) {
    return (
      <form className="flex flex-wrap items-center gap-1.5" onSubmit={e => {
        e.preventDefault()
        run(() => upsertChildLink({ workspaceType, pageId, blockId, linkId: link.id, title, url, reusableLinkId: link.reusableLinkId, isActive: link.isActive, scheduleEnd: end ? new Date(end).toISOString() : null }), { success: 'Link updated' }, () => setEditing(false))
      }}>
        <label className="sr-only" htmlFor={`t-${link.id}`}>Label</label>
        <input id={`t-${link.id}`} value={title} onChange={e => setTitle(e.target.value)} className={cn(input, 'h-8 w-32')} />
        <label className="sr-only" htmlFor={`u-${link.id}`}>URL</label>
        <input id={`u-${link.id}`} value={url} disabled={!!link.reusableLinkId} onChange={e => setUrl(e.target.value)} className={cn(input, 'h-8 w-44')} />
        <label className="sr-only" htmlFor={`e-${link.id}`}>Hide after</label>
        <input id={`e-${link.id}`} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={cn(input, 'h-8 w-44')} title="Hide this link after" />
        <button type="submit" disabled={pending} className="text-[11.5px] font-medium text-[#1a5cff]">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="text-[11.5px] text-slate-500">Cancel</button>
      </form>
    )
  }
  return (
    <div className="flex items-center justify-end gap-3 text-[11.5px]">
      <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="font-medium text-[#1a5cff] disabled:text-slate-400">Edit</button>
      <button type="button" disabled={disabled || pending} className="font-medium text-slate-600 disabled:text-slate-400"
        onClick={() => run(() => upsertChildLink({ workspaceType, pageId, blockId, linkId: link.id, title: link.title, url: link.url ?? '', reusableLinkId: link.reusableLinkId, isActive: !link.isActive, scheduleEnd: link.scheduleEnd }), { success: link.isActive ? 'Link hidden' : 'Link shown' })}>
        {link.isActive ? 'Disable' : 'Enable'}
      </button>
      <button type="button" disabled={disabled || pending} className="font-medium text-red-600 disabled:text-slate-400"
        onClick={() => run(() => removeChildLink({ workspaceType, pageId, linkId: link.id }), { success: 'Link removed from page', confirm: `Remove “${link.title}” from this page?${link.reusableLinkId ? ' The reusable link itself is kept.' : ''}` })}>
        Remove
      </button>
    </div>
  )
}

// --------------------------------------------------------- products & forms

export function AddBlockButton({ workspaceType, pageId, type, label, disabledReason, config }: { workspaceType: string; pageId: string; type: string; label: string; disabledReason: string | null; config?: Record<string, unknown> }) {
  const { run, pending } = useAction()
  return (
    <button type="button" disabled={pending || !!disabledReason} title={disabledReason ?? undefined} className={buttonClass.primary}
      onClick={() => run(() => addBlock({ workspaceType, pageId, type, config }), { success: `${label} added` })}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {label}
    </button>
  )
}

export function BlockSelect({ workspaceType, pageId, blockId, field, value, options, label, disabled, extra }: {
  workspaceType: string; pageId: string; blockId: string; field: string; value: string; label: string; disabled: boolean
  options: { id: string; name: string; disabled?: boolean }[]; extra?: (id: string) => Record<string, unknown>
}) {
  const { run, pending } = useAction()
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`sel-${blockId}`}>{label}</label>
      <select id={`sel-${blockId}`} value={value} disabled={disabled || pending} className={cn(input, 'h-8 max-w-[260px]')}
        onChange={e => run(() => updateBlock({ workspaceType, pageId, blockId, config: { [field]: e.target.value || null, ...(extra ? extra(e.target.value) : {}) } }), { success: 'Saved' })}>
        <option value="">Choose…</option>
        {options.map(o => <option key={o.id} value={o.id} disabled={o.disabled}>{o.name}</option>)}
      </select>
      {pending && <Loader2 size={14} className="animate-spin text-slate-400" aria-hidden />}
    </div>
  )
}

export function BlockToggle({ workspaceType, pageId, blockId, active, disabled, label }: { workspaceType: string; pageId: string; blockId: string; active: boolean; disabled: boolean; label: string }) {
  const { run, pending } = useAction()
  return (
    <button type="button" role="switch" aria-checked={active} aria-label={label} disabled={disabled || pending}
      onClick={() => run(() => updateBlock({ workspaceType, pageId, blockId, isActive: !active }))}
      className={cn('relative h-5 w-9 rounded-full transition-colors disabled:opacity-60', active ? 'bg-[#1a5cff]' : 'bg-slate-200')}>
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', active ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

// ------------------------------------------------------------------ pixels

const PROVIDERS = [
  { id: 'meta', label: 'Meta Pixel', placeholder: '1234567890123456', category: 'marketing' },
  { id: 'google_analytics', label: 'Google Analytics 4', placeholder: 'G-XXXXXXXXXX', category: 'analytics' },
  { id: 'google_ads', label: 'Google Ads', placeholder: 'AW-123456789', category: 'marketing' },
  { id: 'tiktok', label: 'TikTok Pixel', placeholder: 'C4ABCDEFGHIJKL1234', category: 'marketing' },
  { id: 'linkedin', label: 'LinkedIn Insight Tag', placeholder: '1234567', category: 'marketing' },
] as const

export function PixelForm({ workspaceType, pageId, existing }: { workspaceType: string; pageId: string; existing: string[] }) {
  const available = PROVIDERS.filter(p => !existing.includes(p.id))
  const [provider, setProvider] = useState<string>(available[0]?.id ?? 'meta')
  const [pixelId, setPixelId] = useState('')
  const [category, setCategory] = useState<'analytics' | 'marketing'>(PROVIDERS.find(p => p.id === provider)?.category ?? 'marketing')
  const { run, pending } = useAction()
  if (!available.length) return <p className="text-[12px] text-slate-500">Every supported provider is already configured on this page.</p>
  const def = PROVIDERS.find(p => p.id === provider)
  return (
    <form className="grid items-end gap-2.5 md:grid-cols-[190px_1fr_170px_auto]" onSubmit={e => {
      e.preventDefault()
      run(() => upsertPixel({ workspaceType, pageId, provider, pixelId, consentCategory: category }), { success: 'Pixel saved' }, () => setPixelId(''))
    }}>
      <FormRow label="Provider" htmlFor="px-provider"><select id="px-provider" value={provider} onChange={e => { setProvider(e.target.value); setCategory(PROVIDERS.find(p => p.id === e.target.value)?.category ?? 'marketing') }} className={input}>{available.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></FormRow>
      <FormRow label="Pixel / measurement ID" htmlFor="px-id" hint="Public IDs only — never paste API secrets."><input id="px-id" value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder={def?.placeholder} className={input} /></FormRow>
      <FormRow label="Consent category" htmlFor="px-cat"><select id="px-cat" value={category} onChange={e => setCategory(e.target.value as 'analytics' | 'marketing')} className={input}><option value="analytics">Analytics</option><option value="marketing">Marketing</option></select></FormRow>
      <button type="submit" disabled={pending || !pixelId.trim()} className={cn(buttonClass.primary, 'h-9')}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add pixel</button>
    </form>
  )
}

export function PixelActions({ workspaceType, pageId, provider, enabled, approved, canManage, canApprove }: { workspaceType: string; pageId: string; provider: string; enabled: boolean; approved: boolean; canManage: boolean; canApprove: boolean }) {
  const { run, pending } = useAction()
  return (
    <div className="flex justify-end gap-3 text-[11.5px]">
      {!approved && <button type="button" disabled={!canApprove || pending} title={canApprove ? undefined : 'An approver must approve this pixel.'} className="font-medium text-emerald-700 disabled:text-slate-400" onClick={() => run(() => setPixelState({ workspaceType, pageId, provider, action: 'approve' }), { success: 'Pixel approved' })}>Approve</button>}
      <button type="button" disabled={!canManage || pending} className="font-medium text-slate-600 disabled:text-slate-400" onClick={() => run(() => setPixelState({ workspaceType, pageId, provider, action: enabled ? 'disable' : 'enable' }), { success: enabled ? 'Pixel disabled' : 'Pixel enabled' })}>{enabled ? 'Disable' : 'Enable'}</button>
      <button type="button" disabled={!canManage || pending} className="font-medium text-red-600 disabled:text-slate-400" onClick={() => run(() => setPixelState({ workspaceType, pageId, provider, action: 'remove' }), { success: 'Pixel removed', confirm: 'Remove this pixel from the page?' })}>Remove</button>
    </div>
  )
}

// ---------------------------------------------------------------- settings

type SettingsValues = {
  title: string; slug: string; description: string; ownerId: string; goal: string; campaignId: string; themeId: string; tags: string
  visibility: 'public' | 'private'; indexInSearch: boolean; utmTracking: boolean; seoTitle: string; seoDescription: string; ogImage: string
  privacyUrl: string; termsUrl: string; disclosure: string; consentBanner: boolean; scheduledPublishAt: string; scheduledUnpublishAt: string; domainId: string
}

export function SettingsForm({ workspaceType, pageId, initial, members, campaigns, themes, domains, disabledReason, canPublish, canDomains }: {
  workspaceType: string; pageId: string; initial: SettingsValues; disabledReason: string | null; canPublish: boolean; canDomains: boolean
  members: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; themes: { id: string; name: string }[]; domains: { id: string; hostname: string; status: string }[]
}) {
  const [v, setV] = useState(initial)
  const { run, pending } = useAction()
  const disabled = !!disabledReason
  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => setV(prev => ({ ...prev, [key]: value }))
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)

  const save = () => {
    const patch: PageSettingsPatch = {
      title: v.title, slug: v.slug, description: v.description, ownerId: v.ownerId, goal: v.goal, campaignId: v.campaignId || null, themeId: v.themeId || null,
      tags: v.tags.split(',').map(t => t.trim()).filter(Boolean), visibility: v.visibility, indexInSearch: v.indexInSearch, utmTracking: v.utmTracking,
      seoTitle: v.seoTitle, seoDescription: v.seoDescription, ogImage: v.ogImage, privacyUrl: v.privacyUrl || null, termsUrl: v.termsUrl || null,
      disclosure: v.disclosure, consentBanner: v.consentBanner, domainId: v.domainId || null,
      ...(canPublish ? { scheduledPublishAt: v.scheduledPublishAt ? new Date(v.scheduledPublishAt).toISOString() : null } : {}),
      scheduledUnpublishAt: v.scheduledUnpublishAt ? new Date(v.scheduledUnpublishAt).toISOString() : null,
    }
    if (!canDomains) delete patch.domainId
    run(() => updatePageSettings({ workspaceType, pageId, patch }), { success: 'Settings saved' })
  }

  const section = (title: string, id: string, children: ReactNode) => (
    <section id={id} className="scroll-mt-24 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  )
  const check = (key: 'indexInSearch' | 'utmTracking' | 'consentBanner', label: string, hint: string) => (
    <label className="flex items-start gap-2.5 text-[12px] text-slate-700">
      <input type="checkbox" checked={v[key]} disabled={disabled} onChange={e => set(key, e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1a5cff]" />
      <span><span className="font-medium">{label}</span><span className="block text-[11px] text-slate-500">{hint}</span></span>
    </label>
  )

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
      {disabledReason && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">{disabledReason}</p>}
      {section('Identity', 'identity', <>
        <FormRow label="Page title" htmlFor="s-title"><input id="s-title" value={v.title} maxLength={80} disabled={disabled} onChange={e => set('title', e.target.value)} className={input} /></FormRow>
        <FormRow label="Slug" htmlFor="s-slug" hint={`Public URL: /l/${slugify(v.slug) || '…'}`}><input id="s-slug" value={v.slug} maxLength={50} disabled={disabled} onChange={e => set('slug', e.target.value)} className={input} /></FormRow>
        <FormRow label="Description" htmlFor="s-desc"><input id="s-desc" value={v.description} maxLength={300} disabled={disabled} onChange={e => set('description', e.target.value)} className={input} /></FormRow>
        <FormRow label="Owner" htmlFor="s-owner"><select id="s-owner" value={v.ownerId} disabled={disabled} onChange={e => set('ownerId', e.target.value)} className={input}>{members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FormRow>
        <FormRow label="Goal" htmlFor="s-goal"><select id="s-goal" value={v.goal} disabled={disabled} onChange={e => set('goal', e.target.value)} className={input}>{[['clicks', 'Drive clicks'], ['sales', 'Drive sales'], ['leads', 'Capture leads'], ['registrations', 'Registrations'], ['waitlist', 'Grow a waitlist'], ['downloads', 'App downloads'], ['rsvp', 'Event RSVPs']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormRow>
        <FormRow label="Campaign" htmlFor="s-campaign"><select id="s-campaign" value={v.campaignId} disabled={disabled} onChange={e => set('campaignId', e.target.value)} className={input}><option value="">No campaign</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FormRow>
        <FormRow label="Theme" htmlFor="s-theme" hint="Live visitors see the theme after the next publish."><select id="s-theme" value={v.themeId} disabled={disabled} onChange={e => set('themeId', e.target.value)} className={input}><option value="">Default</option>{themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></FormRow>
        <FormRow label="Tags" htmlFor="s-tags" hint="Comma separated"><input id="s-tags" value={v.tags} disabled={disabled} onChange={e => set('tags', e.target.value)} className={input} /></FormRow>
      </>)}
      {section('Domain', 'domain', <>
        <FormRow label="Domain" htmlFor="s-domain" hint={canDomains ? 'Only verified domains serve pages.' : 'Custom domains are included from the Team plan.'}>
          <select id="s-domain" value={v.domainId} disabled={disabled || !canDomains} onChange={e => set('domainId', e.target.value)} className={input}>
            <option value="">Caption Fox hosted URL</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.hostname} ({d.status})</option>)}
          </select>
        </FormRow>
      </>)}
      {section('Visibility & SEO', 'seo', <>
        <FormRow label="Who can view this page" htmlFor="s-vis"><select id="s-vis" value={v.visibility} disabled={disabled} onChange={e => set('visibility', e.target.value as 'public' | 'private')} className={input}><option value="public">Public</option><option value="private">Private (team only)</option></select></FormRow>
        <div className="flex items-end">{check('indexInSearch', 'Index in search engines', 'Turn off to add a noindex tag.')}</div>
        <FormRow label="SEO title" htmlFor="s-seot"><input id="s-seot" value={v.seoTitle} maxLength={70} disabled={disabled} onChange={e => set('seoTitle', e.target.value)} className={input} /></FormRow>
        <FormRow label="SEO description" htmlFor="s-seod"><input id="s-seod" value={v.seoDescription} maxLength={160} disabled={disabled} onChange={e => set('seoDescription', e.target.value)} className={input} /></FormRow>
        <FormRow label="Social share image" htmlFor="s-og" hint="https:// image from your asset library"><input id="s-og" value={v.ogImage} disabled={disabled} onChange={e => set('ogImage', e.target.value)} className={input} /></FormRow>
      </>)}
      {section('Publishing & tracking', 'publishing', <>
        <FormRow label="Publish on" htmlFor="s-pub" hint={canPublish ? 'Times are Europe/London.' : 'Only publishers can schedule.'}><input id="s-pub" type="datetime-local" value={v.scheduledPublishAt} disabled={disabled || !canPublish} onChange={e => set('scheduledPublishAt', e.target.value)} className={input} /></FormRow>
        <FormRow label="Automatically unpublish on" htmlFor="s-unpub"><input id="s-unpub" type="datetime-local" value={v.scheduledUnpublishAt} disabled={disabled} onChange={e => set('scheduledUnpublishAt', e.target.value)} className={input} /></FormRow>
        {check('utmTracking', 'UTM tracking', 'Automatically add UTM parameters to outbound links.')}
      </>)}
      {section('Legal & consent', 'legal', <>
        <FormRow label="Privacy policy URL" htmlFor="s-priv"><input id="s-priv" value={v.privacyUrl} disabled={disabled} onChange={e => set('privacyUrl', e.target.value)} className={input} placeholder="https://" /></FormRow>
        <FormRow label="Terms URL" htmlFor="s-terms"><input id="s-terms" value={v.termsUrl} disabled={disabled} onChange={e => set('termsUrl', e.target.value)} className={input} placeholder="https://" /></FormRow>
        <FormRow label="Disclosure" htmlFor="s-disc" hint="e.g. affiliate or sponsorship disclosure"><input id="s-disc" value={v.disclosure} maxLength={300} disabled={disabled} onChange={e => set('disclosure', e.target.value)} className={input} /></FormRow>
        <div className="flex items-end">{check('consentBanner', 'Cookie consent banner', 'Required when tracking pixels are enabled.')}</div>
      </>)}
      {!disabled && (
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur">
          {dirty && <span className="text-[12px] text-slate-500">Unsaved changes</span>}
          <button type="button" disabled={!dirty || pending} onClick={() => setV(initial)} className={buttonClass.secondary}>Discard</button>
          <button type="submit" disabled={!dirty || pending} className={buttonClass.primary}>{pending && <Loader2 size={14} className="animate-spin" />} Save settings</button>
        </div>
      )}
    </form>
  )
}

export function DomainConnect({ workspaceType, domains }: { workspaceType: string; domains: { id: string; hostname: string; status: string; token?: string; lastError?: string | null }[] }) {
  const [hostname, setHostname] = useState('')
  const [token, setToken] = useState<{ host: string; token: string } | null>(null)
  const { run, pending } = useAction()
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); run(() => connectDomain({ workspaceType, hostname }), { success: 'Domain added — add the DNS record to verify' }, data => { setToken({ host: hostname, token: data.token }); setHostname('') }) }}>
        <FormRow label="Connect a domain" htmlFor="dom-host" hint="Use a subdomain you control, e.g. link.yourbrand.com"><input id="dom-host" value={hostname} onChange={e => setHostname(e.target.value)} className={cn(input, 'w-64')} placeholder="link.yourbrand.com" /></FormRow>
        <button type="submit" disabled={pending || !hostname.trim()} className={buttonClass.secondary}>Add domain</button>
      </form>
      {token && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-[12px] text-slate-700">
          Add this TXT record at your DNS provider, then press Verify:
          <dl className="mt-2 grid grid-cols-[70px_1fr] gap-y-1 font-mono text-[11.5px]"><dt>Name</dt><dd>_captionfox.{token.host}</dd><dt>Value</dt><dd className="break-all">captionfox-verify={token.token}</dd></dl>
        </div>
      )}
      <ul className="divide-y divide-slate-100">
        {domains.map(d => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]">
            <span className="font-medium text-slate-800">{d.hostname}</span>
            <span className="flex items-center gap-3">
              <span className={cn('text-[11px]', d.status === 'verified' ? 'text-emerald-600' : d.status === 'failed' ? 'text-red-600' : 'text-amber-600')}>{d.status === 'verified' ? 'Verified' : d.status === 'failed' ? 'Verification failed' : 'Pending DNS'}</span>
              {d.status !== 'verified' && <button type="button" disabled={pending} className="font-medium text-[#1a5cff]" onClick={() => run(() => verifyDomain({ workspaceType, domainId: d.id }), { success: 'Domain verified' })}>Verify</button>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- versions

export function RestoreVersionButton({ workspaceType, pageId, version, disabledReason }: { workspaceType: string; pageId: string; version: number; disabledReason: string | null }) {
  const { run, pending } = useAction()
  return (
    <button type="button" disabled={pending || !!disabledReason} title={disabledReason ?? undefined} className="text-[11.5px] font-medium text-[#1a5cff] disabled:text-slate-400"
      onClick={() => run(() => restorePageVersion({ workspaceType, pageId, version }), { success: `Restored v${version} as a new draft version`, confirm: `Restore v${version}? Current blocks are replaced by that version; history is kept and you can publish when ready.` })}>
      Restore
    </button>
  )
}

export function ReviewButtons({ workspaceType, pageId }: { workspaceType: string; pageId: string }) {
  const { run, pending } = useAction()
  return (
    <div className="flex gap-2">
      <button type="button" disabled={pending} className={buttonClass.primary} onClick={() => run(() => reviewPage({ workspaceType, pageId, decision: 'approved' }), { success: 'Approved' })}>Approve</button>
      <button type="button" disabled={pending} className={buttonClass.secondary} onClick={() => {
        run(() => reviewPage({ workspaceType, pageId, decision: 'changes_requested' }), { success: 'Changes requested' })
        notify('The owner will see “changes requested” on this page.')
      }}>Request changes</button>
    </div>
  )
}
