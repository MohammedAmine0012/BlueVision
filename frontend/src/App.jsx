import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Map as MapIcon, BrainCircuit, Satellite, Layers3, Navigation2, Flame, MapPin, Maximize, Waves, AlertTriangle, ShieldCheck, Clapperboard, Square } from 'lucide-react'
import MapView from './components/MapView'
import Timeline from './components/Timeline'
import LeftPanel from './components/LeftPanel'
import ZonePanel from './components/ZonePanel'
import AIView from './components/AIView'
import { BUNDLE, probeApi, interpFrame, interpGrid, sendAlert, issueDate } from './lib/data'

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-lagoon-400 to-lagoon-600 grid place-items-center shadow-[0_0_20px_rgba(63,211,232,.4)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M2 15c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6-1" />
          <circle cx="12" cy="8" r="3" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-white tracking-tight">BlueVision <span className="text-lagoon-300">Dakhla</span></div>
        <div className="text-[10.5px] text-slate-400">Météo des risques marins</div>
      </div>
    </div>
  )
}

function Seg({ value, onChange, options }) {
  return (
    <div className="flex bg-white/[0.04] border border-white/[0.07] rounded-xl p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} title={o.title}
          className={`flex items-center gap-1.5 text-[12px] font-medium px-3 h-8 rounded-[10px] transition
            ${value === o.id ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:text-slate-200'}`}>
          {o.icon && <o.icon size={14} />}{o.label}
        </button>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div className="panel !rounded-xl px-3 py-2.5 w-[220px]">
      <div className="label mb-1.5">Risque d’algues toxiques</div>
      <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#34d39955,#facc15,#fb923c,#f43f5e,#c026d3)' }} />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>Faible</span><span>Modéré</span><span>Élevé</span></div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
        <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#0e7490" strokeDasharray="4 4" /></svg> Courants marins
      </div>
    </div>
  )
}

