'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrandKit, createLicense, createProduct } from '@/lib/brand-assets/actions'
import { btn } from './Dialog'

/** Form shell: stepper, per-field error, Save draft / Submit with duplicate-submit protection. */
function useSubmit() {
  const [pending, start] = useTransition()
  const [error, setError] = useState<{ text: string; field?: string } | null>(null)
  return { pending, error, setError, start }
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={btn.label}>{label}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}</span>
      {children}
      {error && <span role="alert" className="mt-1 block text-[11.5px] text-rose-600">{error}</span>}
    </label>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-slate-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600">{n}</span>{title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

const FONTS = ['Inter', 'DM Sans', 'Poppins', 'Manrope', 'Lora', 'Space Grotesk', 'IBM Plex Sans', 'Source Sans 3', 'Roboto', 'Montserrat']

export function CreateKitForm({ workspaceType, brands, base }: { workspaceType: string; brands: { id: string; name: string }[]; base: string }) {
  const router = useRouter()
  const { pending, error, setError, start } = useSubmit()
  const [f, setF] = useState({ brandId: brands[0]?.id ?? '', name: '', description: '', teamName: '', headingFont: 'Inter', bodyFont: 'Inter', toneStatement: '', toneTraits: '' })
  const [colours, setColours] = useState([{ name: 'Primary', hex: '#2563EB', role: 'primary' }, { name: 'Navy', hex: '#0F172A', role: 'secondary' }, { name: 'White', hex: '#FFFFFF', role: 'surface' }])
  const err = (k: string) => (error?.field === k ? error.text : null)
  const save = (submit: boolean) => start(async () => {
    setError(null)
    const res = await createBrandKit(workspaceType, { ...f, colours, submit, toneTraits: f.toneTraits.split(',').map(t => t.trim()).filter(Boolean) })
    if (!res.ok) { setError({ text: res.error, field: res.field }); return }
    router.push(`${base}/kits/${res.data.id}`)
  })
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(true) }}>
      <Section n={1} title="Brand and kit name">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Brand" error={err('brandId')}><select className={btn.field} value={f.brandId} onChange={e => setF({ ...f, brandId: e.target.value })}>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Kit name" error={err('name')}><input className={btn.field} required minLength={2} maxLength={120} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Acme Sport Brand Kit" /></Field>
          <Field label="Team" hint="(optional)"><input className={btn.field} maxLength={60} value={f.teamName} onChange={e => setF({ ...f, teamName: e.target.value })} placeholder="Marketing Team" /></Field>
          <Field label="Description" hint="(optional)"><input className={btn.field} maxLength={600} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        </div>
      </Section>
      <Section n={2} title="Colour system">
        {err('colours') && <p role="alert" className="text-[11.5px] text-rose-600">{err('colours')}</p>}
        <ul className="space-y-2">
          {colours.map((c, i) => (
            <li key={i} className="grid grid-cols-[36px_1fr_110px_120px_32px] items-center gap-2">
              <input type="color" aria-label={`Colour ${i + 1} swatch`} value={/^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : '#000000'} onChange={e => setColours(cs => cs.map((x, j) => j === i ? { ...x, hex: e.target.value.toUpperCase() } : x))} className="h-9 w-9 cursor-pointer rounded border border-slate-200" />
              <input aria-label={`Colour ${i + 1} name`} className={btn.field} value={c.name} onChange={e => setColours(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <input aria-label={`Colour ${i + 1} hex`} className={cn(btn.field, 'font-mono uppercase')} value={c.hex} onChange={e => setColours(cs => cs.map((x, j) => j === i ? { ...x, hex: e.target.value } : x))} />
              <select aria-label={`Colour ${i + 1} role`} className={btn.field} value={c.role} onChange={e => setColours(cs => cs.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
                {['primary', 'secondary', 'accent', 'neutral', 'surface'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" aria-label={`Remove colour ${i + 1}`} onClick={() => setColours(cs => cs.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {colours.length < 12 && <button type="button" className={btn.secondary} onClick={() => setColours(cs => [...cs, { name: `Colour ${cs.length + 1}`, hex: '#94A3B8', role: 'neutral' }])}><Plus size={14} />Add colour</button>}
      </Section>
      <Section n={3} title="Typography">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Heading font" error={err('fonts')}><select className={btn.field} value={f.headingFont} onChange={e => setF({ ...f, headingFont: e.target.value })}>{FONTS.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Body font"><select className={btn.field} value={f.bodyFont} onChange={e => setF({ ...f, bodyFont: e.target.value })}>{FONTS.map(x => <option key={x}>{x}</option>)}</select></Field>
        </div>
      </Section>
      <Section n={4} title="Tone of voice">
        <Field label="Voice statement" hint="(optional)"><textarea className={cn(btn.field, 'h-20 py-2')} maxLength={400} value={f.toneStatement} onChange={e => setF({ ...f, toneStatement: e.target.value })} placeholder="We are clear, confident and human…" /></Field>
        <Field label="Traits" hint="(comma separated)"><input className={btn.field} value={f.toneTraits} onChange={e => setF({ ...f, toneTraits: e.target.value })} placeholder="Clear, Confident, Helpful" /></Field>
      </Section>
      {error && !error.field && <p role="alert" className="text-[12.5px] text-rose-600">{error.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={pending} className={btn.secondary} onClick={() => save(false)}>Save draft</button>
        <button type="submit" disabled={pending} className={btn.primary}>{pending && <Loader2 size={14} className="animate-spin" />}Submit for approval</button>
      </div>
    </form>
  )
}

const LICENSE_TYPES = [['standard', 'Standard'], ['exclusive', 'Exclusive'], ['non_exclusive', 'Non-exclusive'], ['campaign', 'Campaign'], ['royalty_free', 'Royalty-free'], ['design', 'Design'], ['trademark', 'Trademark'], ['video', 'Video'], ['image', 'Image'], ['music', 'Music']] as const

export function CreateLicenseForm({ workspaceType, base, brands, assets, products, territories, channels }: {
  workspaceType: string; base: string; brands: { id: string; name: string }[]
  assets: { id: string; file_name: string }[]; products: { id: string; name: string; sku: string }[]
  territories: { id: string; name: string }[]; channels: { id: string; name: string }[]
}) {
  const router = useRouter()
  const { pending, error, setError, start } = useSubmit()
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ name: '', reference: '', licenseType: 'standard', licensor: '', licensee: '', assetId: '', productId: '', brandId: '', startsOn: today, expiresOn: '', usageScope: '', exclusivity: false, modificationAllowed: true, notes: '' })
  const [terr, setTerr] = useState<string[]>([]); const [chan, setChan] = useState<string[]>([])
  const err = (k: string) => (error?.field === k ? error.text : null)
  const pick = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  const save = (submit: boolean) => start(async () => {
    setError(null)
    const res = await createLicense(workspaceType, { ...f, assetId: f.assetId || null, productId: f.productId || null, brandId: f.brandId || null, expiresOn: f.expiresOn || null, territoryIds: terr, channelIds: chan, submit })
    if (!res.ok) { setError({ text: res.error, field: res.field }); return }
    router.push(`${base}/rights/${res.data.id}`)
  })
  const chip = (on: boolean) => cn('rounded-full border px-2.5 py-1 text-[11.5px]', on ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(true) }}>
      <Section n={1} title="Licence">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Licence name" error={err('name')}><input required className={btn.field} maxLength={160} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Reference" hint="(optional, unique)" error={err('reference')}><input className={btn.field} maxLength={60} value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} placeholder="IMG-2026-SPR" /></Field>
          <Field label="Licence type" error={err('licenseType')}><select className={btn.field} value={f.licenseType} onChange={e => setF({ ...f, licenseType: e.target.value })}>{LICENSE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Brand" hint="(optional)"><select className={btn.field} value={f.brandId} onChange={e => setF({ ...f, brandId: e.target.value })}><option value="">—</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Licensor"><input className={btn.field} maxLength={120} value={f.licensor} onChange={e => setF({ ...f, licensor: e.target.value })} /></Field>
          <Field label="Licensee"><input className={btn.field} maxLength={120} value={f.licensee} onChange={e => setF({ ...f, licensee: e.target.value })} /></Field>
        </div>
      </Section>
      <Section n={2} title="What it covers">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asset" hint="(optional)" error={err('assetId')}><select className={btn.field} value={f.assetId} onChange={e => setF({ ...f, assetId: e.target.value })}><option value="">—</option>{assets.map(a => <option key={a.id} value={a.id}>{a.file_name}</option>)}</select></Field>
          <Field label="Product" hint="(optional)" error={err('productId')}><select className={btn.field} value={f.productId} onChange={e => setF({ ...f, productId: e.target.value })}><option value="">—</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></Field>
        </div>
        <fieldset><legend className={btn.label}>Territories</legend>{err('territories') && <p role="alert" className="mb-1 text-[11.5px] text-rose-600">{err('territories')}</p>}
          <div className="flex flex-wrap gap-1.5">{territories.map(t => <button key={t.id} type="button" aria-pressed={terr.includes(t.id)} className={chip(terr.includes(t.id))} onClick={() => pick(terr, setTerr, t.id)}>{t.name}</button>)}</div></fieldset>
        <fieldset><legend className={btn.label}>Channels</legend>{err('channels') && <p role="alert" className="mb-1 text-[11.5px] text-rose-600">{err('channels')}</p>}
          <div className="flex flex-wrap gap-1.5">{channels.map(c => <button key={c.id} type="button" aria-pressed={chan.includes(c.id)} className={chip(chan.includes(c.id))} onClick={() => pick(chan, setChan, c.id)}>{c.name}</button>)}</div></fieldset>
        <Field label="Usage scope" hint="(optional)"><input className={btn.field} maxLength={120} value={f.usageScope} onChange={e => setF({ ...f, usageScope: e.target.value })} placeholder="Marketing, Web, Social" /></Field>
        <div className="flex flex-wrap gap-4 text-[12.5px] text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={f.exclusivity} onChange={e => setF({ ...f, exclusivity: e.target.checked })} />Exclusive</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={f.modificationAllowed} onChange={e => setF({ ...f, modificationAllowed: e.target.checked })} />Modification allowed</label>
        </div>
      </Section>
      <Section n={3} title="Term">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start date" error={err('startsOn')}><input type="date" required className={btn.field} value={f.startsOn} onChange={e => setF({ ...f, startsOn: e.target.value })} /></Field>
          <Field label="Expiry date" hint="(blank = perpetual)" error={err('expiresOn')}><input type="date" min={f.startsOn} className={btn.field} value={f.expiresOn} onChange={e => setF({ ...f, expiresOn: e.target.value })} /></Field>
        </div>
        <Field label="Notes" hint="(optional)"><textarea className={cn(btn.field, 'h-20 py-2')} maxLength={2000} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      </Section>
      {error && !error.field && <p role="alert" className="text-[12.5px] text-rose-600">{error.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={pending} className={btn.secondary} onClick={() => save(false)}>Save draft</button>
        <button type="submit" disabled={pending} className={btn.primary}>{pending && <Loader2 size={14} className="animate-spin" />}Save licence</button>
      </div>
    </form>
  )
}

export function CreateProductForm({ workspaceType, base, brands, categories }: { workspaceType: string; base: string; brands: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const { pending, error, setError, start } = useSubmit()
  const [f, setF] = useState({ name: '', sku: '', brandId: '', categoryId: '', description: '', productLine: '', markets: 'UK' })
  const err = (k: string) => (error?.field === k ? error.text : null)
  const save = (submit: boolean) => start(async () => {
    setError(null)
    const res = await createProduct(workspaceType, { ...f, brandId: f.brandId || null, categoryId: f.categoryId || null, markets: f.markets.split(/[,; ]+/), submit })
    if (!res.ok) { setError({ text: res.error, field: res.field }); return }
    router.push(`${base}/products/${res.data.id}`)
  })
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(true) }}>
      <Section n={1} title="Product identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product name" error={err('name')}><input required className={btn.field} maxLength={160} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="SKU" hint="(unique)" error={err('sku')}><input required className={cn(btn.field, 'font-mono uppercase')} maxLength={40} value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} placeholder="ACM-7001" /></Field>
          <Field label="Brand"><select className={btn.field} value={f.brandId} onChange={e => setF({ ...f, brandId: e.target.value })}><option value="">—</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Category"><select className={btn.field} value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Product line" hint="(optional)"><input className={btn.field} maxLength={80} value={f.productLine} onChange={e => setF({ ...f, productLine: e.target.value })} /></Field>
          <Field label="Markets" hint="(ISO codes, e.g. UK, US, DE)"><input className={cn(btn.field, 'uppercase')} value={f.markets} onChange={e => setF({ ...f, markets: e.target.value })} /></Field>
        </div>
        <Field label="Description" hint="(20+ characters counts toward readiness)"><textarea className={cn(btn.field, 'h-24 py-2')} maxLength={2000} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      </Section>
      <p className="text-[12px] text-slate-500">After saving, link packshots, lifestyle imagery and video from the product page — campaign readiness is recalculated from what is linked.</p>
      {error && !error.field && <p role="alert" className="text-[12.5px] text-rose-600">{error.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={pending} className={btn.secondary} onClick={() => save(false)}>Save draft</button>
        <button type="submit" disabled={pending} className={btn.primary}>{pending && <Loader2 size={14} className="animate-spin" />}Create &amp; submit for review</button>
      </div>
    </form>
  )
}
