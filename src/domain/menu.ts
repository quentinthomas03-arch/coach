import type { ISODate } from '../data/types'
import { addDays } from './dates'
import { produceById } from './seasons'
import type { DayType } from './nutrition'
import type { Ingredient, Rayon, Recipe } from './recipes'

/**
 * MENU DE LA SEMAINE, LISTE DE COURSES, PANIER DU MARAÎCHER.
 *
 * Règles du menu (déterministes, explicables) :
 * - La veille d'une séance soutenue ou longue : dîner riche en féculents.
 * - Le soir d'une séance : dîner riche en protéines (récupération).
 * - Les légumes du panier sont utilisés en priorité (les fragiles d'abord), puis ceux de saison ;
 *   un légume hors saison est évité.
 * - Un plat « à cuisiner en avance » couvre aussi les déjeuners suivants (restes, 2-3 jours),
 *   un seul à la fois, deux fois par semaine (1er et 4e jour).
 * - Pas de recette répétée dans la semaine, aucune recette avec un aliment que je n'aime pas.
 */

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number }
export type NutrientTable = Map<number, Nutrients> // pour 100 g

export function recipeNutrients(r: Recipe, table: NutrientTable): Nutrients {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const i of r.ingredients) {
    const n = table.get(i.code)
    if (!n) continue
    const k = i.g / 100
    t.kcal += n.kcal * k
    t.protein += n.protein * k
    t.carbs += n.carbs * k
    t.fat += n.fat * k
  }
  return { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) }
}

export interface BasketItem {
  produce: string
  addedAt: ISODate
}

export interface MenuDayContext {
  date: ISODate
  /** Type de la journée (séance du jour). */
  dayType: DayType
  /** Type du lendemain (pour le dîner de la veille). */
  tomorrow: DayType
}

export interface MenuMeal {
  recipeId: string
  /** Vrai si c'est un reste d'un plat cuisiné en avance. */
  leftover?: boolean
  locked?: boolean
  why: string
}

export interface MenuDay {
  date: ISODate
  lunch: MenuMeal
  dinner: MenuMeal
}

export interface MenuInput {
  days: MenuDayContext[]
  recipes: Recipe[]
  month: number
  basket: BasketItem[]
  dislikes: string[]
  /** Repas déjà fixés par moi (gardés tels quels). */
  locked?: Partial<Record<string, { lunch?: string; dinner?: string }>>
}

const lc = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function allowed(r: Recipe, dislikes: string[]): boolean {
  const ds = dislikes.map(lc).filter(Boolean)
  return !r.ingredients.some((i) => ds.some((d) => lc(i.name).includes(d))) && !ds.some((d) => lc(r.name).includes(d))
}

function produceScore(r: Recipe, month: number, basket: BasketItem[], used: Map<string, number>): { score: number; basketHits: string[] } {
  let score = 0
  const basketHits: string[] = []
  for (const i of r.ingredients) {
    if (!i.produce) continue
    const p = produceById(i.produce)
    if (!p) continue
    if (basket.some((b) => b.produce === p.id)) {
      // Panier : fort bonus, plus fort pour les légumes fragiles, décroissant si déjà utilisé cette semaine.
      score += (p.fragile ? 40 : 25) / (1 + (used.get(p.id) ?? 0))
      basketHits.push(p.name.toLowerCase())
    } else if (p.months.includes(month)) score += 4
    else score -= 25
  }
  return { score, basketHits }
}

