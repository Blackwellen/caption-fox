import { Skeleton, S_CARD } from '@/components/studio/ui'
import { cn } from '@/lib/utils'

/** Route-level skeleton shaped like a Studio page: header, tabs, KPI row, content grid. */
export default function StudioLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Studio">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-3.5 w-80" />
      <div className="mt-4 flex gap-4 border-b border-[#e6e9f0] pb-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-3.5 w-16" />)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(S_CARD, 'flex h-[82px] items-center gap-3 px-4')}>
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-10" /><Skeleton className="h-3 w-24" /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
        <div className={cn(S_CARD, 'h-[380px]')} />
        <div className={cn(S_CARD, 'h-[380px]')} />
      </div>
    </div>
  )
}
