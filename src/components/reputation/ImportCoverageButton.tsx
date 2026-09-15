'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X } from 'lucide-react'
import { useToast } from './Toast'
import { importCoverageCsv } from '@/app/app/reputation/actions'

export function ImportCoverageButton() {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [csv, setCsv] = useState('')
  const [errors, setErrors] = useState<string | null>(null)

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then(setCsv)
  }

  function submit() {
    if (pending || !csv.trim()) return
    startTransition(async () => {
      const result = await importCoverageCsv(csv)
      if (!result.ok) { setErrors(result.error ?? 'Import failed.'); return }
      notify('success', result.message ?? 'Coverage imported.')
      setOpen(false); setErrors(null); setCsv('')
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
        <Upload size={15} />Import Coverage
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center">
          <div className="fixed inset-0" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Import coverage from CSV</h2>
                <p className="text-xs text-slate-500">Columns: publication, headline, url, topic, sentiment, estimated_reach. Duplicate URLs are skipped.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={16} /></button>
            </header>
            <div className="space-y-3 px-5 py-4">
              {errors && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{errors}</p>}
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="block w-full text-xs text-slate-600" />
              <textarea
                value={csv} onChange={e => setCsv(e.target.value)} rows={8}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={'publication,headline,url,topic,sentiment,estimated_reach\nTechCrunch,Example headline,https://...,Launch,positive,50000'}
              />
              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="button" disabled={pending || !csv.trim()} onClick={submit} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                  {pending && <Loader2 size={14} className="animate-spin" />}Import
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