export function planMenu(input: MenuInput): MenuDay[] {
  const pool = input.recipes.filter((r) => !r.tags.includes('petit-dej') && allowed(r, input.dislikes))
  const lastUsed = new Map<string, number>() // recette → index du jour
  const produceUsed = new Map<string, number>()
  const leftovers: { recipeId: string; remaining: number }[] = []
  const out: MenuDay[] = []

  const choose = (dayIdx: number, want: 'feculents' | 'proteines' | undefined, slot: 'lunch' | 'dinner', ctx: MenuDayContext): MenuMeal => {
    const scored = pool.map((r) => {
      let s = 0
      const why: string[] = []
      const ps = produceScore(r, input.month, input.basket, produceUsed)
      s += ps.score
      if (ps.basketHits.length) why.push(`utilise ton panier (${ps.basketHits.join(', ')})`)
      if (want && r.tags.includes(want)) {
        s += want === 'feculents' ? 50 : 30 // la veille d'une séance longue, c'est prioritaire
        why.push(want === 'feculents' ? 'riche en féculents avant ta séance de demain' : 'riche en protéines pour récupérer de ta séance')
      }
      if (slot === 'lunch' && r.tags.includes('rapide')) s += 10
      // Un seul plat en avance à la fois : on en relance un quand les restes sont finis.
      const pending = leftovers.some((l) => l.remaining > 0)
      // Deux moments de « cuisine en avance » par semaine : 1er et 4e jour.
      const batchDay = dayIdx === 0 || dayIdx === 3
      if (r.tags.includes('batch')) s += pending || slot === 'lunch' || !batchDay ? -40 : 8
      if (ctx.dayType === 'repos' && r.tags.includes('leger')) s += 6
      const last = lastUsed.get(r.id)
      if (last != null) s -= dayIdx - last < 3 ? 100 : 60 // pas deux fois la même recette dans la semaine
      // Variété déterministe : léger décalage selon le jour.
      s += ((dayIdx * 7 + r.id.length * 3) % 5) * 0.5
      return { r, s, why }
    })
    scored.sort((a, b) => b.s - a.s || a.r.id.localeCompare(b.r.id))
    const best = scored[0]
    lastUsed.set(best.r.id, dayIdx)
    for (const i of best.r.ingredients) if (i.produce) produceUsed.set(i.produce, (produceUsed.get(i.produce) ?? 0) + 1)
    if (best.r.portions > 1) leftovers.push({ recipeId: best.r.id, remaining: best.r.portions - 1 })
    const why = best.why.length ? best.why.join(' ; ') : best.r.tags.includes('rapide') ? 'rapide à préparer' : 'équilibré et de saison'
    return { recipeId: best.r.id, why: why[0].toUpperCase() + why.slice(1) + '.' }
  }

  input.days.forEach((ctx, idx) => {
    const lock = input.locked?.[ctx.date]
    // Déjeuner : un reste s'il y en a (plat cuisiné en avance), sinon une recette rapide.
    let lunch: MenuMeal
    const lo = leftovers.find((l) => l.remaining > 0)
    if (lock?.lunch) lunch = { recipeId: lock.lunch, locked: true, why: 'Choisi par toi.' }
    else if (lo) {
      lo.remaining--
      lunch = { recipeId: lo.recipeId, leftover: true, why: 'Reste du plat cuisiné en avance.' }
    } else lunch = choose(idx, ctx.dayType === 'soutenu' ? 'feculents' : undefined, 'lunch', ctx)
    const want = ctx.tomorrow === 'soutenu' ? 'feculents' : ctx.dayType !== 'repos' ? 'proteines' : undefined
    const dinner: MenuMeal = lock?.dinner ? { recipeId: lock.dinner, locked: true, why: 'Choisi par toi.' } : choose(idx, want, 'dinner', ctx)
    out.push({ date: ctx.date, lunch, dinner })
  })
  return out
}

/* ---------- Liste de courses ---------- */

export interface ShoppingItem {
  key: string
  name: string
  grams: number
  rayon: Rayon
  /** Déjà dans le panier du maraîcher. */
  inBasket: boolean
}

export const RAYON_ORDER: Rayon[] = ['Fruits et légumes', 'Boucherie / poissonnerie', 'Crèmerie', 'Boulangerie', 'Épicerie']

/**
 * Agrège les ingrédients du menu (un plat en avance compte toutes ses portions une fois).
 * `from` : ignore les jours déjà passés. Les féculents sont en poids sec (à acheter).
 */
export function shoppingList(menu: MenuDay[], recipes: Recipe[], basket: BasketItem[], includePantry = false, from?: ISODate): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>()
  menu = from ? menu.filter((d) => d.date >= from) : menu
  const add = (i: Ingredient, mult: number) => {
    if (i.pantry && !includePantry) return
    const key = `${i.code}`
    const cur = map.get(key)
    const grams = i.g * mult * (i.buy?.factor ?? 1)
    if (cur) cur.grams += grams
    else map.set(key, { key, name: i.buy?.name ?? i.name, grams, rayon: i.rayon, inBasket: !!i.produce && basket.some((b) => b.produce === i.produce) })
  }
  for (const d of menu) {
    for (const m of [d.lunch, d.dinner]) {
      if (m.leftover) continue // déjà compté le jour où le plat est cuisiné
      const r = recipes.find((x) => x.id === m.recipeId)
      if (!r) continue
      for (const i of r.ingredients) add(i, r.portions)
    }
  }
  return [...map.values()]
    .map((x) => ({ ...x, grams: Math.ceil(x.grams / 10) * 10 }))
    .sort((a, b) => RAYON_ORDER.indexOf(a.rayon) - RAYON_ORDER.indexOf(b.rayon) || a.name.localeCompare(b.name, 'fr'))
}

export function formatQty(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1).replace('.', ',').replace(',0', '')} kg` : `${g} g`
}

/** Liste en texte, pour la partager (menu de partage iOS). */
export function shoppingText(items: ShoppingItem[], checked: Set<string>): string {
  const lines: string[] = ['Liste de courses']
  for (const r of RAYON_ORDER) {
    const list = items.filter((i) => i.rayon === r && !i.inBasket && !checked.has(i.key))
    if (!list.length) continue
    lines.push('', r.toUpperCase(), ...list.map((i) => `☐ ${i.name} — ${formatQty(i.grams)}`))
  }
  return lines.join('\n')
}

/** Idées de recettes pour les légumes du panier (les fragiles d'abord). */
export function basketIdeas(basket: BasketItem[], recipes: Recipe[], dislikes: string[], limit = 6): { recipe: Recipe; uses: string[] }[] {
  const ids = new Set(basket.map((b) => b.produce))
  return recipes
    .filter((r) => allowed(r, dislikes))
    .map((r) => {
      const uses = [...new Set(r.ingredients.filter((i) => i.produce && ids.has(i.produce)).map((i) => i.produce!))]
      const fragile = uses.filter((u) => produceById(u)?.fragile).length
      return { recipe: r, uses, score: uses.length * 10 + fragile * 5 - r.minutes / 10 }
    })
    .filter((x) => x.uses.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ recipe, uses }) => ({ recipe, uses: uses.map((u) => produceById(u)!.name) }))
}

export function weekDates(monday: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
