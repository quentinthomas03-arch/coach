import { useState } from 'react'
import { db } from '../../data/db'
import { addDays, mondayOf, parseISODate, todayISO } from '../../domain/dates'
import { buildLoadEntries, loadStatus, weeklyLoads } from '../../domain/load'
import { BarChart, LineChart, StatTile } from '../components/Charts'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'

const WEEKS = 8
const shortDate = (d: string) => {
  const x = parseISODate(d)
  return `${x.getDate()}/${x.getMonth() + 1}`
}
const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')

function WeightForm() {
  const [v, setV] = useState('')
  const today = todayISO()
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const kg = Number(v.replace(',', '.'))
        if (!kg || kg < 30 || kg > 250) return
        await db.bodyMetrics.put({ ...(await db.bodyMetrics.get(today)), date: today, weightKg: kg })
        setV('')
      }}
    >
      <label htmlFor="poids" className="sr-only">
        Poids du jour en kg
      </label>
      <input id="poids" className="field" inputMode="decimal" placeholder="Poids du jour (kg)" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-primary shrink-0" type="submit">
        Ajouter
      </button>
    </form>
  )
}

export function Suivi() {
  const today = todayISO()
  const data = useDbQuery(async () => {
    const from = addDays(mondayOf(today), -7 * (WEEKS + 4))
    const [acts, sessions, feedback, wellness, weights, checkins] = await Promise.all([
      db.activities.where('date').aboveOrEqual(from).toArray(),
      db.sessions.where('date').between(from, today, true, true).toArray(),
      db.feedback.where('date').aboveOrEqual(from).toArray(),
      db.wellness.where('date').between(addDays(today, -13), today, true, true).toArray(),
      db.bodyMetrics.orderBy('date').toArray(),
      db.checkins.where('date').between(addDays(today, -13), today, true, true).toArray(),
    ])
    const entries = buildLoadEntries(acts, sessions, feedback)
    const weeks = weeklyLoads(entries, mondayOf(today), WEEKS)
    const plannedStrength = (ws: string) => sessions.filter((s) => s.kind === 'renfo' && s.date >= ws && s.date < addDays(ws, 7)).length
    return { entries, weeks, status: loadStatus(entries, today), wellness, weights, checkins, plannedStrength }
  }, [today])
  if (!data) return null
  const { weeks, status, wellness, weights, checkins, plannedStrength } = data
  const cur = weeks[weeks.length - 1]
  const sleep = wellness.map((w) => w.sleepHours).filter((x): x is number => x != null)
  const rhr = wellness.map((w) => w.restingHr).filter((x): x is number => x != null)
  const forme = checkins.map((c) => c.physique)
  const nothing = data.entries.length === 0

  return (
    <div className="space-y-4">
      <PageTitle sub="Tes 8 dernières semaines">Suivi</PageTitle>

      {status.alerts.map((a) => (
        <p key={a.rule} className="rounded-card border border-danger/40 bg-danger/10 px-4 py-3 text-[15px]">
          <span className="sr-only">Alerte : </span>
          {a.text}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Course cette semaine" value={`${cur.runMinutes} min`} sub={status.lastWeekRunMin ? `semaine dernière : ${status.lastWeekRunMin} min` : undefined} />
        <StatTile label="Distance cette semaine" value={`${fmt1(cur.runKm)} km`} sub="mesurée par la montre" />
        <StatTile
          label="Charge 7 j / moyenne"
          value={status.ratio != null ? fmt1(status.ratio) : '—'}
          sub={status.ratio != null ? (status.ratio > 1.5 ? 'trop haut : lève le pied' : status.ratio < 0.8 ? 'en dessous de ta moyenne' : 'zone raisonnable (0,8 à 1,3)') : '3 semaines d’historique nécessaires'}
        />
        <StatTile label="Renfo cette semaine" value={`${cur.strengthSessions}/${plannedStrength(cur.weekStart) || '—'}`} sub="séances faites / prévues" />
      </div>

      {nothing ? (
        <section className="card">
          <p>Pas encore de séance faite. Les graphiques se rempliront au fil des semaines, avec tes séances détectées par la montre ou marquées « faites ».</p>
        </section>
      ) : (
        <>
          <BarChart title="Minutes de course par semaine" unit="min" data={weeks.map((w, i) => ({ label: shortDate(w.weekStart), value: w.runMinutes, current: i === weeks.length - 1 }))} />
          <BarChart
            title="Charge d’entraînement par semaine"
            unit=""
            data={weeks.map((w, i) => ({ label: shortDate(w.weekStart), value: w.load, detail: `${w.load} (durée × effort)`, current: i === weeks.length - 1 }))}
          />
          <BarChart
            title="Régularité du renfo"
            unit="séance(s)"
            data={weeks.map((w, i) => ({ label: shortDate(w.weekStart), value: w.strengthSessions, detail: `${w.strengthSessions} faite(s) / ${plannedStrength(w.weekStart)} prévue(s)`, current: i === weeks.length - 1 }))}
          />
        </>
      )}

      <section className="space-y-2" aria-label="Récupération">
        <h2 className="display text-lg">Récupération (14 jours)</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Sommeil moyen" value={sleep.length ? `${fmt1(sleep.reduce((a, b) => a + b, 0) / sleep.length)} h` : '—'} />
          <StatTile label="FC repos" value={rhr.length ? `${Math.round(rhr.reduce((a, b) => a + b, 0) / rhr.length)}` : '—'} sub="bpm" />
          <StatTile label="Forme (check)" value={forme.length ? `${fmt1(forme.reduce((a, b) => a + b, 0) / forme.length)}/5` : '—'} />
        </div>
        {!sleep.length && <p className="text-xs text-muted">Sommeil et FC de repos viennent de ta montre via Intervals.icu (vérifie l’import du bien-être dans la connexion Garmin d’Intervals.icu).</p>}
      </section>

      <a href="#/notes" className="btn-secondary w-full">
        Mes notes
      </a>

      <section className="space-y-2" aria-label="Poids">
        <h2 className="display text-lg">Poids</h2>
        <WeightForm />
        <LineChart title="Évolution du poids" unit="kg" data={weights.filter((w) => w.weightKg).slice(-20).map((w) => ({ label: shortDate(w.date), value: w.weightKg! }))} />
        {weights.length === 1 && <p className="text-sm text-muted">Une seule pesée pour l’instant : le graphique apparaîtra à la deuxième.</p>}
        <p className="text-xs text-muted">Facultatif. Une pesée par semaine, le matin, suffit : le poids varie naturellement d’un jour à l’autre.</p>
      </section>
    </div>
  )
}
