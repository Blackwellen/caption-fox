'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from './Toast'
import { importCampaigns, importTemplates } from '@/app/app/campaigns/import-actions'
import { importGiveawayEntries, importCompetitionSubmissions, type ImportResult } from '@/app/app/campaigns/actions'

const MAX_BYTES = 5 * 1024 * 1024

export type ImportEntity = 'campaigns' | 'templates' | 'giveaway-entries' | 'competition-submissions'

interface EntityConfig {
  label: string
  title: string
  /** Target fields the CSV columns are mapped onto. */
  fields: { key: string; label: string; required?: boolean; aliases: string[] }[]
  needsTarget?: 'giveaway' | 'competition'
  sample: string
}

const CONFIG: Record<ImportEntity, EntityConfig> = {
  campaigns: {
    label: 'Import', title: 'Import campaigns',
    fields: [
      { key: 'name', label: 'Campaign name', required: true, aliases: ['name', 'campaign', 'campaign name', 'title'] },
      { key: 'type', label: 'Campaign type', aliases: ['type', 'campaign type'] },
      { key: 'owner', label: 'Owner (email or name)', aliases: ['owner', 'owner email', 'email'] },
      { key: 'stage', label: 'Stage', aliases: ['stage', 'lifecycle', 'lifecycle stage'] },
      { key: 'priority', label: 'Priority', aliases: ['priority'] },
      { key: 'budget', label: 'Budget', aliases: ['budget', 'amount'] },
      { key: 'start_date', label: 'Start date (YYYY-MM-DD)', aliases: ['start date', 'start', 'start_date'] },
      { key: 'end_date', label: 'End date (YYYY-MM-DD)', aliases: ['end date', 'end', 'end_date', 'due date'] },
      { key: 'channels', label: 'Channels (pipe separated)', aliases: ['channels', 'channel', 'platforms'] },
    ],
    sample: 'name,type,owner,stage,priority,budget,start_date,end_date,channels\nSummer Launch 2026,product_launch,you@example.com,planning,high,45000,2026-06-01,2026-08-31,instagram|tiktok',
  },
  templates: {
    label: 'Import template', title: 'Import campaign templates',
    fields: [
      { key: 'name', label: 'Template name', required: true, aliases: ['name', 'template', 'template name', 'title'] },
      { key: 'description', label: 'Description', aliases: ['description', 'summary'] },
      { key: 'category', label: 'Category', aliases: ['category', 'type'] },
      { key: 'channels', label: 'Channels (pipe separated)', aliases: ['channels', 'channel'] },
      { key: 'budget', label: 'Default budget', aliases: ['budget', 'default budget'] },
    ],
    sample: 'name,description,category,channels,budget\nProduct launch playbook,Six-week multi-channel launch,product_launch,instagram|email,25000',
  },
  'giveaway-entries': {
    label: 'Import entries', title: 'Import giveaway entries',
    needsTarget: 'giveaway',
    fields: [
      { key: 'handle', label: 'Participant handle', required: true, aliases: ['handle', 'username', 'participant', 'participant handle'] },
      { key: 'email', label: 'Email', aliases: ['email', 'email address'] },
      { key: 'method', label: 'Entry method', aliases: ['method', 'entry method', 'entry'] },
    ],
    sample: 'handle,email,method\n@jane.doe,jane@example.com,comment',
  },
  'competition-submissions': {
    label: 'Import submissions', title: 'Import competition submissions',
    needsTarget: 'competition',
    fields: [
      { key: 'handle', label: 'Participant handle', required: true, aliases: ['handle', 'username', 'participant'] },
      { key: 'email', label: 'Email', aliases: ['email'] },
      { key: 'url', label: 'Submission URL', aliases: ['url', 'link', 'submission url'] },
      { key: 'text', label: 'Submission text', aliases: ['text', 'caption', 'entry'] },
    ],
    sample: 'handle,email,url,text\n@jane.doe,jane@example.com,https://example.com/post,My entry',
  },
}

