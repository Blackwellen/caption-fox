'use client'

import { useState, useEffect } from 'react'
import { Plus, FileText, Users, Upload, Wand2, Package, DollarSign, BarChart2, ClipboardList, Check, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonPage, SkeletonRow } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { UgcBrief, UgcCreator, UgcSubmission } from '@/types/database'

const TABS = [
  { id: 'briefs', label: 'Briefs' },
  { id: 'creators', label: 'Creators' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'rights', label: 'Rights' },
  { id: 'samples', label: 'Samples' },
  { id: 'payments', label: 'Payments' },
  { id: 'performance', label: 'Performance' },
]

interface NewBriefForm {
  title: string; campaign: string; goal: string; instructions: string
  due_date: string; rights_terms: string; deliverables: string[]
}
const DELIVERABLE_OPTIONS = ['Video 30s', 'Video 60s', 'Photos x3', 'Behind the scenes', 'Unboxing', 'Tutorial']

export default function UGCPage() {
  const [tab, setTab] = useState('briefs')
  const [briefs, setBriefs] = useState<UgcBrief[]>([])
  const [creators, setCreators] = useState<UgcCreator[]>([])
  const [submissions, setSubmissions] = useState<UgcSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Brief modal
  const [briefModal, setBriefModal] = useState(false)
  const [briefStep, setBriefStep] = useState(1)
  const [briefForm, setBriefForm] = useState<NewBriefForm>({
    title: '', campaign: '', goal: '', instructions: '',
    due_date: '', rights_terms: '12_months', deliverables: [],
  })
  const [briefSaving, setBriefSaving] = useState(false)

  // Creator modal
  const [creatorModal, setCreatorModal] = useState(false)
  const [creatorForm, setCreatorForm] = useState({ name: '', email: '', instagram_handle: '', tiktok_handle: '', follower_count: '', niche: '' })
  const [creatorSaving, setCreatorSaving] = useState(false)

  // Script generator
  const [scriptForm, setScriptForm] = useState({ product: '', duration: '30s', style: 'Testimonial' })
  const [scriptOutput, setScriptOutput] = useState<string | null>(null)
  const [scriptLoading, setScriptLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const sb = createClient()
    const [{ data: b }, { data: c }, { data: s }] = await Promise.all([
      sb.from('ugc_briefs').select('*').order('created_at', { ascending: false }),
      sb.from('ugc_creators').select('*').order('created_at', { ascending: false }),
      sb.from('ugc_submissions').select('*').order('created_at', { ascending: false }),
    ])
    setBriefs(b ?? [])
    setCreators(c ?? [])
    setSubmissions(s ?? [])
    setLoading(false)
  }

  async function saveBrief() {
    setBriefSaving(true)
    const sb = createClient()
    const { error } = await sb.from('ugc_briefs').insert({
      title: briefForm.title, goal: briefForm.goal, instructions: briefForm.instructions,
      due_date: briefForm.due_date || null, deliverables: briefForm.deliverables.join(', '),
      status: 'draft', created_by: (await sb.auth.getUser()).data.user?.id ?? '',
      workspace_id: 'placeholder',
    })
    if (!error) { setBriefModal(false); setBriefStep(1); setBriefForm({ title: '', campaign: '', goal: '', instructions: '', due_date: '', rights_terms: '12_months', deliverables: [] }); loadData() }
    setBriefSaving(false)
  }

  async function saveCreator() {
    setCreatorSaving(true)
    const sb = createClient()
    const { error } = await sb.from('ugc_creators').insert({
      name: creatorForm.name, email: creatorForm.email || null,
      instagram_handle: creatorForm.instagram_handle || null,
      tiktok_handle: creatorForm.tiktok_handle || null,
      follower_count: creatorForm.follower_count ? parseInt(creatorForm.follower_count) : null,
      niche: creatorForm.niche || null, workspace_id: 'placeholder',
    })
    if (!error) { setCreatorModal(false); setCreatorForm({ name: '', email: '', instagram_handle: '', tiktok_handle: '', follower_count: '', niche: '' }); loadData() }
    setCreatorSaving(false)
  }

  async function generateScript() {
    setScriptLoading(true)
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'ugc_script', ...scriptForm }) })
      const data = await res.json()
      setScriptOutput(data.output ?? `[${scriptForm.duration} ${scriptForm.style} script for ${scriptForm.product}]\n\nOPENING (0-5s):\nHook line grabbing attention...\n\nMAIN CONTENT (5-25s):\n- Key benefit 1\n- Key benefit 2\n- Key benefit 3\n\nCTA (25-30s):\nCall to action here.\n\n[B-ROLL SUGGESTIONS: Product close-up, lifestyle shot, hands-on demo]`)
    } catch { setScriptOutput('Script generation unavailable. Configure AI provider in Settings.') }
    setScriptLoading(false)
  }

  function toggleDeliverable(d: string) {
    setBriefForm(f => ({ ...f, deliverables: f.deliverables.includes(d) ? f.deliverables.filter(x => x !== d) : [...f.deliverables, d] }))
  }

  if (loading) return <SkeletonPage />
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="p-6">
      <PageHeader title="UGC" subtitle="Manage creator briefs, submissions, rights and performance.">
        <Button variant="secondary" size="sm" onClick={() => setCreatorModal(true)} icon={<Users size={14} />}>Add Creator</Button>
        <Button variant="ai" size="sm" onClick={() => setBriefModal(true)} icon={<Plus size={14} />}>New UGC Brief</Button>
      </PageHeader>

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

      {/* ── BRIEFS ── */}
      {tab === 'briefs' && (
        briefs.length === 0
          ? <EmptyState icon={ClipboardList} title="No UGC briefs yet" description="Create your first brief to start working with creators." action={{ label: 'New UGC Brief', onClick: () => setBriefModal(true) }} />
          : <div className="space-y-3">
              {briefs.map(b => (
                <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <ClipboardList size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{b.title}</p>
                    <p className="text-sm text-slate-500 truncate">{b.goal ?? 'No goal set'}</p>
                  </div>
                  <Badge status={b.status}>{b.status}</Badge>
                  <span className="text-xs text-slate-400">{b.due_date ? formatDate(b.due_date) : 'No due date'}</span>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </div>
      )}

      {/* ── CREATORS ── */}
      {tab === 'creators' && (
        creators.length === 0
          ? <EmptyState icon={Users} title="No creators added" description="Add creators to your CRM to manage collaborations." action={{ label: 'Add Creator', onClick: () => setCreatorModal(true) }} />
          : <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">{['Name','Handles','Followers','Niche','Actions'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
                <tbody>
                  {creators.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">{c.name[0]}</div><span className="font-medium text-slate-900">{c.name}</span></div></td>
                      <td className="px-4 py-3 text-slate-500">{[c.instagram_handle && `@${c.instagram_handle}`, c.tiktok_handle && `@${c.tiktok_handle}`].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.follower_count?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant="default">{c.niche ?? 'General'}</Badge></td>
                      <td className="px-4 py-3"><Button variant="ghost" size="xs">View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      )}

      {/* ── SUBMISSIONS ── */}
      {tab === 'submissions' && (
        submissions.length === 0
          ? <EmptyState icon={Upload} title="No submissions yet" description="Submissions will appear here once creators upload their content." />
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {submissions.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="aspect-video bg-slate-100 flex items-center justify-center"><Upload size={24} className="text-slate-300" /></div>
                  <div className="p-4">
                    <Badge status={s.status} className="mb-2">{s.status}</Badge>
                    <p className="text-sm text-slate-600">{s.file_type}</p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="secondary" size="xs" className="flex-1">Revision</Button>
                      <Button variant="primary" size="xs" className="flex-1">Approve</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* ── SCRIPTS ── */}
      {tab === 'scripts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">AI Script Generator</h3>
            <div className="space-y-4">
              <Input label="Product / Service" placeholder="e.g. Daily vitamin supplement" value={scriptForm.product} onChange={e => setScriptForm(f => ({ ...f, product: e.target.value }))} />
              <Select label="Duration" value={scriptForm.duration} onChange={e => setScriptForm(f => ({ ...f, duration: e.target.value }))} options={[{ value: '15s', label: '15 seconds' }, { value: '30s', label: '30 seconds' }, { value: '60s', label: '60 seconds' }]} />
              <Select label="Style" value={scriptForm.style} onChange={e => setScriptForm(f => ({ ...f, style: e.target.value }))} options={[{ value: 'Testimonial', label: 'Testimonial' }, { value: 'Tutorial', label: 'Tutorial' }, { value: 'Demo', label: 'Demo' }, { value: 'Lifestyle', label: 'Lifestyle' }]} />
              <Button variant="ai" className="w-full" loading={scriptLoading} onClick={generateScript} icon={<Wand2 size={14} />}>Generate Script</Button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Generated Script</h3>
            {scriptOutput
              ? <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{scriptOutput}</pre>
              : <EmptyState icon={FileText} title="No script generated yet" description="Fill in the form and click Generate Script." compact />}
          </div>
        </div>
      )}

      {/* ── RIGHTS ── */}
      {tab === 'rights' && <EmptyState icon={FileText} title="No rights records" description="Usage rights will appear here once UGC is approved." action={{ label: 'Add Usage Rights', onClick: () => {} }} />}

      {/* ── SAMPLES ── */}
      {tab === 'samples' && (
        <div>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
            <Package size={16} className="shrink-0" />
            Track product samples sent to creators. Update status when shipped.
          </div>
          <EmptyState icon={Package} title="No samples tracked" description="Add a sample record when you ship product to a creator." action={{ label: 'Add Sample', onClick: () => {} }} />
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'payments' && (
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-center gap-2">
            <DollarSign size={16} className="shrink-0" />
            Payment processing arrives in V1.5. Track creator payments manually for now.
          </div>
          <EmptyState icon={DollarSign} title="No payment records" description="Add payment records to track what you owe creators." action={{ label: 'Add Payment Record', onClick: () => {} }} />
        </div>
      )}

      {/* ── PERFORMANCE ── */}
      {tab === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[{ label: 'Total Submissions', val: submissions.length.toString() }, { label: 'Approved Assets', val: '0' }, { label: 'Posts from UGC', val: '0' }, { label: 'Avg Engagement', val: '—' }].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-sm text-slate-500">{k.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{k.val}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <EmptyState icon={BarChart2} title="Connect analytics to see UGC performance" description="Publish posts created from UGC to start tracking performance." compact />
          </div>
        </div>
      )}

      {/* ── New Brief Modal (5 steps) ── */}
      <Modal open={briefModal} onClose={() => { setBriefModal(false); setBriefStep(1) }} title={`New UGC Brief — Step ${briefStep} of 5`} size="lg">
        {briefStep === 1 && (
          <div className="space-y-4">
            <Input label="Brief Title *" placeholder="e.g. Summer product launch UGC" value={briefForm.title} onChange={e => setBriefForm(f => ({ ...f, title: e.target.value }))} />
            <Input label="Campaign (optional)" placeholder="Link to a campaign" value={briefForm.campaign} onChange={e => setBriefForm(f => ({ ...f, campaign: e.target.value }))} />
            <div className="flex justify-end"><Button onClick={() => setBriefStep(2)} disabled={!briefForm.title}>Next →</Button></div>
          </div>
        )}
        {briefStep === 2 && (
          <div className="space-y-4">
            <Textarea label="Goal *" placeholder="What do you want creators to achieve?" rows={3} value={briefForm.goal} onChange={e => setBriefForm(f => ({ ...f, goal: e.target.value }))} />
            <Textarea label="Creator Instructions" placeholder="Tone, key messages, what to include/avoid..." rows={4} value={briefForm.instructions} onChange={e => setBriefForm(f => ({ ...f, instructions: e.target.value }))} />
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setBriefStep(1)}>← Back</Button><Button onClick={() => setBriefStep(3)}>Next →</Button></div>
          </div>
        )}
        {briefStep === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Deliverables</p>
              <div className="grid grid-cols-2 gap-2">
                {DELIVERABLE_OPTIONS.map(d => (
                  <button key={d} onClick={() => toggleDeliverable(d)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${briefForm.deliverables.includes(d) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${briefForm.deliverables.includes(d) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{briefForm.deliverables.includes(d) && <Check size={10} className="text-white" />}</div>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <Input label="Due Date" type="date" value={briefForm.due_date} onChange={e => setBriefForm(f => ({ ...f, due_date: e.target.value }))} />
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setBriefStep(2)}>← Back</Button><Button onClick={() => setBriefStep(4)}>Next →</Button></div>
          </div>
        )}
        {briefStep === 4 && (
          <div className="space-y-4">
            <Select label="Usage Rights Terms" value={briefForm.rights_terms} onChange={e => setBriefForm(f => ({ ...f, rights_terms: e.target.value }))} options={[{ value: '6_months', label: '6 Months' }, { value: '12_months', label: '12 Months' }, { value: 'perpetual', label: 'Perpetual' }]} />
            <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">Creator will be asked to accept these terms before their submission is approved.</div>
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setBriefStep(3)}>← Back</Button><Button onClick={() => setBriefStep(5)}>Next →</Button></div>
          </div>
        )}
        {briefStep === 5 && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="font-medium text-green-800 mb-2">Ready to create</p>
              <ul className="text-sm text-green-700 space-y-1"><li>✓ Title: {briefForm.title}</li><li>✓ Goal set</li><li>✓ {briefForm.deliverables.length} deliverable(s)</li><li>✓ {briefForm.rights_terms.replace('_', ' ')} rights</li></ul>
            </div>
            <div className="flex justify-between"><Button variant="ghost" onClick={() => setBriefStep(4)}>← Back</Button><Button loading={briefSaving} onClick={saveBrief}>Create Brief</Button></div>
          </div>
        )}
      </Modal>

      {/* ── New Creator Modal ── */}
      <Modal open={creatorModal} onClose={() => setCreatorModal(false)} title="Add Creator" size="md"
        footer={<><Button variant="ghost" onClick={() => setCreatorModal(false)}>Cancel</Button><Button loading={creatorSaving} onClick={saveCreator}>Add Creator</Button></>}
      >
        <div className="space-y-4">
          <Input label="Full Name *" placeholder="Creator's name" value={creatorForm.name} onChange={e => setCreatorForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" placeholder="creator@email.com" value={creatorForm.email} onChange={e => setCreatorForm(f => ({ ...f, email: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Instagram Handle" placeholder="@handle" value={creatorForm.instagram_handle} onChange={e => setCreatorForm(f => ({ ...f, instagram_handle: e.target.value }))} />
            <Input label="TikTok Handle" placeholder="@handle" value={creatorForm.tiktok_handle} onChange={e => setCreatorForm(f => ({ ...f, tiktok_handle: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Follower Count" type="number" placeholder="10000" value={creatorForm.follower_count} onChange={e => setCreatorForm(f => ({ ...f, follower_count: e.target.value }))} />
            <Input label="Niche" placeholder="Fitness, Beauty, Tech…" value={creatorForm.niche} onChange={e => setCreatorForm(f => ({ ...f, niche: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
