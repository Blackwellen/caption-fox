'use client'

import { createContext, useContext } from 'react'
import type { SeoTabId } from '@/lib/seo/types'

interface SeoNavValue { tabs: SeoTabId[]; active: SeoTabId; query?: string }

const SeoNavContext = createContext<SeoNavValue | null>(null)

/**
 * Carries the entitled SEO tabs from the server chrome to the header, so the
 * section switcher can live on the page title (the references have no
 * separate tab strip above the header).
 */
export function SeoNavProvider({ value, children }: { value: SeoNavValue; children: React.ReactNode }) {
  return <SeoNavContext.Provider value={value}>{children}</SeoNavContext.Provider>
}

export function useSeoNav() {
  return useContext(SeoNavContext)
}
