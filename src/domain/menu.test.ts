import { describe, expect, it } from 'vitest'
import { basketIdeas, planMenu, recipeNutrients, shoppingList, shoppingText, weekDates, type MenuDayContext } from './menu'
import { RECIPES, recipeById } from './recipes'
import { PRODUCE, inSeason } from './seasons'
import ciqual from '../../public/data/ciqual.json'

const table = new Map((ciqual as unknown as { foods: [number, string, string, number, number, number, number, number][] }).foods.map((f) => [f[0], { kcal: f[3], protein: f[4], carbs: f[5], fat: f[6] }]))
const days = (types: MenuDayContext['dayType'][]): MenuDayContext[] =>
  weekDates('2026-11-16').map((date, i) => ({ date, dayType: types[i], tomorrow: types[i + 1] ?? 'repos' }))
const WEEK = days(['repos', 'leger', 'repos', 'leger', 'repos', 'repos', 'soutenu'])

describe('recettes', () => {
  it('tous les ingrédients existent dans Ciqual et les valeurs sont plausibles', () => {
    for (const r of RECIPES) {
      for (const i of r.ingredients) expect(table.has(i.code), `${r.id} : ${i.name} (${i.code})`).toBe(true)
      const n = recipeNutrients(r, table)
      expect(n.kcal, r.id).toBeGreaterThan(150)
      expect(n.kcal, r.id).toBeLessThan(1100)
    }
  })
  it('aucun œuf entier, saumon ni fruit exotique', () => {
    const banned = /(^|\s)(oeufs?|œufs?)\b|saumon|mangue|ananas|avocat|coco|papaye|passion/i
    for (const r of RECIPES) expect(r.ingredients.some((i) => banned.test(i.name)), r.id).toBe(false)
  })
  it('saisons : en novembre, potiron oui, tomate non', () => {
    const nov = inSeason(11).map((p) => p.id)
    expect(nov).toContain('potiron')
    expect(nov).not.toContain('tomate')
    expect(PRODUCE.every((p) => p.months.length > 0)).toBe(true)
  })
})

describe('menu de la semaine', () => {
  it('veille de sortie longue : dîner riche en féculents', () => {
    const m = planMenu({ days: WEEK, recipes: RECIPES, month: 11, basket: [], dislikes: [] })
    const sat = m[5]
    expect(recipeById(sat.dinner.recipeId)!.tags).toContain('feculents')
    expect(sat.dinner.why).toMatch(/féculents/)
  })
  it('évite les légumes hors saison et répète peu', () => {
    const m = planMenu({ days: WEEK, recipes: RECIPES, month: 11, basket: [], dislikes: [] })
    const used = m.flatMap((d) => [d.lunch, d.dinner]).filter((x) => !x.leftover).map((x) => recipeById(x.recipeId)!)
    expect(used.some((r) => r.ingredients.some((i) => i.produce === 'tomate' && i.g > 0 && r.id === 'ratatouille'))).toBe(false)
    const cooked = m.flatMap((d) => [d.lunch, d.dinner]).filter((x) => !x.leftover).map((x) => x.recipeId)
    expect(new Set(cooked).size).toBe(cooked.length) // aucune recette cuisinée deux fois
    expect(m.filter((d) => d.lunch.leftover).length).toBeLessThanOrEqual(4)
  })
  it('panier du maraîcher utilisé en priorité, restes en déjeuner', () => {
    const m = planMenu({ days: WEEK, recipes: RECIPES, month: 11, basket: [{ produce: 'poireau', addedAt: '2026-11-15' }, { produce: 'epinard', addedAt: '2026-11-15' }], dislikes: [] })
    const all = m.flatMap((d) => [d.lunch, d.dinner]).map((x) => recipeById(x.recipeId)!)
    expect(all.some((r) => r.ingredients.some((i) => i.produce === 'poireau'))).toBe(true)
    expect(all.some((r) => r.ingredients.some((i) => i.produce === 'epinard'))).toBe(true)
    expect(m.some((d) => d.lunch.leftover)).toBe(true)
  })
  it('respecte mes repas fixés et les aliments que je n’aime pas', () => {
    const m = planMenu({ days: WEEK, recipes: RECIPES, month: 11, basket: [], dislikes: ['thon'], locked: { '2026-11-18': { dinner: 'chili' } } })
    expect(m[2].dinner).toMatchObject({ recipeId: 'chili', locked: true })
    expect(m.flatMap((d) => [d.lunch.recipeId, d.dinner.recipeId])).not.toContain('pates-thon-tomate')
  })
})

describe('courses et panier', () => {
  const menu = planMenu({ days: WEEK, recipes: RECIPES, month: 11, basket: [{ produce: 'poireau', addedAt: '' }], dislikes: [] })
  it('liste agrégée, triée par rayon, placard exclu, panier signalé', () => {
    const list = shoppingList(menu, RECIPES, [{ produce: 'poireau', addedAt: '' }])
    expect(list[0].rayon).toBe('Fruits et légumes')
    expect(list.some((i) => i.name === 'Huile d’olive')).toBe(false)
    const p = list.find((i) => i.name === 'Poireaux')
    if (p) expect(p.inBasket).toBe(true)
    expect(new Set(list.map((i) => i.key)).size).toBe(list.length)
    const txt = shoppingText(list, new Set())
    expect(txt).toMatch(/^Liste de courses/)
    expect(txt).not.toMatch(/Poireaux/)
  })
  it('féculents en poids sec, jours passés ignorés', () => {
    const list = shoppingList(menu, RECIPES, [])
    expect(list.some((i) => /poids cuit/.test(i.name))).toBe(false)
    const later = shoppingList(menu, RECIPES, [], false, '2026-11-20')
    expect(later.reduce((a, i) => a + i.grams, 0)).toBeLessThan(list.reduce((a, i) => a + i.grams, 0))
  })
  it('en novembre, pas de tomates fraîches au menu', () => {
    const used = menu.flatMap((d) => [d.lunch, d.dinner]).map((x) => recipeById(x.recipeId)!)
    expect(used.some((r) => r.ingredients.some((i) => i.produce === 'tomate'))).toBe(false)
  })
  it('idées pour mes légumes, fragiles d’abord', () => {
    const ideas = basketIdeas([{ produce: 'epinard', addedAt: '' }, { produce: 'carotte', addedAt: '' }], RECIPES, [])
    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas[0].uses).toContain('Épinards')
  })
})
