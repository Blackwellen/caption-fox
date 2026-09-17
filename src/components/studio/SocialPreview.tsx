'use client'

import {
  Bookmark, ChevronRight, Heart, MessageCircle, MoreHorizontal, Music2, Play, Repeat2, Send, Share2, ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChannelIcon } from '@/components/home/brand-icons'
import { CHANNEL_LABELS } from '@/lib/studio/constants'
import { fmtCompact } from './ui'

export interface PreviewAccountLite { name: string; handle: string; avatar_url: string | null; followers: number | null }

export interface PreviewContent {
  caption: string
  mediaUrl: string | null
  mediaType?: 'image' | 'video' | null
  ctaLabel?: string | null
  /** Text-only content (e.g. AI drafts): no media placeholder is drawn. */
  textOnly?: boolean
  /** Overrides the feed media aspect ratio class, e.g. a banner-style template cover. */
  mediaAspect?: string
  /** Real engagement only (published content). Drafts show none rather than invented numbers. */
  engagement?: { likes?: number; comments?: number; shares?: number; views?: number } | null
  timestamp?: string | null
}

/**
 * Live channel previews. They render from the editor state so they update as
 * the user types. Truncation follows each platform's "more" cut-off; engagement
 * counts appear only when the record has real engagement data.
 */
export default function SocialPreview({ channel, account, content, size = 'md', className }: {
  channel: string
  account: PreviewAccountLite
  content: PreviewContent
  size?: 'sm' | 'md'
  className?: string
}) {
  const label = `${CHANNEL_LABELS[channel] ?? channel} preview`
  if (channel === 'tiktok') return <TikTok account={account} content={content} className={className} label={label} />
  if (channel === 'linkedin' || channel === 'facebook') return <LinkedInLike channel={channel} account={account} content={content} className={className} label={label} />
  if (channel === 'x' || channel === 'threads') return <XLike account={account} content={content} className={className} label={label} />
  return <Instagram account={account} content={content} size={size} className={className} label={label} />
}

