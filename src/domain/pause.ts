import type { ISODate } from '../data/types'
import { daysBetween } from './dates'

/**
 * PAUSE (vacances, maladie, blessure) ET REPRISE ADAPTÉE.
 *
 * Pendant la pause : aucune séance planifiée ni envoyée sur la montre, pas de reproche du coach.
 * Au retour, repères prudents de désentraînement :
 * - Reprise en cours : on redescend d'un niveau par semaine d'arrêt (un de plus après maladie/blessure).
 * - Forme continue : volume −7 % par semaine d'arrêt (−10 % de plus après maladie/blessure), 70 % minimum ;
 *   au-delà de 4 semaines d'arrêt, retour en mode reprise.
 * - Objectif en cours : le bilan est à refaire (la date peut ne plus être réaliste).
 */

export type PauseReason = 'vacances' | 'maladie' | 'blessure' | 'autre'
export const PAUSE_LABEL: Record<PauseReason, string> = { vacances: 'Vacances', maladie: 'Maladie', blessure: 'Blessure', autre: 'Autre' }

export interface Pause {
  from: ISODate
  until?: ISODate
  reason: PauseReason
}

export function isPaused(p: Pause | undefined, date: ISODate): boolean {
  return !!p && date >= p.from && (!p.until || date <= p.until)
}

export interface ResumeState {
  mode: 'reprise' | 'forme'
  repriseLevel: number
  formeBaseMinutes?: number
}

export interface ResumeDecision extends ResumeState {
  weeksOff: number
  messages: string[]
}

export function resumeAfterPause(state: ResumeState, pause: Pause, today: ISODate, hasGoal: boolean): ResumeDecision {
  const weeksOff = Math.floor(Math.max(0, daysBetween(pause.from, today)) / 7)
  const health = pause.reason === 'maladie' || pause.reason === 'blessure'
  const messages: string[] = []
  let { mode, repriseLevel, formeBaseMinutes } = state
  if (weeksOff === 0 && !health) {
    messages.push('Pause courte : on reprend le plan là où il en était.')
  } else if (mode === 'reprise') {
    const drop = weeksOff + (health ? 1 : 0)
    repriseLevel = Math.max(1, repriseLevel - drop)
    messages.push(`Retour après ${weeksOff ? `${weeksOff} semaine(s)` : 'quelques jours'} : reprise au niveau ${repriseLevel}/9 (un cran par semaine d’arrêt${health ? ', un de plus après ' + (pause.reason === 'maladie' ? 'une maladie' : 'une blessure') : ''}).`)
  } else if (weeksOff > 4) {
    mode = 'reprise'
    repriseLevel = weeksOff > 8 ? 3 : 5
    messages.push(`Plus de 4 semaines d’arrêt : on repasse par une reprise progressive (niveau ${repriseLevel}/9) pour retrouver tes sensations sans te blesser.`)
  } else {
    const factor = Math.max(0.7, 1 - 0.07 * weeksOff - (health ? 0.1 : 0))
    formeBaseMinutes = Math.round((formeBaseMinutes ?? 120) * factor)
    messages.push(`Retour après ${weeksOff ? `${weeksOff} semaine(s)` : 'quelques jours'} : volume ramené à ${formeBaseMinutes} min/semaine (−${Math.round((1 - factor) * 100)} %), puis on remonte progressivement.`)
  }
  if (pause.reason === 'blessure') messages.push('Après une blessure, reprends seulement sans douleur, et avec l’accord de ton médecin ou kiné si elle était sérieuse.')
  if (pause.reason === 'maladie') messages.push('Après une maladie (surtout avec fièvre), les premières séances restent très faciles.')
  if (hasGoal && weeksOff >= 1) messages.push('Ton objectif est toujours là : refais le bilan (Plan) pour vérifier que la date reste réaliste.')
  return { mode, repriseLevel, formeBaseMinutes, weeksOff, messages }
}
