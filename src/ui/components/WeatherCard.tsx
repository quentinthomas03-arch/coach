import { useState } from 'react'
import { swapSessions } from '../../app/plan'
import { sessionsWeather } from '../../app/runWeather'
import { syncToWatch } from '../../app/sync'
import { formatLongFr } from '../../domain/dates'
import { INDOOR_PLAN_B } from '../../domain/runWeather'
import { useDbQuery } from '../useDbQuery'

const day = (d: string, today: string) => (d === today ? 'Aujourd’hui' : formatLongFr(d).split(' ').slice(0, 1).join(' ').replace(/^./, (c) => c.toUpperCase()))

/** Météo des séances de course : conseils du jour, et alerte si une séance des 3 prochains jours tombe mal. */
export function WeatherCard({ today }: { today: string }) {
  const list = useDbQuery(() => sessionsWeather(today), [today])
  const [done, setDone] = useState<string[]>([])
  if (!list) return null
  const shown = list.filter((w) => !done.includes(w.sessionId) && (w.date === today ? w.level !== 'ok' : w.level === 'decaler'))
  if (!shown.length) return null
  return (
    <section className="card tint tint-eau space-y-3" aria-label="Météo des séances">
      <h2 className="display text-lg">🌦️ Météo des séances</h2>
      {shown.map((w) => (
        <div key={w.sessionId} className="space-y-1">
          <p className="font-semibold">
            {day(w.date, today)} · {w.session.title} — <span className="font-normal">{w.summary}</span>
          </p>
          {w.level === 'decaler' && (
            <>
              <p className="text-[15px]">Pas de prise de risque.{w.swapWith ? ` Je te propose d’échanger avec ${w.swapWith.kind === 'renfo' ? 'le renfo' : 'la séance'} du ${formatLongFr(w.swapWith.date)}, où ça s’annonce mieux.` : ''}</p>
              {w.swapWith && (
                <button
                  className="btn-primary w-full"
                  onClick={async () => {
                    await swapSessions(w.sessionId, w.swapWith!.id, today)
                    setDone([...done, w.sessionId])
                    syncToWatch(today).catch(() => undefined)
                  }}
                >
                  Échanger les deux séances
                </button>
              )}
              <p className="text-sm text-muted">{INDOOR_PLAN_B}</p>
            </>
          )}
          {w.tips.length > 0 && (
            <ul className="list-disc pl-5 text-[15px] space-y-0.5">
              {w.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}
