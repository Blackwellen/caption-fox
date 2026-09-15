'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/campaigns/Toast'
import { importPartners, type ImportPartnerRow } from '@/app/app/partnerships/actions'
import type { ProgrammeRow } from '@/lib/partnerships/types'

const FIELD = 'h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
const LABEL = 'mb-1 block text-[11px] font-medium text-slate-600'

/** Minimal RFC-4180-ish CSV parser — good enough for a name/email/handle/region file. */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  const parseLine = (line: string) => {
    const cells: string[] = []
    let cur = ''; let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cells.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  }
  const [headerLine, ...rest] = lines
  return { headers: parseLine(headerLine ?? '').map(h => h.toLowerCase()), rows: rest.map(parseLine) }
}

function toPartnerRows(headers: string[], rows: string[][]): ImportPartnerRow[] {
  const idx = (name: string) => headers.indexOf(name)
  const nameIdx = idx('name'); const emailIdx = idx('email'); const handleIdx = idx('handle'); const regionIdx = idx('region')
  return rows.map(row => ({
    name: nameIdx >= 0 ? row[nameIdx] ?? '' : '',
    email: emailIdx >= 0 ? row[emailIdx] : undefined,
    handle: handleIdx >= 0 ? row[handleIdx] : undefined,
    region: regionIdx >= 0 ? row[regionIdx] : undefined,
  }))
}

export default function ImportButton({
  programmes, partnerType,
}: { programmes: ProgrammeRow[]; partnerType: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: { row: number; reason: string }[] } | null>(null)
  const [preview, setPreview] = useState<ImportPartnerRow[]>([])
  const [programmeId, setProgrammeId] = useState(programmes[0]?.id ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { notify } = useToast()

  function handleFile(file: File) {
    setError(null); setResult(null)
    file.text().then(text => {
      const { headers, rows } = parseCsv(text)
      if (!headers.includes('name')) { setError('CSV must include a "name" column.'); setPreview([]); return }
      setPreview(toPartnerRows(headers, rows).slice(0, 500))
    }).catch(() => setError('Could not read that file.'))
  }

  function submit() {
    setError(null)
    if (!programmeId) { setError('Select a programme to import into.'); return }
    if (preview.length === 0) { setError('Choose a CSV file with at least one row.'); return }
    startTransition(async () => {
      const res = await importPartners(programmeId, partnerType, preview)
      if (!res.ok) { setError(res.error ?? 'Import failed.'); return }
      setResult({ imported: res.imported, skipped: res.skipped })
      notify('success', `${res.imported} partner${res.imported === 1 ? '' : 's'} imported.`)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <Upload size={14} />
        Import
      </button>

      <Modal
        open={open} onClose={() => setOpen(false)} title="Import partners" size="lg"
        description="Upload a CSV with name, email, handle and region columns. Every imported partner starts active in the programme you choose."
        footer={
          <>
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Close</button>
            <button
              onClick={submit} disabled={pending || preview.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Importing…' : `Import ${preview.length || ''} partner${preview.length === 1 ? '' : 's'}`}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          {result && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
              Imported {result.imported} partner{result.imported === 1 ? '' : 's'}.
              {result.skipped.length > 0 && ` Skipped ${result.skipped.length} row${result.skipped.length === 1 ? '' : 's'}: ${result.skipped.map(s => `#${s.row} (${s.reason})`).join(', ')}.`}
            </p>
          )}
          <label className="block">
            <span className={LABEL}>Programme <span className="text-red-500">*</span></span>
            <select value={programmeId} onChange={e => setProgrammeId(e.target.value)} className={FIELD}>
              {programmes.length === 0 && <option value="">No programmes yet</option>}
              {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>CSV file</span>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              className="block w-full text-[13px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </label>

          {preview.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-400">
                  <tr><th className="px-2.5 py-1.5">Name</th><th className="px-2.5 py-1.5">Email</th><th className="px-2.5 py-1.5">Handle</th><th className="px-2.5 py-1.5">Region</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.slice(0, 20).map((row, i) => (
                    <tr key={i} className={row.name ? '' : 'bg-red-50 text-red-600'}>
                      <td className="px-2.5 py-1.5">{row.name || '(missing name)'}</td>
                      <td className="px-2.5 py-1.5">{row.email ?? '—'}</td>
                      <td className="px-2.5 py-1.5">{row.handle ?? '—'}</td>
                      <td className="px-2.5 py-1.5">{row.region ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && <p className="px-2.5 py-1.5 text-[11px] text-slate-400">+{preview.length - 20} more rows not shown</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
