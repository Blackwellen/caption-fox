import { formatDecimal } from '@/lib/seo/format'
import type { SeoLocation } from '@/lib/seo/types'
import { EmptyPanel } from './primitives'

const BANDS = [
  { max: 3, colour: '#10B981', label: '1-3' },
  { max: 6, colour: '#84CC16', label: '4-6' },
  { max: 10, colour: '#F59E0B', label: '7-10' },
  { max: Infinity, colour: '#EF4444', label: '11+' },
]

function bandFor(rank: number | null) {
  if (rank == null) return { colour: '#94A3B8', label: 'Unranked' }
  return BANDS.find(b => rank <= b.max) ?? BANDS[BANDS.length - 1]
}

/**
 * Renders tracked locations on a lightweight equirectangular projection using
 * their real latitude/longitude — no external map provider or API key
 * required, and no screenshot. An accessible list of the same data sits
 * alongside the visual.
 */
export function LocationMap({ locations }: { locations: SeoLocation[] }) {
  const withCoords = locations.filter(loc => loc.latitude != null && loc.longitude != null)
  if (withCoords.length === 0) {
    return <EmptyPanel title="No mapped locations" description="Locations need coordinates to appear on the map." />
  }

  const lats = withCoords.map(l => l.latitude as number)
  const lngs = withCoords.map(l => l.longitude as number)
  const padding = 0.08
  const minLat = Math.min(...lats) - padding
  const maxLat = Math.max(...lats) + padding
  const minLng = Math.min(...lngs) - padding
  const maxLng = Math.max(...lngs) + padding
  const latRange = Math.max(maxLat - minLat, 0.01)
  const lngRange = Math.max(maxLng - minLng, 0.01)

  const width = 480
  const height = 320

  function project(lat: number, lng: number) {
    const x = ((lng - minLng) / lngRange) * width
    const y = height - ((lat - minLat) / latRange) * height
    return { x, y }
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Map of ${withCoords.length} tracked locations`}
        className="w-full rounded-lg border border-slate-200 bg-slate-50"
      >
        <rect x={0} y={0} width={width} height={height} fill="#F1F5F9" />
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1={0} x2={width} y1={(height / 5) * i} y2={(height / 5) * i} stroke="#E2E8F0" strokeWidth={1} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} y1={0} y2={height} x1={(width / 7) * i} x2={(width / 7) * i} stroke="#E2E8F0" strokeWidth={1} />
        ))}
        {withCoords.map(loc => {
          const { x, y } = project(loc.latitude as number, loc.longitude as number)
          const band = bandFor(loc.avg_local_rank != null ? Math.round(loc.avg_local_rank) : null)
          return (
            <g key={loc.id} transform={`translate(${x}, ${y})`}>
              <circle r={9} fill={band.colour} fillOpacity={0.18} />
              <circle r={5} fill={band.colour} stroke="white" strokeWidth={1.5} />
              <title>{`${loc.name}: ${loc.avg_local_rank != null ? `rank #${formatDecimal(loc.avg_local_rank, 1)}` : 'not ranking'}`}</title>
            </g>
          )
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {BANDS.map(band => (
          <span key={band.label} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.colour }} />{band.label}</span>
        ))}
      </div>

      <ul className="sr-only">
        {withCoords.map(loc => (
          <li key={loc.id}>{loc.name}: {loc.avg_local_rank != null ? `rank ${formatDecimal(loc.avg_local_rank, 1)}` : 'not ranking'}</li>
        ))}
      </ul>
    </div>
  )
}