/** Minimal RFC 4180 CSV reader — handles quoted fields, commas and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else quoted = false
      } else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (char !== '\r') cell += char
  }
  if (cell || row.length > 0) { row.push(cell); rows.push(row) }
  return rows.filter(entry => entry.some(value => value.trim() !== ''))
}

export default function ImportButton({
  entity, targets = [], className,
}: {
  entity: ImportEntity
  /** Records the import attaches to, for entry/submission imports. */
  targets?: { id: string; name: string }[]
  className?: string
}) {
  const config = CONFIG[entity]
  const router = useRouter()
  const { notify } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [fileError, setFileError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [targetId, setTargetId] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setHeaders([]); setDataRows([]); setMapping({}); setResult(null); setFileError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    reset()

    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFileError('Only .csv files can be imported.')
      return
    }
    if (file.size > MAX_BYTES) {
      setFileError('That file is larger than the 5 MB import limit.')
      return
    }

    const rows = parseCsv(await file.text())
    if (rows.length < 2) {
      setFileError('The file needs a header row and at least one data row.')
      return
    }

    const head = rows[0].map(value => value.trim())
    setHeaders(head)
    setDataRows(rows.slice(1))

    // Auto-map by column name so a well-formed export imports without fiddling.
    const auto: Record<string, string> = {}
    for (const field of config.fields) {
      const match = head.find(column => field.aliases.includes(column.toLowerCase()))
      if (match) auto[field.key] = match
    }
    setMapping(auto)
  }

  function submit() {
    const missing = config.fields.filter(f => f.required && !mapping[f.key])
    if (missing.length > 0) {
      setFileError(`Map a column for: ${missing.map(f => f.label).join(', ')}.`)
      return
    }
    if (config.needsTarget && !targetId) {
      setFileError(`Choose which ${config.needsTarget} these rows belong to.`)
      return
    }
    setFileError(null)

    const index = Object.fromEntries(
      Object.entries(mapping).map(([key, column]) => [key, headers.indexOf(column)]),
    )
    const payload = dataRows.map(row =>
      Object.fromEntries(Object.entries(index).map(([key, i]) => [key, i >= 0 ? row[i]?.trim() ?? '' : ''])),
    )

    startTransition(async () => {
      const outcome: ImportResult =
        entity === 'campaigns' ? await importCampaigns(payload)
        : entity === 'templates' ? await importTemplates(payload)
        : entity === 'giveaway-entries' ? await importGiveawayEntries(targetId, payload)
        : await importCompetitionSubmissions(targetId, payload)

      setResult(outcome)
      notify(outcome.ok ? 'success' : 'error', outcome.ok ? (outcome.message ?? 'Import complete.') : (outcome.error ?? 'Import failed.'))
      if (outcome.ok) router.refresh()
    })
  }

  function downloadErrorReport() {
    if (!result?.errors?.length) return
    const csv = 'issue\n' + result.errors.map(line => `"${line.replace(/"/g, '""')}"`).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${entity}-import-issues.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50', className)}
      >
        <Upload size={14} />
        {config.label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog" aria-modal="true" aria-labelledby="import-title"
            className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 id="import-title" className="text-[15px] font-semibold text-slate-900">{config.title}</h2>
                <p className="text-xs text-slate-500">
                  CSV only, up to 5 MB. Duplicates are detected and skipped; invalid rows are reported.
                </p>
              </div>
              <button
                type="button" onClick={() => { setOpen(false); reset() }} aria-label="Close"
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </header>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
              {fileError && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  <AlertTriangle size={14} className="mt-px shrink-0" />
                  {fileError}
                </p>
              )}

              {result?.ok ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                    <CheckCircle2 size={14} className="mt-px shrink-0" />
                    <span>
                      <strong>{result.imported}</strong> imported ·{' '}
                      <strong>{result.duplicates}</strong> duplicate{result.duplicates === 1 ? '' : 's'} skipped ·{' '}
                      <strong>{result.invalid}</strong> invalid
                    </span>
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="mb-1 text-[13px] font-medium text-amber-900">Rows that could not be imported</p>
                      <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-amber-800">
                        {result.errors.map(line => <li key={line}>{line}</li>)}
                      </ul>
                      <button
                        type="button" onClick={downloadErrorReport}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline"
                      >
                        <Download size={12} />
                        Download issue report
                      </button>
                    </div>
                  )}
                  <button
                    type="button" onClick={reset}
                    className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Import another file
                  </button>
                </div>
              ) : (
                <>
                  {config.needsTarget && (
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">
                        Import into which {config.needsTarget}? <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={targetId} onChange={e => setTargetId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700"
                      >
                        <option value="">Choose a {config.needsTarget}…</option>
                        {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
                      </select>
                      {targets.length === 0 && (
                        <span className="mt-1 block text-xs text-amber-700">
                          Create a {config.needsTarget} first — there is nothing to import into yet.
                        </span>
                      )}
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">CSV file</span>
                    <input
                      ref={fileInput} type="file" accept=".csv,text/csv" onChange={onFile}
                      className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-3 text-[13px] text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-[13px] file:font-medium file:text-slate-700"
                    />
                  </label>

                  <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <summary className="cursor-pointer text-[13px] font-medium text-slate-700">Accepted format</summary>
                    <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-600">{config.sample}</pre>
                  </details>

                  {headers.length > 0 && (
                    <>
                      <div>
                        <p className="mb-2 text-[13px] font-medium text-slate-900">
                          Map columns <span className="font-normal text-slate-400">({dataRows.length} data rows found)</span>
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {config.fields.map(field => (
                            <label key={field.key} className="block">
                              <span className="mb-1 block text-[11px] font-medium text-slate-600">
                                {field.label}{field.required && <span className="text-red-500"> *</span>}
                              </span>
                              <select
                                value={mapping[field.key] ?? ''}
                                onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700"
                              >
                                <option value="">Not imported</option>
                                {headers.map(column => <option key={column} value={column}>{column}</option>)}
                              </select>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <caption className="sr-only">Preview of the first rows to be imported</caption>
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>{headers.map(column => <th key={column} scope="col" className="whitespace-nowrap px-2 py-1.5 font-medium">{column}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dataRows.slice(0, 3).map((row, i) => (
                              <tr key={i}>{headers.map((_, index) => <td key={index} className="max-w-32 truncate px-2 py-1.5 text-slate-600">{row[index]}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {!result?.ok && (
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button" onClick={() => { setOpen(false); reset() }}
                  className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button" onClick={submit} disabled={pending || dataRows.length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Import {dataRows.length > 0 ? `${dataRows.length} rows` : ''}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  )
}
