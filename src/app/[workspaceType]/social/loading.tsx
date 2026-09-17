/**
 * Loading skeleton for Social pages: header, section tabs, a six-card KPI row
 * and a three-column content grid, matching the reference layouts so the page
 * does not jump when data arrives.
 */
export default function SocialLoading() {
  const block = 'animate-pulse rounded-xl border border-slate-200/80 bg-white'
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Social…</span>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200/80" />
          <div className="h-3.5 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[34px] w-28 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      </div>
      <div className="mb-4 h-9 w-full max-w-xl animate-pulse rounded-lg bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className={`${block} h-[88px]`} />)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr_0.85fr]">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className={`${block} h-[283px]`} />)}
      </div>
    </div>
  )
}
