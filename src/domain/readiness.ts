import type { MorningCheckin, PlannedSession, Wellness } from '../data/types'
import { sessionDurationSec, strengthDescription } from './strength'
import { estimateDurationSec, scaleWorkout, toIntervalsText } from './workout'

/**
 * FORME DU JOUR : combine le check du matin et les données Garmin.
 *
 * Score sur 100 (repère, pas une mesure médicale) :
 *   forme physique 35 %, sommeil 20 %, moral 15 %, charge de travail 15 %, vie perso 15 %.
 *   Sans donnée de sommeil, son poids est réparti sur les autres.
 * Ajustements : FC de repos ≥ 5 bpm au-dessus de ta moyenne → −10 ; alcool 1-2 verres → −5, 3+ → −15.
 * Réponses 1-5 converties en 0 / 30 / 60 / 85 / 100 : « 3 » est un jour normal.
 * Seuils : ≥ 55 vert, 35-54 orange, < 35 rouge. Toute douleur modérée ou forte → rouge.
 */

export type ReadinessColor = 'vert' | 'orange' | 'rouge'

export interface Readiness {
  score: number
  color: ReadinessColor
  reasons: string[]
  pain: boolean
}

const SCALE5 = [0, 30, 60, 85, 100]
const scale5 = (v: number) => SCALE5[Math.min(5, Math.max(1, Math.round(v))) - 1]

export function sleepScore(hours: number): number {
  if (hours <= 5) return 0
  if (hours >= 8) return 100
  if (hours <= 6) return (hours - 5) * 40
  if (hours <= 7) return 40 + (hours - 6) * 35
  return 75 + (hours - 7) * 25
}

export function computeReadiness(c: MorningCheckin, w?: Wellness, restingHrBaseline?: number): Readiness {
  const reasons: string[] = []
  const parts: [number, number][] = [
    [scale5(c.physique), 35],
    [scale5(c.moral), 15],
    [scale5(c.travail), 15],
    [scale5(c.viePerso), 15],
  ]
  if (w?.sleepHours != null) {
    parts.push([sleepScore(w.sleepHours), 20])
    if (w.sleepHours < 6) reasons.push(`Nuit courte (${w.sleepHours.toFixed(1).replace('.', ',')} h).`)
  }
  const totalW = parts.reduce((s, [, p]) => s + p, 0)
  let score = parts.reduce((s, [v, p]) => s + v * p, 0) / totalW

  if (c.physique <= 2) reasons.push('Tu te sens physiquement fatigué.')
  if (c.moral <= 2) reasons.push('Moral bas.')
  if (c.travail <= 2) reasons.push('Grosse charge de travail.')
  if (w?.restingHr != null && restingHrBaseline != null && w.restingHr - restingHrBaseline >= 5) {
    score -= 10
    reasons.push(`FC de repos élevée (${w.restingHr} bpm, ta moyenne : ${Math.round(restingHrBaseline)}).`)
  }
  if (c.alcool === '1-2') {
    score -= 5
    reasons.push('Un ou deux verres hier soir.')
  } else if (c.alcool === '3+') {
    score -= 15
    reasons.push('Soirée arrosée hier : hydratation et récupération en priorité.')
  }
  score = Math.round(Math.max(0, Math.min(100, score)))

  const pain = !!c.douleur && c.douleur.intensite >= 2
  if (c.douleur && !pain) reasons.push(`Gêne légère signalée (${c.douleur.zone}) : surveille-la.`)
  if (pain) reasons.push(`Douleur signalée (${c.douleur!.zone}) : repos, pas de course aujourd'hui.`)
  const color: ReadinessColor = pain ? 'rouge' : score >= 55 ? 'vert' : score >= 35 ? 'orange' : 'rouge'
  if (!reasons.length && color === 'vert') reasons.push('Tous les voyants sont au vert.')
  return { score, color, reasons, pain }
}

export interface SessionProposal {
  change: 'aucun' | 'allegee' | 'repos'
  /** Séance proposée (identique si aucun changement). */
  session: PlannedSession
  why: string
}

/**
 * Propose une adaptation de la séance du jour selon la forme.
 * C'est une PROPOSITION : l'appli la présente, je l'accepte ou je garde ma séance.
 * Les séances verrouillées ne sont jamais modifiées.
 */
export function proposeAdjustment(s: PlannedSession, r: Readiness): SessionProposal {
  const none = (why: string): SessionProposal => ({ change: 'aucun', session: s, why })
  if (s.locked) return none('Séance verrouillée par toi : le coach n’y touche pas.')
  if (s.kind === 'repos' || s.status === 'done') return none('')
  if (r.color === 'vert') return none('Forme au vert : séance maintenue.')

  if (r.color === 'rouge') {
    return {
      change: 'repos',
      session: {
        ...s,
        kind: 'repos',
        title: 'Repos',
        durationMin: 0,
        workout: undefined,
        strength: undefined,
        workoutText: undefined,
        key: false,
        reasons: [...r.reasons, 'Le coach propose du repos aujourd’hui (une marche tranquille de 20 min est possible).'],
        origin: 'moteur',
      },
      why: r.pain
        ? 'Douleur signalée : repos aujourd’hui. Si elle dure plus de 3 jours, consulte un médecin ou un kiné.'
        : 'Voyants au rouge : une journée de repos te fera plus de bien qu’une séance subie.',
    }
  }

  // Orange : séance allégée d'environ 30 %.
  if (s.kind === 'renfo' && s.strength) {
    // Mêmes exercices, une série de moins chacun.
    const items = s.strength.items.map((i) => ({ ...i, sets: Math.max(1, i.sets - 1) }))
    const strength = { ...s.strength, items, durationMin: Math.round(sessionDurationSec(items) / 60) }
    return {
      change: 'allegee',
      session: { ...s, strength, durationMin: strength.durationMin, workoutText: strengthDescription(strength), reasons: [...s.reasons, 'Allégée : une série de moins par exercice.'] },
      why: 'Forme moyenne : renfo allégé (une série de moins).',
    }
  }
  if (s.workout) {
    const workout = scaleWorkout(s.workout, 0.7)
    return {
      change: 'allegee',
      session: {
        ...s,
        workout,
        workoutText: toIntervalsText(workout),
        durationMin: Math.round(estimateDurationSec(workout) / 60),
        key: false,
        reasons: [...s.reasons, 'Allégée d’environ 30 % selon ta forme du matin.'],
      },
      why: 'Forme moyenne : séance raccourcie d’environ 30 %, même intensité très facile.',
    }
  }
  return none('')
}
