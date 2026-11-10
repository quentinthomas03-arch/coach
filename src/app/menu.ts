import type { ISODate } from '../data/types'
import { db, getSetting, setSetting, type CoachDB } from '../data/db'
import { addDays, mondayOf, parseISODate } from '../domain/dates'
import { planMenu, recipeNutrients, shoppingList, weekDates, type BasketItem, type MenuDay, type NutrientTable } from '../domain/menu'
import { dayType, type DaySession } from '../domain/nutrition'
import { RECIPES, recipeById } from '../domain/recipes'
import { addFood, loadCiqual, type Meal } from './nutrition'

const BASKET_KEY = 'basket.items'
const menuKey = (monday: ISODate) => `menu.${monday}`

export interface StoredMenu {
  days: MenuDay[]
  checked: string[]
  includePantry?: boolean
}

export const getBasket = async (database: CoachDB = db) => (await getSetting<BasketItem[]>(BASKET_KEY, database)) ?? []
export async function toggleBasket(produce: string, today: ISODate, database: CoachDB = db) {
  const b = await getBasket(database)
  await setSetting(BASKET_KEY, b.some((x) => x.produce === produce) ? b.filter((x) => x.produce !== produce) : [...b, { produce, addedAt: today }], database)
}
export const clearBasket = (database: CoachDB = db) => setSetting(BASKET_KEY, [], database)

export const getMenu = (monday: ISODate, database: CoachDB = db) => getSetting<StoredMenu>(menuKey(monday), database)

/** Type de chaque journée d'après les séances prévues. */
async function dayTypes(monday: ISODate, database: CoachDB) {
  const end = addDays(monday, 8)
  const sessions = await database.sessions.where('date').between(monday, end, true, false).filter((s) => s.status !== 'skipped' && s.kind !== 'repos').toArray()
  const typeOf = (d: ISODate) =>
    dayType(sessions.filter((s) => s.date === d).map((s): DaySession => ({ kind: s.kind === 'renfo' ? 'renfo' : 'course', minutes: s.durationMin, rpe: s.key ? 7 : undefined })))
  return weekDates(monday).map((date) => ({ date, dayType: typeOf(date), tomorrow: typeOf(addDays(date, 1)) }))
}

/** (Re)génère le menu de la semaine ; les repas fixés par moi sont conservés. */
export async function buildMenu(monday: ISODate, database: CoachDB = db): Promise<StoredMenu> {
  const prev = await getMenu(monday, database)
  const locked: Record<string, { lunch?: string; dinner?: string }> = {}
  for (const d of prev?.days ?? []) {
    locked[d.date] = { lunch: d.lunch.locked ? d.lunch.recipeId : undefined, dinner: d.dinner.locked ? d.dinner.recipeId : undefined }
  }
  const profile = await database.profile.get('me')
  const days = planMenu({
    days: await dayTypes(monday, database),
    recipes: RECIPES,
    month: parseISODate(monday).getMonth() + 1,
    basket: await getBasket(database),
    dislikes: profile?.foodDislikes ?? [],
    locked,
  })
  const menu: StoredMenu = { days, checked: prev?.checked ?? [], includePantry: prev?.includePantry }
  await setSetting(menuKey(monday), menu, database)
  return menu
}

export async function setMeal(monday: ISODate, date: ISODate, slot: 'lunch' | 'dinner', recipeId: string, database: CoachDB = db) {
  const m = (await getMenu(monday, database)) ?? (await buildMenu(monday, database))
  m.days = m.days.map((d) => (d.date === date ? { ...d, [slot]: { recipeId, locked: true, why: 'Choisi par toi.' } } : d))
  await setSetting(menuKey(monday), m, database)
  // Les autres repas non fixés se réorganisent (restes, variété).
  return buildMenu(monday, database)
}

export async function toggleChecked(monday: ISODate, key: string, database: CoachDB = db) {
  const m = await getMenu(monday, database)
  if (!m) return
  m.checked = m.checked.includes(key) ? m.checked.filter((k) => k !== key) : [...m.checked, key]
  await setSetting(menuKey(monday), m, database)
}

export async function setIncludePantry(monday: ISODate, v: boolean, database: CoachDB = db) {
  const m = await getMenu(monday, database)
  if (m) await setSetting(menuKey(monday), { ...m, includePantry: v }, database)
}

export async function shoppingFor(monday: ISODate, today: ISODate, database: CoachDB = db) {
  const m = await getMenu(monday, database)
  if (!m) return undefined
  return { items: shoppingList(m.days, RECIPES, await getBasket(database), m.includePantry, today), checked: new Set(m.checked), includePantry: !!m.includePantry }
}

let table: NutrientTable | undefined
export async function nutrientTable(): Promise<NutrientTable> {
  if (table) return table
  const foods = await loadCiqual()
  table = new Map(foods.map((f) => [Number(f.id.replace('ciqual-', '')), { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }]))
  return table
}

/** Ajoute une portion de recette au journal (un aliment « recette » réutilisable). */
export async function logRecipe(recipeId: string, date: ISODate, meal: Meal, database: CoachDB = db) {
  const r = recipeById(recipeId)
  if (!r) return
  const n = recipeNutrients(r, await nutrientTable())
  const grams = Math.round(r.ingredients.reduce((a, i) => a + i.g, 0))
  const per100 = (x: number) => Math.round((x / grams) * 1000) / 10
  await addFood(date, meal, { id: `recette-${r.id}`, source: 'perso', name: r.name, kcal: per100(n.kcal), protein: per100(n.protein), carbs: per100(n.carbs), fat: per100(n.fat), group: 'Recette' }, grams, database)
}

export const thisMonday = (today: ISODate) => mondayOf(today)
