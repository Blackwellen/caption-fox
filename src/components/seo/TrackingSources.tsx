import Link from 'next/link'
import { Plus } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { brandLabel } from '@/lib/brand/brands'
import { formatNumber, humanise, relativeTime } from '@/lib/seo/format'
import type { SeoSourceConnection } from '@/lib/seo/types'
import { Card, CardHeader, EmptyPanel, StatusChip } from './primitives'

const STATUS_LABEL: Record<string, string> = {
  connected: 'Healthy',
  needs_reauth: 'Reconnect',
  error: 'Error',
  disconnected: 'Disconnected',
  pending: 'Pending',
}

const STATUS_TONE: Record<string, string> = {
  connected: 'healthy',
  needs_reauth: 'needs_attention',
  error: 'error',
  disconnected: 'not_connected',
  pending: 'partial',
}

/**
 * Truthful source-health panel. Each row states the provider, the mapped
 * property, when it last synced and how many keywords it actually covers —
 * nothing is shown as "synced" unless the connection row says so.
 */
export function TrackingSources({
  sources, connectHref = '/app/settings/integrations', canConnect = false, title = 'Tracking Sources',
}: {
  sources: SeoSourceConnection[]
  connectHref?: string
  canConnect?: boolean
  title?: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title={title}
        help="Where ranking data comes from. Coverage is the number of tracked keywords the provider actually returns."
        action={<Link href={connectHref} className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</Link>}
      />
      {sources.length === 0
        ? (
          <EmptyPanel
            title="No ranking source connected"
            description="Connect Google Search Console or a rank-tracking provider to start collecting positions."
            action={canConnect
              ? <Link href={connectHref} className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700">Connect a source</Link>
              : undefined}
          />
        )
        : (
          <>
            <ul className="divide-y divide-slate-100">
              {sources.map(source => (
                <li key={source.id} className="flex items-center gap-2 px-3 py-2">
                  <BrandLogo brand={source.provider} size={16} tile tileSize={30} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-slate-800">{brandLabel(source.provider)}</span>
                      {source.is_primary && (
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Primary</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {source.last_synced_at
                        ? `Last synced: ${relativeTime(source.last_synced_at)}`
                        : source.last_error
                          ? 'Never synced — needs attention'
                          : 'Never synced'}
                      {source.property_label && ` · ${source.property_label}`}
                    </p>
                  </div>
                  <StatusChip
                    status={STATUS_TONE[source.status] ?? 'unknown'}
                    label={STATUS_LABEL[source.status] ?? humanise(source.status)}
                  />
                  <span className="w-[86px] shrink-0 text-right text-[11.5px] text-slate-600">
                    {formatNumber(source.coverage_keywords)} keywords
                  </span>
                </li>
              ))}
            </ul>
            {canConnect && (
              <div className="border-t border-slate-100 p-2">
                <Link
                  href={connectHref}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-50 text-[12px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Plus size={13} aria-hidden />
                  Add Source
                </Link>
              </div>
            )}
          </>
        )}
    </Card>
  )
}
