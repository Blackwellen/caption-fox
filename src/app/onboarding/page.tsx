'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronRight, Wand2, ArrowRight, Users, Building2, Megaphone, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CONTENT_GOALS } from '@/lib/constants'

const WORKSPACE_TYPES = [
  { id: 'Creator', icon: Sparkles, title: 'Creator', desc: 'Individual content creator or influencer' },
  { id: 'Small Business', icon: Building2, title: 'Small Business', desc: 'Small team managing brand presence' },
  { id: 'Brand', icon: Megaphone, title: 'Brand', desc: 'Established brand with marketing team' },
  { id: 'Agency', icon: Users, title: 'Agency', desc: 'Agency managing multiple client accounts' },
]

const PLANS = [
  { id: 'starter', name: 'Starter', price: 0, features: ['2 social channels', '50 AI generations/mo', '1 seat', '2 UGC briefs'], cta: 'Start free' },
  { id: 'creator_pro', name: 'Creator Pro', price: 19, features: ['5 social channels', '500 AI generations/mo', '1 seat', '10 UGC briefs', 'Approval workflows'], cta: 'Start trial' },
  { id: 'team', name: 'Team', price: 49, features: ['10 social channels', '2,000 AI generations/mo', '5 seats', '25 UGC briefs', 'Priority support'], cta: 'Start trial', popular: true },
]

const TONES = ['Professional', 'Casual', 'Bold', 'Playful', 'Expert', 'Warm', 'Inspirational', 'Witty']

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'x', name: 'X (Twitter)', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'youtube', name: 'YouTube', color: 'bg-red-100 text-red-700 border-red-200' },
]

