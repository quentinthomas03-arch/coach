import type { FitnessEstimate } from './fitness'
import { formatPace, type Target, type Workout } from './workout'
import { trainingPaces } from './paces'
import { STRETCH_LABEL, WARMUP_LABEL } from './routines'

/**
 * ALLURES DE CHAQUE ÉTAPE (comme Kiprun) : échauffement, course, récupération, retour au calme,
 * chacun avec une fourchette d'allure affichée par la montre.
 *
 * - Allures tirées de la forme (VDOT) : mesurée, ou estimée depuis tes records.
 * - En reprise, la course « facile » est volontairement plus lente que l'allure facile d'avant l'arrêt
 *   (+15 à +30 s/km) : on reconstruit l'endurance sans s'essouffler.
 * - Marche : fourchette large de marche active (9:00 à 12:00/km).
 * - Forme inconnue : on garde les zones cardio.
 */

export interface SessionPaces {
  walk: [number, number]
  /** Course facile (reprise ou endurance). */
  easy: [number, number]
  /** Petit footing d'échauffement / retour au calme. */
  jog: [number, number]
  steady: [number, number]
  threshold: [number, number]
  interval: [number, number]
  estimated: boolean
}

export function sessionPaces(f: FitnessEstimate, reprise: boolean): SessionPaces | undefined {
  if (f.vdot == null) return undefined
  const p = trainingPaces(f.vdot)
  const easy: [number, number] = reprise ? [p.facile[0] + 15, p.facile[1] + 30] : [p.facile[0], p.facile[1]]
  return {
    walk: [540, 720],
    easy,
    jog: [easy[1] - 10, easy[1] + 45],
    steady: [p.marathon - 5, p.marathon + 10],
    threshold: [p.seuil[0], p.seuil[1]],
    interval: [p.intervalles[0], p.intervalles[1]],
    estimated: f.confidence !== 'mesuree',
  }
}

const pace = ([a, b]: [number, number]): Target => ({ kind: 'pace', fastSecPerKm: Math.round(a), slowSecPerKm: Math.round(b) })
const isWalk = (label = '') => /marche/i.test(label)

/**
 * Remplace les cibles cardio par des fourchettes d'allure, étape par étape.
 * Les cibles d'allure déjà présentes (séances objectif) sont conservées.
 */
export function applyPaces(w: Workout, sp: SessionPaces | undefined): Workout {
  if (!sp) return w
  return {
    blocks: w.blocks.map((b) => ({
      ...b,
      steps: b.steps.map((s) => {
        if (s.label === WARMUP_LABEL || s.label === STRETCH_LABEL) return s
        if (s.target?.kind === 'pace') return s
        if (isWalk(s.label)) return { ...s, target: pace(sp.walk) }
        if (s.target?.kind !== 'hrZone' && s.target?.kind !== 'paceZone') return s
        const z = s.target.zone
        const t = z <= 1 ? sp.jog : z === 2 ? sp.easy : z === 3 ? sp.steady : z === 4 ? sp.threshold : sp.interval
        return { ...s, target: pace(t) }
      }),
    })),
  }
}

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60)
  const r = Math.round(sec % 60)
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`
}

function targetText(t?: Target): string {
  if (!t) return ''
  if (t.kind === 'pace') return `${formatPace(t.fastSecPerKm)}–${formatPace(t.slowSecPerKm)}/km`
  return `zone ${t.zone}${t.kind === 'hrZone' ? ' cardio' : ''}`
}

export interface StepLine {
  section: 'Échauffement' | 'Séance' | 'Retour au calme'
  text: string
  target?: string
  repeat?: number
}

/** Déroulé lisible de la séance (affiché dans l'appli, identique à la montre). */
export function describeWorkout(w: Workout): StepLine[] {
  const out: StepLine[] = []
  for (const b of w.blocks) {
    const section = b.role === 'warmup' ? 'Échauffement' : b.role === 'cooldown' ? 'Retour au calme' : 'Séance'
    if (b.repeat && b.repeat > 1) {
      out.push({
        section,
        repeat: b.repeat,
        text: b.steps.map((s) => `${s.durationSec ? mmss(s.durationSec) : `${(s.distanceM ?? 0) / 1000} km`.replace('.', ',')} ${s.label?.toLowerCase() ?? ''}`.trim()).join(' + '),
        target: b.steps.map((s) => targetText(s.target)).filter(Boolean).join(' / '),
      })
    } else {
      for (const s of b.steps) {
        const label = s.label === WARMUP_LABEL ? 'mobilité et gammes (guidé dans l’appli)' : s.label === STRETCH_LABEL ? 'étirements (guidés dans l’appli)' : s.label?.toLowerCase() ?? ''
        out.push({ section, text: `${s.durationSec ? mmss(s.durationSec) : `${(s.distanceM ?? 0) / 1000} km`.replace('.', ',')} ${label}`.trim(), target: targetText(s.target) || undefined })
      }
    }
  }
  return out
}
