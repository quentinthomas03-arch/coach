import type { PlannedSession } from '../data/types'
import { formatLongFr } from './dates'

/**
 * Résumé lisible des différences entre deux versions du plan
 * (affiché dans « Ce qui a changé », avec bouton Annuler).
 */

const fmtDay = (d: string) => formatLongFr(d).split(' ').slice(0, 2).join(' ')
const label = (s: PlannedSession) => `${s.title} (${s.durationMin} min)`

/** Clé de correspondance : l'identifiant suit une séance déplacée par moi ; sinon type + date. */
function sameSlot(a: PlannedSession, b: PlannedSession) {
  return a.id === b.id
}

export function diffSessions(before: PlannedSession[], after: PlannedSession[]): string[] {
  const out: string[] = []
  const matchedAfter = new Set<string>()
  for (const b of before) {
    const a = after.find((x) => sameSlot(x, b))
    if (!a) {
      // Même type de séance replacée un autre jour ?
      const moved = after.find((x) => !before.some((y) => y.id === x.id) && x.kind === b.kind && !matchedAfter.has(x.id))
      if (moved) {
        matchedAfter.add(moved.id)
        out.push(`${b.title} : déplacée du ${fmtDay(b.date)} au ${fmtDay(moved.date)}.`)
        if (moved.durationMin !== b.durationMin) out.push(`${moved.title} du ${fmtDay(moved.date)} : ${b.durationMin} → ${moved.durationMin} min.`)
      } else out.push(`${label(b)} du ${fmtDay(b.date)} : retirée.`)
      continue
    }
    matchedAfter.add(a.id)
    if (a.date !== b.date) out.push(`${b.title} : déplacée du ${fmtDay(b.date)} au ${fmtDay(a.date)}.`)
    if (a.kind !== b.kind) out.push(`${fmtDay(a.date)} : ${b.title} remplacée par ${a.title}.`)
    else if (a.durationMin !== b.durationMin) out.push(`${a.title} du ${fmtDay(a.date)} : ${b.durationMin} → ${a.durationMin} min.`)
    else if ((a.workoutText ?? '') !== (b.workoutText ?? '')) out.push(`${a.title} du ${fmtDay(a.date)} : contenu ajusté.`)
  }
  for (const a of after) {
    if (!matchedAfter.has(a.id) && !before.some((b) => b.id === a.id)) out.push(`${label(a)} ajoutée le ${fmtDay(a.date)}.`)
  }
  return out
}
