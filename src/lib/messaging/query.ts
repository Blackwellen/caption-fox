// Canonical URL query-state for the Messaging surfaces.
//
// Every filter, search term and view mode lives in the URL so a refresh, a
// browser back/forward, and a shared link all restore the same screen.
// Invalid values fall back safely rather than throwing.

import { MESSAGE_STATUSES, MESSAGING_CHANNELS } from './constants'

export interface MessagingQuery {
  q: string
  channel: string
  status: string
  owner: string
  journeyStatus: string
  campaign: string
  tag: string
  from: string
  to: string
  archived: boolean
}

/** Next.js passes `searchParams` values as string | string[] | undefined. */
export type RawParams = Record<string, string | string[] | undefined>

function one(params: RawParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

export function parseMessagingQuery(params: RawParams): MessagingQuery {
  const from = one(params, 'from')
  const to = one(params, 'to')

  return {
    q: one(params, 'q').slice(0, 120),
    channel: oneOf(one(params, 'channel'), ['', ...MESSAGING_CHANNELS], ''),
    status: oneOf(one(params, 'status'), ['', ...MESSAGE_STATUSES], ''),
    owner: one(params, 'owner').slice(0, 64),
    journeyStatus: one(params, 'journeyStatus').slice(0, 32),
    campaign: one(params, 'campaign').slice(0, 64),
    tag: one(params, 'tag').slice(0, 40),
    from: isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    archived: one(params, 'archived') === '1',
  }
}
