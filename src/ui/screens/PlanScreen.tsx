import { useDbQuery } from '../useDbQuery'
import { Link } from 'react-router-dom'
import { db } from '../../data/db'
import { getPlanConfig } from '../../app/config'
import { weekIndexOf } from '../../app/plan'
import { formatLongFr, mondayOf, todayISO } from '../../domain/dates'
import { getLevel, MAX_REPRISE_LEVEL } from '../../domain/reprise'
import { PageTitle } from '../Layout'

export function PlanScreen() {
  const today = todayISO()
  const data = useDbQuery(async () => {
    const cfg = await getPlanConfig()
    const done = await db.sessions.where('status').equals('done').count()
    return { cfg, done }
  }, [])
  if (!data?.cfg) return null
  const { cfg, done } = data
  const started = today >= cfg.startDate
  const week = weekIndexOf(cfg.startDate, mondayOf(today)) + 1
  return (
    <div className="space-y-4">
      <PageTitle sub={started ? `Semaine ${week} · ${done} séance(s) faite(s)` : `Début le ${formatLongFr(cfg.startDate)}`}>Mon plan</PageTitle>
      {cfg.mode === 'forme' ? (
        <section className="card">
          <p className="text-sm text-muted">Mode actuel</p>
          <h2 className="display text-2xl">Forme continue</h2>
          <p className="mt-1">
            Semaine <strong className="num">{(weekIndexOf(cfg.startDate, mondayOf(today)) % 4) + 1}/4</strong> du cycle · volume de base{' '}
            <strong className="num">{cfg.formeBaseMinutes} min</strong> de course
          </p>
          <div className="flex gap-1 mt-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i === weekIndexOf(cfg.startDate, mondayOf(today)) % 4 ? 'bg-accent-ink' : 'bg-line'}`} />
            ))}
          </div>
          <p className="text-sm text-muted mt-3">
            3 semaines de charge (+8 % max par semaine validée) puis 1 semaine allégée. Une séance un peu plus soutenue en semaines 2 et 3.
          </p>
        </section>
      ) : (
      <section className="card">
        <p className="text-sm text-muted">Mode actuel</p>
        <h2 className="display text-2xl">Reprise en douceur</h2>
        <p className="mt-1">
          Niveau <strong className="num">{cfg.repriseLevel}/{MAX_REPRISE_LEVEL}</strong> : {getLevel(cfg.repriseLevel).label}
        </p>
        <div className="flex gap-1 mt-3" aria-hidden>
          {Array.from({ length: MAX_REPRISE_LEVEL }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < cfg.repriseLevel ? 'bg-accent-ink' : 'bg-line'}`} />
          ))}
        </div>
        <p className="text-sm text-muted mt-3">
          Objectif de la reprise : 30 min de course continue, sans douleur. Ensuite : mode Forme continue, puis un test pour calibrer tes allures.
        </p>
      </section>
      )}
      <section className="card">
        <p className="text-sm text-muted">Renfo</p>
        <p>
          Niveau <strong className="num">{cfg.strengthLevel}/5</strong> · {cfg.strengthPerWeek} séances par semaine
        </p>
      </section>
      <section className="card">
        <h2 className="display text-lg">Objectifs (route, chrono, trail, forme)</h2>
        <p className="text-sm text-muted mt-1">
          Arrivent en Phase 3, avec le bilan : où tu en es, le temps nécessaire, réaliste ou non.
        </p>
      </section>
      <Link to="/reglages#plan" className="btn-secondary w-full">
        Réglages du plan
      </Link>
    </div>
  )
}
