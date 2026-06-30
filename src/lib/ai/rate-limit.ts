import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Durable, serverless-safe AI rate limiting backed by the usage tables already written
// by the AI routes (`ai_generations` and `ai_usage_logs`). No external store needed.
//
// Two guards:
//   1. Burst   — too many calls in a short window (abuse / runaway loops).
//   2. Monthly — a per-user safety cap (cost control). Plan-based caps from src/lib/plans.ts
//      can be passed in once billing/entitlements are wired.
//
// Fails OPEN on infrastructure errors (e.g. table not migrated yet) so it can never take
// the product down — it only ever blocks when a real limit is exceeded.

const BURST_WINDOW_MS = 60_000
const BURST_LIMIT = 12

export interface RateLimitOptions {
  table: 'ai_generations' | 'ai_usage_logs'
  /** Per-user monthly safety cap. Pass a plan limit, or a generous default. */
  monthlyCap?: number
}

export async function enforceAiRateLimit(
  supabase: SupabaseClient,
  userId: string,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const monthlyCap = opts.monthlyCap ?? 1000

  // 1. Burst window
  try {
    const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString()
    const { count, error } = await supabase
      .from(opts.table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)
    if (!error && (count ?? 0) >= BURST_LIMIT) {
      return NextResponse.json(
        { error: 'Too many AI requests in a short time. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': '30' } },
      )
    }
  } catch { /* fail open */ }

  // 2. Monthly cap (skip if unlimited)
  if (monthlyCap !== -1) {
    try {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const { count, error } = await supabase
        .from(opts.table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart)
      if (!error && (count ?? 0) >= monthlyCap) {
        return NextResponse.json(
          { error: 'You have reached your monthly AI limit. Upgrade your plan for more.' },
          { status: 429 },
        )
      }
    } catch { /* fail open */ }
  }

  return null
}
