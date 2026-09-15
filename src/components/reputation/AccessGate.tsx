import Link from 'next/link'
import { Lock } from 'lucide-react'

export function AccessGate({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
        <Lock className="text-slate-400" size={22} />
      </div>
      <h2 className="text-base font-semibold text-slate-900">You do not have access to this area</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{message}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/app/home" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
