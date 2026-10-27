import { Play, Pause, RotateCcw } from 'lucide-react'
import { horizonLabel, levelColor } from '../lib/data'

const MARKS = [
  { h: 0, label: "Aujourd'hui" },
  { h: 24, label: '+24 h' },
  { h: 48, label: '+48 h' },
  { h: 72, label: '+72 h' },
]

// Global risk curve drawn behind the slider track
function RiskCurve({ frames }) {
  const W = 1000, H = 44
  const pts = frames.map((f, i) => [(i / (frames.length - 1)) * W, H - (f.global_index / 100) * (H - 4) - 2])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const stops = frames.map((f, i) => (
    <stop key={i} offset={`${(i / (frames.length - 1)) * 100}%`} stopColor={levelColor(f.global_index)} />
  ))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
      <defs>
        <linearGradient id="riskStroke" x1="0" x2="1">{stops}</linearGradient>
        <linearGradient id="riskFill" x1="0" x2="1">
          {frames.map((f, i) => (
            <stop key={i} offset={`${(i / (frames.length - 1)) * 100}%`} stopColor={levelColor(f.global_index)} stopOpacity="0.18" />
          ))}
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#riskFill)" />
      <path d={d} fill="none" stroke="url(#riskStroke)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {[35, 65].map((t) => (
        <line key={t} x1="0" x2={W} y1={H - (t / 100) * (H - 4) - 2} y2={H - (t / 100) * (H - 4) - 2}
          stroke="#0f2a3d" strokeOpacity="0.12" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export default function Timeline({ hour, setHour, playing, setPlaying, frames, confidence }) {
  const { day, time } = horizonLabel(hour)
  return (
    <div className="panel px-5 py-4 flex items-center gap-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (hour >= 72) setHour(0)
            setPlaying(!playing)
          }}
          className="h-11 w-11 rounded-full bg-lagoon-400 text-paper grid place-items-center hover:bg-lagoon-500 transition shadow-[0_4px_18px_rgba(8,145,178,.45)]"
          title="Lecture (Espace)"
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <button onClick={() => { setPlaying(false); setHour(0) }} className="h-9 w-9 rounded-full grid place-items-center text-slate-400 hover:text-white hover:bg-white/5" title="Réinitialiser">
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="w-36 shrink-0">
        <div className="label">Prévision</div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="num text-2xl font-semibold text-white">+{Math.round(hour)}</span>
          <span className="text-sm text-slate-400">h</span>
        </div>
        <div className="text-[11px] text-slate-400 capitalize">{day} · {time}</div>
      </div>

      <div className="flex-1 relative">
        <div className="relative h-11 rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
          <RiskCurve frames={frames} />
          <div className="absolute inset-y-0 left-0 bg-lagoon-400/10 border-r border-lagoon-300/40 pointer-events-none"
            style={{ width: `${(hour / 72) * 100}%` }} />
          <input
            type="range" min={0} max={72} step={0.5} value={hour}
            onChange={(e) => { setPlaying(false); setHour(+e.target.value) }}
            className="timeline absolute inset-0"
          />
        </div>
        <div className="relative h-5 mt-1.5">
          {MARKS.map((m) => (
            <button key={m.h} onClick={() => { setPlaying(false); setHour(m.h) }}
              className={`absolute -translate-x-1/2 text-[11px] font-medium px-2 py-0.5 rounded-md transition
                ${Math.abs(hour - m.h) < 1.5 ? 'text-lagoon-300 bg-lagoon-400/10' : 'text-slate-400 hover:text-white'}`}
              style={{ left: `${(m.h / 72) * 100}%`, ...(m.h === 0 && { transform: 'none', left: 0 }), ...(m.h === 72 && { transform: 'none', left: 'auto', right: 0 }) }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-32 shrink-0 text-right">
        <div className="label">Fiabilité</div>
        <div className="num text-2xl font-semibold text-white mt-0.5">{Math.round(confidence)}<span className="text-sm text-slate-400">%</span></div>
        <div className="h-1 rounded-full bg-white/5 mt-1.5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-lagoon-500 to-lagoon-300" style={{ width: `${confidence}%` }} />
        </div>
      </div>
    </div>
  )
}
