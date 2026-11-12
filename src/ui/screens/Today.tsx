import { useState } from 'react'
import { useDbQuery } from '../useDbQuery'
import { Link, useNavigate } from 'react-router-dom'
import type { MorningCheckin, PlannedSession } from '../../data/types'
import { db } from '../../data/db'
import { addFragileZone, dismissProposal, loadToday, type TodayView } from '../../app/daily'
import { applyProposal, givePaceFeedback, markDone, markMissed, shortenSession } from '../../app/plan'
import { saveActivityRpe } from '../../app/importer'
import { setWaterEstimate } from '../../app/nutrition'
import { addDays } from '../../domain/dates'
import { getGoal, resultsAwaited, saveTestResult, TEST_TITLE } from '../../app/goals'
import { parseTime, DISTANCES } from '../../domain/paces'
import { useDbQuery as useResults } from '../useDbQuery'
import { nutritionDay } from '../../app/nutrition'
import { WaterButtons } from './Nutrition'
import { Gauge } from '../components/Segmented'
import { Rings, type Ring } from '../components/Rings'
import { activityLabel } from '../../domain/activities'
import { syncToWatch } from '../../app/sync'
import { formatLongFr, todayISO } from '../../domain/dates'
import type { CoachMessage } from '../../domain/coach'
import { Scale5 } from '../components/Segmented'
import { Choice } from '../components/Choice'
import { WeatherCard } from '../components/WeatherCard'
import { newRecords } from '../../domain/progress'
import { LockTag, StatusTag, WatchBadge, WorkoutSteps, sessionSummary } from '../components/SessionBits'

const ZONES = ['Genou', 'Mollet', 'Tendon d’Achille', 'Cheville', 'Hanche', 'Dos', 'Pied', 'Autre']

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bonjour' : h < 18 ? 'Salut' : 'Bonsoir'
}

function Messages({ list, today }: { list: CoachMessage[]; today: string }) {
  if (!list.length) return null
  const style = {
    alerte: 'border-danger/40 bg-danger/10',
    recadrage: 'border-warn/40 bg-warn/10',
    bravo: 'border-ok/40 bg-ok/10',
    info: 'border-line bg-surface',
  }
  return (
    <section aria-label="Le coach" className="space-y-2">
      {list.map((m) => (
        <div key={m.rule} className={`rounded-card border px-4 py-3 text-[15px] leading-snug ${style[m.kind]}`}>
          <p>
            <span className="sr-only">{m.kind} : </span>
            {m.text}
          </p>
          {m.action?.type === 'add-zone' && (
            <button className="btn-secondary w-full mt-2" onClick={() => m.action?.type === 'add-zone' && addFragileZone(m.action.zone, today).then(() => syncToWatch(today))}>
              {m.action.label}
            </button>
          )}
          {m.action?.type === 'pace-feedback' && (
            <button className="btn-secondary w-full mt-2" onClick={() => m.action?.type === 'pace-feedback' && givePaceFeedback(m.action.sessionId, m.action.fb, today).then(() => syncToWatch(today))}>
              {m.action.label}
            </button>
          )}
          {m.action?.type === 'link' && (
            <Link to={m.action.to} className="btn-secondary w-full mt-2">
              {m.action.label}
            </Link>
          )}
        </div>
      ))}
    </section>
  )
}

