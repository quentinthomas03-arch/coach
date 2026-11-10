import type { FoodItem, FoodLogEntry, ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays } from '../domain/dates'
import { forGrams } from '../domain/foodSearch'
import { dayTargets, fuelingTips, hydrationTarget, waterOfDay, WATER_ESTIMATE_ML, type ActivityLevel, type DaySession, type DayTargets, type FuelingTips, type HydrationTarget, type WeightGoal } from '../domain/nutrition'
import { RUN_TYPES } from '../domain/activities'
import { dishFoods } from '../domain/dishes'
import { currentPosition, fetchTodayMax } from '../integrations/weather'

export type Meal = FoodLogEntry['meal']
export const MEALS: { id: Meal; label: string }[] = [
  { id: 'petit-dej', label: 'Petit-déjeuner' },
  { id: 'dejeuner', label: 'Déjeuner' },
  { id: 'collation', label: 'Collation' },
  { id: 'diner', label: 'Dîner' },
]

export interface NutritionConfig {
  activity: ActivityLevel
  goal: WeightGoal
  /** Objectif de poids (facultatif). */
  targetWeightKg?: number
  targetDate?: ISODate
  /** Utiliser la météo (position) pour l'hydratation. */
  weather: boolean
  /** Contenance de ma gourde (ml) : 1 tap = 1 gourde. */
  bottleMl: number
}
export const NUTRITION_KEY = 'nutrition.config'
export const DEFAULT_NUTRITION: NutritionConfig = { activity: 'sedentaire', goal: 'maintien', weather: true, bottleMl: 500 }
export const getNutritionConfig = async (database: CoachDB = db) => ({ ...DEFAULT_NUTRITION, ...((await getSetting<NutritionConfig>(NUTRITION_KEY, database)) ?? {}) })

/* ---------- Base Ciqual (chargée à la demande, gardée en mémoire) ---------- */

let ciqualCache: FoodItem[] | undefined
export async function loadCiqual(): Promise<FoodItem[]> {
  if (ciqualCache) return ciqualCache
  const res = await fetch(`${import.meta.env.BASE_URL}data/ciqual.json`)
  const data = (await res.json()) as { foods: [number, string, string, number, number, number, number, number][] }
  ciqualCache = data.foods.map(([code, name, group, kcal, protein, carbs, fat]) => ({ id: `ciqual-${code}`, source: 'ciqual' as const, name, group, kcal, protein, carbs, fat }))
  return ciqualCache
}

/** Tous les aliments cherchables : mes aliments (favoris, déjà utilisés, perso, produits) + Ciqual. */
export async function allFoods(database: CoachDB = db): Promise<FoodItem[]> {
  const mine = await database.foods.toArray()
  const ciq = await loadCiqual().catch(() => [])
  const table = new Map(ciq.map((f) => [Number(f.id.replace('ciqual-', '')), { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }]))
  const mineIds = new Set(mine.map((f) => f.id))
  return [...mine, ...[...dishFoods(table), ...ciq].filter((f) => !mineIds.has(f.id))]
}

/* ---------- Journal ---------- */

export async function addFood(date: ISODate, meal: Meal, food: FoodItem, grams: number, database: CoachDB = db) {
  const v = forGrams(food, grams)
  const known = await database.foods.get(food.id)
  await database.foods.put({ ...food, ...known, favorite: known?.favorite ?? food.favorite, usageCount: (known?.usageCount ?? 0) + 1, lastUsedAt: new Date().toISOString(), portionG: grams })
  await database.foodLog.add({ date, meal, foodId: food.id, name: food.name, grams, ...v, at: new Date().toISOString() })
}

export async function removeEntry(id: number, database: CoachDB = db) {
  await database.foodLog.delete(id)
}

export async function toggleFavorite(food: FoodItem, database: CoachDB = db) {
  const known = await database.foods.get(food.id)
  await database.foods.put({ ...food, ...known, favorite: !(known?.favorite ?? false) })
}

