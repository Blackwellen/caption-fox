'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Download, CheckCircle, X, FileText, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkImportModalProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  onImported: (count: number) => void
}

interface ParsedRow {
  title: string
  caption: string
  platforms: string[]
  scheduled_at: string
  post_type: string
  hashtags: string
  campaign_id: string
  brand_id: string
  _errors: string[]
  _rowIndex: number
}

type Step = 1 | 2 | 3

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_HEADERS = ['title', 'caption', 'platforms', 'scheduled_at', 'post_type', 'hashtags', 'campaign_id', 'brand_id']

const VALID_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'facebook', 'x', 'youtube']
const VALID_POST_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'thread', 'short', 'article', 'pin']

function downloadTemplate() {
  const header = CSV_HEADERS.join(',')
  const exampleRow = [
    'My product launch post',
    'Excited to announce our new product! Check it out now.',
    'instagram|tiktok',
    '2026-07-01T10:00:00',
    'post',
    '#launch #excited #newproduct',
    '',
    '',
  ].map(v => `"${v}"`).join(',')

  const csv = [header, exampleRow].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'caption-fox-bulk-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function validateRow(row: Record<string, string>, rowIndex: number): ParsedRow {
  const errors: string[] = []

  const caption = row['caption'] ?? ''
  const platforms = (row['platforms'] ?? '').split('|').map(p => p.trim().toLowerCase()).filter(Boolean)
  const scheduled_at = row['scheduled_at'] ?? ''
  const post_type = row['post_type'] || 'post'

  if (!caption.trim()) errors.push('Caption is required')

  if (platforms.length === 0) {
    errors.push('At least one platform is required')
  } else {
    const invalid = platforms.filter(p => !VALID_PLATFORMS.includes(p))
    if (invalid.length > 0) errors.push(`Unknown platform(s): ${invalid.join(', ')}`)
  }

  if (scheduled_at) {
    const d = new Date(scheduled_at)
    if (isNaN(d.getTime())) errors.push('Invalid date format (use ISO 8601, e.g. 2026-07-01T10:00:00)')
  }

  if (post_type && !VALID_POST_TYPES.includes(post_type)) {
    errors.push(`Unknown post_type "${post_type}"`)
  }

  return {
    title: row['title'] ?? '',
    caption,
    platforms,
    scheduled_at,
    post_type: VALID_POST_TYPES.includes(post_type) ? post_type : 'post',
    hashtags: row['hashtags'] ?? '',
    campaign_id: row['campaign_id'] ?? '',
    brand_id: row['brand_id'] ?? '',
    _errors: errors,
    _rowIndex: rowIndex,
  }
}

