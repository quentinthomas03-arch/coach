import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../data/db'
import { giveStrengthFeedback, markDone } from '../../app/plan'
import type { ExerciseFeedback } from '../../domain/strength'
import { todayISO } from '../../domain/dates'
import { formatPrescription } from '../../domain/strength'
import { buildSteps } from '../../domain/strengthSteps'

/** Petit bip (Web Audio) ; l'iPhone doit ne pas être en mode silencieux. */
function useBeep() {
  const ctx = useRef<AudioContext | null>(null)
  return (freq = 880, ms = 180) => {
    try {
      ctx.current ??= new AudioContext()
      const o = ctx.current.createOscillator()
      const g = ctx.current.createGain()
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.current.destination)
      o.start()
      g.gain.setValueAtTime(0.3, ctx.current.currentTime)
      o.stop(ctx.current.currentTime + ms / 1000)
    } catch {
      /* son indisponible */
    }
  }
}

/** Garde l'écran allumé pendant la séance (iOS 16.4+). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => {
      lock?.release().catch(() => undefined)
    }
  }, [])
}

export function StrengthPlayer() {
  const { id } = useParams()
  const nav = useNavigate()
  const session = useLiveQuery(() => db.sessions.get(id ?? ''), [id])
  const [i, setI] = useState(-1) // -1 = échauffement
  const [left, setLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [exFb, setExFb] = useState<Record<string, ExerciseFeedback>>({})
  const beep = useBeep()
  useWakeLock()

  const steps = session?.strength ? buildSteps(session.strength.items) : []
  const step = steps[i]

  useEffect(() => {
    if (!running || left == null) return
    if (left <= 0) {
      beep(1040, 300)
      setRunning(false)
      setLeft(null)
      setI((x) => x + 1)
      return
    }
    if (left <= 3) beep(660, 90)
    const t = setTimeout(() => setLeft((l) => (l == null ? l : l - 1)), 1000)
    return () => clearTimeout(t)
  }, [running, left]) // eslint-disable-line react-hooks/exhaustive-deps

  // Les repos démarrent tout seuls.
  useEffect(() => {
    if (step?.type === 'rest') {
      setLeft(step.sec)
      setRunning(true)
    }
    if (i >= steps.length && steps.length) setFinished(true)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session?.strength) return <p className="p-4">Séance introuvable.</p>
  const items = session.strength.items
  const item = step ? items[step.itemIndex] : undefined
  const progress = steps.length ? Math.max(0, i) / steps.length : 0

  if (finished)
    return (
      <div className="space-y-4">
        <h1 className="display text-3xl">Bien joué !</h1>
        <section className="card">
          <h2 className="font-semibold mb-1">Chaque exercice était…</h2>
          <p className="text-xs text-muted mb-2">Le coach ajuste exercice par exercice pour les prochaines séances.</p>
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.exerciseId}>
                <p className="text-sm font-medium">{it.name}</p>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {(
                    [
                      ['trop-facile', 'Trop facile'],
                      ['ok', 'Bien'],
                      ['trop-dur', 'Trop dur'],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} aria-pressed={exFb[it.exerciseId] === v} onClick={() => setExFb({ ...exFb, [it.exerciseId]: v })} className={`min-h-[40px] rounded-btn border text-sm ${exFb[it.exerciseId] === v ? 'bg-accent text-on-accent border-transparent font-semibold' : 'bg-surface2 border-line'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p>Et la séance dans l’ensemble ? (1 = très facile, 10 = à bloc)</p>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              className="h-12 rounded-btn bg-surface2 border border-line num font-semibold"
              onClick={async () => {
                await markDone(session.id, n)
                if (Object.keys(exFb).length) await giveStrengthFeedback(exFb, todayISO())
                nav('/aujourdhui')
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">Pour l’enregistrer sur ta montre, lance l’activité « Musculation » sur la Fenix au début de la séance.</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="h-2 rounded-full bg-surface2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement">
        <div className="h-full bg-accent-ink" style={{ width: `${progress * 100}%` }} />
      </div>

      {i === -1 ? (
        <section className="card space-y-3">
          <p className="text-sm text-muted">{session.title} · ~{session.durationMin} min</p>
          <h1 className="display text-2xl">Échauffement 3 min</h1>
          <p>Montées de genoux, rotations de hanches et de chevilles, 10 squats légers.</p>
          <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
            {items.map((it) => (
              <li key={it.exerciseId}>
                {it.name} : {formatPrescription(it)}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">Astuce : lance l’activité « Musculation » sur ta Fenix pour enregistrer la séance.</p>
          <button className="btn-primary w-full" onClick={() => setI(0)}>
            C’est parti
          </button>
        </section>
      ) : step?.type === 'rest' ? (
        <section className="card text-center space-y-3 py-8">
          <p className="text-muted">Repos</p>
          <p className="num display text-7xl">{left ?? step.sec}</p>
          <p>
            Ensuite : <strong>{step.next}</strong>
          </p>
          <button className="btn-secondary w-full" onClick={() => { setRunning(false); setLeft(null); setI(i + 1) }}>
            Passer le repos
          </button>
        </section>
      ) : step && item ? (
        <section className="card space-y-3">
          <p className="text-sm text-muted">
            Exercice {step.itemIndex + 1}/{items.length} · série {step.set}/{step.sets}
            {step.side && ` · côté ${step.side}`}
          </p>
          <h1 className="display text-3xl leading-tight">{item.name}</h1>
          {item.variant && <p className="font-semibold">{item.variant}</p>}
          <p className="text-[15px]">{item.description}</p>
          {item.replaced && <p className="text-xs text-muted">Remplace « {item.replaced} » (matériel absent).</p>}
          {step.sec ? (
            <div className="text-center py-4">
              <p className="num display text-7xl">{left ?? step.sec}<span className="text-2xl"> s</span></p>
              {!running ? (
                <button className="btn-primary w-full mt-4" onClick={() => { setLeft(step.sec!); setRunning(true) }}>
                  Démarrer le chrono
                </button>
              ) : (
                <button className="btn-secondary w-full mt-4" onClick={() => { setRunning(false); setLeft(null); setI(i + 1) }}>
                  Terminer maintenant
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="num display text-7xl">{step.reps}<span className="text-2xl"> répét.</span></p>
              <button className="btn-primary w-full mt-4" onClick={() => setI(i + 1)}>
                Série faite
              </button>
            </div>
          )}
        </section>
      ) : null}

      {i >= 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" disabled={i <= 0} onClick={() => { setRunning(false); setLeft(null); setI(i - 1) }}>
            Précédent
          </button>
          <button className="btn-secondary" onClick={() => nav('/aujourdhui')}>
            Quitter
          </button>
        </div>
      )}
    </div>
  )
}
