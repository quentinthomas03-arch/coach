import { useState } from 'react'
import { useDbQuery } from '../useDbQuery'
import type { DayAvailability, PlannedSession } from '../../data/types'
import { db } from '../../data/db'
import { getAvailability } from '../../app/config'
import { acceptVersion, addMySession, computePlan, markDone, moveSession, regenerate, rejectVersion, removeSession, setLocked, undoVersion } from '../../app/plan'
import { syncToWatch } from '../../app/sync'
import { addDays, formatLongFr, mondayOf, todayISO } from '../../domain/dates'
import { repriseWorkout } from '../../domain/reprise'
import { withRoutines, type FragileZone } from '../../domain/routines'
import { estimateDurationSec, toIntervalsText } from '../../domain/workout'
import { Choice } from '../components/Choice'
import { LockTag, StatusTag, WatchBadge, sessionSummary } from '../components/SessionBits'
import { DAY_NAMES, WeekEditor } from '../components/WeekEditor'
import { PageTitle } from '../Layout'

const afterChange = (today: string) => syncToWatch(today).catch(() => undefined)

function SessionSheet({ s, weekStart, today, onClose }: { s: PlannedSession; weekStart: string; today: string; onClose: () => void }) {
  const [moving, setMoving] = useState(false)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d >= today)
  const act = async (fn: () => Promise<unknown>) => {
    await fn()
    afterChange(today)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end" onClick={onClose}>
      <div
        role="dialog"
        aria-label={s.title}
        className="w-full bg-surface rounded-t-[24px] p-4 pb-[max(env(safe-area-inset-bottom),16px)] max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-line rounded-full mx-auto mb-3" />
        <p className="text-sm text-muted first-letter:uppercase">{formatLongFr(s.date)}</p>
        <h2 className="display text-2xl">{s.title}</h2>
        <p className="font-semibold mt-1">
          {sessionSummary(s)} · {s.durationMin} min
        </p>
        <ul className="text-sm text-muted list-disc pl-5 mt-2 space-y-1">
          {s.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {s.status === 'planned' && s.date >= today && (
          <>
            {moving ? (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Déplacer au…</p>
                <div className="grid grid-cols-2 gap-2">
                  {days
                    .filter((d) => d !== s.date)
                    .map((d) => (
                      <button key={d} className="btn-secondary first-letter:uppercase" onClick={() => act(() => moveSession(s.id, d, today))}>
                        {formatLongFr(d).split(' ').slice(0, 2).join(' ')}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button className="btn-secondary" onClick={() => setMoving(true)}>
                  Déplacer
                </button>
                <button className="btn-secondary" onClick={() => act(() => setLocked(s.id, !s.locked))}>
                  {s.locked ? 'Déverrouiller' : 'Verrouiller'}
                </button>
                <button className="btn-secondary" onClick={() => act(() => markDone(s.id, 5))}>
                  Marquer faite
                </button>
                <button className="btn-secondary text-danger" onClick={() => act(() => removeSession(s.id, today))}>
                  Retirer
                </button>
              </div>
            )}
            <p className="text-xs text-muted mt-3">Verrouillée = le coach n’y touche plus. Déplacer ou retirer la verrouille automatiquement.</p>
          </>
        )}
        <button className="btn-secondary w-full mt-3" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  )
}

function AddSession({ weekStart, today, onClose }: { weekStart: string; today: string; onClose: () => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d >= today)
  const [date, setDate] = useState(days[0])
  const [minutes, setMinutes] = useState(40)
  return (
    <section className="card space-y-3">
      <h2 className="display text-lg">Ajouter une course facile</h2>
      <Choice cols={2} value={date} onChange={setDate} options={days.map((d) => ({ value: d, label: formatLongFr(d).split(' ').slice(0, 2).join(' ') }))} />
      <Choice cols={4} value={minutes} onChange={setMinutes} options={[30, 40, 50, 60].map((m) => ({ value: m, label: `${m}′` }))} />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button
          className="btn-primary"
          onClick={async () => {
            const base = repriseWorkout(9)
            base.blocks[1].steps[0].durationSec = Math.max(5, minutes - 19) * 60
            const w = withRoutines(base, ((await db.profile.get('me'))?.injuries ?? []) as FragileZone[])
            await addMySession(
              { date, kind: 'endurance', title: 'Course facile (ajoutée)', durationMin: Math.round(estimateDurationSec(w) / 60), workout: w, workoutText: toIntervalsText(w), reasons: ['Ajoutée par toi.'] },
              today,
            )
            afterChange(today)
            onClose()
          }}
        >
          Ajouter
        </button>
      </div>
    </section>
  )
}

function Availability({ weekStart, today }: { weekStart: string; today: string }) {
  const data = useDbQuery(() => getAvailability(weekStart), [weekStart])
  const [draft, setDraft] = useState<DayAvailability[] | null>(null)
  if (!data) return null
  const days = draft ?? data.days
  return (
    <details className="card">
      <summary className="display text-lg min-h-[44px] flex items-center">Mes dispos cette semaine {data.specific ? '' : '(semaine type)'}</summary>
      <WeekEditor days={days} onChange={setDraft} />
      {draft && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button className="btn-secondary" onClick={() => setDraft(null)}>
            Annuler
          </button>
          <button
            className="btn-primary"
            onClick={async () => {
              await db.availability.put({ weekStart, days: draft, updatedAt: new Date().toISOString() })
              setDraft(null)
              await regenerate('Dispos de la semaine modifiées', today)
              afterChange(today)
            }}
          >
            Enregistrer
          </button>
        </div>
      )}
    </details>
  )
}

export function Week() {
  const today = todayISO()
  const [offset, setOffset] = useState(0)
  const [open, setOpen] = useState<PlannedSession | null>(null)
  const [adding, setAdding] = useState(false)
  const weekStart = addDays(mondayOf(today), offset * 7)
  const end = addDays(weekStart, 7)
  const sessions = useDbQuery(() => db.sessions.where('date').between(weekStart, end, true, false).sortBy('date'), [weekStart])
  const versions = useDbQuery(() => db.planVersions.orderBy('id').reverse().limit(15).toArray(), [])
  const notes = useDbQuery(async () => (await computePlan(today)).notes, [today, sessions?.length])
  const pending = versions?.find((v) => v.status === 'pending')

  return (
    <div className="space-y-4">
      <PageTitle>Semaine</PageTitle>
      <div className="grid grid-cols-2 gap-2">
        <button className={offset === 0 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(0)}>
          Cette semaine
        </button>
        <button className={offset === 1 ? 'btn-primary' : 'btn-secondary'} onClick={() => setOffset(1)}>
          La suivante
        </button>
      </div>

      {pending && (
        <section className="card border-warn/50">
          <h2 className="display text-lg">Le coach propose des changements</h2>
          <p className="text-sm text-muted">{pending.cause}</p>
          <ul className="text-sm list-disc pl-5 my-2 space-y-1">
            {pending.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => rejectVersion(pending.id!)}>
              Refuser
            </button>
            <button className="btn-primary" onClick={() => acceptVersion(pending.id!).then(() => afterChange(today))}>
              Accepter
            </button>
          </div>
        </section>
      )}

      <ol className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
          const list = (sessions ?? []).filter((s) => s.date === d)
          return (
            <li key={d} className={`card py-3 ${d === today ? 'ring-2 ring-accent-ink' : ''} ${d < today ? 'bg-surface2' : ''}`}>
              <p className="text-sm font-semibold text-muted">
                {DAY_NAMES[i]} {Number(d.slice(8))}
              </p>
              {list.length === 0 && <p className="text-muted">Repos</p>}
              {list.map((s) => (
                <button key={s.id} className="w-full text-left mt-1 min-h-[44px]" onClick={() => setOpen(s)}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${s.status === 'skipped' ? 'line-through text-muted' : ''}`}>
                      {s.title} · {s.durationMin} min
                    </span>
                    <WatchBadge s={s} />
                  </span>
                  <span className="flex gap-3">
                    <StatusTag s={s} />
                    <LockTag s={s} />
                  </span>
                </button>
              ))}
            </li>
          )
        })}
      </ol>

      {notes && notes.length > 0 && offset === 0 && (
        <section className="card">
          <h2 className="display text-lg mb-1">Remarques du coach</h2>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            {[...new Set(notes)].map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {adding ? <AddSession weekStart={weekStart} today={today} onClose={() => setAdding(false)} /> : (
        <button className="btn-secondary w-full" onClick={() => setAdding(true)}>
          + Ajouter une séance
        </button>
      )}

      <Availability weekStart={weekStart} today={today} />

      <details className="card">
        <summary className="display text-lg min-h-[44px] flex items-center">Ce qui a changé</summary>
        <ul className="space-y-3 mt-2">
          {(versions ?? [])
            .filter((v) => v.status !== 'pending')
            .map((v) => (
              <li key={v.id} className="border-t border-line pt-2">
                <p className="text-sm font-semibold">
                  {new Date(v.createdAt).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {v.cause}
                  {v.status === 'undone' && <span className="text-muted"> (annulé)</span>}
                  {v.status === 'rejected' && <span className="text-muted"> (refusé)</span>}
                </p>
                <ul className="text-sm text-muted list-disc pl-5">
                  {v.changes.slice(0, 6).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                  {v.changes.length > 6 && <li>… et {v.changes.length - 6} autre(s)</li>}
                </ul>
                {v.status === 'applied' && v.before.length > 0 && (
                  <button className="text-sm font-semibold underline min-h-[44px]" onClick={() => undoVersion(v.id!).then(() => afterChange(today))}>
                    Annuler ce changement
                  </button>
                )}
              </li>
            ))}
        </ul>
      </details>

      {open && <SessionSheet s={open} weekStart={weekStart} today={today} onClose={() => setOpen(null)} />}
    </div>
  )
}