function CheckinCard({ today, initial, tabacPrep }: { today: string; initial?: MorningCheckin; tabacPrep: boolean }) {
  const [c, setC] = useState<Partial<MorningCheckin>>(initial ?? {})
  const [pain, setPain] = useState(!!initial?.douleur)
  const [open, setOpen] = useState(!initial)
  const ready = c.physique && c.moral && c.travail && c.viePerso && (!pain || (c.douleur?.zone && c.douleur.intensite))
  const save = async () => {
    await db.checkins.put({ ...(c as MorningCheckin), douleur: pain ? c.douleur : undefined, date: today, at: new Date().toISOString() })
    await setWaterEstimate(addDays(today, -1), c.eauHier)
    setOpen(false)
  }
  if (!open)
    return (
      <button className="btn-secondary w-full" onClick={() => setOpen(true)}>
        Modifier mon check du matin
      </button>
    )
  return (
    <section className="card tint tint-course space-y-3" aria-label="Check du matin">
      <h2 className="display text-lg flex items-center gap-2">
        <span className="chip" aria-hidden>☀️</span> Check du matin
      </h2>
      <Scale5 label="Forme physique" value={c.physique} onChange={(v) => setC({ ...c, physique: v })} low="épuisé" high="au top" />
      <Scale5 label="Moral" value={c.moral} onChange={(v) => setC({ ...c, moral: v })} low="bas" high="excellent" />
      <Scale5 label="Charge de travail" value={c.travail} onChange={(v) => setC({ ...c, travail: v })} low="débordé" high="léger" />
      <Scale5 label="Vie perso" value={c.viePerso} onChange={(v) => setC({ ...c, viePerso: v })} low="tendu" high="serein" />
      <Choice
        label="Hier soir"
        cols={3}
        value={c.alcool ?? 'aucun'}
        onChange={(v) => setC({ ...c, alcool: v, sortie: v !== 'aucun' || c.sortie })}
        options={[
          { value: 'aucun', label: 'Pas d’alcool' },
          { value: '1-2', label: '1-2 verres' },
          { value: '3+', label: '3 et +' },
        ]}
      />
      <Choice
        label="Hier, tu as bu (eau, tisane…)"
        cols={4}
        value={c.eauHier}
        onChange={(v) => setC({ ...c, eauHier: v })}
        options={[
          { value: 'moins-1', label: '< 1 L' },
          { value: '1-1.5', label: '1-1,5 L' },
          { value: '1.5-2', label: '1,5-2 L' },
          { value: 'plus-2', label: '> 2 L' },
        ]}
      />
      {tabacPrep && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cigarettes hier</span>
          <input type="number" inputMode="numeric" min={0} aria-label="Cigarettes fumées hier" className="field w-24 text-center" value={c.cigarettes ?? ''} onChange={(e) => setC({ ...c, cigarettes: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
      )}
      <Choice cols={2} value={pain ? 'oui' : 'non'} onChange={(v) => setPain(v === 'oui')} label="Une douleur ?" options={[{ value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui' }]} />
      {pain && (
        <>
          <Choice cols={2} value={c.douleur?.zone} onChange={(zone) => setC({ ...c, douleur: { intensite: c.douleur?.intensite ?? 1, zone } })} options={ZONES.map((z) => ({ value: z, label: z }))} />
          <Choice
            cols={3}
            value={c.douleur?.intensite}
            onChange={(intensite) => setC({ ...c, douleur: { zone: c.douleur?.zone ?? 'Autre', intensite } })}
            options={[
              { value: 1, label: 'Gêne' },
              { value: 2, label: 'Douleur' },
              { value: 3, label: 'Forte' },
            ]}
          />
        </>
      )}
      <button className="btn-primary w-full" disabled={!ready} onClick={save}>
        Valider
      </button>
    </section>
  )
}

function RpePicker({ onPick, onCancel }: { onPick: (n: number) => void; onCancel: () => void }) {
  return (
    <div className="mt-3">
      <p className="text-sm font-medium mb-2">C’était dur comment ? (1 = très facile, 10 = à bloc)</p>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button key={n} className="h-11 rounded-btn bg-surface2 border border-line num font-semibold" onClick={() => onPick(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="text-sm text-muted mt-2 min-h-[44px]" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}

function SessionCard({ s, view }: { s: PlannedSession; view: TodayView }) {
  const [rpe, setRpe] = useState(false)
  const nav = useNavigate()
  const proposal = view.proposals.find((p) => p.session.id === s.id)
  return (
    <section className={`card tint ${s.kind === 'renfo' ? 'tint-renfo' : s.kind === 'repos' ? 'tint-sommeil' : 'tint-course'}`} aria-label={`Séance : ${s.title}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <span className="chip" aria-hidden>{s.kind === 'renfo' ? '💪' : s.kind === 'repos' ? '😴' : '🏃'}</span>
          {s.kind === 'renfo' ? 'Renfo' : s.kind === 'repos' ? 'Repos' : 'Course'} · {s.durationMin} min
        </p>
        <WatchBadge s={s} />
      </div>
      <h2 className="display text-2xl leading-tight mt-1">{s.title}</h2>
      <p className="num text-lg font-semibold mt-2">{sessionSummary(s)}</p>
      {s.kind !== 'renfo' && (
        <details className="mt-1" open>
          <summary className="text-sm font-semibold min-h-[40px] flex items-center">Déroulé et allures</summary>
          <WorkoutSteps s={s} />
        </details>
      )}
      <div className="flex gap-3 mt-1">
        <StatusTag s={s} />
        <LockTag s={s} />
      </div>
      <details className="mt-2">
        <summary className="text-sm font-semibold min-h-[44px] flex items-center">Pourquoi cette séance ?</summary>
        <ul className="text-sm text-muted space-y-1 list-disc pl-5">
          {s.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      {proposal && (
        <div className="mt-3 rounded-card border border-warn/40 bg-warn/10 p-3">
          <p className="text-sm">
            <strong>Le coach propose :</strong> {proposal.why}
          </p>
          {proposal.change === 'allegee' && <p className="text-sm mt-1">→ {sessionSummary(proposal.session)} ({proposal.session.durationMin} min)</p>}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="btn-secondary" onClick={() => dismissProposal(view.today, s.id)}>
              Je garde ma séance
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                await applyProposal(proposal.session, 'Forme du jour')
                syncToWatch(view.today)
              }}
            >
              D’accord
            </button>
          </div>
        </div>
      )}

      {s.status === 'planned' && s.kind !== 'repos' && s.kind !== 'renfo' && !rpe && s.durationMin > 25 && (
        <div className="mt-3">
          <p className="text-sm font-medium mb-1.5">Pas le temps ? Je n’ai que :</p>
          <div className="flex gap-1.5">
            {[20, 30, 45].filter((m) => m < s.durationMin - 2).map((m) => (
              <button key={m} className="btn-secondary px-3 min-h-[44px] text-sm" onClick={() => shortenSession(s.id, m, view.today).then(() => syncToWatch(view.today))}>
                {m} min
              </button>
            ))}
          </div>
        </div>
      )}
      {s.status === 'planned' && s.kind !== 'repos' && !rpe && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          {s.kind === 'renfo' ? (
            <button className="btn-primary col-span-2" onClick={() => nav(`/renfo/${s.id}`)}>
              Commencer le renfo
            </button>
          ) : (
            <>
              <button className="btn-primary col-span-2" onClick={() => nav('/routine/echauffement')}>
                Échauffement guidé (4 min)
              </button>
              <button className="btn-secondary col-span-2" onClick={() => setRpe(true)}>
                C’est fait
              </button>
            </>
          )}
          {s.kind === 'renfo' && (
            <button className="btn-secondary" onClick={() => setRpe(true)}>
              Déjà faite
            </button>
          )}
          <button className={`btn-secondary ${s.kind === 'renfo' ? '' : 'col-span-2'}`} onClick={() => markMissed(s.id, view.today).then(() => syncToWatch(view.today))}>
            Pas faite
          </button>
        </div>
      )}
      {rpe && (
        <RpePicker
          onCancel={() => setRpe(false)}
          onPick={async (n) => {
            await markDone(s.id, n)
            setRpe(false)
          }}
        />
      )}
      {s.status === 'done' && s.kind !== 'renfo' && (
        <>
          <button className="btn-secondary w-full mt-3" onClick={() => nav('/routine/etirements')}>
            Étirements guidés (5 min)
          </button>
          {!s.paceFeedback ? (
            <div className="mt-3">
              <p className="text-sm font-medium mb-1.5">Les allures demandées étaient :</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['trop-lent', 'Trop faciles'],
                    ['bien', 'Bien'],
                    ['trop-rapide', 'Trop dures'],
                  ] as const
                ).map(([v, l]) => (
                  <button key={v} className="btn-secondary px-2 text-sm" onClick={() => givePaceFeedback(s.id, v, view.today).then(() => syncToWatch(view.today))}>
                    {l}
                  </button>
                ))}
              </div>
              <Link to="/reglages#seances" className="text-sm underline text-muted inline-block mt-2 min-h-[32px]">
                Autre correction (marche, échauffement…)
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted mt-2">
              Retour noté : allures {s.paceFeedback === 'bien' ? 'bien dosées' : s.paceFeedback === 'trop-lent' ? 'trop faciles, les prochaines seront un peu plus rapides' : 'trop dures, les prochaines seront un peu plus lentes'}.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function ReadinessBadge({ view }: { view: TodayView }) {
  const r = view.readiness
  if (!r) return null
  const c = { vert: 'bg-ok', orange: 'bg-warn', rouge: 'bg-danger' }[r.color]
  return (
    <section className="card tint tint-course flex items-start gap-3" aria-label="Forme du jour">
      <span className={`mt-1 w-3.5 h-3.5 rounded-full shrink-0 ${c}`} aria-hidden />
      <div>
        <p className="font-semibold">
          Forme du jour : {r.color} <span className="num text-muted font-normal">({r.score}/100)</span>
        </p>
        <p className="text-sm text-muted">{r.reasons.join(' ')}</p>
      </div>
    </section>
  )
}

function TabacCard({ view }: { view: TodayView }) {
  const t = view.tabac
  if (!t) return null
  return (
    <Link to="/tabac" className="card tint tint-tabac block">
      <p className="text-sm font-medium flex items-center gap-2">
        <span className="chip" aria-hidden>🚭</span> Arrêt du tabac
      </p>
      {t.phase === 'preparation' ? (
        <p className="display text-xl">J−{t.daysUntilQuit}</p>
      ) : (
        <p className="display text-xl">
          {t.daysSmokeFree} jour{(t.daysSmokeFree ?? 0) > 1 ? 's' : ''} sans tabac · <span className="num">{Math.round(t.moneySaved ?? 0)} €</span>
        </p>
      )}
      <p className="text-sm text-muted mt-1">Voir le détail et le bouton SOS envie ›</p>
    </Link>
  )
}

/** Le dimanche (et le samedi soir) : préparer la semaine suivante en 30 secondes. */
function SundayCard() {
  const wd = new Date().getDay()
  const hour = new Date().getHours()
  if (!(wd === 0 || (wd === 6 && hour >= 17))) return null
  return (
    <section className="card tint tint-course space-y-2" aria-label="Préparer la semaine">
      <h2 className="display text-lg">Bilan et semaine à venir</h2>
      <p className="text-sm text-muted">Lis le bilan du coach, puis 30 secondes pour tes dispos, le menu et les courses.</p>
      <Link to="/bilan" className="btn-primary w-full">
        Mon bilan de la semaine
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/semaine" className="btn-secondary">
          Dispos et plan
        </Link>
        <Link to="/nutrition" className="btn-secondary">
          Menu et courses
        </Link>
      </div>
      <p className="text-xs text-muted">Pense aussi à sauvegarder (Réglages) si ça fait un moment.</p>
    </section>
  )
}

function NutritionCard({ today }: { today: string }) {
  const d = useResults(() => nutritionDay(today), [today])
  if (!d) return null
  return (
    <section className="card tint tint-nutri space-y-3" aria-label="Nutrition et eau">
      <Link to="/nutrition" className="flex items-center justify-between">
        <h2 className="display text-lg flex items-center gap-2">
          <span className="chip" aria-hidden>🍽️</span> Nutrition
        </h2>
        <span className="text-sm text-muted">Assiette et menu ›</span>
      </Link>
      <Gauge label="Eau 💧" value={Math.round(d.waterMl / 10) / 100} target={Math.round(d.hydration.ml / 10) / 100} unit="L" color="eau" />
      <WaterButtons date={today} bottleMl={d.bottleMl} />
      {d.waterSource === 'montre' && <p className="text-xs text-muted">Eau enregistrée sur ta montre.</p>}
      {(() => {
        const h = new Date().getHours()
        const next = h < 14 ? { label: 'Ce midi', p: d.plates.dejeuner } : h < 22 ? { label: 'Ce soir', p: d.plates.diner } : undefined
        return next ? (
          <p className="text-sm">
            <span className="font-semibold">{next.label} : </span>
            {next.p.text}
          </p>
        ) : null
      })()}
    </section>
  )
}

const STATUS_LABEL = { productif: '📈 Productif', maintien: '➡️ Maintien', surcharge: '⚠️ Surcharge', recuperation: '🔋 Récupération', desentrainement: '📉 Désentraînement', demarrage: '' } as const

function TodayRings({ view }: { view: TodayView }) {
  const n = useResults(() => nutritionDay(view.today), [view.today])
  const rings: Ring[] = [
    { label: 'Séances', value: view.week.done, target: Math.max(1, view.week.planned), color: '--c-course', text: `${view.week.done}/${view.week.planned} sem.` },
    { label: 'Eau', value: n?.waterMl ?? 0, target: n?.hydration.ml ?? 2000, color: '--c-eau', text: `${((n?.waterMl ?? 0) / 1000).toFixed(1).replace('.', ',')} L` },
    { label: 'Sommeil', value: view.sleepLastNight ?? 0, target: 7.5, color: '--c-sommeil', text: view.sleepLastNight != null ? `${view.sleepLastNight.toFixed(1).replace('.', ',')} h` : '—' },
  ]
  return <Rings rings={rings} />
}

function Results({ today }: { today: string }) {
  const list = useResults(() => resultsAwaited(today), [today])
  return <>{(list ?? []).map((s) => <ResultCard key={s.id} s={s} today={today} />)}</>
}

function ResultCard({ s, today }: { s: PlannedSession; today: string }) {
  const [v, setV] = useState('')
  const isTest = s.title === TEST_TITLE
  const goal = useResults(() => getGoal(), [])
  const parsed = isTest ? Number(v.replace(',', '.')) : parseTime(v)
  const ok = isTest ? parsed != null && parsed > 1 && parsed < 12 : !!parsed
  return (
    <section className="card space-y-2" aria-label="Résultat à saisir">
      <p className="text-sm text-muted">Résultat à saisir</p>
      <p className="font-semibold">{isTest ? 'Distance parcourue pendant les 30 min du test (km)' : 'Ton temps sur la course objectif'}</p>
      <div className="flex gap-2">
        <input className="field" inputMode={isTest ? 'decimal' : 'text'} placeholder={isTest ? 'ex. 5,8' : 'ex. 48:30'} value={v} onChange={(e) => setV(e.target.value)} aria-label="Résultat" />
        <button
          className="btn-primary shrink-0"
          disabled={!ok}
          onClick={() => {
            const distanceM = isTest ? parsed! * 1000 : goal?.type === 'trail' ? (goal.trailKm ?? 0) * 1000 : DISTANCES[goal?.distance ?? '10k']
            const timeSec = isTest ? 1800 : (parsed as number)
            saveTestResult(s, { distanceM, timeSec }, today)
          }}
        >
          Valider
        </button>
      </div>
      <p className="text-xs text-muted">Tes allures et prédictions seront recalculées.</p>
    </section>
  )
}

export function Today() {
  const today = todayISO()
  const view = useDbQuery(() => loadToday(today), [today])
  if (!view) return null
  return (
    <div className="space-y-4">
      <header className="hero rounded-card border border-line px-4 py-5">
        <p className="text-sm font-medium first-letter:uppercase">{formatLongFr(today)}</p>
        <h1 className="display text-3xl leading-tight">{greeting()}</h1>
        {view.readiness ? (
          <p className="mt-1 font-semibold">
            Forme du jour : <span className={{ vert: 'text-ok', orange: 'text-warn', rouge: 'text-danger' }[view.readiness.color]}>{view.readiness.color}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm">Ton check du matin en 15 secondes, et le coach s’occupe du reste.</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {view.streak > 0 && <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold">🔥 {view.streak} semaine{view.streak > 1 ? 's' : ''} régulière{view.streak > 1 ? 's' : ''}</span>}
          {view.status !== 'demarrage' && <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold">{STATUS_LABEL[view.status]}</span>}
          {view.recoveryLeftH > 0 && <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-semibold">⏳ Récup : encore ~{view.recoveryLeftH} h</span>}
        </div>
        <TodayRings view={view} />
      </header>
      {view.pause && (
        <Link to="/plan" className="block rounded-card border border-warn/40 bg-warn/10 px-4 py-3">
          <strong>Plan en pause</strong> ({view.pause.reason}). Repose-toi bien. Touche ici pour reprendre quand tu es prêt.
        </Link>
      )}
      <Messages list={view.messages} today={today} />
      {!view.pause && <WeatherCard today={today} />}
      <RaceSoon today={today} />
      <NewRecords today={today} />
      <Results today={today} />
      {view.awaitingRpe.map((a) => (
        <section key={a.id} className="card" aria-label="Séance détectée">
          <p className="text-sm text-muted">Séance détectée sur ta montre</p>
          <p className="font-semibold">{activityLabel(a)}</p>
          <p className="text-sm font-medium mt-2 mb-1.5">C’était dur comment ? (1 = très facile, 10 = à bloc)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button key={n} className="h-11 rounded-btn bg-surface2 border border-line num font-semibold" onClick={() => saveActivityRpe(a.id, n)}>
                {n}
              </button>
            ))}
          </div>
        </section>
      ))}
      {!view.checkin ? <CheckinCard today={today} tabacPrep={view.tabac?.phase === 'preparation'} /> : <ReadinessBadge view={view} />}
      {view.todaySessions.length ? (
        view.todaySessions.map((s) => <SessionCard key={s.id} s={s} view={view} />)
      ) : (
        <section className="card tint tint-sommeil">
          <h2 className="display text-xl flex items-center gap-2">
            <span className="chip" aria-hidden>🌿</span> Repos aujourd’hui
          </h2>
          <p className="text-muted text-sm mt-1">Récupérer fait partie de l’entraînement. Une marche tranquille est toujours une bonne idée.</p>
        </section>
      )}
      {view.checkin && <CheckinCard key={view.checkin.at} today={today} initial={view.checkin} tabacPrep={view.tabac?.phase === 'preparation'} />}
      {view.tomorrow.length > 0 && (
        <section className="card">
          <p className="text-sm text-muted">Demain</p>
          {view.tomorrow.map((s) => (
            <p key={s.id} className="font-semibold">
              {s.title} · {s.durationMin} min
            </p>
          ))}
        </section>
      )}
      {view.bedtimeTonight && new Date().getHours() >= 15 && (
        <section className="card tint tint-sommeil" aria-label="Sommeil">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="chip" aria-hidden>🌙</span> Ce soir
          </p>
          <p className="font-semibold">
            Au lit vers <span className="num">{view.bedtimeTonight.time}</span> ({view.bedtimeTonight.why}).
          </p>
        </section>
      )}
      <Link to="/notes" className="btn-secondary w-full">
        + Une note pour le coach
      </Link>
      <SundayCard />
      <NutritionCard today={today} />
      <TabacCard view={view} />
    </div>
  )
}

/** Semaine de course : lien vers le plan de course. */
function RaceSoon({ today }: { today: string }) {
  const goal = useDbQuery(() => getGoal(), [])
  if (!goal || goal.date < today || goal.date > addDays(today, 7)) return null
  const n = Math.round((Date.parse(goal.date) - Date.parse(today)) / 86400000)
  return (
    <Link to="/plan#jour-j" className="card tint tint-course block">
      <p className="font-semibold">🏁 {n === 0 ? 'C’est le jour J !' : n === 1 ? 'Course demain' : `Course dans ${n} jours`} : {goal.name ?? 'ton objectif'}</p>
      <p className="text-sm text-muted">Allures, repas, échauffement et sac de la veille : ton plan de course est prêt.</p>
    </Link>
  )
}

/** Record battu ces 3 derniers jours : le coach félicite. */
function NewRecords({ today }: { today: string }) {
  const recs = useDbQuery(async () => newRecords(await db.activities.toArray(), addDays(today, -2), today), [today])
  if (!recs?.length) return null
  return (
    <Link to="/suivi" className="card tint tint-course block">
      <p className="font-semibold">🏆 Nouveau record !</p>
      <ul className="text-[15px]">
        {recs.map((r) => (
          <li key={r.id}>
            {r.label} : <b className="num">{r.value}</b>
          </li>
        ))}
      </ul>
    </Link>
  )
}
