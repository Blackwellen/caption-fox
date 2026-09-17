'use client'

import { useMemo, useState } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { formatDecimal } from '@/lib/seo/format'
import { mapPackBand } from '@/lib/seo/map-pack'

export interface MapPackPoint {
  id: string
  name: string
  latitude: number
  longitude: number
  rank: number | null
}

const TILE = 256
// Light basemap without an API key. Deployments can point this at their own
// licensed tile provider; attribution below must match whichever is used.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL
  ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
  ?? '© OpenStreetMap contributors'

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

function fitZoom(points: MapPackPoint[], width: number, height: number) {
  for (let zoom = 15; zoom >= 2; zoom -= 1) {
    const projected = points.map(p => project(p.latitude, p.longitude, zoom))
    const xs = projected.map(p => p.x)
    const ys = projected.map(p => p.y)
    if (Math.max(...xs) - Math.min(...xs) < width * 0.8 && Math.max(...ys) - Math.min(...ys) < height * 0.75) return zoom
  }
  return 2
}

/**
 * Map pack visibility map. Real slippy-map tiles positioned in Web Mercator,
 * one numbered marker per tracked location coloured by its local-rank band.
 * Zoom and recentre are real controls; every marker is also exposed as a
 * list for assistive technology.
 */
export function MapPackMap({ points, height = 196 }: { points: MapPackPoint[]; height?: number }) {
  const width = 506
  const baseZoom = useMemo(() => (points.length ? fitZoom(points, width, height) : 5), [points, height])
  const [zoomOffset, setZoomOffset] = useState(0)
  const zoom = Math.min(18, Math.max(2, baseZoom + zoomOffset))

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-50 text-[12px] text-slate-500" style={{ height }}>
        Locations need coordinates to appear on the map.
      </div>
    )
  }

  const projected = points.map(p => ({ ...p, ...project(p.latitude, p.longitude, zoom) }))
  const centreX = (Math.min(...projected.map(p => p.x)) + Math.max(...projected.map(p => p.x))) / 2
  const centreY = (Math.min(...projected.map(p => p.y)) + Math.max(...projected.map(p => p.y))) / 2
  const originX = centreX - width / 2
  const originY = centreY - height / 2

  const tiles: { key: string; src: string; left: number; top: number }[] = []
  const maxIndex = 2 ** zoom
  for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + width) / TILE); tx += 1) {
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + height) / TILE); ty += 1) {
      if (ty < 0 || ty >= maxIndex) continue
      const wrapped = ((tx % maxIndex) + maxIndex) % maxIndex
      tiles.push({
        key: `${zoom}-${tx}-${ty}`,
        src: TILE_URL.replace('{z}', String(zoom)).replace('{x}', String(wrapped)).replace('{y}', String(ty)),
        left: tx * TILE - originX,
        top: ty * TILE - originY,
      })
    }
  }

  return (
    <div className="relative w-full overflow-hidden bg-[#EEF2F5]" style={{ height }}>
      <div className="absolute left-1/2 top-0 h-full" style={{ width, marginLeft: -width / 2 }} role="img" aria-label={`Map of ${points.length} tracked locations`}>
        {tiles.map(tile => (
          // eslint-disable-next-line @next/next/no-img-element -- raster map tiles, positioned manually
          <img key={tile.key} src={tile.src} alt="" width={TILE} height={TILE} draggable={false} className="pointer-events-none absolute max-w-none select-none opacity-90 saturate-[.35]" style={{ left: tile.left, top: tile.top }} />
        ))}
        {projected.map(point => {
          const band = mapPackBand(point.rank)
          return (
            <span
              key={point.id}
              title={`${point.name}: ${point.rank != null ? `rank #${formatDecimal(point.rank, 1)}` : 'not ranking'}`}
              className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-md ring-2 ring-white"
              style={{ left: point.x - originX, top: point.y - originY, backgroundColor: band.colour }}
            >
              {point.rank != null ? Math.round(point.rank) : '–'}
            </span>
          )
        })}
      </div>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setZoomOffset(z => z + 1)} disabled={zoom >= 18} aria-label="Zoom in" className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Plus size={13} aria-hidden /></button>
        <button type="button" onClick={() => setZoomOffset(z => z - 1)} disabled={zoom <= 2} aria-label="Zoom out" className="flex h-7 w-7 items-center justify-center border-t border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Minus size={13} aria-hidden /></button>
        <button type="button" onClick={() => setZoomOffset(0)} aria-label="Recentre map" className="flex h-7 w-7 items-center justify-center border-t border-slate-200 text-slate-600 hover:bg-slate-50"><LocateFixed size={13} aria-hidden /></button>
      </div>

      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-slate-500">{TILE_ATTRIBUTION}</span>

      <ul className="sr-only">
        {points.map(point => (
          <li key={point.id}>{point.name}: {point.rank != null ? `local rank ${formatDecimal(point.rank, 1)}` : 'not ranking'}</li>
        ))}
      </ul>
    </div>
  )
}
