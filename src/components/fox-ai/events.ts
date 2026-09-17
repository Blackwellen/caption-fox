'use client'

// Cross-module bridge: any page can open the Fox AI panel on a given state
// (e.g. Unassigned → "Open Copilot", Unified → "View full profile").

export type FoxTab = 'copilot' | 'create' | 'inbox' | 'tasks' | 'alerts' | 'media' | 'agent' | 'contacts'

export interface FoxOpenDetail {
  tab: FoxTab
  contactId?: string
  threadId?: string
  chatId?: string
  prompt?: string
}

export const FOX_OPEN_EVENT = 'captionfox:fox-open'

export function openFox(detail: FoxOpenDetail) {
  window.dispatchEvent(new CustomEvent<FoxOpenDetail>(FOX_OPEN_EVENT, { detail }))
}
