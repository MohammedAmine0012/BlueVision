import { useState } from 'react'
import { Satellite, ScanSearch, Route, BellRing, ArrowRight, ScanLine } from 'lucide-react'

const STEPS = [
  { icon: Satellite, title: 'Observer', text: 'Chaque jour, les satellites européens photographient les eaux de Dakhla.' },
  { icon: ScanSearch, title: 'Détecter', text: 'L’intelligence artificielle repère les algues toxiques sur l’image.' },
  { icon: Route, title: 'Prévoir', text: 'Les courants et la marée indiquent où elles seront dans 72 h.' },
  { icon: BellRing, title: 'Alerter', text: 'Chaque acteur reçoit l’alerte qui le concerne, au bon moment.' },
]

function Img({ src, label, sub }) {
  const [ok, setOk] = useState(true)
  return (
    <figure className="flex-1 min-w-0">
      <div className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-abyss-850 grid place-items-center">
        {ok ? <img src={src} alt={label} className="w-full h-full object-cover" onError={() => setOk(false)} />
          : <div className="text-xs text-slate-500 p-6 text-center">Image non disponible</div>}
      </div>
      <figcaption className="mt-2">
        <div className="text-[13px] font-semibold text-white">{label}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </figcaption>
    </figure>
  )
}

export default function AIView() {
  const [split, setSplit] = useState(50)

  return (
    <div className="absolute inset-0 overflow-y-auto thin-scroll pt-[84px] pb-8 px-6 bg-[radial-gradient(ellipse_at_top,rgba(20,184,212,.08),transparent_60%)]">
      <div className="max-w-[1280px] mx-auto space-y-5">
        <div>
          <div className="label !text-lagoon-300">Vision IA</div>
          <h2 className="text-2xl font-semibold text-white mt-1">L’IA repère les algues toxiques depuis l’espace</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            À partir d’une simple image satellite, BlueVision distingue l’eau saine, les nuages, la côte — et les zones d’algues toxiques.
          </p>
        </div>

        <div className="grid grid-cols-[1.25fr_1fr] gap-5">
          {/* comparison slider */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><ScanLine size={16} className="text-lagoon-300" /> Avant ↔ Après l’IA</div>
              <div className="text-[11px] text-slate-400">Glissez pour comparer</div>
            </div>
            <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10 select-none">
              <img src="/ai/showcase_overlay.png" className="absolute inset-0 w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                <img src="/ai/showcase_raw.png" className="absolute inset-0 w-full h-full object-cover" alt="" />
              </div>
              <div className="absolute inset-y-0 w-0.5 bg-paper shadow-[0_0_14px_rgba(255,255,255,.8)]" style={{ left: `${split}%` }}>
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-paper text-white shadow grid place-items-center text-xs font-bold">⇆</div>
              </div>
              <span className="absolute top-3 left-3 text-[11px] font-semibold text-paper bg-black/60 px-2 py-1 rounded-md">Image satellite</span>
              <span className="absolute top-3 right-3 text-[11px] font-semibold text-paper bg-rose-500/80 px-2 py-1 rounded-md">Algues détectées</span>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(+e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize" />
            </div>
          </div>

          <div className="panel p-4">
            <div className="text-sm font-semibold text-white mb-3">Ce que voit l’IA</div>
            <div className="flex gap-3">
              <Img src="/ai/showcase_raw.png" label="Image satellite" sub="Ce que voit l’œil humain" />
              <Img src="/ai/showcase_mask.png" label="Résultat de l’IA" sub="En rouge : les algues toxiques" />
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <div className="text-sm font-semibold text-white mb-3">Comment ça marche</div>
          <div className="flex items-stretch gap-2">
            {STEPS.map((p, i) => (
              <div key={p.title} className="flex items-center gap-2 flex-1">
                <div className="flex-1 rounded-xl bg-white/[0.03] border border-white/5 p-3 h-full">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-lagoon-400/15 text-lagoon-300 grid place-items-center"><p.icon size={15} /></div>
                    <div className="text-[13px] font-semibold text-white">{p.title}</div>
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-2 leading-snug">{p.text}</div>
                </div>
                {i < STEPS.length - 1 && <ArrowRight size={16} className="text-slate-600 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
