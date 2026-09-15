import { revalidatePath } from 'next/cache'
import { Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Affiliate applications — Admin' }

interface Application {
  id: string
  full_name: string
  email: string
  website_url: string | null
  primary_channel: string | null
  country: string | null
  audience_size: string | null
  platforms: string[] | null
  promotion_method: string | null
  audience_links: string[] | null
  message: string | null
  status: string
  review_note: string | null
  submitted_at: string | null
  created_at: string
}

async function review(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const note = String(formData.get('note') ?? '')
  const supabase = await createClient()
  // The RPC re-checks platform-admin rights, status and writes the audit log.
  await supabase.rpc('review_affiliate_application', { p_application: id, p_decision: decision, p_note: note || null })
  revalidatePath('/admin/affiliates')
}

const PILL: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  needs_info: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  draft: 'bg-slate-100 text-slate-600',
}

export default async function AdminAffiliatesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('affiliate_applications')
    .select('id, full_name, email, website_url, primary_channel, country, audience_size, platforms, promotion_method, audience_links, message, status, review_note, submitted_at, created_at')
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(200)
  const apps = (data ?? []) as Application[]
  const open = apps.filter(a => a.status === 'pending' || a.status === 'needs_info')
  const closed = apps.filter(a => !open.includes(a))

  return (
    <div className="max-w-5xl p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Gift size={20} className="text-blue-600" aria-hidden /> Affiliate applications</h1>
      <p className="mt-1 text-sm text-slate-500">Approving an application creates the applicant’s affiliate account and referral code. Every decision is audit-logged.</p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-slate-500">Awaiting review ({open.length})</h2>
      {open.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No applications are waiting for review.</p>}
      <div className="mt-3 space-y-3">
        {open.map(a => (
          <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{a.full_name} <span className="font-normal text-slate-500">· {a.email}</span></p>
                <p className="mt-0.5 text-xs text-slate-500">Submitted {new Date(a.submitted_at ?? a.created_at).toLocaleString('en-GB')} · {a.country ?? 'Country n/a'}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[a.status] ?? ''}`}>{a.status.replace('_', ' ')}</span>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-slate-500">Primary channel: </dt><dd className="inline text-slate-800">{a.primary_channel ?? '—'}</dd></div>
              <div><dt className="inline text-slate-500">Audience: </dt><dd className="inline text-slate-800">{a.audience_size ?? '—'}</dd></div>
              <div><dt className="inline text-slate-500">Platforms: </dt><dd className="inline text-slate-800">{a.platforms?.join(', ') || '—'}</dd></div>
              <div><dt className="inline text-slate-500">Promotion: </dt><dd className="inline text-slate-800">{a.promotion_method ?? '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="inline text-slate-500">Links: </dt><dd className="inline break-all text-slate-800">{[a.website_url, ...(a.audience_links ?? [])].filter(Boolean).join(' · ') || '—'}</dd></div>
              {a.message && <div className="sm:col-span-2"><dt className="inline text-slate-500">Note: </dt><dd className="inline text-slate-800">{a.message}</dd></div>}
            </dl>
            <form action={review} className="mt-4 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={a.id} />
              <label className="sr-only" htmlFor={`note-${a.id}`}>Note to applicant</label>
              <input id={`note-${a.id}`} name="note" maxLength={1000} placeholder="Optional note (sent with ‘Needs info’)" className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button name="decision" value="approved" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Approve</button>
              <button name="decision" value="needs_info" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Needs info</button>
              <button name="decision" value="rejected" className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Reject</button>
            </form>
          </article>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-slate-500">Decided</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 font-medium">Applicant</th><th className="px-4 py-2 font-medium">Channel</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Submitted</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {closed.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No decided applications yet.</td></tr>}
            {closed.map(a => (
              <tr key={a.id}><td className="px-4 py-2 text-slate-800">{a.full_name}<span className="block text-xs text-slate-500">{a.email}</span></td><td className="px-4 py-2 text-slate-600">{a.primary_channel ?? '—'}</td><td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[a.status] ?? ''}`}>{a.status}</span></td><td className="px-4 py-2 text-slate-600">{new Date(a.submitted_at ?? a.created_at).toLocaleDateString('en-GB')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
