'use client'

import { Sparkles } from 'lucide-react'

/**
 * Placeholder Agent tab. The autonomous-agent workflow itself is not yet
 * implemented — this keeps the Fox AI bubble buildable without claiming a
 * capability that doesn't exist yet.
 */
export function AgentTab({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  void workspaceId
  void userId
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Sparkles size={20} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-600">Agent mode is coming soon</p>
      <p className="text-xs text-slate-400">Autonomous multi-step tasks will appear here once this capability ships.</p>
    </div>
  )
}
