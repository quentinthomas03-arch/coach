import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getPlanConfig } from '../../app/config'
import { endPause, startPause, weekIndexOf } from '../../app/plan'
import { PAUSE_LABEL, type PauseReason } from '../../domain/pause'
import { abandonGoal, addPerformance, assess, getGoal, getPerformances, removePerformance, scheduleCalibrationTest, setGoal } from '../../app/goals'
import { syncToWatch } from '../../app/sync'
import { addDays, formatLongFr, mondayOf, todayISO } from '../../domain/dates'
import { estimateFitness } from '../../domain/fitness'
import { goalLabel, type Goal, type GoalAssessment, type GoalType } from '../../domain/goals'
import { PHASE_LABEL, peakMinutesFor, phasesFor, taperWeeksFor, totalWeeks, type Phase } from '../../domain/goalPlan'
import { DISTANCE_LABEL, DISTANCES, formatTime, parseTime, predictTimeSec, trainingPaces, type RoadDistance } from '../../domain/paces'
import { getLevel, MAX_REPRISE_LEVEL } from '../../domain/reprise'
import { Choice } from '../components/Choice'
import { useDbQuery } from '../useDbQuery'
import { PageTitle } from '../Layout'

const PHASE_COLOR: Record<Phase, string> = {
  base: 'bg-accent-ink/30',
  developpement: 'bg-accent-ink/55',
  specifique: 'bg-accent-ink/80',
  affutage: 'bg-accent-ink',
  course: 'bg-ink',
}
const VERDICT = {
  realiste: { txt: 'Réaliste', cls: 'bg-ok/15 text-ok' },
  ambitieux: { txt: 'Ambitieux', cls: 'bg-warn/15 text-warn' },
  deconseille: { txt: 'Déconseillé', cls: 'bg-danger/15 text-danger' },
}
const pace = (s: number) => `${formatTime(s)}/km`

