'use client'

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import {
  AlignLeft, Bold, CheckCircle2, ChevronDown, Code2, Hash, Image as ImageIcon, IndentIncrease, Italic,
  Link2, List, ListOrdered, Loader2, MoreVertical, Quote, Redo2, Smile, Sparkles, Strikethrough,
  Underline, Undo2, AlertCircle, Copy, Eraser,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  applyBlock, applyParagraph, countCharacters, countWords, toPlain, toggleStyle,
  type BlockStyle, type InlineStyle, type ParagraphStyle,
} from '@/lib/studio/text-format'
import { ASSIST_ACTIONS, type AssistAction } from '@/lib/studio/ai'
import { MenuItem, MenuSeparator, Popover, PopoverContent, PopoverTrigger } from './overlays'
import { S_FOCUS } from './ui'

const EMOJIS = ['😀', '😍', '🥳', '🔥', '🚀', '✨', '💡', '🎯', '📈', '✅', '👉', '👇', '💬', '📣', '🎉', '💙', '🙌', '👏', '⚡', '🌿', '💧', '☀️', '📸', '🎬', '🛍️', '💼', '🧠', '⏰', '📅', '🏆', '❤️', '🤝']

export interface CaptionEditorHandle {
  insert: (text: string) => void
  focus: () => void
}

type Density = 'compact' | 'large'

/**
 * The Studio caption editor. Captions are plain text on every social network,
 * so formatting is applied as platform-safe Unicode (see text-format.ts).
 * Hashtags and links are highlighted through a mirrored layer behind a real
 * <textarea>, so native selection, IME input, spellcheck and screen readers keep
 * working. Undo / redo keep their own history because programmatic edits bypass
 * the browser's undo stack.
 */
