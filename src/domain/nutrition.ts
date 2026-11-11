import type { Sex } from '../data/types'

/**
 * NUTRITION : besoins du jour, garde-fous, hydratation, repères autour des séances.
 *
 * Repères généraux, pas des prescriptions (voir README > Nutrition) :
 * - Métabolisme de base : équation de Mifflin-St Jeor (1990).
 * - Activité hors sport : facteur 1,3 (sédentaire) à 1,6 (métier physique).
 * - Dépense des séances : ≈ 1 kcal/kg/km en course ; sinon équivalents métaboliques (MET) nets.
 * - Protéines 1,6 g/kg (1,8 en déficit), lipides ≥ 0,8 g/kg et ≥ 25 % des calories,
 *   glucides = le reste, avec un repère en g/kg selon le type de journée.
 * - Perte de poids : déficit ≤ 15 % et ≤ 500 kcal/j, rythme ≤ 0,75 % du poids/semaine ;
 *   jamais sous le métabolisme de base ni sous 1 500 kcal (homme) / 1 200 kcal (femme).
 * - Hydratation : ~30 ml/kg de boissons par jour, + 500 à 750 ml par heure de sport, + chaleur.
 */

export type ActivityLevel = 'sedentaire' | 'actif' | 'tres-actif'
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = { sedentaire: 1.3, actif: 1.45, 'tres-actif': 1.6 }
export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentaire: 'Bureau, peu de marche',
  actif: 'Debout ou beaucoup de marche',
  'tres-actif': 'Métier physique',
}

export type WeightGoal = 'maintien' | 'perte' | 'prise'

export interface NutritionProfile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: ActivityLevel
  goal: WeightGoal
}

export const KCAL_FLOOR: Record<Sex, number> = { homme: 1500, femme: 1200 }

export function bmr(p: Pick<NutritionProfile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'homme' ? 5 : -161))
}

/** Séance du jour (prévue ou faite) pour estimer la dépense. */
export interface DaySession {
  kind: 'course' | 'renfo' | 'marche-course'
  minutes: number
  distanceKm?: number
  /** Intensité ressentie 1-10 (ou estimée). */
  rpe?: number
  /** Dépense nette mesurée par la montre (prioritaire sur l'estimation). */
  kcal?: number
}

/** MET nets (au-dessus du repos) par type d'effort. */
const NET_MET = { 'marche-course': 5, course: 8, renfo: 4 }

export function sessionKcal(s: DaySession, weightKg: number): number {
  if (s.kcal != null) return s.kcal
  if (s.kind === 'course' && s.distanceKm) return Math.round(s.distanceKm * weightKg)
  const met = NET_MET[s.kind] * (s.rpe && s.rpe >= 7 ? 1.25 : 1)
  return Math.round((met * 3.5 * weightKg * s.minutes) / 200)
}

export type DayType = 'repos' | 'leger' | 'soutenu'

export function dayType(sessions: DaySession[]): DayType {
  const run = sessions.filter((s) => s.kind !== 'renfo').reduce((a, s) => a + s.minutes, 0)
  const hard = sessions.some((s) => (s.rpe ?? 0) >= 7)
  if (!sessions.length) return 'repos'
  return run >= 75 || hard ? 'soutenu' : 'leger'
}

const CARB_GKG: Record<DayType, [number, number]> = { repos: [3, 4], leger: [4, 5], soutenu: [5, 7] }

export interface DayTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  bmr: number
  tdee: number
  exerciseKcal: number
  dayType: DayType
  /** Repère glucides en g/kg pour ce type de journée. */
  carbRangeGkg: [number, number]
  notes: string[]
}

export function dayTargets(p: NutritionProfile, sessions: DaySession[]): DayTargets {
  const base = bmr(p)
  const exerciseKcal = sessions.reduce((a, s) => a + sessionKcal(s, p.weightKg), 0)
  const tdee = Math.round(base * ACTIVITY_FACTOR[p.activity] + exerciseKcal)
  const notes: string[] = []
  let kcal = tdee
  if (p.goal === 'perte') {
    const deficit = Math.min(500, Math.round(tdee * 0.15))
    kcal = tdee - deficit
    const floor = Math.max(base, KCAL_FLOOR[p.sex])
    if (kcal < floor) {
      kcal = floor
      notes.push(`Objectif calorique remonté au plancher de sécurité (${floor} kcal) : ne descends jamais en dessous.`)
    }
    notes.push(`Léger déficit (−${tdee - kcal} kcal) : perte progressive, sans sacrifier l’entraînement.`)
  } else if (p.goal === 'prise') {
    kcal = tdee + Math.min(300, Math.round(tdee * 0.1))
  }
  const protein = Math.round(p.weightKg * (p.goal === 'perte' ? 1.8 : 1.6))
  const fat = Math.round(Math.max(p.weightKg * 0.8, (kcal * 0.25) / 9))
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  const dt = dayType(sessions)
  const range = CARB_GKG[dt]
  if (carbs < range[0] * p.weightKg && dt !== 'repos') notes.push('Glucides un peu bas pour ta séance : privilégie féculents et fruits autour de l’entraînement.')
  return { kcal, protein, carbs, fat, bmr: base, tdee, exerciseKcal, dayType: dt, carbRangeGkg: range, notes }
}

/* ---------- Objectif de poids (garde-fous stricts) ---------- */

export interface WeightPlanCheck {
  weeklyRateKg: number
  /** % du poids par semaine */
  weeklyRatePct: number
  verdict: 'raisonnable' | 'trop-rapide'
  earliestWeeks: number
  messages: string[]
}

