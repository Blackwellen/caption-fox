import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, Repeat2 } from 'lucide-react'
import { CHANNEL_LABELS, captionLimitFor } from '@/lib/studio/constants'
import type { MediaRow } from '@/lib/studio/types'

/**
 * Real, channel-specific previews driven by the live editor state — not a
 * static screenshot. Truncation matches each channel's actual caption limit.
 */
export default function ChannelPreview({
  channel, caption, asset,
}: { channel: string; caption: string; asset?: MediaRow }) {
  const limit = captionLimitFor([channel])
  const shown = caption.length > 220 ? `${caption.slice(0, 220)}…` : caption
  const label = CHANNEL_LABELS[channel] ?? channel

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" aria-label={`${label} preview`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">CF</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800">captionfox</p>
          <p className="text-[10px] text-slate-400">{label}</p>
        </div>
      </div>

      {asset?.file_type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.file_url} alt="" className="mb-2 aspect-square w-full rounded-lg object-cover" />
      ) : (
        <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-center text-sm font-semibold text-white">
          {shown ? shown.slice(0, 40) : 'Your content preview'}
        </div>
      )}

      <p className="whitespace-pre-wrap text-[12px] text-slate-700">{shown || <span className="text-slate-300">Nothing written yet…</span>}</p>

      <div className="mt-2 flex items-center gap-3 text-slate-400">
        {channel === 'linkedin' ? (
          <><ThumbsUp size={14} /><MessageCircle size={14} /><Repeat2 size={14} /><Send size={14} /></>
        ) : (
          <><Heart size={14} /><MessageCircle size={14} /><Send size={14} /><Bookmark size={14} className="ml-auto" /></>
        )}
      </div>

      {caption.length > limit && (
        <p className="mt-1.5 text-[11px] font-medium text-red-500">Over the {limit}-character limit for {label}</p>
      )}
    </div>
  )
}