function AssessmentCard({ a }: { a: GoalAssessment }) {
  const v = VERDICT[a.verdict]
  return (
    <div className="space-y-2">
      <p>
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${v.cls}`}>{v.txt}</span>
        <span className="text-sm text-muted ml-2">
          {a.weeksAvailable} sem. disponibles · ~{a.weeksNeeded} nécessaires
        </span>
      </p>
      <ul className="space-y-1.5 text-[15px]">
        {a.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {a.predictionAtDate && <p className="font-semibold">Chrono raisonnablement visable à la date : {formatTime(a.predictionAtDate)}</p>}
      {a.alternatives.length > 0 && (
        <div>
          <p className="font-semibold">Ce que je te propose :</p>
          <ul className="list-disc pl-5 text-[15px]">
            {a.alternatives.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type Kind = RoadDistance | 'trail' | 'chrono'

function GoalForm({ today, onClose }: { today: string; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>('10k')
  const [chronoDist, setChronoDist] = useState<RoadDistance>('5k')
  const [date, setDate] = useState(addDays(today, 7 * 20))
  const [time, setTime] = useState('')
  const [km, setKm] = useState('25')
  const [dplus, setDplus] = useState('1000')
  const [a, setA] = useState<GoalAssessment>()
  const [goal, setG] = useState<Goal>()
  const timeSec = time ? parseTime(time) : undefined
  const build = (): Goal => {
    const type: GoalType = kind === 'trail' ? 'trail' : kind === 'chrono' ? 'chrono' : 'route'
    const g: Goal = { id: `goal-${Date.now().toString(36)}`, type, date, createdAt: new Date().toISOString() }
    if (type === 'trail') {
      g.trailKm = Number(km.replace(',', '.'))
      g.elevationGainM = Number(dplus)
    } else {
      g.distance = type === 'chrono' ? chronoDist : (kind as RoadDistance)
      g.targetTimeSec = timeSec
    }
    g.name = goalLabel(g)
    return g
  }
  const valid = date > today && (kind !== 'chrono' || !!timeSec) && (!time || !!timeSec) && (kind !== 'trail' || Number(km) > 0)
  return (
    <section className="card space-y-3">
      <h2 className="display text-lg">Nouvel objectif</h2>
      <Choice
        cols={3}
        value={kind}
        onChange={(k) => {
          setKind(k)
          setA(undefined)
        }}
        options={[
          { value: '5k', label: '5 km' },
          { value: '10k', label: '10 km' },
          { value: 'semi', label: 'Semi' },
          { value: 'marathon', label: 'Marathon' },
          { value: 'trail', label: 'Trail' },
          { value: 'chrono', label: 'Record' },
        ]}
      />
      {kind === 'chrono' && (
        <Choice label="Améliorer mon record sur" cols={4} value={chronoDist} onChange={setChronoDist} options={(['5k', '10k', 'semi', 'marathon'] as const).map((d) => ({ value: d, label: DISTANCE_LABEL[d].replace('semi-marathon', 'semi') }))} />
      )}
      {kind === 'trail' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="km">
              Distance (km)
            </label>
            <input id="km" className="field" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="dp">
              Dénivelé + (m)
            </label>
            <input id="dp" className="field" inputMode="numeric" value={dplus} onChange={(e) => setDplus(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="gdate">
          {kind === 'chrono' ? 'Date du test (échéance)' : 'Date de la course'}
        </label>
        <input id="gdate" type="date" className="field" min={addDays(today, 7)} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {kind !== 'trail' && (
        <div>
          <label className="label" htmlFor="gtime">
            Chrono visé {kind === 'chrono' ? '' : '(facultatif : vide = finir)'}
          </label>
          <input id="gtime" className="field" placeholder="ex. 50:00 ou 1h45" value={time} onChange={(e) => setTime(e.target.value)} />
          {time && !timeSec && <p className="text-sm text-danger mt-1">Format non reconnu (ex. 50:00, 1:45:00, 1h45).</p>}
        </div>
      )}
      {!a ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={async () => {
              const g = build()
              setG(g)
              setA(await assess(g, today))
            }}
          >
            Faire le bilan
          </button>
        </div>
      ) : (
        <>
          <div className="border-t border-line pt-3">
            <h3 className="display text-lg mb-2">Le bilan du coach</h3>
            <AssessmentCard a={a} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setA(undefined)}>
              Modifier
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                if (a.verdict === 'deconseille' && !confirm('Le coach déconseille cet objectif à cette date. Le lancer quand même ?')) return
                await setGoal(goal!, today)
                syncToWatch(today).catch(() => undefined)
                onClose()
              }}
            >
              Lancer le plan
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function PerfForm({ onDone }: { onDone: () => void }) {
  const [d, setD] = useState<RoadDistance>('10k')
  const [t, setT] = useState('')
  const [date, setDate] = useState(todayISO())
  const sec = parseTime(t)
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <Choice cols={4} value={d} onChange={setD} options={(['5k', '10k', 'semi', 'marathon'] as const).map((x) => ({ value: x, label: DISTANCE_LABEL[x].replace('semi-marathon', 'semi') }))} />
      <div className="grid grid-cols-2 gap-2">
        <input className="field" placeholder="Temps (ex. 1h40)" aria-label="Temps" value={t} onChange={(e) => setT(e.target.value)} />
        <input className="field" type="date" aria-label="Date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button
        className="btn-primary w-full"
        disabled={!sec}
        onClick={async () => {
          await addPerformance({ date, distanceM: DISTANCES[d], timeSec: sec!, source: 'record', label: DISTANCE_LABEL[d][0].toUpperCase() + DISTANCE_LABEL[d].slice(1) })
          onDone()
        }}
      >
        Ajouter
      </button>
    </div>
  )
}

function PauseCard({ paused, from, today }: { paused: boolean; from?: string; today: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<PauseReason>('vacances')
  const [until, setUntil] = useState('')
  if (paused)
    return (
      <section className="card space-y-2 border-warn/50">
        <h2 className="display text-lg">Plan en pause</h2>
        <p className="text-sm text-muted">Depuis le {formatLongFr(from!)}. Aucune séance n’est planifiée ni envoyée sur la montre.</p>
        <button className="btn-primary w-full" onClick={() => endPause(today).then(() => syncToWatch(today).catch(() => undefined))}>
          Reprendre l’entraînement
        </button>
      </section>
    )
  return open ? (
    <section className="card space-y-3">
      <h2 className="display text-lg">Mettre le plan en pause</h2>
      <Choice cols={2} value={reason} onChange={setReason} options={(Object.keys(PAUSE_LABEL) as PauseReason[]).map((r) => ({ value: r, label: PAUSE_LABEL[r] }))} />
      <div>
        <label className="label" htmlFor="until">
          Retour prévu (facultatif)
        </label>
        <input id="until" type="date" className="field" min={today} value={until} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <p className="text-xs text-muted">Au retour, le coach adapte la reprise à la durée et au motif de l’arrêt.</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button
          className="btn-primary"
          onClick={async () => {
            await startPause({ from: today, reason, until: until || undefined }, today)
            syncToWatch(today).catch(() => undefined)
            setOpen(false)
          }}
        >
          Mettre en pause
        </button>
      </div>
    </section>
  ) : (
    <button className="btn-secondary w-full" onClick={() => setOpen(true)}>
      Pause : vacances, maladie, blessure
    </button>
  )
}

export function PlanScreen() {
  const today = todayISO()
  const [creating, setCreating] = useState(false)
  const [addingPerf, setAddingPerf] = useState(false)
  const [msg, setMsg] = useState('')
  const data = useDbQuery(async () => {
    const [cfg, goal, perfs] = await Promise.all([getPlanConfig(), getGoal(), getPerformances()])
    const assessment = goal ? await assess(goal, today) : undefined
    return { cfg, goal, perfs, assessment }
  }, [today])
  if (!data?.cfg) return null
  const { cfg, goal, perfs, assessment } = data
  const fitness = estimateFitness(perfs, today)
  const paces = fitness.vdot ? trainingPaces(fitness.vdot) : undefined
  const reprise = (cfg.mode ?? 'reprise') === 'reprise'
  const cycleWeek = (weekIndexOf(cfg.startDate, mondayOf(today)) % 4) + 1

  let phases: Phase[] = []
  let curIdx = -1
  if (goal) {
    const start = goal.planStart ?? mondayOf(today)
    phases = phasesFor(totalWeeks(start, goal.date), taperWeeksFor(goal))
    curIdx = goal.planStart ? Math.floor((new Date(mondayOf(today)).getTime() - new Date(mondayOf(goal.planStart)).getTime()) / (7 * 86400000)) : -1
  }
  const weeksLeft = goal ? Math.max(0, Math.ceil((new Date(goal.date).getTime() - new Date(today).getTime()) / (7 * 86400000))) : 0

  return (
    <div className="space-y-4">
      <PageTitle>Mon plan</PageTitle>

      {/* Objectif */}
      {goal ? (
        <section className="card space-y-3">
          <p className="text-sm text-muted">Objectif · {formatLongFr(goal.date)}</p>
          <h2 className="display text-2xl leading-tight">{goalLabel(goal)}</h2>
          <p>
            <strong className="num">{weeksLeft}</strong> semaine(s) restantes
            {reprise ? ' · le plan spécifique démarrera à la fin de ta reprise' : curIdx >= 0 && phases[curIdx] ? ` · phase ${PHASE_LABEL[phases[curIdx]].toLowerCase()}` : ''}
          </p>
          {phases.length > 0 && (
            <div>
              <div className="flex gap-0.5" role="img" aria-label={`Plan en ${phases.length} semaines : ${[...new Set(phases)].map((p) => PHASE_LABEL[p]).join(', ')}`}>
                {phases.map((p, i) => (
                  <span key={i} className={`h-3 flex-1 rounded-sm ${PHASE_COLOR[p]} ${i === curIdx ? 'ring-2 ring-offset-1 ring-ink ring-offset-surface' : ''}`} />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted">
                {[...new Set(phases)].map((p) => (
                  <li key={p} className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-sm ${PHASE_COLOR[p]}`} aria-hidden /> {PHASE_LABEL[p]} ({phases.filter((x) => x === p).length})
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted mt-1">Volume au pic visé : ~{peakMinutesFor(goal)} min/semaine.</p>
            </div>
          )}
          {assessment && (
            <details>
              <summary className="font-semibold min-h-[44px] flex items-center">Bilan à jour</summary>
              <AssessmentCard a={assessment} />
            </details>
          )}
          <button
            className="btn-secondary w-full text-danger"
            onClick={async () => {
              if (!confirm('Abandonner cet objectif ? Le plan repasse en Forme continue.')) return
              await abandonGoal(today)
              syncToWatch(today).catch(() => undefined)
            }}
          >
            Abandonner l’objectif
          </button>
        </section>
      ) : creating ? (
        <GoalForm today={today} onClose={() => setCreating(false)} />
      ) : (
        <section className="card">
          <p className="text-sm text-muted">Mode actuel</p>
          {reprise ? (
            <>
              <h2 className="display text-2xl">Reprise en douceur</h2>
              <p className="mt-1">
                Niveau <strong className="num">{cfg.repriseLevel}/{MAX_REPRISE_LEVEL}</strong> : {getLevel(cfg.repriseLevel).label}
              </p>
              <div className="flex gap-1 mt-3" aria-hidden>
                {Array.from({ length: MAX_REPRISE_LEVEL }, (_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < cfg.repriseLevel ? 'bg-accent-ink' : 'bg-line'}`} />
                ))}
              </div>
              <p className="text-sm text-muted mt-3">Objectif de la reprise : 30 min de course continue, sans douleur. Ensuite : Forme continue.</p>
            </>
          ) : (
            <>
              <h2 className="display text-2xl">Forme continue</h2>
              <p className="mt-1">
                Semaine <strong className="num">{cycleWeek}/4</strong> du cycle · base <strong className="num">{cfg.formeBaseMinutes} min</strong> de course
              </p>
              <p className="text-sm text-muted mt-2">3 semaines de charge (+8 % max) puis 1 allégée.</p>
            </>
          )}
          <button className="btn-primary w-full mt-4" onClick={() => setCreating(true)}>
            Fixer un objectif
          </button>
          <p className="text-xs text-muted mt-2">Le coach te dit d’abord où tu en es, le temps nécessaire et si c’est réaliste.</p>
        </section>
      )}

      {/* Ma forme */}
      <section className="card space-y-2">
        <h2 className="display text-lg">Ma forme</h2>
        <p className="text-[15px]">
          {fitness.vdot ? (
            <>
              VDOT <strong className="num">{fitness.vdot}</strong> ({fitness.confidence === 'mesuree' ? 'mesuré' : `estimé, entre ${fitness.low} et ${fitness.high}`})
            </>
          ) : (
            'Inconnue pour l’instant.'
          )}
        </p>
        <p className="text-sm text-muted">{fitness.basis}</p>
        {paces && (
          <table className="w-full text-sm num">
            <caption className="text-left text-muted text-xs pb-1">Allures d’entraînement</caption>
            <tbody>
              <tr className="border-t border-line"><td className="py-1">Facile</td><td className="text-right">{pace(paces.facile[0])} – {pace(paces.facile[1])}</td></tr>
              <tr className="border-t border-line"><td className="py-1">Marathon</td><td className="text-right">{pace(paces.marathon)}</td></tr>
              <tr className="border-t border-line"><td className="py-1">Seuil</td><td className="text-right">{pace(paces.seuil[0])} – {pace(paces.seuil[1])}</td></tr>
              <tr className="border-t border-line"><td className="py-1">Intervalles</td><td className="text-right">{pace(paces.intervalles[0])} – {pace(paces.intervalles[1])}</td></tr>
            </tbody>
          </table>
        )}
        {fitness.vdot && (
          <p className="text-sm text-muted">
            Chronos prédits aujourd’hui (si préparé) : {(['5k', '10k', 'semi', 'marathon'] as const).map((d) => `${DISTANCE_LABEL[d].replace('semi-marathon', 'semi')} ${formatTime(predictTimeSec(fitness.vdot!, DISTANCES[d]))}`).join(' · ')}
          </p>
        )}
        {reprise ? (
          <p className="text-sm text-muted">Le test de calibration (30 min) sera possible à la fin de la reprise.</p>
        ) : (
          <button
            className="btn-secondary w-full"
            onClick={async () => {
              const d = addDays(today, 2)
              await scheduleCalibrationTest(d, today)
              syncToWatch(today).catch(() => undefined)
              setMsg(`Test programmé le ${formatLongFr(d)} (modifiable dans Semaine).`)
            }}
          >
            Programmer le test 30 min
          </button>
        )}
        {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
      </section>

      {/* Performances */}
      <section className="card">
        <h2 className="display text-lg mb-2">Mes performances</h2>
        {perfs.length === 0 && <p className="text-sm text-muted">Ajoute tes records (même anciens) : ils servent de référence.</p>}
        <ul className="divide-y divide-line">
          {[...perfs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 gap-2">
              <span>
                <strong>{p.label}</strong> · <span className="num">{formatTime(p.timeSec)}</span>
                <span className="block text-xs text-muted">{formatLongFr(p.date)} · {p.source === 'test' ? 'test' : p.source === 'course' ? 'course' : 'record'}</span>
              </span>
              <button className="text-sm text-muted underline min-h-[44px] px-2" onClick={() => confirm('Supprimer cette performance ?') && removePerformance(p.id)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        {addingPerf ? <PerfForm onDone={() => setAddingPerf(false)} /> : (
          <button className="btn-secondary w-full mt-2" onClick={() => setAddingPerf(true)}>
            + Ajouter une performance
          </button>
        )}
      </section>

      <PauseCard paused={!!cfg.pause && cfg.pause.from <= today} from={cfg.pause?.from} today={today} />

      <Link to="/reglages#plan" className="btn-secondary w-full">
        Réglages du plan
      </Link>
    </div>
  )
}
