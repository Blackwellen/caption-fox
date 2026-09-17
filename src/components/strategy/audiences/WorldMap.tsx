import { WORLD_PATHS } from '../world-paths'

/** Crops Antarctica (no audience markets) so the map fills the panel width like the design. */
const MAP_VIEWBOX = '0 0 360 150'

const BANDS = [
  { key: 'high', label: 'High', fill: '#3f6ff8' },
  { key: 'medium', label: 'Medium', fill: '#7ea1fb' },
  { key: 'low', label: 'Low', fill: '#b9cbfd' },
  { key: 'minimal', label: 'Minimal', fill: '#d2dcfd' },
  { key: 'none', label: 'No data', fill: '#d6dce4' },
] as const

/**
 * Choropleth of aggregated audience size by country (Natural Earth 110m
 * outlines). Bands are relative to the largest country so the map stays
 * meaningful at any workspace size; the same figures ship as a table.
 */
export default function WorldMap({
  rows, className, showLegend = true,
}: { rows: { code: string; name: string; size: number }[]; className?: string; showLegend?: boolean }) {
  const byIso = new Map(rows.map(row => [row.code, row]))
  const max = Math.max(1, ...rows.map(row => row.size))
  const band = (size: number) => (size <= 0 ? 'none' : size >= max * 0.6 ? 'high' : size >= max * 0.3 ? 'medium' : size >= max * 0.1 ? 'low' : 'minimal')
  const fill = (key: string) => BANDS.find(item => item.key === key)!.fill

  return (
    <figure className={className}>
      <svg viewBox={MAP_VIEWBOX} className="h-auto w-full" role="img" aria-label={`Audience coverage across ${rows.length} countries`}>
        {WORLD_PATHS.map((country, index) => {
          const row = byIso.get(country.iso)
          const key = row ? band(row.size) : 'none'
          return (
            <path key={`${country.iso}-${index}`} d={country.d} fill={fill(key)} stroke="#ffffff" strokeWidth={0.25}>
              <title>{row ? `${row.name}: ${new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(row.size)} people` : `${country.name}: no data`}</title>
            </path>
          )
        })}
      </svg>
      {showLegend && (
        <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[11px] text-sg-body lg:mt-[10px] lg:flex-nowrap lg:text-[8.5px]">
          {BANDS.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1.5"><i aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: item.fill }} />{item.label}</span>
          ))}
        </figcaption>
      )}
      <table className="sr-only">
        <caption>Audience size by country</caption>
        <thead><tr><th scope="col">Country</th><th scope="col">Audience</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.code}><td>{row.name}</td><td>{row.size}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
