import type { PlannedSession } from '../../data/types'
import { IconWatch } from '../icons'
import { isRunSession } from '../../app/plan'

export function WatchBadge({ s }: { s: PlannedSession }) {
  if (!isRunSession(s)) return null
  const map = {
    sent: { cls: 'bg-ok/15 text-ok', txt: 'Sur la montre' },
    outdated: { cls: 'bg-warn/15 text-warn', txt: 'À renvoyer' },
    error: { cls: 'bg-danger/15 text-danger', txt: 'Envoi échoué' },
    'not-sent': { cls: 'bg-surface2 text-muted', txt: 'Pas encore envoyée' },
  } as const
  const m = map[s.sync.status]
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${m.cls}`}>
      <IconWatch width={14} height={14} /> {m.txt}
    </span>
  )
}

export function StatusTag({ s }: { s: PlannedSession }) {
  if (s.status === 'done') return <span className="text-xs font-semibold text-ok">✓ Faite</span>
  if (s.status === 'missed') return <span className="text-xs font-semibold text-danger">Non faite</span>
  if (s.status === 'skipped') return <span className="text-xs font-semibold text-muted">Retirée par toi</span>
  return null
}

export function LockTag({ s }: { s: PlannedSession }) {
  if (!s.locked || s.status !== 'planned') return null
  return <span className="text-xs text-muted">🔒 {s.origin === 'moi' ? 'Choisie par toi' : 'Verrouillée'}</span>
}

/** 90 → « 1 min 30 », 120 → « 2 min » */
export function fmtMinSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const r = Math.round(sec % 60)
  if (!m) return `${r} s`
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`
}

/** Résumé d'une séance (contenu principal) en une ligne. */
export function sessionSummary(s: PlannedSession): string {
  if (s.kind === 'repos') return 'Repos ou marche tranquille'
  if (s.kind === 'renfo' && s.strength) return s.strength.items.map((i) => i.name).join(' · ')
  const main = s.workout?.blocks.find((b) => b.role === 'main')
  if (!main) return ''
  const step = main.steps[0]
  if (main.repeat && main.repeat > 1) {
    const [run, walk] = main.steps
    return `${main.repeat} × (${fmtMinSec(run.durationSec ?? 0)} course${walk ? ` + ${fmtMinSec(walk.durationSec ?? 0)} marche` : ''})`
  }
  return `${Math.round((step.durationSec ?? 0) / 60)} min de course facile`
}
