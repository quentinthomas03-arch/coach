import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../data/db'
import { routineFor, type FragileZone, type Routine } from '../../domain/routines'
import { useDbQuery } from '../useDbQuery'

interface Step {
  name: string
  description: string
  sec: number
  side?: string
}

function stepsOf(r: Routine): Step[] {
  return r.items.flatMap((i) => (i.sides ? [{ ...i, side: 'côté droit' }, { ...i, side: 'côté gauche' }] : [i]))
}

/** Échauffement ou étirements guidés : enchaînement automatique avec chrono, bip et écran allumé. */
export function RoutinePlayer() {
  const { id } = useParams() as { id: 'echauffement' | 'etirements' }
  const nav = useNavigate()
  const zones = useDbQuery(async () => ((await db.profile.get('me'))?.injuries ?? []) as FragileZone[], [])
  const [i, setI] = useState(-1)
  const [left, setLeft] = useState(0)
  const [paused, setPaused] = useState(false)
  const ctx = useRef<AudioContext | null>(null)
  const routine = zones ? routineFor(id, zones) : undefined
  const steps = routine ? stepsOf(routine) : []
  const beep = (f = 880) => {
    try {
      ctx.current ??= new AudioContext()
      const o = ctx.current.createOscillator()
      o.frequency.value = f
      o.connect(ctx.current.destination)
      o.start()
      o.stop(ctx.current.currentTime + 0.15)
    } catch {
      /* pas de son */
    }
  }
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    n.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => {
      lock?.release().catch(() => undefined)
    }
  }, [])
  useEffect(() => {
    if (i < 0 || i >= steps.length || paused) return
    if (left <= 0) {
      beep(1040)
      setI(i + 1)
      setLeft(steps[i + 1]?.sec ?? 0)
      return
    }
    const t = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(t)
  }, [i, left, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!routine) return null
  const total = Math.round(steps.reduce((a, s) => a + s.sec, 0) / 60)
  if (i >= steps.length)
    return (
      <div className="space-y-4">
        <h1 className="display text-3xl">{id === 'echauffement' ? 'Prêt à courir !' : 'Bien récupéré !'}</h1>
        <p>{id === 'echauffement' ? 'Lance ta séance sur la montre : elle commence par l’échauffement progressif.' : 'Bois un grand verre d’eau et pense à une collation avec des protéines.'}</p>
        <button className="btn-primary w-full" onClick={() => nav('/aujourdhui')}>
          Retour à Aujourd’hui
        </button>
      </div>
    )
  const s = steps[i]
  return (
    <div className="space-y-4">
      <div className="h-2 rounded-full bg-surface2 overflow-hidden" role="progressbar" aria-label="Avancement" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.max(0, i)}>
        <div className="h-full bg-accent-ink" style={{ width: `${(Math.max(0, i) / steps.length) * 100}%` }} />
      </div>
      {i < 0 ? (
        <section className="card space-y-3">
          <h1 className="display text-2xl">{routine.name}</h1>
          <p className="text-muted">≈ {total} min, enchaînement automatique avec un bip à chaque changement.</p>
          <ol className="list-decimal pl-5 text-[15px] space-y-1">
            {routine.items.map((it) => (
              <li key={it.name}>
                {it.name} · {it.sec} s{it.sides ? ' par côté' : ''}
              </li>
            ))}
          </ol>
          {zones && zones.length > 0 && <p className="text-xs text-muted">Inclut des exercices pour tes zones fragiles.</p>}
          <button className="btn-primary w-full" onClick={() => { setI(0); setLeft(steps[0].sec); beep() }}>
            C’est parti
          </button>
        </section>
      ) : (
        <section className="card text-center space-y-3 py-6">
          <p className="text-sm text-muted">
            {i + 1}/{steps.length}
            {s.side ? ` · ${s.side}` : ''}
          </p>
          <h1 className="display text-3xl leading-tight">{s.name}</h1>
          <p className="text-[15px] text-left">{s.description}</p>
          <p className="num display text-7xl" aria-live="off">{left}</p>
          {steps[i + 1] && (
            <p className="text-sm text-muted">
              Ensuite : {steps[i + 1].name}
              {steps[i + 1].side ? ` (${steps[i + 1].side})` : ''}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={() => setPaused(!paused)}>
              {paused ? 'Reprendre' : 'Pause'}
            </button>
            <button className="btn-secondary" onClick={() => { setI(i + 1); setLeft(steps[i + 1]?.sec ?? 0) }}>
              Suivant
            </button>
          </div>
        </section>
      )}
      <button className="btn-secondary w-full" onClick={() => nav('/aujourdhui')}>
        Quitter
      </button>
    </div>
  )
}