const CaptionEditor = forwardRef<CaptionEditorHandle, {
  value: string
  onChange: (value: string) => void
  limit: number
  density?: Density
  placeholder?: string
  label?: string
  readOnly?: boolean
  canAssist?: boolean
  channel?: string
  onAssistError?: (message: string) => void
  onRequestMedia?: () => void
  toolbarExtra?: React.ReactNode
  className?: string
  bodyClassName?: string
  showFooter?: boolean
  counterStyle?: 'label' | 'fraction'
}>(function CaptionEditor({
  value, onChange, limit, density = 'large', placeholder, label = 'Caption', readOnly, canAssist = false,
  channel = 'instagram', onAssistError, onRequestMedia, className, bodyClassName, showFooter = true, counterStyle = 'label',
}, ref) {
  const area = useRef<HTMLTextAreaElement>(null)
  const mirror = useRef<HTMLDivElement>(null)
  const history = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  const [assisting, setAssisting] = useState<AssistAction | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const compact = density === 'compact'

  const commit = useCallback((next: string, selection?: [number, number]) => {
    if (next === value) return
    history.current.past.push(value)
    if (history.current.past.length > 200) history.current.past.shift()
    history.current.future = []
    onChange(next)
    if (selection) requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(selection[0], selection[1]) })
  }, [value, onChange])

  const undo = () => {
    const prev = history.current.past.pop()
    if (prev === undefined) return
    history.current.future.push(value)
    onChange(prev)
  }
  const redo = () => {
    const next = history.current.future.pop()
    if (next === undefined) return
    history.current.past.push(value)
    onChange(next)
  }

  const selection = () => {
    const el = area.current
    return el ? [el.selectionStart, el.selectionEnd] as const : [value.length, value.length] as const
  }

  const insert = useCallback((text: string) => {
    const el = area.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const needsSpace = start > 0 && !/\s$/.test(value.slice(0, start)) && /^[#@]/.test(text)
    const chunk = `${needsSpace ? ' ' : ''}${text}`
    commit(value.slice(0, start) + chunk + value.slice(end), [start + chunk.length, start + chunk.length])
  }, [value, commit])

  useImperativeHandle(ref, () => ({ insert, focus: () => area.current?.focus() }), [insert])

  function inline(style: InlineStyle) {
    const [start, end] = selection()
    if (start === end) return
    const styled = toggleStyle(value.slice(start, end), style)
    commit(value.slice(0, start) + styled + value.slice(end), [start, start + styled.length])
  }

  function lines(transform: (lines: string[]) => string[]) {
    const [start, end] = selection()
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextBreak = value.indexOf('\n', end)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const block = transform(value.slice(lineStart, lineEnd).split('\n')).join('\n')
    commit(value.slice(0, lineStart) + block + value.slice(lineEnd), [lineStart, lineStart + block.length])
  }

  const block = (style: BlockStyle) => lines(ls => applyBlock(ls, style))
  const paragraph = (style: ParagraphStyle) => lines(ls => ls.map(l => applyParagraph(l, style)))

  function applyLink() {
    const url = linkUrl.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) { onAssistError?.('Enter a full link starting with https://'); return }
    const [start, end] = selection()
    const text = value.slice(start, end)
    const chunk = text ? `${text} (${url})` : url
    commit(value.slice(0, start) + chunk + value.slice(end), [start + chunk.length, start + chunk.length])
    setLinkUrl('')
    setLinkOpen(false)
  }

  async function assist(action: AssistAction) {
    if (!value.trim()) { onAssistError?.('Write something first, then use AI Assist.'); return }
    setAssisting(action)
    try {
      const res = await fetch('/api/studio/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'assist', action, text: value, channel }),
      })
      const body = await res.json().catch(() => ({})) as { outputs?: { output: string }[]; error?: string }
      if (!res.ok || !body.outputs?.[0]) { onAssistError?.(body.error ?? 'AI Assist is unavailable right now.'); return }
      commit(body.outputs[0].output)
    } catch {
      onAssistError?.('AI Assist could not be reached. Check your connection and try again.')
    } finally {
      setAssisting(null)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.metaKey || event.ctrlKey
    if (!mod) return
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo() }
    else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo() }
    else if (key === 'b') { event.preventDefault(); inline('bold') }
    else if (key === 'i') { event.preventDefault(); inline('italic') }
    else if (key === 'u') { event.preventDefault(); inline('underline') }
  }

  const count = countCharacters(value)
  const over = count > limit
  const tool = cn(
    'inline-flex items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40',
    S_FOCUS, compact ? 'h-9 w-9 shrink-0 lg:h-[26px] lg:w-[26px]' : 'h-9 w-9 shrink-0 lg:h-[24px] lg:w-[23px]',
  )
  const iconSize = compact ? 15 : 13
  const sep = <span className="mx-1 h-5 w-px shrink-0 bg-[#e6e9f0] lg:mx-[3px] lg:h-4" aria-hidden />

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-[8px] border border-[#e3e7ee] bg-white focus-within:border-[#b9ccff]', className)}>
      <div role="toolbar" aria-label={`${label} formatting`}
        className={cn('flex flex-wrap items-center gap-0.5 border-b border-[#eceff4] bg-[#fbfcfd] px-1.5 lg:flex-nowrap lg:gap-0 lg:overflow-hidden', compact ? 'min-h-11 lg:min-h-[38px]' : 'min-h-11 lg:min-h-[32px]')}>
        <Popover>
          <PopoverTrigger haspopup="menu" label="Paragraph style" disabled={readOnly}
            className={cn('inline-flex h-9 items-center gap-1 rounded-md px-2 text-slate-600 hover:bg-slate-100 lg:h-[24px]', S_FOCUS, compact ? 'min-w-[88px] justify-between text-[13px] lg:min-w-[80px] lg:text-[10.5px]' : 'text-[13px] lg:text-[9.5px]')}>
            Paragraph <ChevronDown size={11} className="text-slate-400" />
          </PopoverTrigger>
          <PopoverContent role="menu" label="Paragraph style" width={170}>
            {close => (<>
              <MenuItem close={close} onSelect={() => paragraph('paragraph')}>Paragraph (plain)</MenuItem>
              <MenuItem close={close} onSelect={() => paragraph('heading')}>𝗛𝗘𝗔𝗗𝗜𝗡𝗚</MenuItem>
              <MenuItem close={close} onSelect={() => paragraph('caps')}>UPPERCASE</MenuItem>
            </>)}
          </PopoverContent>
        </Popover>
        {sep}
        <button type="button" className={cn(tool, compact && 'bg-slate-100/70')} onClick={() => inline('bold')} aria-label="Bold (Ctrl+B)" title="Bold" disabled={readOnly}><Bold size={iconSize} strokeWidth={2.4} /></button>
        <button type="button" className={cn(tool, compact && 'bg-slate-100/70')} onClick={() => inline('italic')} aria-label="Italic (Ctrl+I)" title="Italic" disabled={readOnly}><Italic size={iconSize} /></button>
        <button type="button" className={tool} onClick={() => inline('underline')} aria-label="Underline (Ctrl+U)" title="Underline" disabled={readOnly}><Underline size={iconSize} /></button>
        {compact && (
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger label="Insert link" className={tool} disabled={readOnly}><Link2 size={iconSize} /></PopoverTrigger>
            <LinkPanel url={linkUrl} setUrl={setLinkUrl} onApply={applyLink} />
          </Popover>
        )}
        {sep}
        <button type="button" className={tool} onClick={() => block('bullets')} aria-label="Bulleted list" title="Bulleted list" disabled={readOnly}><List size={iconSize} /></button>
        <button type="button" className={tool} onClick={() => block('numbers')} aria-label="Numbered list" title="Numbered list" disabled={readOnly}><ListOrdered size={iconSize} /></button>
        {sep}
        <Popover>
          <PopoverTrigger haspopup="menu" label="Spacing" disabled={readOnly} className={cn(tool, 'w-auto gap-0.5 px-1 lg:w-auto')}>
            <AlignLeft size={iconSize} />{compact && <ChevronDown size={9} className="text-slate-400" />}
          </PopoverTrigger>
          <PopoverContent role="menu" label="Spacing" width={190}>
            {close => (<>
              <MenuItem close={close} onSelect={() => commit(value.replace(/\n{2,}/g, '\n'))}>Single line breaks</MenuItem>
              <MenuItem close={close} onSelect={() => commit(value.replace(/\n{2,}/g, '\n').replace(/\n/g, '\n\n'))}>Double line breaks</MenuItem>
              <MenuItem close={close} onSelect={() => commit(value.split('\n').map(l => l.trimEnd()).join('\n').trim())}>Trim spacing</MenuItem>
            </>)}
          </PopoverContent>
        </Popover>
        {compact && <button type="button" className={tool} onClick={() => block('indent')} aria-label="Indent" title="Indent" disabled={readOnly}><IndentIncrease size={iconSize} /></button>}
        {!compact && (
          <>
            <Popover open={linkOpen} onOpenChange={setLinkOpen}>
              <PopoverTrigger label="Insert link" className={tool} disabled={readOnly}><Link2 size={iconSize} /></PopoverTrigger>
              <LinkPanel url={linkUrl} setUrl={setLinkUrl} onApply={applyLink} />
            </Popover>
            <button type="button" className={tool} onClick={() => block('quote')} aria-label="Quote" title="Quote" disabled={readOnly}><Quote size={iconSize} /></button>
            <button type="button" className={tool} onClick={() => inline('bold')} aria-label="Monospace emphasis" title="Emphasis" disabled={readOnly}><Code2 size={iconSize} /></button>
          </>
        )}
        {compact && (<>{sep}<EmojiButton className={tool} size={iconSize} onPick={insert} disabled={readOnly} /></>)}
        {canAssist && !readOnly && (
          <>
            {compact && sep}
            <Popover>
              <PopoverTrigger haspopup="menu" label="AI Assist"
                className={cn('inline-flex items-center gap-1 rounded-md font-medium text-[#1a5cff] transition-colors hover:bg-[#eef3ff]', S_FOCUS,
                  compact ? 'h-9 border border-[#e3eaff] bg-[#f5f8ff] px-2.5 text-[13px] lg:h-[26px] lg:text-[10.5px]' : 'h-9 px-2 text-[13px] lg:h-[24px] lg:text-[10px]')}>
                {assisting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {compact ? 'AI Assist' : <>AI <ChevronDown size={10} /></>}
              </PopoverTrigger>
              <PopoverContent role="menu" label="AI Assist" width={210} align={compact ? 'start' : 'end'}>
                {close => ASSIST_ACTIONS.map(action => (
                  <MenuItem key={action.id} close={close} onSelect={() => void assist(action.id)} icon={<Sparkles size={12} />} disabled={assisting !== null}>
                    {action.label}
                  </MenuItem>
                ))}
              </PopoverContent>
            </Popover>
          </>
        )}
        <div className={cn('flex items-center', compact ? 'ml-auto' : 'ml-auto')}>
          <Popover>
            <PopoverTrigger haspopup="menu" label="More editor options" className={tool}><MoreVertical size={iconSize} /></PopoverTrigger>
            <PopoverContent role="menu" label="More editor options" width={200} align="end">
              {close => (<>
                <MenuItem close={close} icon={<Undo2 size={12} />} onSelect={undo} disabled={readOnly || history.current.past.length === 0}>Undo</MenuItem>
                <MenuItem close={close} icon={<Redo2 size={12} />} onSelect={redo} disabled={readOnly || history.current.future.length === 0}>Redo</MenuItem>
                <MenuSeparator />
                {!compact && <MenuItem close={close} icon={<Strikethrough size={12} />} onSelect={() => inline('strike')} disabled={readOnly}>Strikethrough</MenuItem>}
                {!compact && <MenuItem close={close} icon={<IndentIncrease size={12} />} onSelect={() => block('indent')} disabled={readOnly}>Indent</MenuItem>}
                <MenuItem close={close} icon={<Eraser size={12} />} onSelect={() => commit(toPlain(value))} disabled={readOnly}>Clear formatting</MenuItem>
                <MenuItem close={close} icon={<Copy size={12} />} onSelect={() => void navigator.clipboard?.writeText(value)}>Copy caption</MenuItem>
                {!compact && <MenuItem close={close} icon={<Smile size={12} />} onSelect={() => insert('✨')} disabled={readOnly}>Insert emoji ✨</MenuItem>}
              </>)}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className={cn('relative min-h-0 flex-1', bodyClassName)}>
        <div ref={mirror} aria-hidden
          className={cn('pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent', compact ? 'px-3.5 py-3 text-[15px] leading-[1.6] lg:text-[13px] lg:leading-[21px]' : 'px-3 py-2.5 text-[14px] leading-[1.6] lg:text-[11px] lg:leading-[16px]')}>
          <Highlighted text={value} />
          {'\n'}
        </div>
        <textarea
          ref={area} value={value} readOnly={readOnly} aria-label={label} placeholder={placeholder}
          aria-invalid={over || undefined}
          onChange={e => commit(e.target.value)} onKeyDown={onKeyDown}
          onScroll={e => { if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop }}
          spellCheck
          className={cn(
            'relative block h-full w-full resize-none bg-transparent text-slate-800 caret-slate-900 outline-none placeholder:text-slate-400 placeholder:[-webkit-text-fill-color:#94a3b8]',
            compact ? 'min-h-[180px] px-3.5 py-3 text-[15px] leading-[1.6] lg:min-h-0 lg:text-[13px] lg:leading-[21px]' : 'min-h-[260px] px-3 py-2.5 text-[14px] leading-[1.6] lg:min-h-0 lg:text-[11px] lg:leading-[16px]',
          )}
          style={{ WebkitTextFillColor: 'transparent' }}
        />
        {!compact && showFooter && (
          <span className={cn('pointer-events-none absolute bottom-1.5 right-2.5 text-[12px] tabular-nums lg:text-[8.5px]', over ? 'font-semibold text-red-600' : 'text-slate-400')}>
            {count.toLocaleString('en-GB')} / {limit.toLocaleString('en-GB')}
          </span>
        )}
      </div>

      {compact && showFooter && (
        <div className="flex items-center gap-1 px-2 pb-2 pt-1">
          <EmojiButton className={tool} size={15} onPick={insert} disabled={readOnly} />
          <button type="button" className={tool} onClick={() => insert('#')} aria-label="Add hashtag" title="Add hashtag" disabled={readOnly}><Hash size={15} /></button>
          {onRequestMedia && <button type="button" className={tool} onClick={onRequestMedia} aria-label="Attach media" title="Attach media" disabled={readOnly}><ImageIcon size={15} /></button>}
          <span className={cn('ml-auto flex items-center gap-1.5 pr-1 text-[12px] tabular-nums lg:text-[10.5px]', over ? 'text-red-600' : 'text-slate-500')} aria-live="polite">
            {counterStyle === 'label' ? `Characters: ${count.toLocaleString('en-GB')}` : `${count} / ${limit}`}
            {over
              ? <AlertCircle size={15} className="text-red-500" aria-label={`Over the ${limit}-character limit`} />
              : <CheckCircle2 size={15} className="text-[#22a55b]" aria-label="Within the channel limit" />}
          </span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{over ? `Caption is ${count - limit} characters over the ${limit} limit.` : ''}</span>
      <span className="sr-only">{countWords(value)} words</span>
    </div>
  )
})

export default CaptionEditor

/** Renders the caption with hashtags, mentions and links coloured (mirror layer). */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/((?:^|(?<=\s))[#@][\p{L}\p{N}_]+|https?:\/\/\S+)/u)
  return (
    <>
      {parts.map((part, i) => /^[#@][\p{L}\p{N}_]+$|^https?:\/\//u.test(part)
        ? <span key={i} className="text-[#1a5cff]" style={{ WebkitTextFillColor: '#1a5cff' }}>{part}</span>
        : <span key={i} className="text-slate-800" style={{ WebkitTextFillColor: '#1e293b' }}>{part}</span>)}
    </>
  )
}

function EmojiButton({ className, size, onPick, disabled }: { className: string; size: number; onPick: (emoji: string) => void; disabled?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger label="Insert emoji" haspopup="listbox" className={className} disabled={disabled}><Smile size={size} /></PopoverTrigger>
      <PopoverContent role="listbox" label="Emoji" width={236} className="p-2">
        {close => (
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map(emoji => (
              <button key={emoji} type="button" role="option" aria-selected={false} aria-label={`Insert ${emoji}`}
                onClick={() => { onPick(emoji); close() }}
                className={cn('flex h-7 w-7 items-center justify-center rounded-md text-[16px] hover:bg-slate-100', S_FOCUS)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function LinkPanel({ url, setUrl, onApply }: { url: string; setUrl: (v: string) => void; onApply: () => void }) {
  return (
    <PopoverContent label="Insert link" width={260} className="p-2">
      <form onSubmit={e => { e.preventDefault(); onApply() }} className="flex gap-1.5">
        <label className="sr-only" htmlFor="studio-link-url">Link URL</label>
        <input id="studio-link-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://"
          className="h-8 min-w-0 flex-1 rounded-md border border-[#dfe3ea] px-2 text-[12px] outline-none focus:border-blue-400" />
        <button type="submit" className="h-8 rounded-md bg-[#1a5cff] px-2.5 text-[12px] font-medium text-white">Add</button>
      </form>
    </PopoverContent>
  )
}
