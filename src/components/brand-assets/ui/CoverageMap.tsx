import { WORLD_COLS, WORLD_DOTS, WORLD_ROWS } from './world-dots'

/**
 * Rights coverage map. Every dot is a 3° cell of real land (Natural Earth);
 * its colour comes from how many licences cover that country. Worldwide
 * licences count towards every country. Bands are relative to the busiest
 * country so the map stays meaningful at any catalogue size, and the same data
 * is given as a table for screen readers.
 */
const DOTS = WORLD_DOTS.split(';').map(d => {
  const [c, r, iso] = d.split(',')
  return { c: Number(c), r: Number(r), iso }
})

const FILL = { full: '#1D4ED8', partial: '#60A5FA', limited: '#BFDBFE', none: '#D9E1EC' } as const
// Rows 0–1 (arctic) and the bottom rows (Southern Ocean / Antarctica) carry no
// licensable land; cropping them gives the reference's taller, denser map.
const TOP_ROWS = 2, BOTTOM_ROWS = 10

export default function CoverageMap({ iso, worldwide }: { iso: Record<string, number>; worldwide: number }) {
  const counts = new Map<string, number>()
  for (const d of DOTS) if (d.iso) counts.set(d.iso, (iso[d.iso] ?? 0) + worldwide)
  const max = Math.max(1, ...counts.values())
  const band = (n: number) => (n === 0 ? 'none' : n >= max * 0.5 ? 'full' : n >= max * 0.2 ? 'partial' : 'limited') as keyof typeof FILL
  const hi = Math.ceil(max * 0.5), mid = Math.ceil(max * 0.2)

  const covered = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const S = 6

  return (
    <figure className="m-0">
      <svg viewBox={`0 ${TOP_ROWS * S} ${WORLD_COLS * S} ${(WORLD_ROWS - TOP_ROWS - BOTTOM_ROWS) * S}`} className="h-auto w-full" role="img"
        aria-label={`Licence coverage map: ${covered.length} countries covered${worldwide ? `, including ${worldwide} worldwide licence${worldwide === 1 ? '' : 's'}` : ''}.`}>
        {DOTS.map((d, i) => (
          <circle key={i} cx={d.c * S + S / 2} cy={d.r * S + S / 2} r={S * 0.5}
            fill={FILL[d.iso ? band(counts.get(d.iso) ?? 0) : 'none']} />
        ))}
      </svg>
      <figcaption className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[8.5px] text-slate-500">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: FILL.full }} />Fully Covered ({hi}+)</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: FILL.limited }} />Limited (1–{Math.max(1, mid - 1)})</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: FILL.partial }} />Partially Covered ({mid}–{Math.max(mid, hi - 1)})</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: FILL.none }} />Not Covered (0)</span>
      </figcaption>
      <table className="sr-only">
        <caption>Licences covering each country</caption>
        <thead><tr><th scope="col">Country</th><th scope="col">Licences</th></tr></thead>
        <tbody>{covered.map(([c, n]) => <tr key={c}><td>{c}</td><td>{n}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
