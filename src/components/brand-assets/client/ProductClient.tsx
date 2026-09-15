'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, Bookmark, Download, FileSpreadsheet, Link2, Loader2, MoreHorizontal, Pencil, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  importProducts, linkAssetsToProduct, setProductStatus, toggleProductFavourite, type ImportRowResult,
} from '@/lib/brand-assets/actions'
import Dialog, { btn } from './Dialog'

function useUrlDialog(key: string) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams()
  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString()); next.delete(key)
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [key, params, pathname, router])
  return { open: params.get(key) === '1', close, params }
}

/** Bookmark with optimistic toggle and rollback. */
export function ProductBookmark({ workspaceType, productId, initial, name }: { workspaceType: string; productId: string; initial: boolean; name: string }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <button type="button" aria-pressed={on} aria-label={on ? `Remove bookmark from ${name}` : `Bookmark ${name}`} disabled={pending}
      onClick={() => { const prev = on; setOn(!prev); start(async () => { const r = await toggleProductFavourite(workspaceType, productId); if (!r.ok) setOn(prev) }) }}
      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-500 shadow-sm hover:text-blue-600">
      <Bookmark size={12} fill={on ? 'currentColor' : 'none'} className={on ? 'text-blue-600' : undefined} />
    </button>
  )
}

