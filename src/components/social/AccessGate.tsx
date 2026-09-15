import Link from 'next/link'
import { Lock, ShieldAlert } from 'lucide-react'
import type { AccessResult } from '@/lib/social/entitlements'

/** Canonical blocked / upgrade state for a Social surface. */
export function AccessGate({ access }: { access: Exclude<AccessResult, { allowed: true }> }) {
  const isUpgrade = access.upgrade
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        {isUpgrade ? <ShieldAlert className="text-slate-400" size={22} /> : <Lock className="text-slate-400" size={22} />}
      </div>
      <h2 className="text-base font-semibold text-slate-900">
        {isUpgrade ? 'Upgrade to unlock this area' : 'You do not have access to this area'}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{access.message}</p>
      <div className="mt-5 flex justify-center gap-2">
        {isUpgrade && (
          <Link href="/app/settings/billing" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            View plans
          </Link>
        )}
        <Link href="/app/social" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          Back to Social
        </Link>
      </div>
    </div>
  )
}
