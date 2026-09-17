// Idea stage styling shared by server and client components.

import { Check, CircleDashed, Search, Sparkles, Star, X } from 'lucide-react'
import type { Tone } from '../ui'

export const STAGE_STYLE: Record<string, { tone: Tone; bar: string; icon: React.ReactNode }> = {
  backlog: { tone: 'slate', bar: 'bg-[#f2f4f7] text-slate-600', icon: <CircleDashed size={11} /> },
  in_research: { tone: 'violet', bar: 'bg-[#f1ecff] text-[#7045e6]', icon: <Search size={11} /> },
  prioritised: { tone: 'amber', bar: 'bg-[#fff4df] text-[#c77a05]', icon: <Star size={11} className="fill-current" /> },
  ready_to_draft: { tone: 'blue', bar: 'bg-[#e9f0ff] text-[#2f62f5]', icon: <Sparkles size={11} /> },
  approved: { tone: 'green', bar: 'bg-[#e8f7ee] text-[#1c9b52]', icon: <Check size={11} /> },
  converted: { tone: 'green', bar: 'bg-[#e8f7ee] text-[#1c9b52]', icon: <Check size={11} /> },
  archived: { tone: 'slate', bar: 'bg-[#f2f4f7] text-slate-500', icon: <X size={11} /> },
}
