import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Equipment, EquipmentId } from '../../data/types'
import { db } from '../../data/db'
import { getPlanConfig, savePlanConfig, type PlanConfig } from '../../app/config'
import { regenerate } from '../../app/plan'
import { syncToWatch } from '../../app/sync'
import { todayISO } from '../../domain/dates'
import { Choice, Stepper, Toggle } from '../components/Choice'
import { DAY_NAMES } from '../components/WeekEditor'

const EQUIP_LABELS: Record<EquipmentId, string> = {
  tapis: 'Tapis', kettlebell: 'Kettlebell', elastiques: 'Élastiques', 'roue-abdos': 'Roue abdos',
  escalier: 'Escalier', mur: 'Mur libre', banc: 'Banc', 'barre-traction': 'Barre de traction',
}

/** Réglages du plan : tout est modifiable, le plan se recalcule ensuite. */
export function PlanSettings() {
  const [cfg, setCfg] = useState<PlanConfig>()
  const [equip, setEquip] = useState<Equipment[]>([])
  const [msg, setMsg] = useState('')
  useEffect(() => {
    getPlanConfig().then(setCfg)
    db.equipment.toArray().then(setEquip)
  }, [])
  if (!cfg) return null
  const today = todayISO()
  const save = async () => {
    await savePlanConfig(cfg)
    await db.equipment.bulkPut(equip)
    const r = await regenerate('Réglages du plan modifiés', today)
    syncToWatch(today).catch(() => undefined)
    setMsg(r.changed ? (r.version?.status === 'pending' ? 'Changements proposés : valide-les dans Semaine.' : `Plan mis à jour (${r.version?.changes.length} changement(s), annulable dans Semaine).`) : 'Enregistré, aucun changement de séance.')
  }
  return (
    <section id="plan" className="card mb-4 scroll-mt-16 space-y-4">
      <h2 className="display text-base">Mon plan</h2>
      <div>
        <label className="label" htmlFor="start">
          Date de début
        </label>
        <input id="start" type="date" className="field" value={cfg.startDate} onChange={(e) => setCfg({ ...cfg, startDate: e.target.value })} />
      </div>
      <Choice label="Sorties par semaine" cols={3} value={cfg.runsPerWeek} onChange={(v) => setCfg({ ...cfg, runsPerWeek: v })} options={[2, 3, 4].map((n) => ({ value: n, label: `${n}` }))} />
      <Choice label="Renfos par semaine" cols={3} value={cfg.strengthPerWeek} onChange={(v) => setCfg({ ...cfg, strengthPerWeek: v })} options={[1, 2, 3].map((n) => ({ value: n, label: `${n}` }))} />
      <Choice label="Sortie longue le" cols={3} value={cfg.longRunWeekday} onChange={(v) => setCfg({ ...cfg, longRunWeekday: v })} options={[5, 6, 0].map((d) => ({ value: d, label: DAY_NAMES[d] }))} />
      <div>
        <Stepper label="Niveau de reprise" value={cfg.repriseLevel} onChange={(v) => setCfg({ ...cfg, repriseLevel: v })} min={1} max={9} unit="/9" />
        <Stepper label="Niveau de renfo" value={cfg.strengthLevel} onChange={(v) => setCfg({ ...cfg, strengthLevel: v })} min={1} max={5} unit="/5" />
        <p className="text-xs text-muted">Le coach ajuste les niveaux chaque lundi selon ta semaine ; tu peux les forcer ici.</p>
      </div>
      <Choice
        label="Changements du plan"
        cols={1}
        value={cfg.recalcMode}
        onChange={(v) => setCfg({ ...cfg, recalcMode: v })}
        options={[
          { value: 'auto', label: 'Le coach ajuste, je peux annuler' },
          { value: 'valider', label: 'Le coach propose, je valide' },
        ]}
      />
      <Choice
        label="Ton du coach"
        cols={3}
        value={cfg.tone}
        onChange={(v) => setCfg({ ...cfg, tone: v })}
        options={[
          { value: 'bienveillant', label: 'Bienveillant' },
          { value: 'direct', label: 'Direct' },
          { value: 'cash', label: 'Cash' },
        ]}
      />
      <details>
        <summary className="font-medium min-h-[44px] flex items-center">Matériel</summary>
        <div className="divide-y divide-line">
          {equip.map((e) => (
            <Toggle key={e.id} label={EQUIP_LABELS[e.id]} checked={e.available} onChange={(v) => setEquip(equip.map((x) => (x.id === e.id ? { ...x, available: v } : x)))} />
          ))}
        </div>
      </details>
      <button className="btn-primary w-full" onClick={save}>
        Enregistrer
      </button>
      {msg && (
        <p role="status" className="text-sm text-ok">
          {msg}
        </p>
      )}
      <Link to="/tabac" className="btn-secondary w-full">
        Arrêt du tabac
      </Link>
    </section>
  )
}
