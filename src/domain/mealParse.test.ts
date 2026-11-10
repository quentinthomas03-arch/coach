import { describe, expect, it } from 'vitest'
import ciqual from '../../public/data/ciqual.json'
import type { FoodItem } from '../data/types'
import { parseMeal, splitMeal } from './mealParse'
import { normalPortion, portionGrams } from './portions'
import { dishFoods } from './dishes'

const foods: FoodItem[] = (ciqual as unknown as { foods: [number, string, string, number, number, number, number][] }).foods.map(([code, name, group, kcal, protein, carbs, fat]) => ({
  id: `ciqual-${code}`, source: 'ciqual', name, group, kcal, protein, carbs, fat,
}))
const best = (t: string) => parseMeal(t, foods).map((x) => x.best?.name)

describe('décris ton repas', () => {
  it('découpe la phrase', () => {
    expect(splitMeal('colin pané, écrasé de pommes de terre et fondue de poireaux')).toEqual(['colin pané', 'écrasé de pommes de terre', 'fondue de poireaux'])
  })
  it('l’exemple du colin d’Alaska', () => {
    const r = best("colin d'Alaska pané, écrasé de pommes de terre et fondue de poireaux")
    expect(r[0]).toMatch(/^Poisson pané/)
    expect(r[1]).toMatch(/^Purée de pomme de terre/)
    expect(r[2]).toMatch(/^Fondue de poireau/)
  })
  it('repas du quotidien', () => {
    const r = best('steak haché, frites, salade')
    expect(r[0]).toMatch(/steak haché/i)
    expect(r[1]).toMatch(/^Frites/)
    expect(r[2]).toMatch(/^Laitue/)
    const p = best('spaghetti bolognaise + yaourt + pomme')
    expect(p[0]).toMatch(/bolognaise/i)
    expect(p[1]).toMatch(/^Yaourt/)
    expect(p[2]).toMatch(/^Pomme/)
    expect(best('pain, beurre, confiture, café')).toEqual([expect.stringMatching(/^Pain/), expect.stringMatching(/^Beurre/), expect.stringMatching(/^Confiture/), expect.stringMatching(/^Café/)])
  })
  it('plats du resto et du quotidien, cuit avant cru', () => {
    const all = [...foods, ...dishFoods(new Map(foods.map((f) => [Number(f.id.slice(7)), { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }])))]
    const r = parseMeal('onglet de boeuf, frites, burger, tacos, poke bowl, coca, bière, pizza reine, kebab, paella', all).map((x) => x.best?.name)
    expect(r[0]).toBe('Boeuf, onglet grillé/poêlé')
    expect(r[1]).toMatch(/^Frites/)
    expect(r[2]).toMatch(/^Hamburger/)
    expect(r[3]).toMatch(/^Tacos/)
    expect(r[4]).toMatch(/^Poke bowl/)
    expect(r[5]).toMatch(/^Boisson gazeuse.*sucrée/)
    expect(r[6]).toMatch(/^Bière/)
    expect(r[7]).toMatch(/reine/)
    expect(r[8]).toMatch(/kebab/)
    expect(r[9]).toMatch(/^Paëlla/)
    expect(best('entrecôte')[0]).toMatch(/grillée|poêlée/)
  })
  it('chaque aliment trouvé a des alternatives', () => {
    expect(parseMeal('riz', foods)[0].alternatives.length).toBeGreaterThan(0)
  })
})

describe('portions sans pesée', () => {
  const f = (name: string, group: string): FoodItem => ({ id: name, source: 'ciqual', name, group, kcal: 100, protein: 0, carbs: 0, fat: 0 })
  it('repères usuels', () => {
    expect(normalPortion(f('Poisson pané, frit', 'Produits à base de poissons et produits de la mer')).g).toBe(120)
    expect(normalPortion(f('Purée de pomme de terre (aliment moyen)', 'Pommes de terre et autres tubercules')).g).toBe(200)
    expect(normalPortion(f('Yaourt à la grecque nature', 'Produits laitiers frais et alternatives végétales'))).toMatchObject({ g: 125, label: '1 pot' })
    expect(normalPortion(f('Huile d’olive vierge extra', 'Huiles et graisses végétales')).g).toBe(10)
    expect(normalPortion(f('Pâtes sèches, standard, crues', 'Pâtes, riz et céréales')).g).toBe(80)
    expect(normalPortion(f('Pâtes sèches, standard, cuites, sans sel ajouté', 'Pâtes, riz et céréales')).g).toBe(200)
  })
  it('petite et grosse portion ; ma portion habituelle prime', () => {
    const r = f('Riz blanc, cuit', 'Pâtes, riz et céréales')
    expect(portionGrams(r, 'petite')).toBe(140)
    expect(portionGrams(r, 'grosse')).toBe(280)
    expect(normalPortion({ ...r, portionG: 250 }).g).toBe(250)
  })
})