const STEP_LABELS = ['Welcome', 'Workspace', 'Type', 'Plan', 'Brand', 'Voice', 'Channels', 'Goals', 'Calendar', 'Done']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [calendarGenerating, setCalendarGenerating] = useState(false)
  const [calendarGenerated, setCalendarGenerated] = useState(false)

  const [form, setForm] = useState({
    workspaceName: '', workspaceType: '', plan: 'starter',
    brandName: '', industry: '',
    tones: [] as string[], styleRules: '',
    channels: [] as string[], goals: [] as string[],
  })

  function next() { setStep(s => Math.min(s + 1, 10)) }
  function back() { setStep(s => Math.max(s - 1, 1)) }

  function toggleTone(t: string) { setForm(f => ({ ...f, tones: f.tones.includes(t) ? f.tones.filter(x => x !== t) : [...f.tones, t] })) }
  function toggleChannel(c: string) { setForm(f => ({ ...f, channels: f.channels.includes(c) ? f.channels.filter(x => x !== c) : [...f.channels, c] })) }
  function toggleGoal(g: string) { setForm(f => ({ ...f, goals: f.goals.includes(g) ? f.goals.filter(x => x !== g) : f.goals.length < 3 ? [...f.goals, g] : f.goals })) }

  async function saveWorkspace() {
    setSaving(true)
    setSaveError(null)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }
    const slug = form.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data: workspace, error } = await sb
      .from('workspaces')
      .insert({ name: form.workspaceName, slug: `${slug}-${Date.now()}`, type: form.workspaceType.toLowerCase().replace(' ', '_'), plan: form.plan, owner_id: user.id })
      .select('id')
      .single()
    setSaving(false)
    if (error || !workspace) {
      setSaveError(error?.message ?? 'We couldn’t create your workspace. Please try again.')
      return
    }
    // The on_workspace_created DB trigger adds the owner membership row that all
    // in-workspace RLS relies on. Remember this workspace as the active one.
    document.cookie = `cf_workspace=${workspace.id}; path=/; max-age=31536000; samesite=lax`
    setSaveError(null)
    next()
  }

  async function generateCalendar() {
    setCalendarGenerating(true)
    await new Promise(r => setTimeout(r, 2000))
    setCalendarGenerated(true)
    setCalendarGenerating(false)
  }

  const calendarDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const calendarPosts = ['Instagram Reel: Morning routine tips', 'LinkedIn: Industry insight post', 'TikTok: Behind the scenes', 'Instagram: Product highlight', 'X: Trending topic comment', 'Instagram Story: Poll', 'Pinterest: Weekly inspiration']

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-72 flex-col p-8" style={{ backgroundColor: '#0C1A2E' }}>
        <div className="mb-10">
          <Image src="/caption-fox-logo-transparent.png" alt="Caption Fox" width={140} height={34} className="brightness-0 invert" />
        </div>
        <div className="space-y-2 flex-1">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const done = step > stepNum
            const active = step === stepNum
            return (
              <div key={label} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', active ? 'bg-blue-600/20' : 'opacity-60')}>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'border border-slate-600 text-slate-500'
                )}>{done ? <Check size={12} /> : stepNum}</div>
                <span className={cn('text-sm font-medium', active ? 'text-white' : 'text-slate-400')}>{label}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-600 mt-8">Need help? <a href="/contact" className="text-blue-400 hover:underline">Contact us</a></p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Step {step} of 10</span>
              <span className="text-xs text-slate-400">{Math.round((step / 10) * 100)}% complete</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(step / 10) * 100}%` }} />
            </div>
          </div>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-fox-gradient flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #38BDF8, #2563EB)' }}>
                <Image src="/caption fox favicon.png" alt="" width={48} height={48} className="rounded-xl" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome to Caption Fox</h1>
              <p className="text-slate-500 mb-8">Let&apos;s get your workspace set up. It only takes a few minutes.</p>
              <button onClick={next} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base transition-colors inline-flex items-center gap-2">Get started <ArrowRight size={18} /></button>
            </div>
          )}

          {/* Step 2: Workspace Name */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Name your workspace</h2>
              <p className="text-slate-500 mb-7">This is usually your brand or company name.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Workspace name</label>
                  <input autoFocus value={form.workspaceName} onChange={e => setForm(f => ({ ...f, workspaceName: e.target.value }))} className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Acme Marketing" />
                  {form.workspaceName && <p className="text-xs text-slate-400 mt-1.5">URL: captionfox.com/{form.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</p>}
                </div>
                <div className="flex gap-3 pt-2"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} disabled={!form.workspaceName} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
              </div>
            </div>
          )}

          {/* Step 3: Workspace Type */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">What best describes you?</h2>
              <p className="text-slate-500 mb-7">We&apos;ll personalise your experience based on your answer.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {WORKSPACE_TYPES.map(t => (
                  <button key={t.id} onClick={() => setForm(f => ({ ...f, workspaceType: t.id }))} className={cn('p-5 rounded-xl border-2 text-left transition-all', form.workspaceType === t.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}>
                    <t.icon size={24} className={form.workspaceType === t.id ? 'text-blue-600' : 'text-slate-400'} />
                    <p className="font-semibold text-slate-900 mt-3 mb-1">{t.title}</p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} disabled={!form.workspaceType} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
            </div>
          )}

          {/* Step 4: Plan */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Choose your plan</h2>
              <p className="text-slate-500 mb-7">Start free, upgrade anytime. No credit card required for Starter.</p>
              <div className="space-y-3 mb-6">
                {PLANS.map(p => (
                  <button key={p.id} onClick={() => setForm(f => ({ ...f, plan: p.id }))} className={cn('w-full p-4 rounded-xl border-2 text-left transition-all relative', form.plan === p.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300')}>
                    {p.popular && <span className="absolute top-3 right-3 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">Most popular</span>}
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', form.plan === p.id ? 'border-blue-600' : 'border-slate-300')}>{form.plan === p.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}</div>
                      <span className="font-semibold text-slate-900">{p.name}</span>
                      <span className="text-slate-700 font-bold">{p.price === 0 ? 'Free' : `£${p.price}/mo`}</span>
                    </div>
                    <div className="ml-8 flex flex-wrap gap-x-4 gap-y-1">{p.features.map(f => <span key={f} className="text-xs text-slate-500 flex items-center gap-1"><Check size={10} className="text-emerald-500" />{f}</span>)}</div>
                  </button>
                ))}
              </div>
              {saveError && <p role="alert" className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={saveWorkspace} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">{saving ? 'Saving…' : 'Continue'}</button></div>
            </div>
          )}

          {/* Step 5: Brand */}
          {step === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Create your brand profile</h2>
              <p className="text-slate-500 mb-7">You can add more brands later in Settings.</p>
              <div className="space-y-4 mb-6">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Brand name</label><input value={form.brandName} onChange={e => setForm(f => ({ ...f, brandName: e.target.value }))} className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Acme Co" /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select industry</option>
                    {['E-commerce', 'Fashion', 'Food & Beverage', 'Health & Fitness', 'Technology', 'Finance', 'Education', 'Travel', 'Beauty', 'Real Estate', 'Entertainment', 'Other'].map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
            </div>
          )}

          {/* Step 6: Brand Voice */}
          {step === 6 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Set your brand voice</h2>
              <p className="text-slate-500 mb-7">Fox AI will use this to generate on-brand content.</p>
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Tone (select all that apply)</label>
                <div className="flex flex-wrap gap-2">{TONES.map(t => <button key={t} onClick={() => toggleTone(t)} className={cn('px-3.5 py-1.5 rounded-full text-sm border font-medium transition-colors', form.tones.includes(t) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>{t}</button>)}</div>
              </div>
              <div className="mb-6"><label className="block text-sm font-medium text-slate-700 mb-1">Style notes (optional)</label><textarea value={form.styleRules} onChange={e => setForm(f => ({ ...f, styleRules: e.target.value }))} rows={3} className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="e.g. Always use British English. Avoid jargon. Keep it human." /></div>
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
              <button onClick={next} className="w-full mt-2 py-2 text-sm text-slate-400 hover:text-slate-600">Skip for now</button>
            </div>
          )}

          {/* Step 7: Connect Channel */}
          {step === 7 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Connect a social channel</h2>
              <p className="text-slate-500 mb-7">Connect your first account to start scheduling and tracking.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => toggleChannel(p.id)} className={cn('p-4 rounded-xl border-2 text-sm font-medium transition-all', form.channels.includes(p.id) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:border-slate-300')}>
                    <div className="flex items-center gap-2">{form.channels.includes(p.id) && <Check size={14} className="text-blue-600 shrink-0" />}<span>{p.name}</span></div>
                    <p className="text-xs text-slate-400 mt-1 text-left">Redirects to {p.name}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
              <button onClick={next} className="w-full mt-2 py-2 text-sm text-slate-400 hover:text-slate-600">Skip for now</button>
            </div>
          )}

          {/* Step 8: Content Goals */}
          {step === 8 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">What are your content goals?</h2>
              <p className="text-slate-500 mb-7">Pick up to 3. We&apos;ll tailor your experience.</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {CONTENT_GOALS.map(g => (
                  <button key={g} onClick={() => toggleGoal(g)} disabled={form.goals.length >= 3 && !form.goals.includes(g)} className={cn('p-4 rounded-xl border-2 text-sm font-medium text-left transition-all', form.goals.includes(g) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:border-slate-300 disabled:opacity-40')}>
                    {form.goals.includes(g) && <Check size={14} className="text-blue-600 mb-1" />}{g}
                  </button>
                ))}
              </div>
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} disabled={form.goals.length === 0} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors">Continue</button></div>
            </div>
          )}

          {/* Step 9: Generate Calendar */}
          {step === 9 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Generate your first content calendar</h2>
              <p className="text-slate-500 mb-6">Fox AI will create a 7-day content plan based on your goals and brand.</p>
              {!calendarGenerated ? (
                <div className="text-center mb-6">
                  <button onClick={generateCalendar} disabled={calendarGenerating} className="px-8 py-3.5 text-white font-semibold rounded-xl transition-all inline-flex items-center gap-2.5 disabled:opacity-70" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
                    <Wand2 size={18} />{calendarGenerating ? 'Generating…' : 'Generate 7-day calendar'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 mb-6">
                  {calendarDays.map((day, i) => (
                    <div key={day} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-400 w-8">{day}</span>
                      <div className="flex-1"><p className="text-sm font-medium text-slate-800">{calendarPosts[i]}</p></div>
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">Draft</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3"><button onClick={back} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button><button onClick={next} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors">{calendarGenerated ? 'Save & continue' : 'Skip for now'}</button></div>
            </div>
          )}

          {/* Step 10: Done */}
          {step === 10 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #38BDF8, #2563EB)' }}>
                <Image src="/caption fox favicon.png" alt="" width={48} height={48} className="rounded-xl" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re all set! 🎉</h2>
              <p className="text-slate-500 mb-8">Your Caption Fox workspace is ready. Start creating.</p>
              <div className="space-y-2.5 mb-8 text-left bg-slate-50 rounded-xl p-5">
                {[form.workspaceName && `✓ Workspace: ${form.workspaceName}`, form.workspaceType && `✓ Type: ${form.workspaceType}`, form.brandName && `✓ Brand: ${form.brandName}`, form.tones.length > 0 && `✓ Brand voice configured`, form.channels.length > 0 && `✓ ${form.channels.length} channel(s) connected`, form.goals.length > 0 && `✓ Goals: ${form.goals.slice(0, 2).join(', ')}${form.goals.length > 2 ? '…' : ''}`].filter(Boolean).map((item, i) => <p key={i} className="text-sm text-slate-700">{item as string}</p>)}
              </div>
              <button onClick={() => router.push('/app/home')} className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base transition-colors inline-flex items-center gap-2">
                Start creating <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
