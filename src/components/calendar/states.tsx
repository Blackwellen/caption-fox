import Link from 'next/link'
import { Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { capabilityBlockReason, planLabel, type CalendarCapability, type CalendarContext } from '@/lib/calendar/entitlements'
import { BlockedState, GridSkeleton, KpiStripSkeleton, PanelSkeleton, Shimmer, T } from './primitives'

/** Shown when the visitor is signed in but this workspace is not theirs to view. */
export function NoAccessState({ basePath }: { basePath: string }) {
  return (
    <div className={cn(T.page, 'py-10')}>
      <BlockedState
        title="You do not have access to this workspace's calendar"
        body="Your account is not a member of the active workspace, or the workspace does not include the Campaign Manager Calendar. Switch workspace from the top bar, or ask an owner to invite you."
        action={
          <Link href={`${basePath}/home`} className={cn('inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
            Back to Home
          </Link>
        }
      />
    </div>
  )
}

/**
 * Truthful gate state. It names the exact reason — plan, feature flag or role —
 * and only offers an upgrade route when a plan is genuinely what is missing.
 */
export function CapabilityGate({
  ctx, capability, surfaceLabel,
}: {
  ctx: CalendarContext
  capability: CalendarCapability
  surfaceLabel: string
}) {
  const block = capabilityBlockReason(ctx, capability)
  if (!block) return null

  if (block.reason === 'plan' && block.requiredPlan) {
    return (
      <div className={cn(T.page, 'py-10')}>
        <div className={cn(T.card, 'px-6 py-12 text-center')}>
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600" aria-hidden>
            <Lock size={20} />
          </span>
          <h1 className="text-[18px] font-semibold text-slate-900">{surfaceLabel} is included from {planLabel(block.requiredPlan)}</h1>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
            Your workspace is on the {planLabel(ctx.planId)} plan. Upgrading to {planLabel(block.requiredPlan)} unlocks {surfaceLabel.toLowerCase()} for everyone in this workspace.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href={`${ctx.basePath}/settings/billing`} className={cn('inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
              See plans and upgrade
            </Link>
            <Link href={`${ctx.basePath}/calendar`} className={cn('inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50', T.focus)}>
              Back to Calendar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(T.page, 'py-10')}>
      <BlockedState
        title={block.reason === 'flag' ? `${surfaceLabel} is turned off for this workspace` : `You do not have permission to view ${surfaceLabel.toLowerCase()}`}
        body={
          block.reason === 'flag'
            ? 'An administrator has disabled this area for your workspace. Ask a workspace owner to re-enable it in Workspace Settings.'
            : `Your role (${ctx.role}) does not include access to this area. A workspace owner or admin can change your role in Settings › People.`
        }
        action={
          <Link href={`${ctx.basePath}/calendar`} className={cn('inline-flex h-9 items-center rounded-lg bg-blue-600 px-3.5 text-[13px] font-medium text-white hover:bg-blue-700', T.focus)}>
            Back to Calendar
          </Link>
        }
      />
    </div>
  )
}

/**
 * Loading skeleton sized to the real page so the switch from loading to loaded
 * does not shift layout.
 */
export function CalendarPageSkeleton({ variant }: { variant: 'calendar' | 'queue' | 'agenda' | 'conflicts' }) {
  return (
    <div className={cn(T.page, 'pb-8')} aria-busy="true">
      <div className="mb-3"><Shimmer className="h-3 w-56" /></div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-52" />
          <Shimmer className="h-3.5 w-96" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-36 rounded-lg" />
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="mb-5 flex gap-2">
        {['Calendar', 'Publishing Queue', 'Agenda', 'Conflicts'].map(tab => (
          <Shimmer key={tab} className="h-8 w-28 rounded-lg" />
        ))}
      </div>

      <div className="mb-5"><KpiStripSkeleton /></div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} className="h-9 w-32 rounded-lg" />)}
        <div className="ml-auto flex gap-2"><Shimmer className="h-9 w-56 rounded-lg" /></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0">
          {variant === 'calendar' ? <GridSkeleton /> : <PanelSkeleton rows={8} height="h-[420px]" />}
        </div>
        <div className="space-y-5">
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={3} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
      </div>

      <span className="sr-only" role="status">Loading {variant}</span>
    </div>
  )
}

export { ShieldAlert }
