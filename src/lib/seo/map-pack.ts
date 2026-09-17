/** Local pack rank bands shared by the map markers and their legend. */
export const MAP_PACK_BANDS = [
  { max: 1, colour: '#16A34A', label: '1' },
  { max: 3, colour: '#22C55E', label: '2–3' },
  { max: 6, colour: '#F59E0B', label: '4–6' },
  { max: 10, colour: '#F97316', label: '7–10' },
  { max: Infinity, colour: '#EF4444', label: '11+' },
] as const

export function mapPackBand(rank: number | null) {
  if (rank == null) return { colour: '#94A3B8', label: 'Unranked' }
  return MAP_PACK_BANDS.find(band => rank <= band.max) ?? MAP_PACK_BANDS[MAP_PACK_BANDS.length - 1]
}
