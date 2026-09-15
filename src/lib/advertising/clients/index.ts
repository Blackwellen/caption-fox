import 'server-only'
import type { AdProvider } from '../providers'
import type { Adapter } from './types'

import { metaAdapter } from './meta'
import { googleAdapter } from './google'
import { microsoftAdapter } from './microsoft'
import { tiktokAdapter } from './tiktok'
import { linkedinAdapter } from './linkedin'
import { pinterestAdapter } from './pinterest'
import { redditAdapter } from './reddit'
import { snapchatAdapter } from './snapchat'
import { xAdapter } from './x'
import { yahooAdapter } from './yahoo'
import { amazonAdapter } from './amazon'

// Adapter registry. The sync engine resolves a provider to its adapter here and
// never imports a platform module directly.

export const ADAPTERS: Record<AdProvider, Adapter> = {
  meta: metaAdapter,
  google: googleAdapter,
  microsoft: microsoftAdapter,
  tiktok: tiktokAdapter,
  linkedin: linkedinAdapter,
  pinterest: pinterestAdapter,
  reddit: redditAdapter,
  snapchat: snapchatAdapter,
  x: xAdapter,
  yahoo: yahooAdapter,
  amazon: amazonAdapter,
}

export function getAdapter(provider: AdProvider): Adapter {
  return ADAPTERS[provider]
}

export * from './types'
