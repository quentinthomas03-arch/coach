import type { ISODate, PlannedSession } from '../data/types'
import { STRETCH_LABEL, WARMUP_LABEL } from './routines'

/**
 * POURQUOI LE PLAN A CHANGÉ : attribution des causes.
 *
 * À chaque recalcul, on garde une « photo » de tout ce qui nourrit le plan (version du moteur,
 * niveaux, dispos, réglages, zones fragiles, pause, surcharge, objectif, séances faites/ratées).
 * Au recalcul suivant, on compare les deux photos : chaque différence devient une cause lisible.
 * Le check du matin n'en fait jamais partie : il ne propose d'adapter que la séance du jour.
 */

export const ENGINE_VERSION = 5
/** Ce qui change pour toi à chaque nouvelle version du moteur de plan. */
export const ENGINE_CHANGELOG: Record<number, string> = {
  4: 'Mise à jour de l’appli : l’échauffement guidé (4 min) et les étirements (5 min) font désormais partie de chaque séance de course. Ton temps de course, lui, ne change pas.',
  5: 'Mise à jour de l’appli : les séances indiquent maintenant une fourchette d’allure pour chaque étape (échauffement, course, récupération), comme sur Kiprun.',
}

export interface PlanInputs {
  engine: number
  mode: string
  repriseLevel: number
  strengthLevel: number
  formeBase?: number
  runsPerWeek: number
  strengthPerWeek: number
  longRunWeekday: number
  startDate: ISODate
  /** Empreinte des dispos de chaque semaine calculée. */
  availability: Record<ISODate, string>
  zones: string[]
  pause?: string
  overload: boolean
  goal?: string
  /** Forme de référence (VDOT arrondi) servant aux allures. */
  vdot?: number
  missed: string[]
  skipped: string[]
  /** Mes préférences de séance. */
  prefs?: { walk: boolean; warmupPace?: number; easyOffset: number }
  /** Ajustements du renfo par exercice. */
  strengthOffsets?: Record<string, number>
}

const WD = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

export function explainChanges(prev: PlanInputs | undefined, next: PlanInputs, sessions: PlannedSession[], levelReason?: string): string[] {
  if (!prev) return []
  const out: string[] = []
  for (let v = prev.engine + 1; v <= next.engine; v++) if (ENGINE_CHANGELOG[v]) out.push(ENGINE_CHANGELOG[v])
  if (prev.mode !== next.mode) out.push(next.mode === 'forme' ? 'Reprise terminée : passage en Forme continue.' : next.mode === 'reprise' ? 'Retour en mode reprise.' : `Mode : ${next.mode}.`)
  if (prev.repriseLevel !== next.repriseLevel)
    out.push(`Niveau de reprise ${prev.repriseLevel} → ${next.repriseLevel}${levelReason ? ` : ${levelReason.charAt(0).toLowerCase()}${levelReason.slice(1)}` : '.'}`)
  if (prev.strengthLevel !== next.strengthLevel) out.push(`Niveau de renfo ${prev.strengthLevel} → ${next.strengthLevel}.`)
  if (prev.formeBase !== next.formeBase && next.formeBase && prev.formeBase) out.push(`Volume de base ${prev.formeBase} → ${next.formeBase} min/semaine.`)
  if (prev.runsPerWeek !== next.runsPerWeek || prev.strengthPerWeek !== next.strengthPerWeek) out.push('Nombre de séances par semaine modifié dans tes réglages.')
  if (prev.longRunWeekday !== next.longRunWeekday) out.push(`Sortie longue déplacée au ${WD[next.longRunWeekday]} (réglage).`)
  if (prev.startDate !== next.startDate) out.push('Date de début du plan modifiée.')
  const weeks = Object.keys(next.availability).filter((w) => prev.availability[w] !== undefined && prev.availability[w] !== next.availability[w])
  if (weeks.length) out.push('Tes disponibilités ont changé.')
  if (prev.zones.join() !== next.zones.join()) out.push('Zones fragiles modifiées : échauffement, étirements et renfo adaptés.')
  if (prev.pause !== next.pause) out.push(next.pause ? 'Plan mis en pause.' : 'Fin de la pause : reprise adaptée.')
  if (prev.overload !== next.overload) out.push(next.overload ? 'Surcharge prolongée détectée (check du matin sur 3 semaines) : plan allégé.' : 'Fin de la surcharge : retour au volume normal.')
  if (prev.goal !== next.goal) out.push(next.goal ? 'Nouvel objectif : plan construit à rebours.' : 'Objectif retiré : retour en Forme continue.')
  if (prev.vdot !== next.vdot && next.vdot) out.push(`Forme de référence mise à jour (VDOT ${prev.vdot ?? '—'} → ${next.vdot}) : allures recalculées.`)
  const pp = prev.prefs
  const np = next.prefs
  if (np && pp) {
    if (pp.walk !== np.walk) out.push(np.walk ? 'Tu remarches pendant l’échauffement et les récupérations (ta préférence).' : 'Tu ne marches pas : échauffement en footing et récupérations en trottinant (ta préférence).')
    if (pp.warmupPace !== np.warmupPace) out.push(np.warmupPace ? `Échauffement à ${Math.floor(np.warmupPace / 60)}:${String(np.warmupPace % 60).padStart(2, '0')}/km (ta préférence).` : 'Allure d’échauffement : retour au calcul automatique.')
    if (pp.easyOffset !== np.easyOffset) {
      const d = np.easyOffset - pp.easyOffset
      out.push(`Allure facile ${d > 0 ? 'ralentie' : 'accélérée'} de ${Math.abs(d)} s/km d’après ton retour (décalage total : ${np.easyOffset > 0 ? '+' : ''}${np.easyOffset} s/km).`)
    }
  }
  if (JSON.stringify(prev.strengthOffsets ?? {}) !== JSON.stringify(next.strengthOffsets ?? {})) {
    const changed = Object.keys({ ...(prev.strengthOffsets ?? {}), ...(next.strengthOffsets ?? {}) }).filter((k) => (prev.strengthOffsets ?? {})[k] !== (next.strengthOffsets ?? {})[k])
    const up = changed.filter((k) => ((next.strengthOffsets ?? {})[k] ?? 0) > ((prev.strengthOffsets ?? {})[k] ?? 0)).length
    out.push(`Renfo ajusté d’après ton retour : ${up ? `${up} exercice(s) plus difficile(s)` : ''}${up && changed.length - up ? ', ' : ''}${changed.length - up ? `${changed.length - up} plus facile(s)` : ''}.`)
  }
  const newMissed = next.missed.filter((id) => !prev.missed.includes(id))
  for (const id of newMissed) {
    const s = sessions.find((x) => x.id === id)
    if (s) out.push(`Séance non faite (${s.title.toLowerCase()} du ${WD[(new Date(s.date + 'T12:00:00').getDay() + 6) % 7]}) : la semaine est réorganisée.`)
  }
  if (next.skipped.some((id) => !prev.skipped.includes(id))) out.push('Séance retirée par toi : la semaine est réorganisée.')
  return out
}

/** Minutes de course réelles (hors échauffement guidé et étirements). */
export function runningMinutes(s: PlannedSession): number {
  if (!s.workout) return s.durationMin
  let sec = 0
  for (const b of s.workout.blocks) {
    const reps = b.repeat && b.repeat > 1 ? b.repeat : 1
    for (const st of b.steps) if (st.label !== WARMUP_LABEL && st.label !== STRETCH_LABEL && st.durationSec) sec += st.durationSec * reps
  }
  return Math.round(sec / 60) || s.durationMin
}
