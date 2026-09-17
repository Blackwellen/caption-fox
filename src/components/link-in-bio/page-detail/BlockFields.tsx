'use client'

import { useId, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { BlockType } from '@/lib/link-in-bio/blocks'
import type { Block, ChildLink } from '@/lib/link-in-bio/records'

// Inline configuration editors for each block type. Every change updates the
// builder state immediately (so the live preview follows) and the workbench
// debounces the save to the server.

const input = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-50'

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[10.5px] font-medium text-slate-600">{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </div>
  )
}

export type Lookups = {
  products: { id: string; name: string }[]
  forms: { id: string; name: string; status: string }[]
  reusableLinks: { id: string; name: string; destination: string }[]
}

type EditorProps = {
  block: Block
  readOnly: boolean
  lookups: Lookups
  onConfig: (patch: Record<string, unknown>) => void
  onChild: (childId: string, patch: Partial<ChildLink>) => void
  onAddChild: () => void
  onRemoveChild: (childId: string) => void
  onMoveChild: (childId: string, direction: -1 | 1) => void
}

export default function BlockFields({ block, readOnly, lookups, onConfig, onChild, onAddChild, onRemoveChild, onMoveChild }: EditorProps) {
  const c = block.config
  const s = (key: string) => (typeof c[key] === 'string' ? (c[key] as string) : '')
  const text = (key: string, label: string, opts: { placeholder?: string; max?: number; hint?: string; type?: string } = {}) => (
    <Field label={label} hint={opts.hint}>{id => (
      <input id={id} type={opts.type ?? 'text'} value={s(key)} maxLength={opts.max ?? 120} placeholder={opts.placeholder} disabled={readOnly}
        onChange={e => onConfig({ [key]: e.target.value })} className={input} />
    )}</Field>
  )
  const area = (key: string, label: string, hint?: string) => (
    <Field label={label} hint={hint}>{id => (
      <textarea id={id} value={s(key)} rows={3} maxLength={600} disabled={readOnly} onChange={e => onConfig({ [key]: e.target.value })} className={`${input} h-auto py-1.5`} />
    )}</Field>
  )

  const type: BlockType = block.type
  switch (type) {
    case 'hero':
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {text('eyebrow', 'Badge', { max: 24, placeholder: 'ACME' })}
          {text('headline', 'Headline', { max: 60 })}
          {text('subheadline', 'Subheadline', { max: 80 })}
          {text('body', 'Supporting line', { max: 120 })}
          <div className="sm:col-span-2">{text('imageUrl', 'Background image URL', { placeholder: 'https://…', hint: 'Use an https:// image from your asset library.', max: 500 })}</div>
        </div>
      )
    case 'links':
    case 'button_stack':
      return (
        <div className="space-y-2">
          {block.children.length === 0 && <p className="text-[11.5px] text-slate-500">No links yet.</p>}
          {block.children.map((child, index) => (
            <div key={child.id} className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
              <Field label={`Label ${index + 1}`}>{id => <input id={id} value={child.title} maxLength={80} disabled={readOnly} onChange={e => onChild(child.id, { title: e.target.value })} className={input} />}</Field>
              <Field label="URL or reusable link">{id => (
                <div className="flex gap-1.5">
                  <input id={id} value={child.url ?? ''} placeholder="https://" disabled={readOnly || !!child.reusableLinkId} onChange={e => onChild(child.id, { url: e.target.value })} className={input} />
                  <select aria-label={`Reusable link for ${child.title || `link ${index + 1}`}`} value={child.reusableLinkId ?? ''} disabled={readOnly}
                    onChange={e => {
                      const link = lookups.reusableLinks.find(l => l.id === e.target.value)
                      onChild(child.id, { reusableLinkId: link?.id ?? null, url: link?.destination ?? child.url })
                    }}
                    className={`${input} w-[112px] shrink-0`}>
                    <option value="">Direct URL</option>
                    {lookups.reusableLinks.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}</Field>
              <div className="flex gap-0.5 pb-0.5">
                <button type="button" disabled={readOnly || index === 0} onClick={() => onMoveChild(child.id, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${child.title} up`}><ArrowUp size={13} /></button>
                <button type="button" disabled={readOnly || index === block.children.length - 1} onClick={() => onMoveChild(child.id, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${child.title} down`}><ArrowDown size={13} /></button>
                <button type="button" disabled={readOnly} onClick={() => onRemoveChild(child.id)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label={`Remove ${child.title}`}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          {!readOnly && <button type="button" onClick={onAddChild} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#1a5cff] hover:underline"><Plus size={13} /> Add link</button>}
        </div>
      )
    case 'product':
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Product" hint={lookups.products.length ? 'From your Brand product catalogue.' : 'No products in this workspace yet — add them in Brand.'}>{id => (
            <select id={id} value={s('productId')} disabled={readOnly} className={input}
              onChange={e => { const p = lookups.products.find(x => x.id === e.target.value); onConfig({ productId: p?.id ?? null, ...(p ? { name: p.name } : {}) }) }}>
              <option value="">Choose a product…</option>
              {lookups.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}</Field>
          {text('name', 'Display name', { max: 60 })}
          {text('priceLabel', 'Price label', { max: 20, placeholder: '£32.00' })}
          {text('ctaLabel', 'Button label', { max: 24 })}
          {text('url', 'Button URL', { placeholder: 'https://', max: 500 })}
          {text('imageUrl', 'Image URL', { placeholder: 'https://', max: 500 })}
        </div>
      )
    case 'form':
      return (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Form" hint="Submissions are stored with your Web & Conversion forms.">{id => (
            <select id={id} value={s('formId')} disabled={readOnly} onChange={e => onConfig({ formId: e.target.value || null })} className={input}>
              <option value="">Choose a form…</option>
              {lookups.forms.map(f => <option key={f.id} value={f.id} disabled={f.status !== 'published'}>{f.name}{f.status !== 'published' ? ' (not published)' : ''}</option>)}
            </select>
          )}</Field>
          {text('heading', 'Heading', { max: 40 })}
          {text('body', 'Body', { max: 140 })}
          {text('buttonLabel', 'Button label', { max: 24 })}
          <div className="sm:col-span-2">{text('consentText', 'Consent wording', { max: 140, hint: 'Required for governance when collecting emails.' })}</div>
        </div>
      )
    case 'social_proof': {
      const quotes = Array.isArray(c.quotes) ? (c.quotes as { text?: string; author?: string }[]) : []
      return (
        <Field label="Testimonials" hint="One per line, as: quote — author">{id => (
          <textarea id={id} rows={3} disabled={readOnly} className={`${input} h-auto py-1.5`}
            value={quotes.map(q => `${q.text ?? ''}${q.author ? ` — ${q.author}` : ''}`).join('\n')}
            onChange={e => onConfig({ quotes: e.target.value.split('\n').filter(Boolean).slice(0, 10).map(line => { const [t, a] = line.split(' — '); return { text: t.trim().slice(0, 200), author: (a ?? '').trim().slice(0, 60) } }) })} />
        )}</Field>
      )
    }
    case 'faq': {
      const items = Array.isArray(c.items) ? (c.items as { q?: string; a?: string }[]) : []
      return (
        <Field label="Questions" hint="One per line, as: question | answer">{id => (
          <textarea id={id} rows={4} disabled={readOnly} className={`${input} h-auto py-1.5`}
            value={items.map(i => `${i.q ?? ''} | ${i.a ?? ''}`).join('\n')}
            onChange={e => onConfig({ items: e.target.value.split('\n').filter(Boolean).slice(0, 12).map(line => { const [q, a] = line.split('|'); return { q: q.trim().slice(0, 140), a: (a ?? '').trim().slice(0, 400) } }) })} />
        )}</Field>
      )
    }
    case 'pricing': {
      const tiers = Array.isArray(c.tiers) ? (c.tiers as { name?: string; price?: string }[]) : []
      return (
        <Field label="Tiers" hint="One per line, as: name | price">{id => (
          <textarea id={id} rows={3} disabled={readOnly} className={`${input} h-auto py-1.5`}
            value={tiers.map(t => `${t.name ?? ''} | ${t.price ?? ''}`).join('\n')}
            onChange={e => onConfig({ tiers: e.target.value.split('\n').filter(Boolean).slice(0, 3).map(line => { const [name, price] = line.split('|'); return { name: name.trim().slice(0, 40), price: (price ?? '').trim().slice(0, 20) } }) })} />
        )}</Field>
      )
    }
    case 'countdown':
      return <div className="grid gap-2.5 sm:grid-cols-2">{text('label', 'Label', { max: 40 })}<Field label="Ends at">{id => <input id={id} type="datetime-local" disabled={readOnly} value={s('endsAt') ? s('endsAt').slice(0, 16) : ''} onChange={e => onConfig({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={input} />}</Field></div>
    case 'video':
      return <div className="grid gap-2.5 sm:grid-cols-2">{text('url', 'YouTube or Vimeo URL', { placeholder: 'https://youtube.com/watch?v=…', max: 300 })}{text('caption', 'Caption', { max: 80 })}</div>
    case 'image':
      return <div className="grid gap-2.5 sm:grid-cols-2">{text('imageUrl', 'Image URL', { placeholder: 'https://', max: 500 })}{text('alt', 'Alt text', { max: 120, hint: 'Describe the image for screen readers.' })}{text('ctaLabel', 'Button label', { max: 24 })}{text('url', 'Button URL', { placeholder: 'https://', max: 500 })}</div>
    case 'social_feed':
      return text('handle', 'Instagram handle', { placeholder: '@yourbrand', max: 40 })
    case 'text':
      return area('body', 'Text')
    case 'footer': {
      const socials = Array.isArray(c.socials) ? (c.socials as { url?: string }[]) : []
      return (
        <div className="grid gap-2.5">
          <Field label="Social profile URLs" hint="One per line (Instagram, TikTok, YouTube, X, Facebook).">{id => (
            <textarea id={id} rows={3} disabled={readOnly} className={`${input} h-auto py-1.5`} value={socials.map(x => x.url ?? '').join('\n')}
              onChange={e => onConfig({ socials: e.target.value.split('\n').filter(Boolean).slice(0, 6).map(url => ({ url: url.trim() })) })} />
          )}</Field>
          {text('legalText', 'Footer text', { max: 120, placeholder: '© 2026 Your Brand' })}
        </div>
      )
    }
    case 'divider':
    case 'product_grid':
      return <p className="text-[11.5px] text-slate-500">{type === 'divider' ? 'Dividers have no settings.' : 'Add products to the grid from the Products tab.'}</p>
  }
}
