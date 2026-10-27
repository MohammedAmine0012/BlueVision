import { Thermometer, Navigation, Wind, Waves, AlertTriangle, ChevronRight, Coins, Users } from 'lucide-react'
import { LEVEL, levelColor } from '../lib/data'
import { ZONE_ICONS } from './MapView'

export const SECTORS = [
  { id: 'all', label: 'Tous' },
  { id: 'aquaculture', label: 'Aquaculture' },
  { id: 'water', label: 'Eau' },
  { id: 'tourism', label: 'Tourisme' },
  { id: 'logistics', label: 'Port' },
]

function Gauge({ value }) {
  const r = 52, c = Math.PI * r
  const color = levelColor(value)
  const lvl = value >= 65 ? 'high' : value >= 35 ? 'moderate' : 'low'
  return (
    <div className="relative w-[140px] h-[82px] mx-auto">
      <svg viewBox="0 0 140 82" className="w-full h-full">
        <defs>
          <linearGradient id="gg" x1="0" x2="1">
            <stop offset="0" stopColor="#10b981" /><stop offset=".5" stopColor="#f59e0b" /><stop offset="1" stopColor="#e11d48" />
          </linearGradient>
        </defs>
        <path d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke="rgba(15,42,61,.08)" strokeWidth="10" strokeLinecap="round" />
        <path d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .3s' }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="num text-[34px] leading-none font-semibold" style={{ color }}>{Math.round(value)}</div>
        <div className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${LEVEL[lvl].text}`}>Risque {LEVEL[lvl].label}</div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, unit }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-slate-400"><Icon size={12} /><span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <div className="mt-1"><span className="num text-[17px] font-semibold text-white">{value}</span><span className="text-[11px] text-slate-400 ml-1">{unit}</span></div>
    </div>
  )
}

export default function LeftPanel({ frame, sector, setSector, zones, selectedId, onSelect }) {
  const c = frame.conditions
  const alerts = [...zones].sort((a, b) => b.score - a.score)
  const highCount = zones.filter((z) => z.level === 'high').length
  // assets and operators in zones that are at least moderate at this horizon
  const atRisk = zones.filter((z) => z.level !== 'low')
  const exposedValue = atRisk.reduce((s, z) => s + z.asset_value_mdh, 0)
  const exposedPeople = atRisk.reduce((s, z) => s + z.stakeholders, 0)
  return (
    <div className="panel w-[300px] flex flex-col max-h-full overflow-hidden">
      <div className="p-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="label">Niveau de risque</div>
          <div className="text-[10px] text-slate-500">côte de Dakhla</div>
        </div>
        <Gauge value={frame.global_index} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
            <div className="flex items-center gap-1.5 text-slate-400"><Coins size={12} /><span className="text-[10px] uppercase tracking-wider">Valeur exposée</span></div>
            <div className="mt-0.5"><span className="num text-[17px] font-semibold" style={{ color: exposedValue ? '#d97706' : '#0f2a3d' }}>{exposedValue.toLocaleString('fr-FR')}</span><span className="text-[11px] text-slate-400 ml-1">MDH</span></div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
            <div className="flex items-center gap-1.5 text-slate-400"><Users size={12} /><span className="text-[10px] uppercase tracking-wider">À alerter</span></div>
            <div className="mt-0.5"><span className="num text-[17px] font-semibold text-white">{exposedPeople}</span><span className="text-[11px] text-slate-400 ml-1">acteurs</span></div>
          </div>
        </div>
      </div>

      <div className="p-4 pb-3 grid grid-cols-2 gap-2 border-b border-white/5">
        <Kpi icon={Waves} label="Zone d’algues" value={Math.round(c.bloom_area_km2)} unit="km²" />
        <Kpi icon={Thermometer} label="Eau" value={Math.round(c.sst_c)} unit="°C" />
        <Kpi icon={Navigation} label="Courant" value="Vers" unit="le sud-est" />
        <Kpi icon={Wind} label="Vent" value={Math.round(c.wind_speed_kt * 1.852)} unit="km/h" />
      </div>

      <div className="px-4 pt-3">
        <div className="flex gap-1 flex-wrap">
          {SECTORS.map((s) => (
            <button key={s.id} onClick={() => setSector(s.id)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${sector === s.id
                ? 'bg-lagoon-400/15 border-lagoon-400/40 text-lagoon-300'
                : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="label">Alertes ciblées</div>
        {highCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} /> {highCount} critique{highCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto thin-scroll px-2 pb-3">
        {alerts.map((z) => {
          const Icon = ZONE_ICONS[z.id]
          const col = levelColor(z.score)
          return (
            <button key={z.id} onClick={() => onSelect(z.id)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition
                ${selectedId === z.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
              <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${col}22`, color: col }}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-slate-100 truncate">{z.name}</div>
                <div className="text-[10.5px] text-slate-400">{z.sector_label}</div>
              </div>
              <div className="text-right">
                <div className="num text-[13px] font-semibold" style={{ color: col }}>{Math.round(z.score)}</div>
                <div className="text-[9.5px] text-slate-500">{LEVEL[z.level].label}</div>
              </div>
              <ChevronRight size={14} className="text-slate-600" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
