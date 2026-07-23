import Link from 'next/link'
import { notFound } from 'next/navigation'
import { jamahlFixtures } from '@/lib/shell/caption-fox-shell'

function shellEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_CAPTION_FOX_SHELL_DEMO === 'true'
}

export default function ShellIndex() {
  if (!shellEnabled()) notFound()

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">Development-only shell index</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Caption Fox workspace fixtures</h1>
        <p className="mt-2 max-w-2xl text-slate-600">All fixtures belong to jamahlthomas1996@gmail.com in local shell data. They do not create users, sessions, Supabase records, payment accounts or provider connections.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jamahlFixtures.map(workspace => <Link key={workspace.id} href={`/shell/${workspace.surface}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">{workspace.surface}</p>
            <h2 className="mt-2 font-semibold text-slate-900">{workspace.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{workspace.subscription} · {workspace.onboarding}</p>
          </Link>)}
        </div>
      </div>
    </main>
  )
}
