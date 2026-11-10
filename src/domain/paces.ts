/**
 * ALLURES À PARTIR DE TES PERFORMANCES RÉELLES (méthode VDOT de Jack Daniels).
 *
 * - Une performance (distance + temps) donne un indice VDOT ;
 * - le VDOT donne un chrono prédit sur d'autres distances et des allures d'entraînement.
 * Formules publiées par Daniels & Gilbert (1979), utilisées dans « Daniels' Running Formula ».
 * Ce sont des estimations : elles supposent une préparation adaptée à la distance.
 */

/** Coût en VO2 (ml/kg/min) à la vitesse v (m/min). */
export function vo2AtSpeed(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v
}

/** Fraction de VO2max soutenable pendant t minutes. */
export function fractionForDuration(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin)
}

export function vdotFromPerformance(distanceM: number, timeSec: number): number {
  const t = timeSec / 60
  return vo2AtSpeed(distanceM / t) / fractionForDuration(t)
}

/** Vitesse (m/min) correspondant à un coût VO2 donné (inverse de vo2AtSpeed). */
export function speedAtVo2(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/** Chrono prédit (s) sur une distance pour un VDOT donné (résolution par dichotomie). */
export function predictTimeSec(vdot: number, distanceM: number): number {
  let lo = 60
  let hi = 60 * 60 * 12
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (vdotFromPerformance(distanceM, mid) > vdot) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

/** Allure en s/km pour une fraction de VO2max. */
export function paceAtFraction(vdot: number, fraction: number): number {
  return 60000 / speedAtVo2(vdot * fraction)
}

export interface TrainingPaces {
  vdot: number
  /** Allures en secondes par km : [rapide, lente]. */
  facile: [number, number]
  marathon: number
  seuil: [number, number]
  intervalles: [number, number]
}

/**
 * Allures d'entraînement (fractions de VO2max usuelles chez Daniels) :
 * facile 62-70 %, marathon ~80 %, seuil 86-88 %, intervalles 97-100 %.
 */
export function trainingPaces(vdot: number): TrainingPaces {
  const p = (f: number) => Math.round(paceAtFraction(vdot, f))
  return {
    vdot: Math.round(vdot * 10) / 10,
    facile: [p(0.7), p(0.62)],
    marathon: p(0.8),
    seuil: [p(0.88), p(0.86)],
    intervalles: [p(1.0), p(0.97)],
  }
}

/**
 * Perte de forme après un arrêt (repère prudent tiré de la littérature sur le désentraînement) :
 * ~1 % de VDOT par semaine d'arrêt au-delà de 2 semaines, plafonné à −20 %.
 */
export function detrainedVdot(pastVdot: number, weeksOff: number): number {
  const loss = Math.min(0.2, Math.max(0, weeksOff - 2) * 0.01)
  return pastVdot * (1 - loss)
}

export function formatTime(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

export const DISTANCES = { '5k': 5000, '10k': 10000, semi: 21097.5, marathon: 42195 } as const
export type RoadDistance = keyof typeof DISTANCES
export const DISTANCE_LABEL: Record<RoadDistance, string> = { '5k': '5 km', '10k': '10 km', semi: 'semi-marathon', marathon: 'marathon' }

/** « 45:00 », « 1:45:00 », « 1h45 », « 1h45m30 », « 23'30 » → secondes (undefined si illisible). */
export function parseTime(input: string): number | undefined {
  const s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/[’'′]/g, ':').replace(/"$/, '')
  let m = /^(\d+)h(\d{1,2})?(?:m|:)?(\d{1,2})?s?$/.exec(s)
  if (m) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(s)
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
  m = /^(\d+):(\d{1,2})$/.exec(s)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d+)(?:min|mn|m)?$/.exec(s)
  if (m) return Number(m[1]) * 60
  return undefined
}
