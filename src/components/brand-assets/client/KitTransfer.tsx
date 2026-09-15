'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, FileJson, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrandKit } from '@/lib/brand-assets/actions'
import { KIT_IMPORT_MAX_BYTES, parseKitFile, type ParsedKitFile } from '@/lib/brand-assets/kit-transfer'
import { btn } from './Dialog'

/** Import Kit: read an exported .brandkit.json, preview it, create it as a new kit in this workspace. */
export function ImportKitForm({ workspaceType, brands, base }: { workspaceType: string; brands: { id: string; name: string }[]; base: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [kit, setKit] = useState<ParsedKitFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setError(null); setKit(null)
    if (!file) return
    setFileName(file.name)
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') { setError('Choose a .brandkit.json file exported from Caption Fox.'); return }
    if (file.size > KIT_IMPORT_MAX_BYTES) { setError('That file is larger than 256 KB, which is too big for a brand kit file.'); return }
    const res = parseKitFile(await file.text())
    if (!res.ok) { setError(res.error); return }
    setKit(res.kit)
    setName(res.kit.name)
    const match = brands.find(b => b.name.toLowerCase() === res.kit.sourceBrand?.toLowerCase())
    setBrandId(match?.id ?? brands[0]?.id ?? '')
  }

  const save = (submit: boolean) => start(async () => {
    if (!kit) return
    setError(null)
    const res = await createBrandKit(workspaceType, {
      brandId, name, description: kit.description, teamName: kit.teamName, colours: kit.colours,
      headingFont: kit.headingFont, bodyFont: kit.bodyFont, toneStatement: kit.toneStatement, toneTraits: kit.toneTraits, submit,
    })
    if (!res.ok) { setError(res.error); return }
    router.push(`${base}/kits/${res.data.id}`)
  })

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(false) }}>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-[14px] font-semibold text-slate-900">1. Choose a brand kit file</h2>
        <p className="mb-3 text-[12px] text-slate-500">Use a <code className="rounded bg-slate-100 px-1">.brandkit.json</code> file from <strong>Share → Download brand kit</strong> in any Caption Fox workspace.</p>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-4 hover:border-blue-400 hover:bg-blue-50/30">
          <FileJson size={22} className="shrink-0 text-blue-600" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[13px] text-slate-700">{fileName || 'Select a file…'}</span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={e => onFile(e.target.files?.[0])} aria-label="Brand kit file" />
          <span className={btn.secondary}>Browse</span>
        </label>
      </section>

      {kit && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-[14px] font-semibold text-slate-900">2. Review and name the new kit</h2>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-medium text-slate-700">Kit name
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={120}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </label>
            <label className="block text-[12px] font-medium text-slate-700">Brand in this workspace
              <select value={brandId} onChange={e => setBrandId(e.target.value)} required
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          </div>
          <dl className="grid gap-3 text-[12px] sm:grid-cols-3">
            <div><dt className="text-slate-400">Colours ({kit.colours.length})</dt>
              <dd className="mt-1 flex flex-wrap gap-1">{kit.colours.map(c => <span key={c.hex + c.name} title={`${c.name} ${c.hex}`} className="h-6 w-6 rounded ring-1 ring-inset ring-slate-900/10" style={{ background: c.hex }} />)}</dd></div>
            <div><dt className="text-slate-400">Typography</dt><dd className="mt-1 text-slate-800">{kit.headingFont} / {kit.bodyFont}</dd></div>
            <div><dt className="text-slate-400">Tone of voice</dt><dd className="mt-1 line-clamp-3 text-slate-800">{kit.toneStatement || '—'}</dd></div>
          </dl>
          <p className="mt-3 text-[11.5px] text-slate-500">The import creates a new kit at version 1, owned by you. Logos, templates and guideline files are not part of the file; attach them after import.</p>
        </section>
      )}

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={!kit || pending} className={cn(btn.secondary, 'disabled:opacity-50')}>Save as draft</button>
        <button type="button" disabled={!kit || pending} onClick={() => save(true)} className={cn(btn.primary, 'disabled:opacity-50')}>
          {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}Import and submit for approval
        </button>
      </div>
    </form>
  )
}

/** Copies an absolute link to the current record. */
export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <button type="button" className={btn.secondary} aria-live="polite"
      onClick={async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setCopied(true); setFailed(false); setTimeout(() => setCopied(false), 2000) }
        catch { setFailed(true) }
      }}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Link copied' : failed ? 'Copy failed — use the address bar' : 'Copy workspace link'}
    </button>
  )
}
