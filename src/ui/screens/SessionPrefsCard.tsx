import { useEffect, useState } from 'react'
import { getPlanConfig, getSessionPrefs, KEYS } from '../../app/config'
import { saveSessionPrefs } from '../../app/plan'
import { syncToWatch } from '../../app/sync'
import { getSetting } from '../../data/db'
import { todayISO } from '../../domain/dates'
import { estimateFitness, type Performance } from '../../domain/fitness'
import { formatTime, parseTime } from '../../domain/paces'
import { sessionPaces } from '../../domain/sessionPaces'
import { adjustPaces, OFFSET_LIMIT, type SessionPrefs } from '../../domain/sessionPrefs'
import { Stepper, Toggle } from '../components/Choice'

/** Mes corrections de séance : marche ou non, allure d'échauffement, allure facile. */
export function SessionPrefsCard() {
  const [p, setP] = useState<SessionPrefs>()
  const [warm, setWarm] = useState('')
  const [easy, setEasy] = useState<[number, number]>()
  const [msg, setMsg] = useState('')
  useEffect(() => {
    getSessionPrefs().then((x) => {
      setP(x)
      setWarm(x.warmupPace ? formatTime(x.warmupPace) : '')
    })
  }, [])
  useEffect(() => {
    if (!p) return
    ;(async () => {
      const cfg = await getPlanConfig()
      const f = estimateFitness((await getSetting<Performance[]>(KEYS.perfs)) ?? [], todayISO())
      setEasy(adjustPaces(sessionPaces(f, (cfg?.mode ?? 'reprise') === 'reprise'), p)?.easy)
    })()
  }, [p])
  if (!p) return null
  const warmSec = warm.trim() ? parseTime(warm) : undefined
  const warmOk = !warm.trim() || (warmSec != null && warmSec >= 240 && warmSec <= 600)
  return (
    <section id="seances" className="card mb-4 scroll-mt-16 space-y-3">
      <h2 className="display text-base">Mes séances</h2>
      <p className="text-sm text-muted">Corrige le coach : il appliquera tes choix à toutes les séances à venir, sur la montre comme dans l’appli.</p>
      <Toggle label="Je marche à l’échauffement et pendant les récupérations" hint="Désactivé : échauffement en footing, récups en trottinant." checked={p.walk} onChange={(v) => setP({ ...p, walk: v })} />
      <div>
        <label className="label" htmlFor="warm">
          Mon allure d’échauffement (vide = automatique)
        </label>
        <input id="warm" className="field" placeholder="ex. 6:30" inputMode="text" value={warm} onChange={(e) => setWarm(e.target.value)} />
        {!warmOk && <p className="text-sm text-danger mt-1">Format attendu : 6:30 (entre 4:00 et 10:00/km).</p>}
      </div>
      <Stepper label="Mon allure facile" value={p.easyOffset} onChange={(v) => setP({ ...p, easyOffset: v })} min={-OFFSET_LIMIT} max={OFFSET_LIMIT} step={5} unit="s/km" />
      <p className="text-xs text-muted">
        {p.easyOffset === 0 ? 'Calculée d’après ta forme.' : p.easyOffset > 0 ? `${p.easyOffset} s/km plus lente que le calcul.` : `${-p.easyOffset} s/km plus rapide que le calcul.`}
        {easy ? ` Course facile : ${formatTime(easy[0])}–${formatTime(easy[1])}/km.` : ' Ajoute un record (Plan) pour avoir des allures.'} Tes retours après les séances l’ajustent aussi, par pas de 10 s/km.
      </p>
      <button
        className="btn-primary w-full"
        disabled={!warmOk}
        onClick={async () => {
          const today = todayISO()
          const r = await saveSessionPrefs({ ...p, warmupPace: warmSec }, today)
          syncToWatch(today).catch(() => undefined)
          setMsg(r.changed ? 'Séances à venir mises à jour (détail dans Semaine › Ce qui a changé).' : 'Enregistré.')
        }}
      >
        Appliquer à mes séances
      </button>
      {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
    </section>
  )
}
