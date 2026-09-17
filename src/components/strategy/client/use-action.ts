'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/strategy/action-types'
import { useToast } from './toast'

/**
 * Runs a Strategy server action with one in-flight guard (double clicks and
 * repeated Enter presses never submit twice), a toast for the outcome and a
 * router refresh so every panel re-reads the server state.
 */
export function useStrategyAction() {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, setPending] = useState(false)
  const [, startTransition] = useTransition()
  const inFlight = useRef(false)

  const run = useCallback(async (
    action: () => Promise<ActionResult>,
    opts: { success?: string; quiet?: boolean; refresh?: boolean; onSuccess?: (result: ActionResult) => void } = {},
  ): Promise<ActionResult> => {
    if (inFlight.current) return { ok: false, error: 'Already working on it…' }
    inFlight.current = true
    setPending(true)
    try {
      const result = await action()
      if (result.ok) {
        if (!opts.quiet) notify('success', result.message ?? opts.success ?? 'Saved.')
        opts.onSuccess?.(result)
        if (opts.refresh !== false) startTransition(() => router.refresh())
      } else {
        notify('error', result.error ?? 'Something went wrong. Please try again.')
      }
      return result
    } catch {
      const error = 'We could not reach the server. Check your connection and try again.'
      notify('error', error)
      return { ok: false, error }
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }, [notify, router])

  return { run, pending }
}