function Avatar({ account, size }: { account: PreviewAccountLite; size: number }) {
  if (account.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={account.avatar_url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/caption fox favicon.png" alt="" className="shrink-0 rounded-md object-cover" style={{ width: size, height: size }} />
}

function Media({ content, className, aspect }: { content: PreviewContent; className?: string; aspect: string }) {
  if (!content.mediaUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-[11px] text-slate-400', aspect, className)}>
        Add media to preview it here
      </div>
    )
  }
  return (
    <div className={cn('relative overflow-hidden bg-slate-900', aspect, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.mediaUrl} alt="" className="h-full w-full object-cover" />
      {content.mediaType === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center"><Play className="h-8 w-8 fill-white text-white drop-shadow" /></span>
      )}
    </div>
  )
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  const chars = [...text]
  if (chars.length <= max) return { text, truncated: false }
  return { text: chars.slice(0, max).join('').trimEnd() + '…', truncated: true }
}

function Instagram({ account, content, size, className, label }: { account: PreviewAccountLite; content: PreviewContent; size: 'sm' | 'md'; className?: string; label: string }) {
  const handle = account.handle.replace(/^@/, '') || account.name
  const firstLine = content.caption.split('\n')[0] ?? ''
  const cut = truncate(size === 'sm' ? firstLine : content.caption, size === 'sm' ? 42 : 125)
  const likes = content.engagement?.likes
  return (
    <article aria-label={label} className={cn('overflow-hidden rounded-[10px] border border-[#e6e9f0] bg-white text-slate-900', className)}>
      <header className="flex items-center gap-2 px-2.5 py-2">
        {size === 'sm'
          ? <ChannelIcon channel="instagram" size={18} />
          : <Avatar account={account} size={22} />}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-semibold lg:text-[10px]">{handle}</p>
          {size === 'md' && <p className="text-[10px] text-slate-500 lg:text-[8px]">Sponsored</p>}
        </div>
        {size === 'md' && <MoreHorizontal size={14} className="text-slate-500" aria-hidden />}
      </header>
      {!(content.textOnly && !content.mediaUrl) && <Media content={content} aspect={size === 'sm' ? 'aspect-[16/7.2]' : 'aspect-[4/5]'} className={size === 'sm' ? 'mx-1.5 rounded-[3px]' : ''} />}
      {content.ctaLabel && size === 'md' && (
        <div className="flex items-center justify-between bg-[#132a5c] px-2.5 py-1.5 text-[11px] font-semibold text-white lg:text-[8.5px]">
          {content.ctaLabel}<ChevronRight size={12} aria-hidden />
        </div>
      )}
      <div className="flex items-center gap-2.5 px-2.5 pt-2 text-slate-800" aria-hidden>
        <Heart size={size === 'sm' ? 16 : 14} /><MessageCircle size={size === 'sm' ? 16 : 14} /><Send size={size === 'sm' ? 15 : 13} />
        <Bookmark size={size === 'sm' ? 16 : 14} className="ml-auto" />
      </div>
      <div className="space-y-0.5 px-2.5 pb-2.5 pt-1.5 text-[12px] leading-snug lg:text-[9px]">
        {likes !== undefined && likes > 0 && <p className="font-semibold">{likes.toLocaleString('en-GB')} likes</p>}
        <p className="whitespace-pre-line break-words">
          <span className="font-semibold">{handle}</span> {cut.text}
          {cut.truncated && <span className="text-slate-400"> more</span>}
        </p>
        {size === 'md' && content.engagement?.comments ? <p className="text-slate-400">View all {content.engagement.comments} comments</p> : null}
      </div>
    </article>
  )
}

function LinkedInLike({ channel, account, content, className, label }: { channel: string; account: PreviewAccountLite; content: PreviewContent; className?: string; label: string }) {
  const cut = truncate(content.caption, 150)
  const e = content.engagement
  return (
    <article aria-label={label} className={cn('overflow-hidden rounded-[10px] border border-[#e6e9f0] bg-white text-slate-900', className)}>
      <header className="flex items-start gap-2 px-2.5 pb-1.5 pt-2.5">
        <Avatar account={account} size={26} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-semibold lg:text-[10px]">{account.name}</p>
          {account.followers !== null && <p className="text-[10px] text-slate-500 lg:text-[8px]">{account.followers.toLocaleString('en-GB')} followers</p>}
          <p className="text-[10px] text-slate-500 lg:text-[8px]">{channel === 'facebook' ? 'Sponsored' : 'Promoted'}</p>
        </div>
        <MoreHorizontal size={14} className="text-slate-500" aria-hidden />
      </header>
      <p className="whitespace-pre-line break-words px-2.5 pb-1 text-[12px] leading-snug text-slate-700 lg:text-[9px]">{cut.text}</p>
      {cut.truncated && <p className="px-2.5 pb-1.5 text-right text-[11px] text-slate-500 lg:text-[8.5px]">…see more</p>}
      {!(content.textOnly && !content.mediaUrl) && <Media content={content} aspect={content.mediaAspect ?? 'aspect-[1/1.02]'} />}
      {content.ctaLabel && (
        <div className="flex items-center justify-between bg-[#132a5c] px-2.5 py-1.5 text-[11px] font-semibold text-white lg:text-[8.5px]">
          {content.ctaLabel}<ChevronRight size={12} aria-hidden />
        </div>
      )}
      {e && (e.likes || e.comments) ? (
        <p className="flex items-center gap-1 border-b border-[#eef0f4] px-2.5 py-1.5 text-[10px] text-slate-500 lg:text-[8px]">
          <span className="flex -space-x-1" aria-hidden><span className="h-2.5 w-2.5 rounded-full bg-[#1a73e8]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" /></span>
          {fmtCompact(e.likes ?? 0)} · {e.comments ?? 0} comments
        </p>
      ) : <div className="border-b border-[#eef0f4]" />}
      <div className="grid grid-cols-4 px-1 py-1.5 text-[10px] text-slate-500 lg:text-[8px]" aria-hidden>
        {[[ThumbsUp, 'Like'], [MessageCircle, 'Comment'], [Repeat2, channel === 'facebook' ? 'Share' : 'Share'], [Send, 'Send']].map(([Icon, text]) => {
          const I = Icon as typeof ThumbsUp
          return <span key={text as string} className="flex flex-col items-center gap-0.5"><I size={12} />{text as string}</span>
        })}
      </div>
    </article>
  )
}

function TikTok({ account, content, className, label }: { account: PreviewAccountLite; content: PreviewContent; className?: string; label: string }) {
  const e = content.engagement
  const cut = truncate(content.caption, 120)
  const metric = (value: number | undefined) => (value ? fmtCompact(value) : '')
  return (
    <article aria-label={label} className={cn('overflow-hidden rounded-[10px] border border-[#e6e9f0] bg-white', className)}>
      <div className="relative aspect-[9/14.5] overflow-hidden rounded-[8px] bg-[#070b18]">
        {content.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.mediaUrl} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        <p className="absolute left-2.5 top-2.5 text-[11px] font-semibold text-white lg:text-[8.5px]">
          {account.handle || account.name} <span className="font-normal text-white/70">· now</span>
        </p>
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden><Play className="h-7 w-7 fill-white text-white" /></span>
        <div className="absolute bottom-10 right-1.5 flex flex-col items-center gap-2 text-[10px] font-semibold text-white lg:text-[8px]" aria-hidden>
          <span className="flex flex-col items-center"><Heart className="h-5 w-5 fill-white" />{metric(e?.likes)}</span>
          <span className="flex flex-col items-center"><MessageCircle className="h-5 w-5 fill-white" />{metric(e?.comments)}</span>
          <span className="flex flex-col items-center"><Share2 className="h-5 w-5" />{metric(e?.shares)}</span>
          <Avatar account={account} size={22} />
        </div>
      </div>
      <div className="px-2 pb-2 pt-1.5 text-[12px] leading-snug text-slate-700 lg:text-[9px]">
        <p className="whitespace-pre-line break-words">{cut.text}</p>
        <p className="mt-1 flex items-center gap-1 text-slate-600"><Music2 size={10} aria-hidden /> Original sound – {(account.handle || account.name).replace(/^@/, '')}</p>
      </div>
    </article>
  )
}

function XLike({ account, content, className, label }: { account: PreviewAccountLite; content: PreviewContent; className?: string; label: string }) {
  const cut = truncate(content.caption, 280)
  return (
    <article aria-label={label} className={cn('overflow-hidden rounded-[10px] border border-[#e6e9f0] bg-white p-2.5 text-slate-900', className)}>
      <header className="flex items-center gap-2">
        <Avatar account={account} size={24} />
        <p className="min-w-0 truncate text-[12px] font-semibold lg:text-[10px]">{account.name} <span className="font-normal text-slate-500">{account.handle}</span></p>
      </header>
      <p className="mt-1.5 whitespace-pre-line break-words text-[12px] leading-snug lg:text-[9.5px]">{cut.text}</p>
      {content.mediaUrl && <Media content={content} aspect="aspect-video" className="mt-2 rounded-lg" />}
    </article>
  )
}
