import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import { RAMP } from '../lib/data'

// Leaflet overlay backed by a <canvas> we repaint in place (no flicker while scrubbing).
const CanvasOverlay = L.ImageOverlay.extend({
  _initImage() {
    const el = (this._image = this._url)
    L.DomUtil.addClass(el, 'leaflet-image-layer')
    if (this._zoomAnimated) L.DomUtil.addClass(el, 'leaflet-zoom-animated')
    if (this.options.className) L.DomUtil.addClass(el, this.options.className)
    el.onselectstart = L.Util.falseFn
    el.onmousemove = L.Util.falseFn
    this._updateOpacity()
  },
})

const SCALE = 6 // upsampling factor of the forecast grid
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const invMerc = (y) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90

export default function HeatLayer({ grid, values, land, blend = true, opacity = 0.9 }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const layerRef = useRef(null)
  const geoRef = useRef(null)

  // create once
  useEffect(() => {
    const { bounds, rows, cols } = grid
    const W = cols * SCALE
    const H = rows * SCALE
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvasRef.current = canvas

    // pre-compute, for every canvas row, the fractional grid row (mercator-correct)
    const y0 = mercY(bounds.lat_max), y1 = mercY(bounds.lat_min)
    const rowLookup = new Float32Array(H)
    for (let py = 0; py < H; py++) {
      const lat = invMerc(y0 + ((py + 0.5) / H) * (y1 - y0))
      rowLookup[py] = ((bounds.lat_max - lat) / (bounds.lat_max - bounds.lat_min)) * (rows - 1)
    }
    // land polygon in canvas pixel space
    const ring = land.coordinates[0].map(([lon, lat]) => [
      ((lon - bounds.lon_min) / (bounds.lon_max - bounds.lon_min)) * W,
      ((mercY(lat) - y0) / (y1 - y0)) * H,
    ])
    geoRef.current = { W, H, rowLookup, ring }

    const layer = new CanvasOverlay(
      canvas,
      [[bounds.lat_min, bounds.lon_min], [bounds.lat_max, bounds.lon_max]],
      { opacity, interactive: false, className: 'heat-canvas', pane: 'overlayPane' },
    )
    layer.addTo(map)
    layerRef.current = layer
    return () => layer.remove()
  }, [map, grid, land]) // eslint-disable-line

  useEffect(() => {
    layerRef.current?.setOpacity(opacity)
    const el = canvasRef.current
    if (el) el.classList.toggle('normal', !blend)
  }, [opacity, blend])

  // repaint on every value change
  useEffect(() => {
    const canvas = canvasRef.current
    const g = geoRef.current
    if (!canvas || !g || !values) return
    const { rows, cols } = grid
    const { W, H, rowLookup, ring } = g
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(W, H)
    const d = img.data
    for (let py = 0; py < H; py++) {
      const fy = rowLookup[py]
      const r0 = Math.min(Math.floor(fy), rows - 2)
      const ty = fy - r0
      const o0 = r0 * cols, o1 = o0 + cols
      for (let px = 0; px < W; px++) {
        const fx = ((px + 0.5) / W) * (cols - 1)
        const c0 = Math.min(Math.floor(fx), cols - 2)
        const tx = fx - c0
        const v =
          values[o0 + c0] * (1 - tx) * (1 - ty) + values[o0 + c0 + 1] * tx * (1 - ty) +
          values[o1 + c0] * (1 - tx) * ty + values[o1 + c0 + 1] * tx * ty
        const k = Math.max(0, Math.min(100, v | 0)) * 4
        const p = (py * W + px) * 4
        d[p] = RAMP[k]; d[p + 1] = RAMP[k + 1]; d[p + 2] = RAMP[k + 2]; d[p + 3] = RAMP[k + 3]
      }
    }
    ctx.putImageData(img, 0, 0)
    // crisp coastline: erase anything drawn on land
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }, [values, grid])

  return null
}