export async function createCustomFood(f: Omit<FoodItem, 'id' | 'source'>, database: CoachDB = db): Promise<FoodItem> {
  const food: FoodItem = { ...f, id: `perso-${Date.now().toString(36)}`, source: 'perso' }
  await database.foods.put(food)
  return food
}

/** Copie un repas d'un jour vers un autre (ex. « comme hier »). */
export async function copyMeal(from: ISODate, to: ISODate, meal: Meal, database: CoachDB = db) {
  const src = await database.foodLog.where('date').equals(from).filter((e) => e.meal === meal).toArray()
  const at = new Date().toISOString()
  await database.foodLog.bulkAdd(src.map((e) => ({ ...e, id: undefined, date: to, at })))
  return src.length
}

/** Repas mémorisés (« mon petit-déj habituel ») : ajout en un tap. */
export interface SavedMeal {
  id: string
  name: string
  items: { foodId: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number }[]
}
const SAVED_KEY = 'nutrition.savedMeals'
export const getSavedMeals = async (database: CoachDB = db) => (await getSetting<SavedMeal[]>(SAVED_KEY, database)) ?? []

export async function saveMeal(date: ISODate, meal: Meal, name: string, database: CoachDB = db) {
  const items = (await database.foodLog.where('date').equals(date).filter((e) => e.meal === meal).toArray()).map(({ foodId, name, grams, kcal, protein, carbs, fat }) => ({ foodId, name, grams, kcal, protein, carbs, fat }))
  if (!items.length) return
  await setSetting(SAVED_KEY, [...(await getSavedMeals(database)), { id: `repas-${Date.now().toString(36)}`, name, items }], database)
}

export async function addSavedMeal(date: ISODate, meal: Meal, saved: SavedMeal, database: CoachDB = db) {
  const at = new Date().toISOString()
  await database.foodLog.bulkAdd(saved.items.map((i) => ({ ...i, date, meal, at })))
}

export async function deleteSavedMeal(id: string, database: CoachDB = db) {
  await setSetting(SAVED_KEY, (await getSavedMeals(database)).filter((m) => m.id !== id), database)
}

export function totals(entries: FoodLogEntry[]) {
  const r = (n: number) => Math.round(n)
  return {
    kcal: r(entries.reduce((a, e) => a + e.kcal, 0)),
    protein: r(entries.reduce((a, e) => a + e.protein, 0)),
    carbs: r(entries.reduce((a, e) => a + e.carbs, 0)),
    fat: r(entries.reduce((a, e) => a + e.fat, 0)),
  }
}

/* ---------- Hydratation ---------- */

export async function addWater(date: ISODate, ml: number, database: CoachDB = db) {
  await database.hydration.add({ date, ml, at: new Date().toISOString(), source: 'manuel' })
}
export async function undoLastWater(date: ISODate, database: CoachDB = db) {
  const last = await database.hydration.where('date').equals(date).filter((h) => h.source !== 'check').last()
  if (last?.id != null) await database.hydration.delete(last.id)
}

/** Estimation de la veille, depuis le check du matin (remplace une estimation précédente). */
export async function setWaterEstimate(date: ISODate, estimate: keyof typeof WATER_ESTIMATE_ML | undefined, database: CoachDB = db) {
  const prev = await database.hydration.where('date').equals(date).filter((h) => h.source === 'check').primaryKeys()
  await database.hydration.bulkDelete(prev)
  if (estimate) await database.hydration.add({ date, ml: WATER_ESTIMATE_ML[estimate], at: new Date().toISOString(), source: 'check' })
}

const METEO_KEY = 'meteo.today'
/** Température max du jour (mise en cache pour la journée). Ne bloque jamais. */
export async function todayMaxTemp(today: ISODate, database: CoachDB = db): Promise<number | undefined> {
  const cached = await getSetting<{ date: string; tmaxC: number }>(METEO_KEY, database)
  if (cached?.date === today) return cached.tmaxC
  const cfg = await getNutritionConfig(database)
  if (!cfg.weather) return undefined
  try {
    const pos = await currentPosition()
    if (!pos) return undefined
    const w = await fetchTodayMax(pos.lat, pos.lon)
    if (w) await setSetting(METEO_KEY, w, database)
    return w?.tmaxC
  } catch {
    return undefined
  }
}