export function ProductMenu({
  workspaceType, productId, name, status, href, canEdit, canApprove, canArchive,
}: { workspaceType: string; productId: string; name: string; status: string; href: string; canEdit: boolean; canApprove: boolean; canArchive: boolean }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const run = (s: Parameters<typeof setProductStatus>[2]) => start(async () => {
    const res = await setProductStatus(workspaceType, productId, s)
    setOpen(false); setMsg(res.ok ? { ok: true, text: res.message ?? 'Updated' } : { ok: false, text: res.error })
    if (res.ok) router.refresh()
    setTimeout(() => setMsg(null), 4500)
  })
  const item = 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50'
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${name}`} onClick={() => setOpen(o => !o)}
        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        {pending ? <Loader2 size={13} className="animate-spin" /> : <MoreHorizontal size={15} />}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-30 mb-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <Link role="menuitem" href={href} className={item}><Pencil size={13} className="text-slate-400" />Open product</Link>
          {canEdit && <Link role="menuitem" href={`?link=1&product=${productId}`} scroll={false} className={item}><Link2 size={13} className="text-slate-400" />Link assets</Link>}
          {canEdit && ['draft', 'inactive'].includes(status) && <button role="menuitem" type="button" className={item} onClick={() => run('review')}><Send size={13} className="text-slate-400" />Submit for review</button>}
          {canApprove && status === 'review' && <button role="menuitem" type="button" className={item} onClick={() => run('active')}><Send size={13} className="text-emerald-600" />Approve &amp; activate</button>}
          {canArchive && status !== 'archived' && <button role="menuitem" type="button" className={cn(item, 'text-rose-600')}
            onClick={() => { if (window.confirm(`Archive ${name}? It can be restored later.`)) run('archived') }}><Archive size={13} />Archive</button>}
        </div>
      )}
      {msg && <p role="status" className={cn('absolute bottom-full right-0 z-30 mb-1 w-60 rounded-md px-2.5 py-1.5 text-[11px] shadow-lg', msg.ok ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white')}>{msg.text}</p>}
    </div>
  )
}

const LINK_TYPES = [
  ['primary_image', 'Primary image'], ['packshot', 'Packshot'], ['lifestyle', 'Lifestyle image'], ['video', 'Product video'],
  ['three_sixty', '360° media'], ['packaging', 'Packaging'], ['spec_sheet', 'Specification sheet'], ['social', 'Social asset'],
] as const

/** Link approved assets to a product. URL-driven: ?link=1[&product=id]. */
export function LinkAssetsDialog({
  workspaceType, products, assets,
}: { workspaceType: string; products: { id: string; name: string; sku: string }[]; assets: { id: string; file_name: string; thumbnail_path: string | null; asset_kind: string; rights_state: string }[] }) {
  const { open, close, params } = useUrlDialog('link')
  const [productId, setProductId] = useState(params.get('product') ?? '')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [linkType, setLinkType] = useState('lifestyle')
  const [q, setQ] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string; warnings?: string[] } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  useEffect(() => { if (params.get('product')) setProductId(params.get('product')!) }, [params])
  const shown = useMemo(() => assets.filter(a => a.file_name.toLowerCase().includes(q.toLowerCase())), [assets, q])
  if (!open) return null
  const submit = () => start(async () => {
    const res = await linkAssetsToProduct(workspaceType, productId, [...picked].map(assetId => ({ assetId, linkType })))
    if (!res.ok) { setResult({ ok: false, text: res.error }); return }
    setResult({ ok: true, text: res.message ?? 'Linked', warnings: res.data.warnings })
    setPicked(new Set()); router.refresh()
  })
  return (
    <Dialog wide title="Link Assets" description="Attach approved assets to a product. Links with restricted or expired rights are flagged for review."
      onClose={() => { setResult(null); close() }}
      footer={<><button type="button" className={btn.secondary} onClick={() => { setResult(null); close() }}>Close</button>
        <button type="button" className={btn.primary} disabled={pending || !productId || picked.size === 0} onClick={submit}>
          {pending && <Loader2 size={15} className="animate-spin" />}Link {picked.size || ''} asset{picked.size === 1 ? '' : 's'}</button></>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={btn.label}>Product</span>
          <select className={btn.field} value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">Choose a product…</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
          </select></label>
        <label className="block"><span className={btn.label}>Link as</span>
          <select className={btn.field} value={linkType} onChange={e => setLinkType(e.target.value)}>
            {LINK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
      </div>
      <input className={cn(btn.field, 'mb-2')} value={q} onChange={e => setQ(e.target.value)} placeholder="Search approved assets…" aria-label="Search approved assets" />
      {shown.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-[12.5px] text-slate-500">No approved assets match.</p> : (
        <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          {shown.map(a => {
            const on = picked.has(a.id)
            return (
              <li key={a.id}>
                <label className={cn('block cursor-pointer overflow-hidden rounded-lg border', on ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200')}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })} />
                  <span className="block aspect-[4/3] bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a.thumbnail_path ? <img src={a.thumbnail_path} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] uppercase text-slate-400">{a.asset_kind}</span>}
                  </span>
                  <span className="block truncate px-1.5 py-1 text-[10.5px] text-slate-700">{a.file_name}</span>
                  {['restricted', 'expired'].includes(a.rights_state) && <span className="block px-1.5 pb-1 text-[9.5px] font-medium text-amber-700">Rights {a.rights_state}</span>}
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {result && (
        <div role={result.ok ? 'status' : 'alert'} className={cn('mt-3 rounded-lg px-3 py-2 text-[12px]', result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700')}>
          {result.text}
          {result.warnings?.map(w => <p key={w} className="mt-1 text-amber-800">{w}</p>)}
        </div>
      )}
    </Dialog>
  )
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') quoted = false; else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

/** CSV import with column mapping preview, per-row results and a downloadable error report. URL-driven: ?import=1 */
export function ImportProductsDialog({ workspaceType }: { workspaceType: string }) {
  const { open, close } = useUrlDialog('import')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  if (!open) return null

  const onFile = async (file: File | undefined) => {
    setError(null); setResults(null); setRows([])
    if (!file) return
    if (!/\.csv$/i.test(file.name)) { setError('Choose a .csv file.'); return }
    if (file.size > 2 * 1024 * 1024) { setError('CSV files must be under 2 MB.'); return }
    const table = parseCsv(await file.text())
    if (table.length < 2) { setError('The file needs a header row and at least one product.'); return }
    const header = table[0].map(h => h.trim().toLowerCase())
    if (!header.includes('name') || !header.includes('sku')) { setError('The header row must include "name" and "sku" columns.'); return }
    setRows(table.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))))
  }
  const submit = () => start(async () => {
    const res = await importProducts(workspaceType, rows.map(r => ({ name: r.name, sku: r.sku, category: r.category, description: r.description, markets: r.markets, brand: r.brand })))
    if (!res.ok) { setError(res.error); return }
    setResults(res.data.results); router.refresh()
  })
  const failed = results?.filter(r => r.status !== 'created') ?? []
  const report = failed.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(['row,sku,status,message', ...failed.map(f => `${f.row},"${f.sku}",${f.status},"${f.message}"`)].join('\n'))}` : null

  return (
    <Dialog wide title="Import Products" description="Upload a CSV with columns: name, sku, and optionally category, description, markets (e.g. US;UK), brand. Products import as drafts."
      onClose={() => { setRows([]); setResults(null); close() }}
      footer={<><button type="button" className={btn.secondary} onClick={() => { setRows([]); setResults(null); close() }}>{results ? 'Done' : 'Cancel'}</button>
        {!results && <button type="button" className={btn.primary} disabled={pending || rows.length === 0} onClick={submit}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}Import {rows.length || ''} product{rows.length === 1 ? '' : 's'}</button>}</>}>
      {!results && (
        <input type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} aria-label="Choose CSV file"
          className="mb-3 block w-full text-[12.5px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-blue-700" />
      )}
      {error && <p role="alert" className="mb-3 text-[12px] text-rose-600">{error}</p>}
      {rows.length > 0 && !results && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-[11.5px]">
            <thead><tr className="bg-slate-50 text-slate-500">{['Name', 'SKU', 'Category', 'Markets', 'Brand'].map(h => <th key={h} className="px-2.5 py-1.5 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 8).map((r, i) => <tr key={i}>{[r.name, r.sku, r.category, r.markets, r.brand].map((c, j) => <td key={j} className="max-w-[160px] truncate px-2.5 py-1.5 text-slate-700">{c || '—'}</td>)}</tr>)}
            </tbody>
          </table>
          {rows.length > 8 && <p className="px-2.5 py-1.5 text-[11px] text-slate-500">…and {rows.length - 8} more rows</p>}
        </div>
      )}
      {results && (
        <div role="status">
          <p className="mb-2 text-[13px] font-medium text-slate-800">{results.filter(r => r.status === 'created').length} created · {failed.length} skipped or rejected</p>
          {failed.length > 0 && (
            <ul className="mb-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-[11.5px]">
              {failed.map(f => <li key={f.row} className="flex gap-2 px-2.5 py-1.5"><span className="w-12 text-slate-400">Row {f.row}</span><span className="w-28 truncate text-slate-700">{f.sku || '—'}</span><span className={f.status === 'error' ? 'text-rose-600' : 'text-amber-700'}>{f.message}</span></li>)}
            </ul>
          )}
          {report && <a href={report} download="product-import-errors.csv" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline"><Download size={13} />Download error report</a>}
        </div>
      )}
    </Dialog>
  )
}
