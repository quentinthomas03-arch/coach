import { useState } from 'react'
import { useDbQuery } from '../useDbQuery'
import { Link, useNavigate } from 'react-router-dom'
import type { MorningCheckin, PlannedSession } from '../../data/types'
import { db } from '../../data/db'
import { addFragileZone, dismissProposal, loadToday, type TodayView } from '../../app/daily'
import { applyProposal, markDone, markMissed } from '../../app/plan'
import { saveActivityRpe } from '../../app/importer'
import { setWaterEstimate } from '../../app/nutrition'
import { addDays } from '../../domain/dates'
import { getGoal, resultsAwaited, saveTestResult, TEST_TITLE } from '../../app/goals'
import { parseTime, DISTANCES } from '../../domain/paces'
import { useDbQuery as useResults } from '../useDbQuery'
import { nutritionDay } from '../../app/nutrition'
import { WaterButtons } from './Nutrition'
import { Gauge } from '../components/Segmented'
import { activityLabel } from '../../domain/activities'
import { syncToWatch } from '../../app/sync'
import { formatLongFr, todayISO } from '../../domain/dates'
import type { CoachMessage } from '../../domain/coach'
import { Scale5 } from '../components/Segmented'
import { Choice } from '../components/Choice'
import { LockTag, StatusTag, WatchBadge, sessionSummary } from '../components/SessionBits'

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
            <button className="btn-secondary w-full mt-2" onClick={() => addFragileZone(m.action!.zone, today).then(() => syncToWatch(today))}>
              {m.action.label}
            </button>
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
    <section className="card space-y-3" aria-label="Check du matin">
      <h2 className="display text-lg">Check du matin</h2>
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
    <section className="card" aria-label={`Séance : ${s.title}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {s.kind === 'renfo' ? 'Renfo' : s.kind === 'repos' ? 'Repos' : 'Course'} · {s.durationMin} min
        </p>
        <WatchBadge s={s} />
      </div>
      <h2 className="display text-2xl leading-tight mt-1">{s.title}</h2>
      <p className="num text-lg font-semibold mt-2">{sessionSummary(s)}</p>
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
        <button className="btn-secondary w-full mt-3" onClick={() => nav('/routine/etirements')}>
          Étirements guidés (5 min)
        </button>
      )}
    </section>
  )
}

function ReadinessBadge({ view }: { view: TodayView }) {
  const r = view.readiness
  if (!r) return null
  const c = { vert: 'bg-ok', orange: 'bg-warn', rouge: 'bg-danger' }[r.color]
  return (
    <section className="card flex items-start gap-3" aria-label="Forme du jour">
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
    <Link to="/tabac" className="card block">
      <p className="text-sm text-muted">Arrêt du tabac</p>
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
    <section className="card space-y-2" aria-label="Préparer la semaine">
      <h2 className="display text-lg">Prépare ta semaine</h2>
      <p className="text-sm text-muted">30 secondes : tes dispos, un œil sur le plan, puis le menu et la liste de courses.</p>
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
  if (!d || !d.targets) return null
  return (
    <section className="card space-y-3" aria-label="Nutrition et eau">
      <Link to="/nutrition" className="flex items-baseline justify-between">
        <h2 className="display text-lg">Nutrition</h2>
        <span className="num font-semibold">
          {d.eaten.kcal} <span className="text-sm text-muted font-normal">/ {d.targets.kcal} kcal ›</span>
        </span>
      </Link>
      <Gauge label="Protéines" value={d.eaten.protein} target={d.targets.protein} unit="g" />
      <Gauge label="Eau" value={Math.round(d.waterMl / 10) / 100} target={Math.round(d.hydration.ml / 10) / 100} unit="L" />
      <WaterButtons date={today} bottleMl={d.bottleMl} />
      {d.waterSource === 'montre' && <p className="text-xs text-muted">Eau enregistrée sur ta montre.</p>}
      {d.tips && <p className="text-sm text-muted">{d.tips.avant[0]}</p>}
    </section>
  )
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
      <div>
        <p className="text-muted text-sm first-letter:uppercase">{formatLongFr(today)}</p>
        <h1 className="display text-3xl leading-tight">{greeting()}</h1>
      </div>
      {view.pause && (
        <Link to="/plan" className="block rounded-card border border-warn/40 bg-warn/10 px-4 py-3">
          <strong>Plan en pause</strong> ({view.pause.reason}). Repose-toi bien. Touche ici pour reprendre quand tu es prêt.
        </Link>
      )}
      <Messages list={view.messages} today={today} />
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
        <section className="card">
          <h2 className="display text-xl">Repos aujourd’hui</h2>
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
      <SundayCard />
      <NutritionCard today={today} />
      <TabacCard view={view} />
    </div>
  )
}
