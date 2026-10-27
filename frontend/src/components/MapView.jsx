import { useMemo, useEffect, Fragment } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, Pane, useMap } from 'react-leaflet'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Shell, Fish, Droplets, Wind, Anchor } from 'lucide-react'
import HeatLayer from './HeatLayer'
import { levelColor, pointInRing } from '../lib/data'

export const ZONE_ICONS = { aquaculture: Shell, fishcages: Fish, desalination: Droplets, tourism: Wind, port: Anchor }

const BASEMAPS = {
  // Esri Ocean tiles: free, no API key (CARTO now watermarks keyless requests)
  ocean: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, GEBCO, NOAA',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
}

function zoneIcon(zone, selected) {
  const Icon = ZONE_ICONS[zone.id] ?? Anchor
  const c = levelColor(zone.score)
  const html = `
    <div class="zone-pin ${selected ? 'selected' : ''}" style="--c:${c}">
      ${zone.level === 'high' ? '<span class="ring"></span>' : ''}
      ${renderToStaticMarkup(<Icon size={17} strokeWidth={2.2} />)}
      <div class="zone-label">${zone.short}<b>${Math.round(zone.score)}</b></div>
    </div>`
  return L.divIcon({ html, className: 'zone-marker', iconSize: [38, 38], iconAnchor: [19, 19] })
}

function useCurrents(land) {
  return useMemo(() => {
    const ring = land.coordinates[0]
    const arrows = []
    const add = (lat, lon, bearing, len) => {
      if (pointInRing(lon, lat, ring)) return
      const b = (bearing * Math.PI) / 180
      const k = Math.cos((lat * Math.PI) / 180)
      const end = [lat + Math.cos(b) * len, lon + (Math.sin(b) * len) / k]
      if (pointInRing(end[1], end[0], ring)) return
      const head = (side) => {
        const hb = b + Math.PI + side * 0.5
        return [end[0] + Math.cos(hb) * len * 0.32, end[1] + (Math.sin(hb) * len * 0.32) / k]
      }
      arrows.push({ line: [[lat, lon], end], head: [head(1), end, head(-1)] })
    }
    // Offshore: Canary current / upwelling drift toward SSE
    for (let lat = 23.36; lat <= 24.2; lat += 0.075)
      for (let lon = -16.45; lon <= -15.5; lon += 0.085) {
        const inLagoon = lon > -15.94 && lat > 23.6 && lat < 23.93
        if (inLagoon) continue
        add(lat, lon, 148 + (lat - 23.8) * 25, 0.045)
      }
    // Lagoon: flood tide flowing NNE along the axis
    for (let lat = 23.6; lat <= 23.92; lat += 0.04)
      for (let lon = -15.94; lon <= -15.76; lon += 0.035) add(lat, lon, 28, 0.025)
    return arrows
  }, [land])
}

function Currents({ land }) {
  const arrows = useCurrents(land)
  const style = { color: '#0e7490', weight: 1.4, opacity: 0.5, interactive: false }
  return arrows.map((a, i) => (
    <Fragment key={i}>
      <Polyline positions={a.line} pathOptions={{ ...style, className: 'current-flow' }} />
      <Polyline positions={a.head} pathOptions={style} />
    </Fragment>
  ))
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if (target.overview) map.flyTo([23.78, -16.0], 10.25, { duration: 1.1 })
    else map.flyTo([target.lat, target.lon - 0.03], Math.max(map.getZoom(), 11), { duration: 1.1 })
  }, [target, map])
  return null
}

export default function MapView({ bundle, gridValues, zones, selectedId, onSelect, basemap, layers, flyTarget }) {
  const bm = BASEMAPS[basemap]
  return (
    <MapContainer
      center={[23.78, -16.0]}
      zoom={10.25}
      zoomSnap={0.25}
      minZoom={8}
      maxZoom={14}
      zoomControl={false}
      className="absolute inset-0"
      maxBounds={[[22.8, -17.2], [24.8, -14.8]]}
      worldCopyJump={false}
    >
      {bm && <TileLayer key={basemap} url={bm.url} attribution={bm.attribution} />}
      {/* Vector land: used as offline basemap and as a subtle coastline everywhere */}
      <GeoJSON
        key={`land-${basemap}`}
        data={bundle.land}
        interactive={false}
        style={
          basemap === 'offline'
            ? { color: '#b9ad94', weight: 1.2, fillColor: '#f3ecdc', fillOpacity: 1 }
            : { color: '#0e7490', weight: 0.8, opacity: 0.35, fill: false }
        }
      />
      {layers.heat && (
        <HeatLayer
          grid={bundle.grid}
          values={gridValues}
          land={bundle.land}
          blend={basemap !== 'satellite'}
          opacity={basemap === 'satellite' ? 0.78 : 0.92}
        />
      )}
      {layers.currents && <Currents land={bundle.land} />}
      <Pane name="labels" style={{ zIndex: 450, pointerEvents: 'none' }}>
        {bm?.labels && <TileLayer key="labels" url={bm.labels} opacity={0.75} />}
      </Pane>
      {layers.zones &&
        zones.map((z) => (
          <Marker
            key={z.id}
            position={[z.lat, z.lon]}
            icon={zoneIcon(z, z.id === selectedId)}
            eventHandlers={{ click: () => onSelect(z.id) }}
            zIndexOffset={z.id === selectedId ? 1000 : 0}
          />
        ))}
      <FlyTo target={flyTarget} />
    </MapContainer>
  )
}
