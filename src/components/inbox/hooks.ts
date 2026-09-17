'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withQuery } from '@/lib/inbox/filters'

/** Reads/writes Inbox filter state in the URL without adding a history entry per keystroke. */
export function useInboxUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const set = useCallback((patch: Record<string, string | string[] | null | undefined>, opts: { replace?: boolean } = {}) => {
    const href = `${pathname}${withQuery(params.toString(), patch)}`
    startTransition(() => (opts.replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })))
  }, [params, pathname, router])

  const hrefWith = useCallback((patch: Record<string, string | string[] | null | undefined>) => `${pathname}${withQuery(params.toString(), patch)}`, [params, pathname])

  return { params, set, hrefWith, pending, get: (key: string) => params.get(key) }
}

/** Debounced search box bound to the `q` URL param. */
export function useDebouncedSearch(key = 'q', delay = 300) {
  const { get, set } = useInboxUrl()
  const [value, setValue] = useState(get(key) ?? '')
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => set({ [key]: value.trim() || null }, { replace: true }), delay)
    return () => clearTimeout(t)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue] as const
}

/**
 * Live Inbox: refreshes server data when conversations or messages in THIS
 * workspace change. The subscription is filtered by workspace_id and RLS
 * applies to realtime, so other workspaces' events never arrive.
 */
export function useInboxRealtime(workspaceId: string, tables: string[] = ['inbox_threads', 'inbox_messages']) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`inbox:${workspaceId}:${tables.join(',')}`)
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` }, () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => router.refresh(), 600)
      })
    }
    channel.subscribe()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, router, tables.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Re-renders every `ms` so relative times and SLA countdowns stay current. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
