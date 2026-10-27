import { useState, useEffect } from 'react'
import { X, Clock, BellRing, Check, Loader2, ShieldCheck, Users, Coins, MessageSquare } from 'lucide-react'
import { LEVEL, levelColor, horizonLabel, alertMessage } from '../lib/data'
import { ZONE_ICONS } from './MapView'

function Trend({ trend, hour }) {
  const W = 260, H = 70
  const n = trend.length
  const x = (i) => (i / (n - 1)) * W
  const y = (v) => H - 6 - (v / 100) * (H - 12)
  const d = trend.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const cx = (hour / 72) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[70px]">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e11d48" /><stop offset=".45" stopColor="#f59e0b" /><stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="0" y={y(100)} width={W} height={y(65) - y(100)} fill="#f43f5e" opacity=".06" />
      <rect x="0" y={y(65)} width={W} height={y(35) - y(65)} fill="#fbbf24" opacity=".05" />
      <path d={`${d} L${W},${H} L0,${H}Z`} fill="url(#tg)" opacity=".12" />
      <path d={d} fill="none" stroke="url(#tg)" strokeWidth="2.2" />
      <line x1={cx} x2={cx} y1="0" y2={H} stroke="#0e7490" strokeWidth="1.2" strokeDasharray="3 3" />
      {['0h', '24h', '48h', '72h'].map((t, i) => (
        <text key={t} x={i === 3 ? W - 2 : (i / 3) * W + 2} y={H - 1} fontSize="8" fill="#64748b" textAnchor={i === 3 ? 'end' : 'start'}>{t}</text>
      ))}
    </svg>
  )
}

export default function ZonePanel({ zone, hour, onClose, onAlert }) {
  const [done, setDone] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  useEffect(() => { setDone({}); setSent(false) }, [zone.id, zone.level])

  const Icon = ZONE_ICONS[zone.id]
  const col = levelColor(zone.score)
  const L = LEVEL[zone.level]
  const eta = zone.eta_high_hours
  let etaBlock
  if (eta == null) {
    etaBlock = { tone: 'text-emerald-300', title: 'Aucun impact critique prévu', sub: 'sur l’horizon de 72 h' }
  } else if (eta > hour) {
    const lbl = horizonLabel(eta)
    etaBlock = { tone: 'text-amber-200', title: `Marée toxique dans ${Math.round(eta - hour)} h`, sub: `Seuil critique atteint ${lbl.day} à ${lbl.time}` }
  } else {
    etaBlock = { tone: 'text-rose-300', title: 'Zone impactée', sub: `Seuil critique franchi à +${eta} h` }
  }

  const send = async () => {
    setSending(true)
    await onAlert(zone)
    setSending(false)
    setSent(true)
  }

  return (
    <div className="panel w-[320px] max-h-full overflow-y-auto thin-scroll animate-slidein" key={zone.id}>
      <div className="p-4 flex items-start gap-3 border-b border-white/5">
        <div className="h-11 w-11 rounded-xl grid place-items-center shrink-0" style={{ background: `${col}22`, color: col, boxShadow: `0 0 24px ${col}44` }}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label !text-lagoon-300/80">{zone.sector_label}</div>
          <div className="text-[15px] font-semibold text-white leading-tight mt-0.5">{zone.name}</div>
          <div className="text-[11.5px] text-slate-400 mt-1">{zone.description}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white p-1 -m-1"><X size={16} /></button>
      </div>

      <div className="p-4 grid grid-cols-[auto_1fr] gap-4 items-center border-b border-white/5">
        <div>
          <div className="label">Score</div>
          <div className="num text-[44px] leading-none font-semibold mt-1" style={{ color: col }}>{Math.round(zone.score)}</div>
        </div>
        <div className="space-y-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${L.bg} ${L.text}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: col }} /> Risque {L.label}
          </span>
          <div className="flex items-start gap-2">
            <Clock size={14} className={`${etaBlock.tone} mt-0.5 shrink-0`} />
            <div>
              <div className={`text-[12.5px] font-semibold ${etaBlock.tone}`}>{etaBlock.title}</div>
              <div className="text-[10.5px] text-slate-400 capitalize-first">{etaBlock.sub}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 border-b border-white/5">
        <div className="label mb-1">Évolution prévue · 72 h</div>
        <Trend trend={zone.trend} hour={hour} />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-400"><Coins size={13} className="text-lagoon-300" />
            <span><b className="num text-slate-100">{zone.asset_value_mdh.toLocaleString('fr-FR')}</b> MDH exposés</span></div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400"><Users size={13} className="text-lagoon-300" />
            <span><b className="num text-slate-100">{zone.stakeholders}</b> opérateurs</span></div>
        </div>
      </div>

      <div className="p-4">
        <div className="label mb-2">Actions recommandées</div>
        <div className="space-y-1.5">
          {zone.actions.map((a, i) => (
            <button key={a} onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
              className="w-full flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition">
              <span className={`mt-0.5 h-4 w-4 rounded grid place-items-center shrink-0 border transition
                ${done[i] ? 'bg-lagoon-400 border-lagoon-400 text-paper' : 'border-white/20'}`}>
                {done[i] && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={`text-[12px] ${done[i] ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{a}</span>
            </button>
          ))}
        </div>

        <button onClick={send} disabled={sending || sent || zone.level === 'low'}
          className={`mt-4 w-full h-11 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition
            ${sent ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
              : zone.level === 'low' ? 'bg-white/5 text-slate-500 cursor-not-allowed'
              : zone.level === 'high' ? 'bg-rose-500 hover:bg-rose-400 text-paper shadow-[0_6px_20px_rgba(244,63,94,.35)]'
              : 'bg-amber-400 hover:bg-amber-500 text-amber-950'}`}>
          {sending ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours…</>
            : sent ? <><ShieldCheck size={16} /> Alerte envoyée · {zone.stakeholders} acteurs</>
            : zone.level === 'low' ? <>Aucune alerte nécessaire</>
            : <><BellRing size={16} /> Alerter {zone.stakeholders} acteur{zone.stakeholders > 1 ? 's' : ''} · SMS / WhatsApp</>}
        </button>

        {zone.level !== 'low' && (
          <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="label flex items-center gap-1.5"><MessageSquare size={11} /> {sent ? 'Message envoyé' : 'Aperçu du message'}</div>
              <div className="flex gap-1">
                {['SMS', 'WhatsApp', 'E-mail'].map((c) => (
                  <span key={c} className={`text-[9.5px] px-1.5 py-0.5 rounded ${sent ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>{c}</span>
                ))}
              </div>
            </div>
            <div className={`text-[11.5px] leading-snug rounded-lg rounded-tl-sm px-3 py-2 transition
              ${sent ? 'bg-emerald-500/15 text-emerald-900 toast-enter' : 'bg-white/[0.05] text-slate-300'}`}>
              {alertMessage(zone)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
