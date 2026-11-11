import type { DayType } from './nutrition'

/**
 * RÉPARTITION DE LA JOURNÉE ET « ASSIETTE DU SPORTIF ».
 *
 * Repères généraux de nutrition du sport (assiette composée, répartition par repas) :
 * - Jour de repos : ¼ d'assiette de féculents, ¼ protéines, ½ légumes.
 * - Jour d'entraînement léger : ⅓ féculents, ⅓ protéines, ⅓ légumes.
 * - Jour soutenu ou veille de sortie longue : ½ féculents, ¼ protéines, ¼ légumes.
 * - Séance le soir : collation glucidique 1 à 2 h avant, dîner de récupération (protéines + féculents).
 * - Séance le matin : petit-déjeuner de récupération plus copieux.
 * Exprimé en portions (pas de pesée).
 */

export type MealId = 'petit-dej' | 'dejeuner' | 'collation' | 'diner'
export type SessionSlot = 'matin' | 'midi' | 'soir'

export function mealShares(hasSession: boolean, slot: SessionSlot = 'soir'): Record<MealId, number> {
  if (!hasSession) return { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 }
  if (slot === 'matin') return { 'petit-dej': 0.3, dejeuner: 0.35, collation: 0.08, diner: 0.27 }
  if (slot === 'midi') return { 'petit-dej': 0.25, dejeuner: 0.35, collation: 0.1, diner: 0.3 }
  return { 'petit-dej': 0.22, dejeuner: 0.33, collation: 0.15, diner: 0.3 }
}

export interface MealBudget {
  meal: MealId
  target: number
  eaten: number
}

export function mealBudgets(dayKcal: number, eatenByMeal: Partial<Record<MealId, number>>, hasSession: boolean, slot?: SessionSlot): MealBudget[] {
  const shares = mealShares(hasSession, slot)
  return (Object.keys(shares) as MealId[]).map((meal) => ({ meal, target: Math.round((dayKcal * shares[meal]) / 10) * 10, eaten: Math.round(eatenByMeal[meal] ?? 0) }))
}

export interface Plate {
  feculents: 'petite' | 'normale' | 'grosse'
  text: string
  examples: string
}

/** Assiette conseillée pour un repas principal, selon la journée et le lendemain. */
export function plateFor(meal: 'dejeuner' | 'diner', today: DayType, tomorrow: DayType, slot: SessionSlot = 'soir'): Plate {
  const preLong = meal === 'diner' && tomorrow === 'soutenu'
  const postSession = today !== 'repos' && ((meal === 'diner' && slot === 'soir') || (meal === 'dejeuner' && slot !== 'soir'))
  if (preLong || today === 'soutenu')
    return {
      feculents: 'grosse',
      text: `½ assiette de féculents, ¼ de protéines, ¼ de légumes${preLong ? ' : on fait le plein pour la séance de demain' : ''}.`,
      examples: 'ex. une grosse assiette de pâtes ou de riz, un filet de poulet ou de poisson, des légumes.',
    }
  if (postSession)
    return {
      feculents: 'normale',
      text: '⅓ de féculents, ⅓ de protéines, ⅓ de légumes : repas de récupération après ta séance.',
      examples: 'ex. une assiette normale de riz ou de pommes de terre, un steak ou du poisson, une portion de légumes.',
    }
  return {
    feculents: today === 'repos' ? 'petite' : 'normale',
    text: today === 'repos' ? '¼ de féculents, ¼ de protéines, ½ de légumes : jour de repos, besoins plus modestes.' : '⅓ de féculents, ⅓ de protéines, ⅓ de légumes.',
    examples: today === 'repos' ? 'ex. une petite portion de féculents, une portion de protéines, beaucoup de légumes.' : 'ex. une assiette équilibrée classique.',
  }
}

/** Facteur de portion d'une recette pour coller au budget du repas (¾ à 1½ portion, par quarts). */
export function recipeScale(recipeKcal: number, mealTarget: number): number {
  if (recipeKcal <= 0 || mealTarget <= 0) return 1
  const f = mealTarget / recipeKcal
  return Math.min(1.5, Math.max(0.75, Math.round(f * 4) / 4))
}

/**
 * Dépense nette d'une séance mesurée par la montre : les calories Garmin sont « brutes »
 * (elles incluent ce que le corps aurait brûlé au repos) ; on retire le métabolisme de base sur la durée.
 */
export function netSessionKcal(watchKcal: number, minutes: number, bmr: number): number {
  return Math.max(0, Math.round(watchKcal - (bmr / 1440) * minutes))
}