export default function App() {
  const [source, setSource] = useState('offline')
  const [tour, setTour] = useState(false)
  const [tab, setTab] = useState('map')
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedId, setSelectedId] = useState('aquaculture')
  const [sector, setSector] = useState('all')
  const [basemap, setBasemap] = useState('ocean')
  const [layers, setLayers] = useState({ heat: true, currents: true, zones: true })
  const [flyTarget, setFlyTarget] = useState(null)
  const [toasts, setToasts] = useState([])
  const prevLevels = useRef({})

  useEffect(() => { probeApi().then(setSource) }, [])

  // guided demo: reset, then play slower; zones are focused as they turn red (see below)
  const startTour = useCallback(() => {
    setTab('map'); setSector('all'); setLayers({ heat: true, currents: true, zones: true })
    setSelectedId(null); prevLevels.current = {}
    setFlyTarget({ overview: true, t: Date.now() })
    setHour(0); setTour(true)
    setTimeout(() => setPlaying(true), 1200)
  }, [])
  const stopTour = useCallback(() => { setTour(false); setPlaying(false) }, [])

  const pushToast = useCallback((t) => {
    const id = Math.random()
    setToasts((ts) => [...ts.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200)
  }, [])

  // playback: 72 h in ~14 s
  useEffect(() => {
    if (!playing) return
    let raf, last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      setHour((h) => {
        const n = h + dt * (tour ? 3.4 : 5.2)
        if (n >= 72) { setPlaying(false); return 72 }
        return n
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, tour])

  // end of guided demo: pull back to the overview
  useEffect(() => {
    if (!tour || playing || hour < 72) return
    setTour(false)
    setFlyTarget({ overview: true, t: Date.now() })
  }, [tour, playing, hour])

  // keyboard shortcuts for a smooth recording
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return
      if (e.code === 'Space') { e.preventDefault(); setHour((h) => (h >= 72 ? 0 : h)); setPlaying((p) => !p) }
      else if (e.key.toLowerCase() === 'd') startTour()
      else if (e.key === 'Escape') stopTour()
      else if (e.key === 'ArrowRight') setHour((h) => Math.min(72, Math.round(h) + 3))
      else if (e.key === 'ArrowLeft') setHour((h) => Math.max(0, Math.round(h) - 3))
      else if (['1', '2', '3', '4'].includes(e.key)) { setPlaying(false); setHour((+e.key - 1) * 24) }
      else if (e.key.toLowerCase() === 'm') setTab('map')
      else if (e.key.toLowerCase() === 'i') setTab('ai')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startTour, stopTour])

  const bundle = BUNDLE
  const frame = useMemo(() => interpFrame(bundle, hour), [bundle, hour])
  const gridValues = useMemo(() => interpGrid(bundle, hour), [bundle, hour])

  // toast when a zone crosses into "high" while playing
  useEffect(() => {
    for (const z of frame.zones) {
      const prev = prevLevels.current[z.id]
      if (playing && prev && prev !== 'high' && z.level === 'high') {
        pushToast({ kind: 'danger', title: `${z.short} passe en risque élevé`, text: `Seuil critique franchi à +${Math.round(hour)} h · ${z.sector_label}` })
        if (tour) { setSelectedId(z.id); setFlyTarget({ ...z, t: Date.now() }) }
      }
      prevLevels.current[z.id] = z.level
    }
  }, [frame, playing, hour, pushToast, tour])

  const zonesShown = frame.zones.filter((z) => sector === 'all' || z.sector === sector)
  const selected = frame.zones.find((z) => z.id === selectedId)
  const issued = issueDate()

  const selectZone = (id, fly = false) => {
    setSelectedId(id)
    if (fly) setFlyTarget({ ...frame.zones.find((z) => z.id === id), t: Date.now() })
  }

  const onAlert = async (z) => {
    await sendAlert(z.id, hour, source)
    pushToast({ kind: 'ok', title: `Alerte diffusée · ${z.short}`, text: `${z.stakeholders} acteur${z.stakeholders > 1 ? 's' : ''} notifié${z.stakeholders > 1 ? 's' : ''} par SMS, WhatsApp et e-mail` })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* MAP */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${tab === 'map' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <MapView bundle={bundle} gridValues={gridValues} zones={zonesShown} selectedId={selectedId}
          onSelect={(id) => selectZone(id)} basemap={basemap} layers={layers} flyTarget={flyTarget} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(234,243,248,.55))]" />
      </div>

      {tab === 'ai' && <div className="absolute inset-0 bg-abyss-950"><AIView /></div>}

      {/* TOP BAR */}
      <header className="absolute top-0 inset-x-0 z-[1000] px-4 pt-4">
        <div className="panel !rounded-2xl h-[56px] px-4 flex items-center gap-4">
          <Logo />
          <div className="h-6 w-px bg-white/10" />
          <Seg value={tab} onChange={setTab} options={[
            { id: 'map', label: 'Carte des risques', icon: MapIcon },
            { id: 'ai', label: 'Vision IA', icon: BrainCircuit },
          ]} />
          <button onClick={tour ? stopTour : startTour} title="Démo guidée (D) · Échap pour arrêter"
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition
              ${tour ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40' : 'bg-lagoon-400 text-paper hover:bg-lagoon-500 shadow-[0_4px_14px_rgba(8,145,178,.35)]'}`}>
            {tour ? <><Square size={12} fill="currentColor" /> Arrêter</> : <><Clapperboard size={14} /> Démo guidée</>}
          </button>
          <div className="flex-1" />
          {tab === 'map' && (
            <>
              <div className="flex items-center gap-1">
                {[
                  ['heat', Flame, 'Algues'],
                  ['currents', Navigation2, 'Courants'],
                  ['zones', MapPin, 'Zones'],
                ].map(([k, Icon, label]) => (
                  <button key={k} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} title={label}
                    className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] border transition
                      ${layers[k] ? 'border-lagoon-400/40 bg-lagoon-400/10 text-lagoon-300' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}>
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>
              <Seg value={basemap} onChange={setBasemap} options={[
                { id: 'ocean', icon: Waves, title: 'Carte océan' },
                { id: 'satellite', icon: Satellite, title: 'Imagerie satellite' },
                { id: 'offline', icon: Layers3, title: 'Carte simple' },
              ]} />
              <button onClick={() => setFlyTarget({ overview: true, t: Date.now() })} title="Vue d'ensemble"
                className="h-8 w-8 grid place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white"><Maximize size={14} /></button>
            </>
          )}
          <div className="h-6 w-px bg-white/10" />
          <div className="text-right leading-tight">
            <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Surveillance active
            </div>
            <div className="text-[10px] text-slate-500">Mis à jour le {issued.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à 06:00</div>
          </div>
        </div>
      </header>

      {tab === 'map' && (
        <>
          <aside className="absolute z-[900] left-4 top-[88px] bottom-[124px] flex">
            <LeftPanel frame={frame} sector={sector} setSector={setSector} zones={zonesShown} selectedId={selectedId}
              onSelect={(id) => selectZone(id, true)} />
          </aside>
          {selected && (
            <aside className="absolute z-[900] right-4 top-[88px] bottom-[124px] flex flex-col items-end">
              <ZonePanel zone={selected} hour={hour} onClose={() => setSelectedId(null)} onAlert={onAlert} />
            </aside>
          )}
          <div className="absolute z-[900] left-[332px] bottom-[124px]">
            <Legend />
          </div>
          <footer className="absolute z-[900] bottom-4 left-4 right-4">
            <Timeline hour={hour} setHour={setHour} playing={playing} setPlaying={setPlaying}
              frames={bundle.frames} confidence={frame.confidence} />
          </footer>
        </>
      )}

      {/* TOASTS */}
      <div className="absolute z-[1100] top-[88px] left-1/2 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-enter panel !rounded-xl px-4 py-2.5 flex items-center gap-3 border
            ${t.kind === 'danger' ? '!border-rose-500/40 !bg-rose-950/80' : '!border-emerald-400/30 !bg-emerald-950/70'}`}>
            {t.kind === 'danger' ? <AlertTriangle size={18} className="text-rose-300" /> : <ShieldCheck size={18} className="text-emerald-300" />}
            <div>
              <div className="text-[13px] font-semibold text-white">{t.title}</div>
              <div className="text-[11px] text-slate-300">{t.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
