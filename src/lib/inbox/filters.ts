// URL <-> filter state for every Inbox page. Pure so it is unit-tested and
// shared by server pages (parse) and client controls (serialise).

import type { ConversationFilters, ConversationLane, ConversationSort, SlaStatus } from './types'

export const CHANNELS = ['email', 'sms', 'whatsapp', 'rcs', 'instagram', 'facebook', 'live_chat', 'x', 'tiktok', 'youtube', 'linkedin'] as const
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export const SLA_STATES: SlaStatus[] = ['breached', 'at_risk', 'on_track', 'paused', 'completed']
const LANES: ConversationLane[] = ['open', 'snoozed', 'closed']
const SORTS: ConversationSort[] = ['newest', 'oldest', 'priority', 'sla']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Query = Record<string, string | string[] | undefined>

const one = (q: Query, key: string) => {
  const v = q[key]
  return Array.isArray(v) ? v[0] : v
}
const list = (q: Query, key: string, allowed?: readonly string[]) => {
  const raw = one(q, key)
  if (!raw) return undefined
  const values = raw.split(',').map(v => v.trim()).filter(Boolean).slice(0, 20)
  const kept = allowed ? values.filter(v => allowed.includes(v)) : values.map(v => v.slice(0, 60))
  return kept.length ? kept : undefined
}

export interface InboxUrlState {
  filters: ConversationFilters
  sort: ConversationSort
  page: number
  pageSize: number
  conversationId: string | null
}

export function parseInboxQuery(q: Query, defaults: Partial<InboxUrlState> = {}): InboxUrlState {
  const lane = one(q, 'lane') as ConversationLane | undefined
  const sort = one(q, 'sort') as ConversationSort | undefined
  const assignee = one(q, 'assignee')
  const search = one(q, 'q')?.trim().slice(0, 120)
  const page = Number.parseInt(one(q, 'page') ?? '', 10)
  const pageSize = Number.parseInt(one(q, 'per') ?? '', 10)
  const conversation = one(q, 'c')
  const filters: ConversationFilters = {
    ...defaults.filters,
    lane: lane && LANES.includes(lane) ? lane : defaults.filters?.lane,
    platform: list(q, 'channel', CHANNELS),
    priority: list(q, 'priority', PRIORITIES),
    sla: list(q, 'sla', SLA_STATES) as SlaStatus[] | undefined,
    status: list(q, 'status', ['awaiting', 'waiting', 'open', 'escalated']) as ConversationFilters['status'],
    tags: list(q, 'tag'),
    sentiment: list(q, 'sentiment', ['positive', 'neutral', 'negative']),
    language: list(q, 'lang'),
    team: one(q, 'team') && UUID.test(one(q, 'team')!) ? one(q, 'team') : undefined,
    assignees: list(q, 'assignees')?.filter(v => UUID.test(v)),
    age: (['lt1h', '1to4h', 'gt4h', 'gt24h'] as const).find(a => a === one(q, 'age')),
    queue: one(q, 'queue') && UUID.test(one(q, 'queue')!) ? one(q, 'queue') : undefined,
    search: search || undefined,
  }
  if (assignee && (['me', 'unassigned', 'assigned'].includes(assignee) || UUID.test(assignee))) filters.assignee = assignee
  else if (defaults.filters?.assignee) filters.assignee = defaults.filters.assignee
  return {
    filters: stripEmpty(filters),
    sort: sort && SORTS.includes(sort) ? sort : defaults.sort ?? 'newest',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
    pageSize: [8, 10, 20, 25, 50].includes(pageSize) ? pageSize : defaults.pageSize ?? 25,
    conversationId: conversation && UUID.test(conversation) ? conversation : null,
  }
}

export function stripEmpty<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))) as T
}

/** Serialises changes onto an existing query string (client helper). */
export function withQuery(current: string, patch: Record<string, string | string[] | null | undefined>): string {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) params.delete(key)
    else params.set(key, Array.isArray(value) ? value.join(',') : value)
  }
  if (!('page' in patch)) params.delete('page')
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Escapes PostgREST `or()`/ilike metacharacters in a user search term. */
export function safeSearchTerm(term: string): string {
  return term.replace(/[%_,()\\*:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

export function countActiveFilters(filters: ConversationFilters, ignore: (keyof ConversationFilters)[] = []): number {
  const keys: (keyof ConversationFilters)[] = ['platform', 'priority', 'sla', 'status', 'tags', 'sentiment', 'language', 'team', 'assignees', 'age', 'search', 'segment', 'waiting', 'escalated']
  return keys.filter(k => !ignore.includes(k) && filters[k] !== undefined && !(Array.isArray(filters[k]) && (filters[k] as unknown[]).length === 0)).length
}
