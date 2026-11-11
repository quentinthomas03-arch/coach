import { useState } from 'react'
import { getSetting, setSetting, db } from '../../data/db'
import { abandonGoal, addPerformance } from '../../app/goals'
import { syncToWatch } from '../../app/sync'
import { daysBetween, formatLongFr } from '../../domain/dates'
import type { Goal } from '../../domain/goals'
import { DISTANCES, parseTime } from '../../domain/paces'
import { raceDayPlan, raceDebrief } from '../../domain/raceDay'
import { formatPace } from '../../domain/workout'
import { useDbQuery } from '../useDbQuery'

const START_KEY = 'race.startTime'

/** Plan de course du jour J, puis bilan quand le chrono est saisi. */
export function RaceDayCard({ goal, predictedSec, today }: { goal: Goal; predictedSec?: number; today: string }) {
  const data = useDbQuery(async () => {
    const [profile, metric, start] = await Promise.all([db.profile.get('me'), db.bodyMetrics.orderBy('date').reverse().filter((m) => m.weightKg != null).first(), getSetting<string>(START_KEY)])
    return { weightKg: metric?.weightKg ?? profile?.weightKg ?? 70, start: start ?? '09:00' }
  }, [])
  const [result, setResult] = useState('')
  const [debrief, setDebrief] = useState<string[]>()
  if (!data) return null
  const km = goal.type === 'trail' ? goal.trailKm ?? 0 : goal.distance ? DISTANCES[goal.distance] / 1000 : 0
  if (!km) return null
  const timeSec = goal.targetTimeSec ?? predictedSec
  const plan = raceDayPlan({ distanceKm: km, timeSec, trail: goal.type === 'trail', elevationGainM: goal.elevationGainM, weightKg: data.weightKg, date: goal.date, startTime: data.start })
  const daysLeft = daysBetween(today, goal.date)
  const after = daysLeft <= 0

  return (
    <details className="border-t border-line pt-2" open={daysLeft <= 14} id="jour-j">
      <summary className="font-semibold min-h-[44px] flex items-center">🏁 Plan de course{daysLeft > 0 ? ` (J−${daysLeft})` : ''}</summary>
      <div className="space-y-3 text-[15px]">
        <div className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="race-start">Heure de départ</label>
          <input id="race-start" type="time" className="field w-32" value={data.start} onChange={(e) => e.target.value && setSetting(START_KEY, e.target.value)} />
        </div>

        <div>
          <h3 className="font-semibold">Allures</h3>
          {plan.targetPace ? <p>Allure visée : <b className="num">{formatPace(plan.targetPace)}/km</b>{goal.targetTimeSec ? '' : ' (d’après ta forme prévue)'}.</p> : <p className="text-muted">Pas de chrono connu : course à l’effort.</p>}
          <ul className="space-y-1 mt-1">
            {plan.segments.map((s) => (
              <li key={s.fromKm}>
                <b>km {s.fromKm} → {Math.round(s.toKm * 10) / 10}</b>
                {s.paceSec ? <span className="num"> · {formatPace(s.paceSec)}/km</span> : null} — {s.cue}
              </li>
            ))}
          </ul>
          {plan.splits.length > 0 && (
            <p className="text-sm mt-1">
              Passages : {plan.splits.map((s) => `${String(s.km).replace('.', ',')} km ${s.time}`).join(' · ')}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-semibold">Manger et boire</h3>
          <p>{plan.carbLoad.text}</p>
          <ul className="list-disc pl-5">
            {plan.breakfast.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="font-semibold mt-1">Pendant</p>
          <ul className="list-disc pl-5">
            {plan.during.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Le jour J</h3>
          <ul className="space-y-0.5">
            {plan.timeline.map((t) => (
              <li key={t.what}>
                <b className="num">{t.when.includes('-') ? formatLongFr(t.when) : t.when}</b> — {t.what}
              </li>
            ))}
          </ul>
          <p className="mt-1"><b>Échauffement :</b> {plan.warmup}</p>
        </div>

        <div>
          <h3 className="font-semibold">Sac de la veille</h3>
          <ul className="space-y-1">
            {plan.checklist.map((c) => (
              <li key={c}>
                <label className="flex gap-2 items-start min-h-[32px]">
                  <input type="checkbox" className="mt-1 w-5 h-5" /> <span>{c}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <p>{plan.recovery}</p>

        {after && (
          <div className="rounded-card bg-surface2 p-3 space-y-2">
            <h3 className="font-semibold">Ton chrono</h3>
            {debrief ? (
              <>
                <ul className="space-y-1">
                  {debrief.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <button
                  className="btn-secondary w-full"
                  onClick={async () => {
                    await abandonGoal(today)
                    syncToWatch(today).catch(() => undefined)
                  }}
                >
                  Clore l’objectif et repasser en Forme continue
                </button>
              </>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const t = parseTime(result)
                  if (!t) return
                  if (goal.type !== 'trail') await addPerformance({ date: goal.date, distanceM: km * 1000, timeSec: t, source: 'course', label: goal.name })
                  setDebrief(raceDebrief(Math.round(km * 10) / 10, t, timeSec))
                }}
              >
                <label className="sr-only" htmlFor="race-result">Chrono</label>
                <input id="race-result" className="field flex-1" placeholder="ex. 1:38:20" value={result} onChange={(e) => setResult(e.target.value)} />
                <button className="btn-primary">Valider</button>
              </form>
            )}
          </div>
        )}
      </div>
    </details>
  )
}
