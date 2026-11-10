/**
 * Modèle de séance structurée, indépendant d'Intervals.icu,
 * et conversion vers le format texte d'Intervals.icu.
 *
 * Syntaxe Intervals.icu utilisée (voir README > « Format des séances ») :
 *   - Un en-tête de section par bloc (« Warmup », « Cooldown », ou « 4x » pour répéter).
 *   - Une étape par ligne, commençant par « - » : libellé, durée ou distance, cible.
 *   - Durées : 10m, 30s, 1h, 1m30s. Distances : 1km, 400mtr (« m » = minutes).
 *   - Cibles : « Z2 HR » (zone cardio), « Z2 Pace » (zone d'allure),
 *     « 5:30-6:00/km Pace » (allure absolue).
 * Les mots « Warmup » / « Cooldown » permettent à Garmin d'afficher les étapes
 * d'échauffement et de retour au calme comme telles.
 */

export type Target =
  | { kind: 'hrZone'; zone: number }
  | { kind: 'paceZone'; zone: number }
  /** Allure en secondes par km ; low = la plus rapide, high = la plus lente. */
  | { kind: 'pace'; fastSecPerKm: number; slowSecPerKm: number }

export interface Step {
  label?: string
  durationSec?: number
  distanceM?: number
  target?: Target
}

export interface Block {
  role: 'warmup' | 'main' | 'cooldown'
  repeat?: number
  steps: Step[]
}

export interface Workout {
  blocks: Block[]
}

export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) throw new Error(`Durée invalide : ${totalSec}`)
  const s = Math.round(totalSec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h && !m && !sec) return `${h}h`
  const totalMin = Math.floor(s / 60)
  if (!sec) return `${totalMin}m`
  if (!totalMin) return `${sec}s`
  return `${totalMin}m${sec}s`
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m <= 0) throw new Error(`Distance invalide : ${m}`)
  if (m >= 1000 && m % 100 === 0) {
    const km = m / 1000
    return `${Number.isInteger(km) ? km : km.toFixed(1)}km`
  }
  return `${Math.round(m)}mtr`
}

/** 330 → « 5:30 » */
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function formatTarget(t: Target): string {
  switch (t.kind) {
    case 'hrZone':
      return `Z${t.zone} HR`
    case 'paceZone':
      return `Z${t.zone} Pace`
    case 'pace':
      if (t.fastSecPerKm > t.slowSecPerKm) throw new Error('Allure : la borne rapide doit être ≤ la borne lente')
      return `${formatPace(t.fastSecPerKm)}-${formatPace(t.slowSecPerKm)}/km Pace`
  }
}

/** Retire les caractères qui casseraient la syntaxe (tiret de début, retours ligne). */
function cleanLabel(label: string): string {
  return label.replace(/[\r\n]+/g, ' ').replace(/^[-\s]+/, '').trim()
}

export function stepToText(step: Step): string {
  const parts: string[] = []
  if (step.label) parts.push(cleanLabel(step.label))
  if (step.durationSec != null) parts.push(formatDuration(step.durationSec))
  else if (step.distanceM != null) parts.push(formatDistance(step.distanceM))
  else throw new Error('Une étape doit avoir une durée ou une distance')
  if (step.target) parts.push(formatTarget(step.target))
  return `- ${parts.join(' ')}`
}

export function toIntervalsText(w: Workout): string {
  if (!w.blocks.length) throw new Error('Séance vide')
  return w.blocks
    .map((b) => {
      if (!b.steps.length) throw new Error('Bloc vide')
      const header =
        b.repeat && b.repeat > 1 ? `${b.repeat}x` : b.role === 'warmup' ? 'Warmup' : b.role === 'cooldown' ? 'Cooldown' : 'Main Set'
      return [header, ...b.steps.map(stepToText)].join('\n')
    })
    .join('\n\n')
}

/** Durée totale estimée en secondes (les étapes en distance sont estimées à l'allure donnée). */
export function estimateDurationSec(w: Workout, fallbackSecPerKm = 390): number {
  let total = 0
  for (const b of w.blocks) {
    const reps = b.repeat && b.repeat > 1 ? b.repeat : 1
    for (const s of b.steps) {
      if (s.durationSec != null) total += s.durationSec * reps
      else if (s.distanceM != null) {
        const pace = s.target?.kind === 'pace' ? (s.target.fastSecPerKm + s.target.slowSecPerKm) / 2 : fallbackSecPerKm
        total += (s.distanceM / 1000) * pace * reps
      }
    }
  }
  return Math.round(total)
}
