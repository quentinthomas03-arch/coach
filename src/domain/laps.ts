import type { Workout, Target } from './workout'
import { formatPace } from './workout'

/**
 * ANALYSE TOUR PAR TOUR (chaque étape de la séance).
 * Une séance structurée envoyée sur la montre crée un tour par étape. Intervals.icu renvoie ces
 * tours (« intervals ») avec durée, distance, vitesse et FC moyennes. On les aligne sur les étapes
 * prévues et on juge chaque étape à sa propre fourchette d'allure.
 */

export interface Lap {
  durationSec: number
  distanceM?: number
  /** s/km */
  pace?: number
  avgHr?: number
  type?: string
  label?: string
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Lit les tours d'une réponse Intervals.icu (formats « intervals » ou activité avec icu_intervals). */
export function parseLaps(raw: unknown): Lap[] {
  const r = raw as Record<string, unknown> | unknown[] | null
  const list = Array.isArray(r) ? r : ((r?.icu_intervals ?? (r as Record<string, unknown>)?.intervals) as unknown[] | undefined)
  if (!Array.isArray(list)) return []
  return list
    .map((x) => x as Record<string, unknown>)
    .map((x) => {
      const durationSec = num(x.moving_time) ?? num(x.elapsed_time) ?? 0
      const distanceM = num(x.distance)
      const speed = num(x.average_speed) ?? (distanceM && durationSec ? distanceM / durationSec : undefined)
      return {
        durationSec,
        distanceM,
        pace: speed && speed > 0.5 ? 1000 / speed : undefined,
        avgHr: num(x.average_heartrate),
        type: typeof x.type === 'string' ? x.type : undefined,
        label: typeof x.label === 'string' ? x.label : undefined,
      }
    })
    .filter((l) => l.durationSec > 0)
}

export interface PlannedStep {
  label: string
  durationSec?: number
  target?: Target
  /** n° de répétition (1, 2…) si dans un bloc répété */
  rep?: number
}

/** Étapes de la séance à plat (répétitions déroulées), dans l'ordre de la montre. */
export function flattenSteps(w: Workout): PlannedStep[] {
  const out: PlannedStep[] = []
  for (const b of w.blocks) {
    const reps = b.repeat && b.repeat > 1 ? b.repeat : 1
    for (let r = 1; r <= reps; r++) for (const s of b.steps) out.push({ label: s.label ?? '', durationSec: s.durationSec, target: s.target, rep: reps > 1 ? r : undefined })
  }
  return out
}

export type StepVerdict = 'ok' | 'trop-vite' | 'trop-lent' | 'non-jugé'

export interface StepResult {
  step: PlannedStep
  lap?: Lap
  verdict: StepVerdict
  /** écart en s/km (négatif = plus vite que la fourchette) */
  delta?: number
}

export interface LapAnalysis {
  matched: boolean
  results: StepResult[]
  judged: number
  ok: number
  tooFast: number
  tooSlow: number
  text: string
}

const TOL = 8 // tolérance (s/km) autour de la fourchette

export function analyzeLaps(w: Workout, laps: Lap[]): LapAnalysis {
  const steps = flattenSteps(w)
  // Alignement : un tour par étape. Si le nombre diffère de plus de 2, on n'aligne pas (séance non suivie en mode structuré).
  const matched = laps.length > 0 && Math.abs(laps.length - steps.length) <= 2
  const results: StepResult[] = steps.map((step, i) => {
    const lap = matched ? laps[i] : undefined
    const t = step.target
    if (!lap?.pace || t?.kind !== 'pace' || /guidé dans l’appli/.test(step.label)) return { step, lap, verdict: 'non-jugé' }
    if (lap.pace < t.fastSecPerKm - TOL) return { step, lap, verdict: 'trop-vite', delta: Math.round(lap.pace - t.fastSecPerKm) }
    if (lap.pace > t.slowSecPerKm + TOL) return { step, lap, verdict: 'trop-lent', delta: Math.round(lap.pace - t.slowSecPerKm) }
    return { step, lap, verdict: 'ok', delta: 0 }
  })
  const judged = results.filter((r) => r.verdict !== 'non-jugé')
  const ok = judged.filter((r) => r.verdict === 'ok').length
  const tooFast = judged.filter((r) => r.verdict === 'trop-vite').length
  const tooSlow = judged.filter((r) => r.verdict === 'trop-lent').length
  let text: string
  if (!matched) text = 'Les tours de la montre ne correspondent pas aux étapes (séance lancée hors mode entraînement ?) : analyse globale seulement.'
  else if (!judged.length) text = 'Pas d’étape avec une fourchette d’allure à juger.'
  else {
    text = `${ok}/${judged.length} étapes dans la fourchette.`
    const worstFast = judged.filter((r) => r.verdict === 'trop-vite').sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))[0]
    if (worstFast) text += ` ${tooFast} trop rapide${tooFast > 1 ? 's' : ''} (jusqu’à ${-(worstFast.delta ?? 0)} s/km sous la fourchette, ${worstFast.step.label.toLowerCase()}${worstFast.step.rep ? ` n°${worstFast.step.rep}` : ''}).`
    if (tooSlow) text += ` ${tooSlow} trop lente${tooSlow > 1 ? 's' : ''}.`
    if (ok === judged.length) text += ' Allures parfaitement tenues, bravo.'
    else if (tooFast > judged.length / 2) text += ' Tu pars trop vite : vise le haut de la fourchette.'
  }
  return { matched, results, judged: judged.length, ok, tooFast, tooSlow, text }
}

export function stepLine(r: StepResult): string {
  const t = r.step.target?.kind === 'pace' ? ` (cible ${formatPace(r.step.target.fastSecPerKm)}–${formatPace(r.step.target.slowSecPerKm)})` : ''
  const p = r.lap?.pace ? `${formatPace(r.lap.pace)}/km` : '—'
  return `${r.step.label}${r.step.rep ? ` ${r.step.rep}` : ''} : ${p}${t}`
}