function parseCsv(text: string): { rows: ParsedRow[]; headerError: string | null } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], headerError: 'File is empty or has no data rows' }

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim().replace(/^"|"$/g, ''))
  const missing = CSV_HEADERS.filter(h => !headers.includes(h))
  if (missing.length > 0) return { rows: [], headerError: `Missing columns: ${missing.join(', ')}` }

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? '').replace(/^"|"$/g, '').trim() })
    rows.push(validateRow(obj, i))
  }

  return { rows, headerError: null }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BulkImportModal({ isOpen, onClose, workspaceId, onImported }: BulkImportModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [dragging, setDragging] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [skipErrors, setSkipErrors] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importDone, setImportDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validRows = parsedRows.filter(r => r._errors.length === 0)
  const errorRows = parsedRows.filter(r => r._errors.length > 0)
  const rowsToImport = skipErrors ? validRows : []

  function handleClose() {
    setStep(1)
    setParsedRows([])
    setHeaderError(null)
    setSkipErrors(true)
    setImporting(false)
    setImportProgress(0)
    setImportDone(false)
    setImportCount(0)
    onClose()
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setHeaderError('Please upload a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { rows, headerError: err } = parseCsv(text)
      setHeaderError(err)
      setParsedRows(rows)
      if (!err && rows.length > 0) setStep(2)
    }
    reader.readAsText(file)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function handleImport() {
    if (rowsToImport.length === 0) return
    setImporting(true)
    setImportTotal(rowsToImport.length)
    setImportProgress(0)

    let count = 0
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    for (const row of rowsToImport) {
      try {
        await supabase.from('content_posts').insert({
          workspace_id: workspaceId,
          title: row.title || row.caption.slice(0, 80),
          platforms: row.platforms,
          status: 'draft',
          post_type: row.post_type,
          scheduled_at: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
          campaign_id: row.campaign_id || null,
          brand_id: row.brand_id || null,
          created_by: user?.id ?? null,
        })
        count++
      } catch { /* skip failed rows */ }
      setImportProgress(p => p + 1)
    }

    setImportCount(count)
    setImportDone(true)
    setImporting(false)
    onImported(count)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={importing ? undefined : handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Bulk Import Posts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 1 ? 'Download the template then upload your CSV'
                : step === 2 ? `${parsedRows.length} rows parsed · ${errorRows.length} errors`
                : 'Review and confirm import'}
            </p>
          </div>
          {!importing && (
            <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-slate-100">
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= step ? 'bg-blue-600' : 'bg-slate-200')} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Step 1: Download Template + Upload ── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works</h3>
                <ol className="space-y-1 text-sm text-blue-700">
                  <li>1. Download the CSV template below</li>
                  <li>2. Fill in your posts (one row per post)</li>
                  <li>3. Upload the completed file</li>
                </ol>
              </div>

              {/* Template download */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">CSV Template</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Required columns: title, caption, platforms, scheduled_at, post_type, hashtags, campaign_id, brand_id</p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors shrink-0"
                  >
                    <Download size={13} /> Download Template
                  </button>
                </div>

                {/* Example table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {CSV_HEADERS.map(h => (
                          <th key={h} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-500">
                        <td className="px-2 py-2 whitespace-nowrap">Product launch</td>
                        <td className="px-2 py-2 max-w-[160px] truncate">Excited to announce…</td>
                        <td className="px-2 py-2 whitespace-nowrap">instagram|tiktok</td>
                        <td className="px-2 py-2 whitespace-nowrap">2026-07-01T10:00</td>
                        <td className="px-2 py-2 whitespace-nowrap">post</td>
                        <td className="px-2 py-2 whitespace-nowrap">#launch</td>
                        <td className="px-2 py-2 text-slate-300">(optional)</td>
                        <td className="px-2 py-2 text-slate-300">(optional)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-slate-500 space-y-0.5">
                  <p><span className="font-semibold">platforms:</span> separate multiple with | (e.g. instagram|tiktok)</p>
                  <p><span className="font-semibold">scheduled_at:</span> ISO 8601 format (e.g. 2026-07-01T10:00:00)</p>
                  <p><span className="font-semibold">post_type:</span> post, reel, story, carousel, video, thread, short, article, pin</p>
                </div>
              </div>

              {/* Upload zone */}
              {headerError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={14} /> {headerError}
                </div>
              )}

              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={28} className={cn('mx-auto mb-3', dragging ? 'text-blue-500' : 'text-slate-300')} />
                <p className="text-sm font-medium text-slate-700">Drag & drop your CSV here</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse — .csv files only</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </div>
            </div>
          )}

          {/* ── Step 2: Preview parsed rows ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg">
                  <CheckCircle size={14} />
                  {validRows.length} rows ready
                </div>
                {errorRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg">
                    <AlertCircle size={14} />
                    {errorRows.length} rows with errors
                  </div>
                )}
              </div>

              {/* Preview table (first 5 valid rows) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">
                  Preview (first 5 valid rows)
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">#</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Title</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Caption</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Platforms</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Scheduled</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">{row._rowIndex}</td>
                          <td className="px-3 py-2 text-slate-700 max-w-[120px] truncate">{row.title || '—'}</td>
                          <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{row.caption}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 flex-wrap">
                              {row.platforms.map(p => (
                                <span key={p} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded capitalize">{p}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.scheduled_at ? new Date(row.scheduled_at).toLocaleDateString() : 'Not set'}</td>
                          <td className="px-3 py-2 text-slate-600 capitalize">{row.post_type}</td>
                        </tr>
                      ))}
                      {validRows.length > 5 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-2.5 text-center text-slate-400">
                            +{validRows.length - 5} more rows not shown
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Error rows */}
              {errorRows.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">
                    Rows with errors ({errorRows.length})
                  </h3>
                  <div className="space-y-2">
                    {errorRows.slice(0, 5).map((row, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                        <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-red-700">Row {row._rowIndex}:</span>{' '}
                          <span className="text-red-600">{row._errors.join(' · ')}</span>
                        </div>
                      </div>
                    ))}
                    {errorRows.length > 5 && (
                      <p className="text-xs text-red-500 pl-2">…and {errorRows.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Review + Import ── */}
          {step === 3 && (
            <div className="space-y-4">
              {importDone ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} className="text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">Import Complete</h3>
                  <p className="text-sm text-slate-500">Successfully imported {importCount} post{importCount !== 1 ? 's' : ''} as drafts.</p>
                  <button
                    onClick={handleClose}
                    className="mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : importing ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700 mb-3">
                      Importing {importProgress} of {importTotal} posts…
                    </p>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: importTotal > 0 ? `${(importProgress / importTotal) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 text-center">{Math.round((importProgress / importTotal) * 100)}% complete</p>
                </div>
              ) : (
                <>
                  {/* Skip errors toggle */}
                  {errorRows.length > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <input
                        type="checkbox"
                        id="skip-errors"
                        checked={skipErrors}
                        onChange={e => setSkipErrors(e.target.checked)}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <label htmlFor="skip-errors" className="text-sm text-amber-800 cursor-pointer">
                        Skip {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} with errors and import {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
                      </label>
                    </div>
                  )}

                  {/* Full preview table */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">
                      {validRows.length} posts ready to import
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Title</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Caption</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Platforms</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Scheduled</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validRows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700 max-w-[100px] truncate">{row.title || '—'}</td>
                              <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate">{row.caption}</td>
                              <td className="px-3 py-2 capitalize text-slate-600">{row.platforms.join(', ')}</td>
                              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.scheduled_at ? new Date(row.scheduled_at).toLocaleDateString() : '—'}</td>
                              <td className="px-3 py-2 text-slate-600 capitalize">{row.post_type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!importDone && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white">
            <button
              onClick={step === 1 ? handleClose : () => setStep(s => Math.max(1, s - 1) as Step)}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <div className="flex items-center gap-3">
              {step === 1 && parsedRows.length > 0 && (
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Review {parsedRows.length} Rows
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={validRows.length === 0}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Import
                </button>
              )}
              {step === 3 && !importing && !importDone && (
                <button
                  onClick={handleImport}
                  disabled={rowsToImport.length === 0}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {rowsToImport.length} Post{rowsToImport.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
