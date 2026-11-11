import { loadProgress } from '../../app/progress'
import { formatLongFr, todayISO } from '../../domain/dates'
import { useDbQuery } from '../useDbQuery'

const short = (d: string) => formatLongFr(d).split(' ').slice(1, 3).join(' ') + ` ${d.slice(0, 4)}`

/** Records, trophées, cadence et VO2max (onglet Suivi). */
export function ProgressSections() {
  const today = todayISO()
  const p = useDbQuery(() => loadProgress(today), [today])
  if (!p) return null
  const earned = p.trophies.filter((t) => t.earned)
  const next = p.trophies.filter((t) => !t.earned).slice(0, 3)
  return (
    <>
      <section className="card space-y-2" aria-label="Records">
        <h2 className="display text-lg">🏆 Records</h2>
        {p.records.length === 0 ? (
          <p className="text-sm text-muted">Tes records apparaîtront avec tes sorties enregistrées par la montre.</p>
        ) : (
          <ul className="space-y-1 text-[15px]">
            {p.records.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>{r.label}</span>
                <span className="text-right">
                  <b className="num">{r.value}</b> <span className="text-xs text-muted">· {short(r.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2" aria-label="Trophées">
        <h2 className="display text-lg">Trophées · {earned.length}/{p.trophies.length}</h2>
        <ul className="grid grid-cols-3 gap-2">
          {p.trophies.map((t) => (
            <li key={t.id} className={`rounded-card p-2 text-center ${t.earned ? 'bg-surface2' : 'opacity-40'}`} title={t.hint}>
              <span className="text-2xl block" aria-hidden>{t.emoji}</span>
              <span className="text-xs block leading-tight">{t.label}</span>
              <span className="sr-only">{t.earned ? 'obtenu' : 'à obtenir'}</span>
            </li>
          ))}
        </ul>
        {next.length > 0 && <p className="text-sm text-muted">Prochains : {next.map((t) => t.hint.toLowerCase()).join(' · ')}.</p>}
      </section>

      <section className="card space-y-1" aria-label="Cadence">
        <h2 className="display text-lg">Cadence{p.cadence.current ? ` · ${p.cadence.current} pas/min` : ''}</h2>
        {p.cadence.advice.map((a) => (
          <p key={a} className="text-[15px]">{a}</p>
        ))}
      </section>

      <section className="card space-y-1" aria-label="VO2max">
        <h2 className="display text-lg">VO2max</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card bg-surface2 p-3">
            <p className="num text-2xl font-bold">{p.vo2.garmin ?? '—'}</p>
            <p className="text-xs text-muted">montre{p.vo2.garminTrend ? ` (${p.vo2.garminTrend > 0 ? '+' : ''}${p.vo2.garminTrend} en 4 sem.)` : ''}</p>
          </div>
          <div className="rounded-card bg-surface2 p-3">
            <p className="num text-2xl font-bold">{p.vo2.coach != null ? String(p.vo2.coach).replace('.', ',') : '—'}</p>
            <p className="text-xs text-muted">coach (d’après tes chronos)</p>
          </div>
        </div>
        <p className="text-[15px]">{p.vo2.text}</p>
      </section>
    </>
  )
}