/* ---------- La journée ---------- */

export interface NutritionDay {
  targets?: DayTargets
  hydration: HydrationTarget
  waterMl: number
  /** D'où vient le chiffre de l'eau. */
  waterSource: 'manuel' | 'check' | 'montre' | 'aucune'
  bottleMl: number
  entries: FoodLogEntry[]
  eaten: ReturnType<typeof totals>
  tips?: FuelingTips
  sessionsLabel: string
  missingProfile: boolean
}

export async function nutritionDay(date: ISODate, tmaxC?: number, database: CoachDB = db): Promise<NutritionDay> {
  const [profile, cfg, sessions, acts, entries, water, metrics, wellness] = await Promise.all([
    database.profile.get('me'),
    getNutritionConfig(database),
    database.sessions.where('date').equals(date).filter((s) => s.status !== 'skipped' && s.status !== 'missed' && s.kind !== 'repos').toArray(),
    database.activities.where('date').equals(date).toArray(),
    database.foodLog.where('date').equals(date).toArray(),
    database.hydration.where('date').equals(date).toArray(),
    database.bodyMetrics.orderBy('date').reverse().filter((m) => m.weightKg != null).first(),
    database.wellness.get(date),
  ])
  const manual = water.filter((w) => w.source !== 'check').reduce((a, w) => a + w.ml, 0)
  const check = water.find((w) => w.source === 'check')?.ml
  const w = waterOfDay(manual, check, wellness?.hydrationMl)
  // Séances : l'activité réelle si elle existe, sinon la séance prévue.
  const day: DaySession[] = []
  for (const s of sessions) {
    const a = acts.find((x) => x.matchedSessionId === s.id)
    const kind: DaySession['kind'] = s.kind === 'renfo' ? 'renfo' : s.kind === 'marche-course' ? 'marche-course' : 'course'
    day.push({ kind, minutes: a ? Math.round(a.durationSec / 60) : s.durationMin, distanceKm: a?.distanceM ? a.distanceM / 1000 : undefined, rpe: s.key ? 7 : undefined })
  }
  for (const a of acts.filter((x) => !x.matchedSessionId && RUN_TYPES.has(x.type))) {
    day.push({ kind: 'course', minutes: Math.round(a.durationSec / 60), distanceKm: a.distanceM ? a.distanceM / 1000 : undefined, rpe: a.rpe })
  }
  const weightKg = metrics?.weightKg ?? profile?.weightKg
  const missingProfile = !profile || !profile.heightCm || !weightKg
  const targets = !missingProfile
    ? dayTargets({ sex: profile!.sex, age: new Date(date).getFullYear() - profile!.birthYear, heightCm: profile!.heightCm!, weightKg: weightKg!, activity: cfg.activity, goal: cfg.goal }, day)
    : undefined
  const runMin = day.reduce((a, s) => a + s.minutes, 0)
  const main = day.filter((s) => s.kind !== 'renfo').sort((a, b) => b.minutes - a.minutes)[0] ?? day[0]
  return {
    targets,
    hydration: hydrationTarget(weightKg ?? 70, runMin, tmaxC),
    waterMl: w.ml,
    waterSource: w.source,
    bottleMl: cfg.bottleMl,
    entries,
    eaten: totals(entries),
    tips: main ? fuelingTips(main.minutes, (main.rpe ?? 0) >= 7, main.kind === 'renfo' ? 'renfo' : 'course', profile?.foodDislikes ?? []) : undefined,
    sessionsLabel: day.length ? day.map((s) => `${s.kind === 'renfo' ? 'renfo' : 'course'} ${s.minutes} min`).join(' + ') : 'repos',
    missingProfile,
  }
}

export const yesterday = (d: ISODate) => addDays(d, -1)
