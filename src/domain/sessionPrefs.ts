import type { Workout } from './workout'
import type { SessionPaces } from './sessionPaces'

/**
 * MES PRÉFÉRENCES DE SÉANCE (corrections que je donne au coach).
 *
 * - walk = false : je ne marche pas. L'échauffement devient un footing, les récupérations
 *   se font en trottinant très lentement, le retour au calme en courant doucement.
 * - warmupPace : mon allure d'échauffement (s/km), ex. 390 = 6:30/km.
 * - easyOffset : décalage de mon allure facile en s/km (+ = plus lente, − = plus rapide),
 *   réglé à la main ou par mes retours « trop lent / trop rapide » après les séances.
 */
export interface SessionPrefs {
  walk: boolean
  warmupPace?: number
  easyOffset: number
}

export const DEFAULT_PREFS: SessionPrefs = { walk: true, easyOffset: 0 }
export const OFFSET_STEP = 10
export const OFFSET_LIMIT = 60

/** Décale les fourchettes d'allure selon mes préférences. */
export function adjustPaces(sp: SessionPaces | undefined, p: SessionPrefs): SessionPaces | undefined {
  if (!sp) return sp
  const o = p.easyOffset
  const shift = ([a, b]: [number, number], d: number): [number, number] => [a + d, b + d]
  return { ...sp, easy: shift(sp.easy, o), jog: shift(sp.jog, o) }
}

/**
 * Applique « je ne marche pas » et mon allure d'échauffement à une séance.
 * Les étapes de marche deviennent des étapes de course lente, avec leur propre cible.
 */
export function applyPrefs(w: Workout, p: SessionPrefs, sp: SessionPaces | undefined): Workout {
  const warmTarget = p.warmupPace
    ? { kind: 'pace' as const, fastSecPerKm: p.warmupPace - 10, slowSecPerKm: p.warmupPace + 20 }
    : sp
      ? { kind: 'pace' as const, fastSecPerKm: sp.jog[0], slowSecPerKm: sp.jog[1] }
      : { kind: 'hrZone' as const, zone: 1 }
  const recoveryTarget = sp ? { kind: 'pace' as const, fastSecPerKm: sp.jog[1] - 15, slowSecPerKm: sp.jog[1] + 45 } : { kind: 'hrZone' as const, zone: 1 }
  return {
    blocks: w.blocks.map((b) => ({
      ...b,
      steps: b.steps.map((s) => {
        const walk = /marche/i.test(s.label ?? '')
        // Allure d'échauffement imposée (même si je marche, elle s'applique au footing d'échauffement).
        if (b.role === 'warmup' && !walk && p.warmupPace && /footing|échauffement/i.test(s.label ?? '')) return { ...s, target: warmTarget }
        if (!walk || p.walk) return s
        if (b.role === 'warmup') return { ...s, label: 'Footing d’échauffement', target: warmTarget }
        if (b.role === 'cooldown') return { ...s, label: 'Retour au calme en trottinant', target: recoveryTarget }
        return { ...s, label: 'Récup en trottinant', target: recoveryTarget }
      }),
    })),
  }
}

export type PaceFeedback = 'trop-lent' | 'bien' | 'trop-rapide'

/** Mon retour après une séance → nouveau décalage d'allure (borné à ±60 s/km). */
export function offsetAfterFeedback(current: number, fb: PaceFeedback): number {
  const next = fb === 'trop-lent' ? current - OFFSET_STEP : fb === 'trop-rapide' ? current + OFFSET_STEP : current
  return Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, next))
}
