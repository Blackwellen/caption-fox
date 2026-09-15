'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, Sparkles, Pencil, Inbox, CheckSquare, AlertTriangle, Image as ImageIcon, Bot, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopilotTab } from './tabs/CopilotTab'
import { CreateTab } from './tabs/CreateTab'
import { InboxTab } from './tabs/InboxTab'
import { TasksTab } from './tabs/TasksTab'
import { AlertsTab } from './tabs/AlertsTab'
import { MediaTab } from './tabs/MediaTab'
import { AgentTab } from './tabs/AgentTab'
import { ContactsTab } from './tabs/ContactsTab'

export type FoxTab = 'copilot' | 'create' | 'inbox' | 'tasks' | 'alerts' | 'media' | 'agent' | 'contacts'

const TABS: { id: FoxTab; label: string; icon: React.ReactNode }[] = [
  { id: 'copilot', label: 'Copilot', icon: <Sparkles size={15} /> },
  { id: 'create', label: 'Create', icon: <Pencil size={15} /> },
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={15} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={15} /> },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={15} /> },
  { id: 'media', label: 'Media', icon: <ImageIcon size={15} /> },
  { id: 'agent', label: 'Agent', icon: <Bot size={15} /> },
  { id: 'contacts', label: 'Contacts', icon: <Users2 size={15} /> },
]

interface FoxAIBubbleProps {
  workspaceId: string
  userId: string
  canAssign: boolean
}

export default function FoxAIBubble({ workspaceId, userId, canAssign }: FoxAIBubbleProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<FoxTab>('copilot')
  const [alertCount, setAlertCount] = useState(0)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  function openInboxThread(threadId: string) {
    setActiveThreadId(threadId)
    setTab('inbox')
  }

  return (
    <>
      {/* Collapsed launcher — white background, blue border, fox symbol, no solid fill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-500 bg-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 group"
          aria-label="Open Fox AI Copilot"
          title="Fox AI Copilot"
        >
          <Image src="/caption fox favicon.png" alt="" width={30} height={30} className="rounded-md transition-transform group-hover:scale-105" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex max-h-[calc(100vh-32px)] w-[min(1040px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-label="Fox AI Copilot"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-fox-gradient px-5 py-3.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Image src="/caption fox favicon.png" alt="Fox AI" width={22} height={22} className="rounded" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Fox AI Copilot</p>
              <p className="text-xs text-blue-100">Your social content assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-blue-100 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close Fox AI Copilot">
              <X size={18} />
            </button>
          </div>

          {/* Navigation — 8 one-word tabs, single row */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2" aria-label="Fox AI Copilot sections">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium -mb-px transition-colors',
                  tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>

          {/* Active tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'copilot' && <CopilotTab workspaceId={workspaceId} />}
            {tab === 'create' && <CreateTab workspaceId={workspaceId} />}
            {tab === 'inbox' && <InboxTab workspaceId={workspaceId} userId={userId} canAssign={canAssign} initialThreadId={activeThreadId} />}
            {tab === 'tasks' && <TasksTab workspaceId={workspaceId} userId={userId} />}
            {tab === 'alerts' && <AlertsTab workspaceId={workspaceId} onCountChange={setAlertCount} />}
            {tab === 'media' && <MediaTab workspaceId={workspaceId} userId={userId} />}
            {tab === 'agent' && <AgentTab workspaceId={workspaceId} userId={userId} />}
            {tab === 'contacts' && <ContactsTab workspaceId={workspaceId} onOpenConversation={openInboxThread} />}
          </div>
        </div>
      )}
    </>
  )
}
