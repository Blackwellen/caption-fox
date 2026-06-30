'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_URL } from '@/lib/constants'
import {
  Affiliate, AffiliateReferral, makeAffiliateCode, referralLink, formatGBP,
  DIRECT_COMMISSION_RATE, OVERRIDE_COMMISSION_RATE,
} from '@/lib/affiliate'
import {
  Gift, Users, Coins, Copy, Check, Share2, TrendingUp, UserPlus, Link2,
} from 'lucide-react'

export default function AffiliatesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [me, setMe] = useState<Affiliate | null>(null)
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([])
  const [subAffiliates, setSubAffiliates] = useState<Affiliate[]>([])
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setEmail(user.email ?? null)

    const { data: aff, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Table not migrated yet → show graceful state instead of crashing.
    if (error && (error.code === '42P01' || /relation .* does not exist/i.test(error.message))) {
      setEnabled(false); setLoading(false); return
    }

    if (aff) {
      setMe(aff as Affiliate)
      const [refRes, subRes] = await Promise.all([
        supabase.from('affiliate_referrals').select('*').eq('affiliate_id', aff.id).order('created_at', { ascending: false }),
        supabase.from('affiliates').select('*').eq('parent_affiliate_id', aff.id),
      ])
      setReferrals((refRes.data ?? []) as AffiliateReferral[])
      setSubAffiliates((subRes.data ?? []) as Affiliate[])
    }
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function join() {
    setJoining(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setJoining(false); return }

    // Two-tier: if the user arrived via ?ref=CODE, attribute them to that affiliate.
    let parentId: string | null = null
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      const { data: parent } = await supabase.from('affiliates').select('id').eq('code', ref).maybeSingle()
      parentId = parent?.id ?? null
    }

    const { error } = await supabase.from('affiliates').insert({
      user_id: user.id,
      code: makeAffiliateCode(user.email),
      parent_affiliate_id: parentId,
      payout_email: user.email,
    })
    setJoining(false)
    if (!error) load()
  }

  function copyLink() {
    if (!me) return
    navigator.clipboard?.writeText(referralLink(APP_URL, me.code))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) {
    return <div className="p-6 max-w-5xl mx-auto"><div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-6" /><div className="grid grid-cols-3 gap-4">{[0,1,2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}</div></div>
  }

  if (!enabled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3"><Gift size={22} className="text-amber-500" /></div>
          <h1 className="text-lg font-bold text-slate-900 mb-1">Affiliate programme</h1>
          <p className="text-sm text-slate-500">The affiliate programme is being set up. Once the database migration is applied, you&apos;ll be able to generate your referral link and earn commission here.</p>
        </div>
      </div>
    )
  }

  // Earnings
  const directEarnings = referrals.filter(r => r.status === 'converted').reduce((s, r) => s + r.commission_cents, 0)
  const customers = referrals.filter(r => r.kind === 'customer')
  const link = me ? referralLink(APP_URL, me.code) : ''

  if (!me) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-4"><Gift size={24} /></div>
          <h1 className="text-2xl font-bold mb-2">Earn with Caption Fox</h1>
          <p className="text-blue-100 text-sm max-w-md mx-auto mb-2">Refer customers and earn <strong>{Math.round(DIRECT_COMMISSION_RATE * 100)}%</strong> commission. Recruit other affiliates and earn a <strong>{Math.round(OVERRIDE_COMMISSION_RATE * 100)}%</strong> override on their sales too.</p>
          <button onClick={join} disabled={joining} className="mt-4 px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-lg text-sm hover:bg-blue-50 transition-colors disabled:opacity-60">
            {joining ? 'Setting up…' : 'Join the affiliate programme'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Gift size={20} className="text-blue-600" /> Affiliates</h1>
        <p className="text-sm text-slate-500">Share your link, refer customers and recruit affiliates to earn two-tier commission.</p>
      </div>

      {/* Referral link */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your referral link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono truncate">
            <Link2 size={14} className="text-slate-400 shrink-0" /> {link}
          </div>
          <button onClick={copyLink} className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<Coins size={18} className="text-emerald-500" />} label="Earnings" value={formatGBP(directEarnings)} />
        <Stat icon={<Users size={18} className="text-blue-500" />} label="Customers referred" value={String(customers.length)} />
        <Stat icon={<UserPlus size={18} className="text-violet-500" />} label="Sub-affiliates" value={String(subAffiliates.length)} />
        <Stat icon={<TrendingUp size={18} className="text-amber-500" />} label="Override rate" value={`${Math.round(OVERRIDE_COMMISSION_RATE * 100)}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Referrals */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"><Share2 size={15} className="text-slate-400" /><p className="text-sm font-semibold text-slate-900">Referrals</p></div>
          {referrals.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No referrals yet — share your link to get started.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {referrals.slice(0, 8).map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="text-slate-700 truncate">{r.referred_email ?? 'Referral'}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 capitalize">{r.kind}</span>
                    <span className={cnBadge(r.status)}>{r.status}</span>
                    <span className="text-slate-700 font-medium tabular-nums">{formatGBP(r.commission_cents)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sub-affiliates */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2"><UserPlus size={15} className="text-slate-400" /><p className="text-sm font-semibold text-slate-900">Your sub-affiliates</p></div>
          {subAffiliates.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Recruit affiliates with your link and earn {Math.round(OVERRIDE_COMMISSION_RATE * 100)}% of their sales.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {subAffiliates.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="font-mono text-slate-700">{s.code}</span>
                  <span className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function cnBadge(status: string): string {
  const base = 'text-[10px] font-medium px-1.5 py-0.5 rounded-full '
  if (status === 'converted') return base + 'bg-emerald-50 text-emerald-700'
  if (status === 'cancelled') return base + 'bg-red-50 text-red-600'
  return base + 'bg-amber-50 text-amber-700'
}