export const MAX_WEEKLY_LOSS_PCT = 0.75

export function checkWeightGoal(currentKg: number, targetKg: number, weeks: number, heightCm: number): WeightPlanCheck {
  const diff = currentKg - targetKg
  const weeklyRateKg = weeks > 0 ? diff / weeks : diff
  const weeklyRatePct = (weeklyRateKg / currentKg) * 100
  const earliestWeeks = Math.ceil(diff / (currentKg * (MAX_WEEKLY_LOSS_PCT / 100)))
  const messages: string[] = []
  const bmiTarget = targetKg / (heightCm / 100) ** 2
  const verdict = weeklyRatePct > MAX_WEEKLY_LOSS_PCT ? 'trop-rapide' : 'raisonnable'
  if (verdict === 'trop-rapide') messages.push(`Rythme trop rapide (${weeklyRatePct.toFixed(1).replace('.', ',')} %/semaine). Repère prudent : ≤ ${MAX_WEEKLY_LOSS_PCT} % par semaine, soit au moins ${earliestWeeks} semaines.`)
  if (bmiTarget < 18.5) messages.push('Le poids visé correspond à un IMC inférieur à 18,5 : parles-en à un médecin avant de te fixer cet objectif.')
  if (diff / currentKg > 0.1) messages.push('Objectif de perte important (plus de 10 % de ton poids) : un accompagnement par un médecin ou un diététicien est recommandé.')
  return { weeklyRateKg, weeklyRatePct, verdict, earliestWeeks, messages }
}

/* ---------- Hydratation ---------- */

export interface HydrationTarget {
  ml: number
  reasons: string[]
}

export function hydrationTarget(weightKg: number, sessionMinutes: number, maxTempC?: number): HydrationTarget {
  const reasons: string[] = []
  let ml = Math.round((weightKg * 30) / 50) * 50
  reasons.push(`Base : ~30 ml/kg de boissons (${ml} ml).`)
  if (sessionMinutes > 0) {
    const hot = (maxTempC ?? 0) >= 25
    const s = Math.round(((sessionMinutes / 60) * (hot ? 750 : 500)) / 50) * 50
    ml += s
    reasons.push(`Séance de ${sessionMinutes} min : +${s} ml${hot ? ' (chaleur)' : ''}.`)
  }
  if (maxTempC != null && maxTempC >= 25) {
    const extra = maxTempC >= 30 ? 500 : 250
    ml += extra
    reasons.push(`Chaleur (${Math.round(maxTempC)} °C) : +${extra} ml.`)
  }
  return { ml, reasons }
}

/* ---------- Repères avant / pendant / après ---------- */

export interface FuelingTips {
  avant: string[]
  pendant: string[]
  apres: string[]
}

/** Repères généraux selon la durée et l'intensité. `dislikes` : aliments à ne pas proposer. */
export function fuelingTips(minutes: number, hard: boolean, kind: 'course' | 'renfo', dislikes: string[] = []): FuelingTips {
  const avoid = (s: string) => !dislikes.some((d) => s.toLowerCase().includes(d.toLowerCase()))
  const pick = (opts: string[]) => opts.filter(avoid).slice(0, 2).join(' ou ')
  const avant = [
    `Repas habituel 2 à 3 h avant, ou petite collation 30 à 60 min avant (${pick(['une compote', 'une tranche de pain d’épices', 'une poignée de fruits secs', 'une banane'])}).`,
  ]
  if (minutes >= 75 || hard) avant.push('Séance longue ou soutenue : un repas riche en féculents la veille au soir (pâtes, riz, pommes de terre).')
  const pendant: string[] = []
  if (kind === 'renfo') pendant.push('Quelques gorgées d’eau entre les exercices.')
  else if (minutes < 60) pendant.push('Pas besoin de manger. Une gourde si il fait chaud.')
  else if (minutes < 90) pendant.push('Eau : 400 à 600 ml par heure. Un gel ou des fruits secs si tu sens un coup de mou.')
  else pendant.push('Eau : 500 à 750 ml par heure, et 30 à 60 g de glucides par heure (gels, pâte de fruits, fruits secs) dès 45 min.')
  const apres = [
    `Dans les 2 h : un repas ou une collation avec 20 à 30 g de protéines${kind === 'course' ? ' et des glucides' : ''} (${pick(['yaourt + céréales', 'jambon + pain', 'lait + muesli', 'fromage blanc + fruits'])}).`,
    'Bois régulièrement jusqu’à retrouver une urine claire.',
  ]
  return { avant, pendant, apres }
}

/* ---------- Eau : estimation simple ---------- */

/** Réponse du check du matin → quantité estimée (milieu de la fourchette). */
export const WATER_ESTIMATE_ML: Record<'moins-1' | '1-1.5' | '1.5-2' | 'plus-2', number> = {
  'moins-1': 750,
  '1-1.5': 1250,
  '1.5-2': 1750,
  'plus-2': 2250,
}

/**
 * Eau bue un jour donné : ce que j'ai saisi (verres, gourdes), sinon l'estimation du check du matin,
 * sinon ce que la montre a enregistré. On ne cumule pas les sources (pas de double comptage).
 */
export function waterOfDay(manualMl: number, checkMl: number | undefined, watchMl: number | undefined): { ml: number; source: 'manuel' | 'check' | 'montre' | 'aucune' } {
  if (manualMl > 0) return { ml: manualMl, source: 'manuel' }
  if (checkMl != null) return { ml: checkMl, source: 'check' }
  if (watchMl != null && watchMl > 0) return { ml: watchMl, source: 'montre' }
  return { ml: 0, source: 'aucune' }
}
