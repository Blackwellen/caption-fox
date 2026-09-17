'use client'

import { useRef, useState } from 'react'
import { Braces, ChevronDown, ChevronRight, Code2, Image as ImageIcon, MoreHorizontal, MousePointerSquareDashed, Minus, Share2, Smile, Type, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIMARY, SECONDARY, SelectInput, TestSendButton, TextInput, insertAtCursor, useDraftActions, type DraftState } from './composer-kit'
import type { ComposerDraftProps } from './OverviewComposer'

const BLOCKS = [
  { key: 'text', label: 'Text', icon: Type }, { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'button', label: 'Button', icon: MousePointerSquareDashed }, { key: 'divider', label: 'Divider', icon: Minus },
  { key: 'spacer', label: 'Spacer', icon: ArrowUpDown }, { key: 'social', label: 'Social', icon: Share2 },
  { key: 'html', label: 'HTML', icon: Code2 }, { key: 'more', label: 'More', icon: MoreHorizontal },
] as const

const VARIABLES = ['{{first_name}}', '{{last_name}}', '{{product_name}}', '{{order_id}}']

export default function EmailComposer({
  draft, identities, replyTos, templates, audienceId, userEmail, canCreate, canTest,
}: {
  draft?: ComposerDraftProps
  identities: string[]
  replyTos: string[]
  templates: { id: string; name: string }[]
  audienceId?: string
  userEmail: string
  canCreate: boolean
  canTest: boolean
}) {
  const content = (draft?.content ?? {}) as Record<string, unknown>
  const [from, setFrom] = useState(draft?.sender_id ?? identities[0] ?? '')
  const [replyTo, setReplyTo] = useState(String(content.replyTo ?? replyTos[0] ?? ''))
  const [subject, setSubject] = useState(draft?.subject ?? String(content.subject ?? ''))
  const [preheader, setPreheader] = useState(String(content.preheader ?? ''))
  const [blocks, setBlocks] = useState<string[]>(Array.isArray(content.blocks) ? content.blocks as string[] : ['text', 'image', 'button'])
  const [tab, setTab] = useState<'content' | 'template' | 'design'>('content')
  const [templateId, setTemplateId] = useState(String(content.templateId ?? ''))
  const [varsOpen, setVarsOpen] = useState(false)
  const [saveMenu, setSaveMenu] = useState(false)
  const subjectRef = useRef<HTMLInputElement>(null)
  const actions = useDraftActions('email', draft?.id)

  const state = (): DraftState => ({
    name: draft?.name ?? (subject.slice(0, 60) || 'Email draft'), senderId: from, audienceId: draft?.audience_id ?? audienceId,
    content: { subject, body: String(content.body ?? subject), extras: { replyTo, preheader, blocks, templateId, image: content.image, cta: content.cta } },
  })
  const noCreate = canCreate ? null : 'Your role cannot create messages.'

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 lg:space-y-[9px]">
        <Row label="From"><SelectInput value={from} onChange={e => setFrom(e.target.value)} aria-label="From">{identities.map(i => <option key={i}>{i}</option>)}</SelectInput></Row>
        <Row label="Reply-to"><SelectInput value={replyTo} onChange={e => setReplyTo(e.target.value)} aria-label="Reply-to">{replyTos.map(i => <option key={i}>{i}</option>)}</SelectInput></Row>
        <Row label="Subject" wide><TextInput ref={subjectRef} value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} aria-label="Subject" placeholder="Add a subject line" /></Row>
        <div className="flex items-center gap-2 lg:pl-[57px]">
          <div className="relative">
            <button type="button" onClick={() => setVarsOpen(o => !o)} aria-expanded={varsOpen} aria-haspopup="menu"
              className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-50 px-2 text-[12px] font-medium text-blue-600 hover:bg-blue-100 lg:h-[20px] lg:px-[8px] lg:text-[8px]">
              Add personalization <ChevronRight className="h-3 w-3 lg:h-2.5 lg:w-2.5" aria-hidden />
            </button>
            {varsOpen && (
              <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {VARIABLES.map(v => <button key={v} type="button" role="menuitem" onClick={() => { insertAtCursor(subjectRef.current, v, subject, setSubject); setVarsOpen(false) }} className="block w-full px-3 py-1.5 text-left font-mono text-[12px] text-slate-700 hover:bg-slate-50">{v}</button>)}
              </div>
            )}
          </div>
          <IconBtn label="Insert emoji" onClick={() => insertAtCursor(subjectRef.current, ' ✨', subject, setSubject)}><Smile /></IconBtn>
          <IconBtn label="Insert first name" onClick={() => insertAtCursor(subjectRef.current, '{{first_name}}', subject, setSubject)}><Braces /></IconBtn>
        </div>
        <Row label="Preheader" wide><TextInput value={preheader} maxLength={150} onChange={e => setPreheader(e.target.value)} aria-label="Preheader" placeholder="Short summary shown after the subject" /></Row>
      </div>

      <div role="tablist" aria-label="Email editor" className="mt-3 flex gap-5 border-b border-slate-100 lg:mt-[12px] lg:gap-[34px] lg:pl-[10px]">
        {(['content', 'template', 'design'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-1 pb-1.5 text-[12px] capitalize lg:pb-[6px] lg:text-[8.5px]', tab === t ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-slate-600')}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1 lg:mt-[12px]">
        {tab === 'content' && (
          <ul className="grid grid-cols-4 gap-2 lg:gap-[8px]" aria-label="Content blocks">
            {BLOCKS.map(b => {
              const count = blocks.filter(x => x === b.key).length
              return (
                <li key={b.key}>
                  <button type="button" onClick={() => b.key === 'more' ? actions.openEditor(state()) : setBlocks(list => [...list, b.key])}
                    aria-label={b.key === 'more' ? 'More blocks in the full editor' : `Add ${b.label} block${count ? ` (${count} in email)` : ''}`}
                    className="flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:border-blue-300 hover:bg-blue-50/40 lg:h-[41px] lg:gap-[5px] lg:text-[7.5px]">
                    <b.icon className="h-4 w-4 text-slate-500 lg:h-[11px] lg:w-[11px]" aria-hidden />{b.label}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {tab === 'template' && (
          <label className="block text-[12px] text-slate-600 lg:text-[8.5px]">Start from a published template
            <SelectInput className="mt-1" value={templateId} onChange={e => setTemplateId(e.target.value)} aria-label="Template">
              <option value="">No template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectInput>
          </label>
        )}
        {tab === 'design' && (
          <p className="text-[12px] text-slate-500 lg:text-[8.5px]">{blocks.length} blocks in this email: {blocks.join(', ')}. Open the full editor to arrange them.</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 lg:mt-[10px] lg:gap-[18px]">
        <button type="button" disabled={!!noCreate} onClick={() => actions.openEditor(state())} className={cn(SECONDARY, 'lg:w-[62px] lg:justify-between')}>Preview <ChevronDown className="h-3 w-3 lg:h-2.5 lg:w-2.5" aria-hidden /></button>
        <TestSendButton channel="email" defaultAddress={userEmail} onSend={a => actions.test(state(), a)} disabledReason={!canTest ? 'Your role cannot send tests.' : noCreate} className="border-0 bg-transparent lg:px-0" />
        <div className="relative ml-auto flex lg:mr-[2px]">
          <button type="button" disabled={!!noCreate || actions.pending} title={noCreate ?? undefined} onClick={() => actions.save(state())} className={cn(PRIMARY, 'rounded-r-none lg:w-[70px]')}>Save draft</button>
          <button type="button" aria-label="More save options" aria-haspopup="menu" aria-expanded={saveMenu} disabled={!!noCreate} onClick={() => setSaveMenu(m => !m)} className={cn(PRIMARY, 'rounded-l-none border-l border-white/25 px-2 lg:px-[6px]')}><ChevronDown className="h-3 w-3 lg:h-2.5 lg:w-2.5" /></button>
          {saveMenu && (
            <div role="menu" className="absolute bottom-full right-0 z-40 mb-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              <button type="button" role="menuitem" onClick={() => { setSaveMenu(false); actions.review(state()) }} className="block w-full px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50">Save and submit for approval</button>
              <button type="button" role="menuitem" onClick={() => { setSaveMenu(false); actions.openEditor(state()) }} className="block w-full px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50">Save and open full editor</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[12px] text-slate-500 lg:w-[49px] lg:text-[8.5px]">{label}</span>
      <div className={cn('min-w-0 flex-1', wide ? 'lg:max-w-[232px]' : 'lg:max-w-[168px]')}>{children}</div>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 lg:h-[20px] lg:w-[20px] [&>svg]:h-3.5 [&>svg]:w-3.5 lg:[&>svg]:h-[11px] lg:[&>svg]:w-[11px]">
      {children}
    </button>
  )
}
