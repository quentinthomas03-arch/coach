import { describe, expect, it } from 'vitest'
import { mealBudgets, mealShares, netSessionKcal, plateFor, recipeScale } from './mealPlan'

describe('répartition et assiette', () => {
  it('parts des repas : 100 % de la journée', () => {
    for (const [s, slot] of [[false, undefined], [true, 'soir'], [true, 'matin']] as const) {
      const v = Object.values(mealShares(s, slot))
      expect(Math.round(v.reduce((a, b) => a + b, 0) * 100)).toBe(100)
    }
    expect(mealShares(true, 'soir').collation).toBeGreaterThan(mealShares(false).collation)
  })
  it('budgets par repas', () => {
    const b = mealBudgets(2400, { dejeuner: 650 }, false)
    expect(b.find((x) => x.meal === 'dejeuner')).toEqual({ meal: 'dejeuner', target: 840, eaten: 650 })
  })
  it('assiette : veille de sortie longue, récupération, repos', () => {
    expect(plateFor('diner', 'repos', 'soutenu')).toMatchObject({ feculents: 'grosse' })
    expect(plateFor('diner', 'leger', 'repos', 'soir').text).toMatch(/récupération/)
    expect(plateFor('diner', 'repos', 'repos')).toMatchObject({ feculents: 'petite' })
  })
  it('recette dosée selon le budget du repas', () => {
    expect(recipeScale(600, 900)).toBe(1.5)
    expect(recipeScale(600, 700)).toBe(1.25)
    expect(recipeScale(800, 400)).toBe(0.75)
  })
  it('calories de la montre : nettes du métabolisme de base', () => {
    expect(netSessionKcal(450, 45, 1680)).toBe(398) // 450 − 1680 × 45 / 1440 = 397,5
  })
})
