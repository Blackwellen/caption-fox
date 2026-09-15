import { Download } from 'lucide-react'

// Export split button shared by the Advertising pages. The main part downloads
// the page's primary dataset as CSV; the caret lists the other datasets. Every
// link goes to /api/advertising/export, which re-checks auth and permissions.

const DATASETS = ['campaigns', 'accounts', 'creatives', 'audiences'] as const

export default function ExportSplit({ href, primary = 'campaigns' }: { href: string; primary?: typeof DATASETS[number] }) {
  return (
    <div className="inline-flex h-8 items-stretch rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <a href={`${href}&dataset=${primary}`} className="inline-flex items-center gap-1.5 rounded-l-lg px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
        <Download size={15} aria-hidden /> Export
      </a>
      <details className="relative border-l border-slate-200">
        <summary aria-label="More export options" className="flex h-full cursor-pointer list-none items-center rounded-r-lg px-2 text-slate-500 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        </summary>
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 text-[12.5px] shadow-lg">
          {DATASETS.map(dataset => (
            <a key={dataset} href={`${href}&dataset=${dataset}`} className="block rounded-md px-2.5 py-1.5 capitalize text-slate-700 hover:bg-slate-50">{dataset} (CSV)</a>
          ))}
        </div>
      </details>
    </div>
  )
}
